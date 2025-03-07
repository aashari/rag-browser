import type { Page, BrowserContext, ElementHandle } from "playwright";
import type { PageAnalysis, BrowserOptions, PlannedActionResult, SelectorMode } from "../../types";
import { executePlan } from "../actions";
import { waitForPageStability } from "../stability";
import { getElementInfo, getFullPath } from "../../utils/element";
import { info, error, debug } from "../../utils/logging";
import { DEFAULT_TIMEOUT, LINK_SELECTORS, BUTTON_SELECTORS, INPUT_SELECTORS } from "../../config/constants";

// Add a selector cache to avoid recalculating selectors for the same elements
const selectorCache = new Map<string, string>();

// Add constants for element count limits
const MAX_ELEMENTS_PER_TYPE = 200; // Maximum number of elements to process per type (inputs, buttons, links)
const MAX_ELEMENTS_TOTAL = 500;    // Maximum total elements to process across all types

/**
 * Get a unique selector for an element
 * @param element The element to get a selector for
 * @returns A unique selector for the element
 */
async function getElementSelector(element: any): Promise<string> {
    const startTime = new Date();
    debug('Starting getElementSelector', { timestamp: startTime.toISOString() });
    
    // Generate a temporary key for caching based on element properties
    const cacheKey = await element.evaluate((el: any) => {
        return `${el.tagName}-${el.id}-${el.className}-${el.name || ''}-${el.type || ''}`;
    });
    
    // Check if we have a cached selector for this element
    if (selectorCache.has(cacheKey)) {
        const cachedSelector = selectorCache.get(cacheKey);
        debug('Completed getElementSelector (cached)', { 
            timestamp: new Date().toISOString(),
            duration: new Date().getTime() - startTime.getTime()
        });
        return cachedSelector as string;
    }
    
    try {
        // Try to generate an optimized selector first - this is more efficient
        const optimizedSelector = await element.evaluate((el: any) => {
            // Check for ID (most efficient selector)
            if (el.id) {
                // Make sure ID is unique
                if (document.querySelectorAll(`#${el.id}`).length === 1) {
                    return `#${el.id}`;
                }
            }
            
            // Check for a combination of tag and unique attribute values
            const tag = el.tagName.toLowerCase();
            
            // For inputs, type and name combination can be efficient
            if (tag === 'input' && el.type && el.name) {
                const selector = `${tag}[type="${el.type}"][name="${el.name}"]`;
                if (document.querySelectorAll(selector).length === 1) {
                    return selector;
                }
            }
            
            // Try with a specific class
            if (el.className && typeof el.className === 'string') {
                const classes = el.className.trim().split(/\s+/);
                // Try each class individually
                for (const className of classes) {
                    if (className) {
                        const selector = `${tag}.${className}`;
                        if (document.querySelectorAll(selector).length === 1) {
                            return selector;
                        }
                    }
                }
                
                // Try a combination of tag and two classes
                if (classes.length >= 2) {
                    for (let i = 0; i < classes.length - 1; i++) {
                        for (let j = i + 1; j < classes.length; j++) {
                            if (classes[i] && classes[j]) {
                                const selector = `${tag}.${classes[i]}.${classes[j]}`;
                                if (document.querySelectorAll(selector).length === 1) {
                                    return selector;
                                }
                            }
                        }
                    }
                }
            }
            
            // Return null to indicate we need to use the more expensive full path method
            return null;
        });
        
        if (optimizedSelector) {
            // Cache the optimized selector
            selectorCache.set(cacheKey, optimizedSelector);
            
            debug('Completed getElementSelector (optimized)', { 
                timestamp: new Date().toISOString(),
                duration: new Date().getTime() - startTime.getTime()
            });
            
            return optimizedSelector;
        }
        
        // Fall back to the full path method if optimized selector failed
        const fullPathSelector = await element.evaluate(getFullPath);
        
        // Cache the result
        selectorCache.set(cacheKey, fullPathSelector);
        
        debug('Completed getElementSelector (success)', { 
            timestamp: new Date().toISOString(),
            duration: new Date().getTime() - startTime.getTime()
        });
        
        return fullPathSelector;
    } catch (error) {
        // Fallback to a basic selector if the full path fails
        try {
            const fallbackSelector = await element.evaluate((el: any) => {
                // Simplified selector generation to improve performance
                const tag = el.tagName.toLowerCase();
                const id = el.id ? `#${el.id}` : '';
                const classes = el.className && typeof el.className === 'string' 
                    ? `.${el.className.trim().replace(/\s+/g, '.')}` 
                    : '';
                
                // Use ID if available as it's the most efficient selector
                if (id) return `${tag}${id}`;
                
                // Use classes if available
                if (classes) return `${tag}${classes}`;
                
                // Fallback to tag name with attribute if possible
                if (el.name) return `${tag}[name="${el.name}"]`;
                if (el.type) return `${tag}[type="${el.type}"]`;
                
                // Last resort: just use the tag name
                return tag;
            });
            
            // Cache the fallback result
            selectorCache.set(cacheKey, fallbackSelector);
            
            debug('Completed getElementSelector (fallback)', { 
                timestamp: new Date().toISOString(),
                duration: new Date().getTime() - startTime.getTime()
            });
            
            return fallbackSelector;
        } catch (innerError) {
            // If all else fails, return a very basic selector
            const basicSelector = await element.evaluate((el: any) => el.tagName.toLowerCase());
            
            debug('Completed getElementSelector (basic fallback)', { 
                timestamp: new Date().toISOString(),
                duration: new Date().getTime() - startTime.getTime()
            });
            
            return basicSelector;
        }
    }
}

