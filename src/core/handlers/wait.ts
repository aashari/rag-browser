import type { Page } from "playwright";
import type { WaitAction, ActionResult, BrowserOptions } from "../../types";
import { waitForActionStability } from "../stability";
import { DEFAULT_TIMEOUT } from "../../config/constants";
import { error, info, debug } from "../../utils/logging";
import { captureElementsHtml } from "./print";
import { generateFallbackSelectorChain, discoverContentSelectors, findBestSelectorForContent } from "../selectors";
import { identifyMainContent } from "../analysis";

export async function executeWaitAction(
    page: Page,
    action: WaitAction,
    options: BrowserOptions
): Promise<ActionResult> {
    // Use action-specific timeout if provided, otherwise use global options
    const isInfiniteWait = action.timeout === -1 || options.timeout === -1;
    const timeout = isInfiniteWait ? 0 : (action.timeout || options.timeout || DEFAULT_TIMEOUT);
    let abortController: AbortController | undefined;
    
    // Track initial URL to detect navigation
    const initialUrl = page.url();
    let navigationDetected = false;
    let finalUrl = initialUrl;
    
    // Function to handle navigation events
    const handleNavigation = async (frame: any) => {
        if (frame === page.mainFrame()) {
            const currentUrl = frame.url();
            if (currentUrl !== initialUrl) {
                navigationDetected = true;
                finalUrl = currentUrl;
                info('Navigation detected during wait', { from: initialUrl, to: currentUrl });
            }
        }
    };
    
    // Set up navigation listener
    page.on('framenavigated', handleNavigation);

    try {
        if (!isInfiniteWait) {
            // Create a timeout promise
            const timeoutPromise = new Promise<ActionResult>((_, reject) => {
                setTimeout(() => {
                    if (navigationDetected) {
                        // If we navigated, don't reject with timeout
                        return;
                    }
                    reject(new Error(`Timeout ${timeout}ms exceeded.`));
                }, timeout);
            });
            
            // Create a navigation success promise
            const navigationPromise = new Promise<ActionResult>((resolve) => {
                const checkInterval = setInterval(() => {
                    if (navigationDetected) {
                        clearInterval(checkInterval);
                        resolve({
                            success: true,
                            message: `Navigation detected to: ${finalUrl}`,
                            warning: `Original elements "${action.elements.join(', ')}" not found; navigation occurred to ${finalUrl}`,
                            data: [{
                                type: 'print',
                                selector: '',
                                html: `<p>Navigated to: ${finalUrl}</p>`,
                                format: 'html'
                            }]
                        });
                    }
                }, 500);
                
                // Clean up interval after timeout
                setTimeout(() => clearInterval(checkInterval), timeout);
            });
            
            // Create element wait promise
            const elementPromise = Promise.all(
                action.elements.map(async (selector) => {
                    await page.waitForSelector(selector, { timeout });
                })
            ).then(() => ({
                success: true,
                message: "Elements found",
            }));
            
            // Race all promises
            const result = await Promise.race([
                elementPromise,
                navigationPromise,
                timeoutPromise
            ]);
            
            // If we got a successful result and it's not from navigation
            if (result.success && !('warning' in result && result.warning)) {
                const isStable = await waitForActionStability(page, { 
                    timeout: isInfiniteWait ? undefined : timeout,
                    abortSignal: abortController?.signal
                }).catch(() => false);
                
                // Mark the action as completed
                action.completed = true;

                return {
                    success: true,
                    message: "Elements found and stable",
                    warning: !isStable ? "Page not fully stable, but elements are present" : undefined,
                };
            }
            
            return result;
        } else {
            // Infinite wait - keep retrying until element is found
            abortController = new AbortController();
            const signal = abortController.signal;

            // Log that we're in infinite wait mode
            info("Starting infinite wait for elements", { elements: action.elements.join(", ") });

            while (!signal.aborted) {
                try {
                    // Check if navigation occurred
                    if (navigationDetected) {
                        return {
                            success: true,
                            message: `Navigation detected to: ${finalUrl}`,
                            warning: `Original elements "${action.elements.join(', ')}" not found; navigation occurred to ${finalUrl}`,
                            data: [{
                                type: 'print',
                                selector: '',
                                html: `<p>Navigated to: ${finalUrl}</p>`,
                                format: 'html'
                            }]
                        };
                    }
                    
                    await Promise.all(
                        action.elements.map(async (selector) => {
                            await page.waitForSelector(selector, { timeout: 1000 });
                        })
                    );
                    // If we get here, all elements were found
                    break;
                } catch (_err) {
                    if (signal.aborted) {
                        throw new Error("Wait operation interrupted");
                    }
                    // Element not found, wait a bit and retry
                    await page.waitForTimeout(1000);
                    continue;
                }
            }
        }

        const isStable = await waitForActionStability(page, { 
            timeout: isInfiniteWait ? undefined : timeout,
            abortSignal: abortController?.signal
        }).catch(() => false);

        // Mark the action as completed
        action.completed = true;

        return {
            success: true,
            message: "Elements found and stable",
            warning: !isStable ? "Page not fully stable, but elements are present" : undefined,
        };
    } catch (err) {
        error('Error in wait action', { error: err instanceof Error ? err.message : String(err) });
        
        // If navigation occurred but element waiting failed, return navigation success
        if (navigationDetected) {
            return {
                success: true,
                message: `Navigation detected to: ${finalUrl}`,
                warning: `Original elements "${action.elements.join(', ')}" not found; navigation occurred to ${finalUrl}`,
                data: [{
                    type: 'print',
                    selector: '',
                    html: `<p>Navigated to: ${finalUrl}</p>`,
                    format: 'html'
                }]
            };
        }
        
        // Try to find alternative selectors using our new selector discovery
        debug("Original selectors not found, attempting to discover alternatives");
        
        try {
            // First, try to generate fallback selectors for each original selector
            const fallbackResults = await Promise.all(
                action.elements.map(async (selector) => {
                    try {
                        return await generateFallbackSelectorChain(page, selector);
                    } catch (e) {
                        return [];
                    }
                })
            );
            
            // Flatten and deduplicate fallback selectors
            const fallbackSelectors = [...new Set(fallbackResults.flat())];
            
            if (fallbackSelectors.length > 0) {
                debug(`Generated ${fallbackSelectors.length} fallback selectors`);
                
                // Try each fallback selector
                for (const fallbackSelector of fallbackSelectors) {
                    try {
                        const exists = await page.$(fallbackSelector).then(Boolean);
                        if (exists) {
                            debug(`Found matching fallback selector: ${fallbackSelector}`);
                            
                            // Capture content from the fallback selector
                            const fallbackContent = await captureElementsHtml(
                                page, 
                                [fallbackSelector], 
                                'markdown',
                                options
                            );
                            
                            return {
                                success: true,
                                message: `Found alternative element with selector: ${fallbackSelector}`,
                                warning: `Original selectors "${action.elements.join(', ')}" not found; using fallback selector "${fallbackSelector}"`,
                                data: [fallbackContent]
                            };
                        }
                    } catch (e) {
                        // Invalid selector, skip
                    }
                }
            }
            
            // If fallback selectors didn't work, try to discover content selectors
            debug("Fallback selectors not found, attempting to discover content");
            const discoveredSelectors = await discoverContentSelectors(page);
            
            if (discoveredSelectors.length > 0) {
                debug(`Discovered ${discoveredSelectors.length} potential content selectors`);
                
                // Try each discovered selector, starting with highest confidence
                for (const { selector, confidence, type } of discoveredSelectors) {
                    try {
                        const exists = await page.$(selector).then(Boolean);
                        if (exists) {
                            debug(`Found matching discovered selector: ${selector} (${type}, confidence: ${confidence})`);
                            
                            // Capture content from the discovered selector
                            const discoveredContent = await captureElementsHtml(
                                page, 
                                [selector], 
                                'markdown',
                                options
                            );
                            
                            return {
                                success: true,
                                message: `Found ${type} content with selector: ${selector}`,
                                warning: `Original selectors "${action.elements.join(', ')}" not found; discovered ${type} content with confidence ${confidence.toFixed(2)}`,
                                data: [discoveredContent]
                            };
                        }
                    } catch (e) {
                        // Invalid selector, skip
                    }
                }
            }
            
            // If all else fails, try to identify the main content
            debug("Discovered selectors not found, attempting to identify main content");
            const mainContent = await identifyMainContent(page);
            
            if (mainContent && mainContent.selector) {
                debug(`Identified main content with selector: ${mainContent.selector} (confidence: ${mainContent.confidence})`);
                
                // Capture content from the main content selector
                const mainContentResult = await captureElementsHtml(
                    page, 
                    [mainContent.selector], 
                    'markdown',
                    options
                );
                
                return {
                    success: true,
                    message: `Identified main content with selector: ${mainContent.selector}`,
                    warning: `Original selectors "${action.elements.join(', ')}" not found; identified main content with confidence ${mainContent.confidence.toFixed(2)}`,
                    data: [mainContentResult]
                };
            }
        } catch (discoveryErr) {
            debug(`Error during selector discovery: ${discoveryErr instanceof Error ? discoveryErr.message : String(discoveryErr)}`);
        }
        
        // When elements aren't found, extract broader page content to help AI understand the context
        try {
            // Try to capture content from broader selectors to give context
            const fallbackResult = await captureElementsHtml(
                page, 
                ['h1', 'main', '#content', '.content', 'body'], 
                'markdown',
                options
            );
            
            // Get current page title for additional context
            const pageTitle = await page.title();
            
            // Get a simplified element tree to help understand page structure
            const elementTree = await page.evaluate(() => {
                // Create a simplified tree representation of main page elements
                function getSimplifiedTree(element: Element, depth = 0, maxDepth = 2) {
                    if (depth > maxDepth) return '...';
                    
                    const tagName = element.tagName.toLowerCase();
                    const id = element.id ? `#${element.id}` : '';
                    const className = Array.from(element.classList).join('.');
                    const classSelector = className ? `.${className}` : '';
                    
                    // Get relevant attributes
                    const dataAttrs = Array.from(element.attributes)
                        .filter((attr: Attr) => attr.name.startsWith('data-'))
                        .map((attr: Attr) => `[${attr.name}="${attr.value}"]`)
                        .join('');
                    
                    // Build identifier string
                    const identifier = `${tagName}${id}${classSelector}${dataAttrs}`;
                    
                    // Build children tree (limited depth)
                    let children = '';
                    if (depth < maxDepth && element.children.length > 0) {
                        children = '\n' + Array.from(element.children)
                            .map(child => '  '.repeat(depth + 1) + getSimplifiedTree(child, depth + 1, maxDepth))
                            .join('\n');
                    }
                    
                    return `${identifier}${children}`;
                }
                
                // Start from body and build a simplified tree
                return getSimplifiedTree(document.body);
            });
            
            return {
                success: false,
                message: "Failed to find requested elements. View the extracted content to understand the current page.",
                error: err instanceof Error ? err.message : "Unknown error occurred",
                data: [
                    fallbackResult,
                    {
                        type: 'print',
                        selector: 'page-structure',
                        html: `<h3>Page Structure</h3><p>Current page title: "${pageTitle}"</p><pre><code>${elementTree}</code></pre>`,
                        format: 'html'
                    }
                ],
                warning: `Try using broader selectors to see what's on the page. Current URL: "${page.url()}"`
            };
        } catch (fallbackErr) {
            // If even the fallback content extraction fails, return the original error
            if (isInfiniteWait) {
                return {
                    success: false,
                    message: "Infinite wait interrupted",
                    error: err instanceof Error ? err.message : "Unknown error occurred",
                };
            }
            return {
                success: false,
                message: "Failed to find elements",
                error: err instanceof Error ? err.message : "Unknown error occurred",
            };
        }
    } finally {
        // Clean up abort controller
        if (abortController) {
            abortController.abort();
        }
        
        // Remove navigation listener
        page.removeListener('framenavigated', handleNavigation);
    }
} 