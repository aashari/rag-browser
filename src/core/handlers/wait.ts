import type { Page } from "playwright";
import type { WaitAction, ActionResult, BrowserOptions } from "../../types";
import { waitForActionStability } from "../stability";
import { DEFAULT_TIMEOUT } from "../../config/constants";
import { error, info } from "../../utils/logging";

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
    } finally {
        // Clean up abort controller
        if (abortController) {
            abortController.abort();
        }
        
        // Remove navigation listener
        page.removeListener('framenavigated', handleNavigation);
    }
} 