/**
 * Prioritize elements based on visibility and interactivity
 * @param elements Array of element handles to prioritize
 * @param page The page context
 * @param maxElements Maximum number of elements to return after prioritization
 * @returns Array of elements sorted by priority
 */
async function prioritizeElements(elements: ElementHandle[], page: Page, maxElements: number = MAX_ELEMENTS_PER_TYPE): Promise<ElementHandle[]> {
    debug('Prioritizing elements', { count: elements.length, timestamp: new Date().toISOString() });
    
    if (elements.length <= maxElements) {
        debug('Elements prioritized', { timestamp: new Date().toISOString() });
        return elements;
    }
    
    // Calculate element metrics for prioritization
    const elementMetrics = await Promise.all(elements.map(async (element, index) => {
        try {
            const metrics = await page.evaluate(el => {
                // Check visibility
                const element = el as HTMLElement; // Cast to HTMLElement to access DOM properties
                const rect = element.getBoundingClientRect();
                const computedStyle = window.getComputedStyle(element);
                const isVisible = 
                    rect.width > 0 && 
                    rect.height > 0 && 
                    computedStyle.display !== 'none' && 
                    computedStyle.visibility !== 'hidden' && 
                    computedStyle.opacity !== '0';
                
                if (!isVisible) {
                    return { score: -1 }; // Skip invisible elements
                }
                
                // Check if element is in viewport
                const viewportHeight = window.innerHeight;
                const viewportWidth = window.innerWidth;
                const isInViewport = 
                    rect.top >= 0 && 
                    rect.left >= 0 && 
                    rect.bottom <= viewportHeight && 
                    rect.right <= viewportWidth;
                
                // Check interactivity (inputs, buttons have higher priority)
                const isInteractive = 
                    element.tagName === 'BUTTON' || 
                    element.tagName === 'A' || 
                    element.tagName === 'INPUT' || 
                    element.tagName === 'SELECT' || 
                    element.tagName === 'TEXTAREA' ||
                    element.hasAttribute('onclick') ||
                    element.getAttribute('role') === 'button';
                
                // Get element size (larger elements might be more important)
                const size = rect.width * rect.height;
                
                // Get z-index (elements with higher z-index are usually more important)
                const zIndex = parseInt(computedStyle.zIndex) || 0;
                
                // Calculate position score (elements at top/left are usually more important)
                const positionScore = (1 - (rect.top / viewportHeight)) * 100;
                
                // Calculate final score
                let score = 0;
                score += isInViewport ? 500 : 0;
                score += isInteractive ? 300 : 0;
                score += Math.min(size / 1000, 200); // Cap size score at 200
                score += Math.min(zIndex * 10, 100); // Cap z-index score at 100
                score += positionScore;
                
                return { score, isVisible, isInViewport, isInteractive, size, zIndex, positionScore };
            }, element);
            
            return { element, metrics, index };
        } catch (e) {
            return { element, metrics: { score: -1 }, index };
        }
    }));
    
    // Filter out elements with negative scores (invisible elements)
    const visibleElements = elementMetrics.filter(item => item.metrics.score > 0);
    
    // Sort elements by score (highest first)
    const sortedElements = visibleElements.sort((a, b) => b.metrics.score - a.metrics.score);
    
    // Take top elements up to maxElements
    const prioritizedElements = sortedElements.slice(0, maxElements).map(item => item.element);
    
    debug('Elements prioritized', { timestamp: new Date().toISOString() });
    return prioritizedElements;
}

/**
 * Analyze a page to extract its structure and content
 * @param page The page to analyze
 * @returns The page analysis result
 */
export async function analyzePage(page: Page, url: string, options: BrowserOptions, browser: BrowserContext)
: Promise<PageAnalysis> {
    let actionSucceeded = false;
    let plannedActionResults: PlannedActionResult[] = [];

    try {
        // Navigate to the URL
        info(`Navigating to ${url}`);
        await page.goto(url, {
            timeout: options.timeout || DEFAULT_TIMEOUT,
            waitUntil: 'domcontentloaded',
        });

        // Wait for the page to stabilize with configurable options
        await waitForPageStability(page, { 
            timeout: options.timeout || DEFAULT_TIMEOUT,
            ...options.stabilityOptions
        });

        // If there's a plan, execute it
        if (options.plan) {
            info("Executing plan...");
            const result = await executePlan(page, options.plan, options);
            
            plannedActionResults = result.plannedActionResults || [];
            actionSucceeded = result.actionStatuses.every(status => status.result?.success || false);
            info(`Action succeeded: ${actionSucceeded}`);
            
            if (!actionSucceeded) {
                error("Plan execution failed");
            } else {
                info("Plan execution succeeded");
            }
        }

        // Collect page information
        debug("Collecting page title and description", { timestamp: new Date().toISOString() });
        const title = await page.title();
        let description: string | undefined;
        
        try {
            description = await page.$eval('meta[name="description"]', el => el.getAttribute('content') || '') || undefined;
        } catch (err) {
            // No description meta tag, that's okay
        }
        debug("Page title and description collected", { timestamp: new Date().toISOString() });

        // Use the optimized collection functions with configurable limits
        const elementLimit = options.maxElementsPerType || MAX_ELEMENTS_PER_TYPE;
        const inputs = await collectInputs(page, elementLimit);
        const buttons = await collectButtons(page, elementLimit);
        const links = await collectLinks(page, elementLimit);

        return {
            title,
            description,
            inputs,
            buttons,
            links,
            plannedActions: plannedActionResults.length > 0 ? plannedActionResults : undefined,
            timestamp: Date.now(),
        };
    } catch (err) {
        error("Error during page analysis", err);
        return {
            title: url,
            error: err instanceof Error ? err.message : String(err),
            inputs: [],
            buttons: [],
            links: [],
            plannedActions: plannedActionResults.length > 0 ? plannedActionResults : undefined,
        };
    }
}

/**
 * Collect all input elements from a page
 * @param page The page to collect inputs from
 * @param maxElements Maximum number of input elements to process
 * @returns An array of input elements
 */
async function collectInputs(page: Page, maxElements: number = MAX_ELEMENTS_PER_TYPE): Promise<any[]> {
    debug('Starting input collection', { timestamp: new Date().toISOString() });
    
    // Get all input elements
    const inputElements = await page.$$('input, select, textarea');
    debug(`Found ${inputElements.length} input elements`, { timestamp: new Date().toISOString() });
    
    // Prioritize elements before processing, with a cap on the number to process
    const prioritizedElements = await prioritizeElements(inputElements, page, maxElements);
    
    // Process inputs in batches to improve performance
    const batchSize = 10;
    const inputs = [];
    
    // Early termination check
    const maxElementsToProcess = Math.min(prioritizedElements.length, maxElements);
    
    for (let i = 0; i < maxElementsToProcess; i += batchSize) {
        // If we've already collected enough high-priority inputs, stop processing
        if (inputs.length >= maxElements) {
            debug(`Early termination: Already collected ${inputs.length} high-priority inputs`, 
                  { timestamp: new Date().toISOString() });
            break;
        }
        
        const batch = prioritizedElements.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(async (element: any) => {
            try {
                const info = await page.evaluate((el: any) => {
                    // Extract basic info directly in one evaluation to reduce Playwright calls
                    const tagName = el.tagName.toLowerCase();
                    const id = el.id || '';
                    const name = el.name || '';
                    const type = el.type || '';
                    const value = el.value || '';
                    const placeholder = el.placeholder || '';
                    const className = el.className || '';
                    const isVisible = el.offsetWidth > 0 && el.offsetHeight > 0 && 
                                     getComputedStyle(el).visibility !== 'hidden' &&
                                     getComputedStyle(el).display !== 'none';
                    
                    return { tagName, id, name, type, value, placeholder, className, isVisible };
                }, element);
                
                // Only get selector for visible elements to improve performance
                let selector = '';
                if (info.isVisible) {
                    selector = await getElementSelector(element);
                }
                
                return {
                    ...info,
                    selector
                };
            } catch (error) {
                return null;
            }
        }));
        
        inputs.push(...batchResults.filter(Boolean));
    }
    
    debug(`Processed ${inputs.length} input elements`, { timestamp: new Date().toISOString() });
    return inputs;
}

/**
 * Collect all button elements from a page
 * @param page The page to collect buttons from
 * @param maxElements Maximum number of button elements to process
 * @returns An array of button elements
 */
async function collectButtons(page: Page, maxElements: number = MAX_ELEMENTS_PER_TYPE): Promise<any[]> {
    debug('Starting button collection', { timestamp: new Date().toISOString() });
    
    // Get all button elements
    const buttonElements = await page.$$('button, input[type="button"], input[type="submit"], [role="button"]');
    debug(`Found ${buttonElements.length} button elements`, { timestamp: new Date().toISOString() });
    
    // Prioritize elements before processing, with a cap on the number to process
    const prioritizedElements = await prioritizeElements(buttonElements, page, maxElements);
    
    // Process buttons in batches to improve performance
    const batchSize = 10;
    const buttons = [];
    
    // Early termination check
    const maxElementsToProcess = Math.min(prioritizedElements.length, maxElements);
    
    for (let i = 0; i < maxElementsToProcess; i += batchSize) {
        // If we've already collected enough high-priority buttons, stop processing
        if (buttons.length >= maxElements) {
            debug(`Early termination: Already collected ${buttons.length} high-priority buttons`, 
                  { timestamp: new Date().toISOString() });
            break;
        }
        
        const batch = prioritizedElements.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(async (element: any) => {
            try {
                const info = await page.evaluate((el: any) => {
                    // Extract basic info directly in one evaluation to reduce Playwright calls
                    const tagName = el.tagName.toLowerCase();
                    const id = el.id || '';
                    const text = el.innerText || el.value || '';
                    const className = el.className || '';
                    const isVisible = el.offsetWidth > 0 && el.offsetHeight > 0 && 
                                     getComputedStyle(el).visibility !== 'hidden' &&
                                     getComputedStyle(el).display !== 'none';
                    
                    return { tagName, id, text, className, isVisible };
                }, element);
                
                // Only get selector for visible elements to improve performance
                let selector = '';
                if (info.isVisible) {
                    selector = await getElementSelector(element);
                }
                
                return {
                    ...info,
                    selector
                };
            } catch (error) {
                return null;
            }
        }));
        
        buttons.push(...batchResults.filter(Boolean));
    }
    
    debug(`Processed ${buttons.length} button elements`, { timestamp: new Date().toISOString() });
    return buttons;
}

/**
 * Collect all link elements from a page
 * @param page The page to collect links from
 * @param maxElements Maximum number of link elements to process
 * @returns An array of link elements
 */
async function collectLinks(page: Page, maxElements: number = MAX_ELEMENTS_PER_TYPE): Promise<any[]> {
    debug('Starting link collection', { timestamp: new Date().toISOString() });
    
    // Get all link elements
    const linkElements = await page.$$('a');
    debug(`Found ${linkElements.length} link elements`, { timestamp: new Date().toISOString() });
    
    // Prioritize elements before processing, with a cap on the number to process
    const prioritizedElements = await prioritizeElements(linkElements, page, maxElements);
    
    // Process links in batches to improve performance
    const batchSize = 10;
    const links = [];
    
    // Early termination check
    const maxElementsToProcess = Math.min(prioritizedElements.length, maxElements);
    
    for (let i = 0; i < maxElementsToProcess; i += batchSize) {
        // If we've already collected enough high-priority links, stop processing
        if (links.length >= maxElements) {
            debug(`Early termination: Already collected ${links.length} high-priority links`, 
                  { timestamp: new Date().toISOString() });
            break;
        }
        
        const batch = prioritizedElements.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(async (element: any) => {
            try {
                const info = await page.evaluate((el: any) => {
                    // Extract basic info directly in one evaluation to reduce Playwright calls
                    const tagName = el.tagName.toLowerCase();
                    const id = el.id || '';
                    // Ensure text is never undefined
                    const text = el.innerText || el.textContent || '';
                    const href = el.href || '';
                    const className = el.className || '';
                    const isVisible = el.offsetWidth > 0 && el.offsetHeight > 0 && 
                                     getComputedStyle(el).visibility !== 'hidden' &&
                                     getComputedStyle(el).display !== 'none';
                    
                    return { tagName, id, text, href, className, isVisible };
                }, element);
                
                // Only get selector for visible elements to improve performance
                let selector = '';
                if (info.isVisible) {
                    selector = await getElementSelector(element);
                }
                
                return {
                    ...info,
                    // Ensure title is never undefined
                    title: info.text || '',
                    url: info.href || '',
                    selector
                };
            } catch (error) {
                // Return a valid link object with empty strings instead of null
                return {
                    tagName: 'a',
                    title: '',
                    url: '',
                    selector: '',
                    isVisible: false
                };
            }
        }));
        
        // Filter out any invalid links (no URL or javascript: URLs)
        const validLinks = batchResults.filter(link => 
            link && 
            link.url && 
            !link.url.startsWith('javascript:')
        );
        
        links.push(...validLinks);
    }
    
    debug(`Processed ${links.length} link elements`, { timestamp: new Date().toISOString() });
    return links;
} 