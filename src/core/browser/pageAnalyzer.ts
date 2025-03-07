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

// Add a timeout for element operations
const ELEMENT_OPERATION_TIMEOUT = 1000; // Reduced from 2000ms to 1000ms

/**
 * Get a unique selector for an element with timeout
 * @param element The element to get a selector for
 * @returns A unique selector for the element
 */
async function getElementSelector(element: any): Promise<string> {
    const startTime = new Date();
    debug('Starting getElementSelector', { timestamp: startTime.toISOString() });
    
    // Generate a temporary key for caching based on element properties
    try {
        const cacheKey = await Promise.race([
            element.evaluate((el: any) => {
                return `${el.tagName}-${el.id}-${el.className}-${el.name || ''}-${el.type || ''}`;
            }),
            new Promise<string>((_, reject) => {
                setTimeout(() => reject(new Error('getElementSelector cache key timeout')), 500);
            })
        ]);
        
        // Check if we have a cached selector for this element
        if (selectorCache.has(cacheKey)) {
            const cachedSelector = selectorCache.get(cacheKey);
            debug('Completed getElementSelector (cached)', { 
                timestamp: new Date().toISOString(),
                duration: new Date().getTime() - startTime.getTime()
            });
            return cachedSelector as string;
        }
        
        // Try to generate an optimized selector with timeout
        try {
            const optimizedSelector = await Promise.race([
                element.evaluate((el: any) => {
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
                }),
                new Promise<string>((_, reject) => {
                    setTimeout(() => reject(new Error('getElementSelector optimize timeout')), 1000);
                })
            ]);
            
            if (optimizedSelector) {
                // Cache the optimized selector
                selectorCache.set(cacheKey, optimizedSelector);
                
                debug('Completed getElementSelector (optimized)', { 
                    timestamp: new Date().toISOString(),
                    duration: new Date().getTime() - startTime.getTime()
                });
                
                return optimizedSelector;
            }
        } catch (optimizeErr) {
            debug('Optimized selector generation failed, falling back', optimizeErr);
        }
        
        // Fall back to a basic selector
        const basicSelector = await Promise.race([
            element.evaluate((el: any) => el.tagName.toLowerCase()),
            new Promise<string>((_, reject) => {
                setTimeout(() => reject(new Error('getElementSelector basic fallback timeout')), 500);
            })
        ]);
        
        // Cache the result
        selectorCache.set(cacheKey, basicSelector);
        
        debug('Completed getElementSelector (basic fallback)', { 
            timestamp: new Date().toISOString(),
            duration: new Date().getTime() - startTime.getTime()
        });
        
        return basicSelector;
    } catch (error) {
        debug('Error in getElementSelector', { error });
        return 'unknown';
    }
}

/**
 * Prioritize elements based on visibility and interactivity with timeout
 * @param elements Array of element handles to prioritize
 * @param page The page context
 * @param maxElements Maximum number of elements to return after prioritization
 * @returns Array of elements sorted by priority
 */
async function prioritizeElements(elements: ElementHandle[], page: Page, maxElements: number = MAX_ELEMENTS_PER_TYPE): Promise<ElementHandle[]> {
    debug('Prioritizing elements', { count: elements.length, timestamp: new Date().toISOString() });
    
    if (elements.length <= maxElements) {
        debug('Elements prioritized (under limit)', { timestamp: new Date().toISOString() });
        return elements;
    }
    
    // Limit the number of elements to process to avoid excessive processing
    const elementsToProcess = elements.slice(0, Math.min(elements.length, maxElements * 2));
    
    try {
        // Set a timeout for the entire prioritization operation
        const timeoutPromise = new Promise<ElementHandle[]>((resolve) => {
            setTimeout(() => {
                debug('Element prioritization timed out, returning first elements', { 
                    timestamp: new Date().toISOString() 
                });
                resolve(elementsToProcess.slice(0, maxElements));
            }, ELEMENT_OPERATION_TIMEOUT);
        });
        
        // Process elements in batches to improve performance
        const batchSize = 20;
        const elementMetrics: { element: ElementHandle, score: number }[] = [];
        
        for (let i = 0; i < elementsToProcess.length; i += batchSize) {
            const batch = elementsToProcess.slice(i, i + batchSize);
            
            // Process this batch with a timeout
            const batchPromise = Promise.all(batch.map(async (element) => {
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
                    
                    return { 
                        element, 
                        score: typeof metrics === 'number' ? metrics : -1 
                    };
                } catch (e) {
                    return { element, score: -1 };
                }
            }));
            
            // Set a timeout for this batch
            const batchTimeoutPromise = new Promise<{ element: ElementHandle, score: number }[]>((resolve) => {
                setTimeout(() => {
                    resolve(batch.map(element => ({ element, score: 0 })));
                }, 1000);
            });
            
            // Race the batch processing against the timeout
            const batchResults = await Promise.race([batchPromise, batchTimeoutPromise]);
            elementMetrics.push(...batchResults);
        }
        
        // Filter and sort elements
        const visibleElements = elementMetrics.filter(item => item.score > 0);
        const sortedElements = visibleElements.sort((a, b) => b.score - a.score);
        const prioritizedElements = sortedElements.slice(0, maxElements).map(item => item.element);
        
        // Race the entire operation against the timeout
        return await Promise.race([
            Promise.resolve(prioritizedElements),
            timeoutPromise
        ]);
    } catch (err) {
        debug('Error during element prioritization', { error: err });
        return elementsToProcess.slice(0, maxElements);
    }
}

/**
 * Optimized function to collect elements from the page
 * @param page The page to collect elements from
 * @param selector The CSS selector to use
 * @param maxElements Maximum number of elements to collect
 * @returns Array of element information
 */
async function collectElements(page: Page, selector: string, maxElements: number = MAX_ELEMENTS_PER_TYPE): Promise<any[]> {
    debug(`Starting collection for selector: ${selector}`, { timestamp: new Date().toISOString() });
    
    // Create a master timeout to ensure the function always returns
    const masterTimeoutPromise = new Promise<any[]>((resolve) => {
        setTimeout(() => {
            debug(`Master timeout triggered for selector: ${selector}`, { 
                timestamp: new Date().toISOString() 
            });
            resolve([]);
        }, ELEMENT_OPERATION_TIMEOUT * 1.5); // Master timeout is 50% longer than regular timeout
    });
    
    try {
        // Set a timeout for the entire collection operation
        const timeoutPromise = new Promise<any[]>((resolve) => {
            setTimeout(() => {
                debug(`Element collection timed out for selector: ${selector}`, { 
                    timestamp: new Date().toISOString() 
                });
                resolve([]);
            }, ELEMENT_OPERATION_TIMEOUT);
        });
        
        // Get elements with a limit to avoid excessive processing
        // Use a timeout for the element selection
        const elementsPromise = page.$$(selector).catch(err => {
            debug(`Error selecting elements for ${selector}: ${err}`, { timestamp: new Date().toISOString() });
            return [];
        });
        
        // Race the element selection against a timeout
        const elements = await Promise.race([
            elementsPromise,
            new Promise<ElementHandle[]>((resolve) => {
                setTimeout(() => {
                    debug(`Element selection timed out for selector: ${selector}`, { 
                        timestamp: new Date().toISOString() 
                    });
                    resolve([]);
                }, ELEMENT_OPERATION_TIMEOUT / 2); // Half the main timeout
            })
        ]);
        
        debug(`Found ${elements.length} elements for selector: ${selector}`, { timestamp: new Date().toISOString() });
        
        // If no elements found, return empty array immediately
        if (elements.length === 0) {
            return [];
        }
        
        // Take only a limited number of elements to process
        const limitedElements = elements.slice(0, Math.min(elements.length, maxElements * 2));
        
        // Process elements directly without prioritization if there are few of them
        if (limitedElements.length <= 10) {
            const results = await Promise.race([
                Promise.all(limitedElements.map(async (element) => {
                    try {
                        const info = await element.evaluate((el: any) => {
                            const tagName = el.tagName.toLowerCase();
                            const id = el.id || '';
                            const text = el.innerText || el.textContent || el.value || '';
                            const href = el.href || '';
                            const type = el.type || '';
                            const name = el.name || '';
                            const value = el.value || '';
                            const placeholder = el.placeholder || '';
                            const className = el.className || '';
                            const isVisible = el.offsetWidth > 0 && el.offsetHeight > 0;
                            
                            return { 
                                tagName, id, text, href, type, name, 
                                value, placeholder, className, isVisible 
                            };
                        }).catch(() => null);
                        
                        if (!info) return null;
                        
                        return {
                            ...info,
                            selector: info.id ? `#${info.id}` : (info.tagName || 'unknown'),
                            title: info.text || '',
                            url: info.href || ''
                        };
                    } catch (error) {
                        return null;
                    }
                })),
                timeoutPromise
            ]);
            
            return results.filter(Boolean);
        }
        
        // For larger sets, try to prioritize but with a fallback
        try {
            // Try to prioritize elements with a timeout
            const prioritizationPromise = prioritizeElements(limitedElements, page, maxElements);
            const prioritizationTimeoutPromise = new Promise<ElementHandle[]>((resolve) => {
                setTimeout(() => {
                    debug(`Element prioritization timed out for selector: ${selector}`, { 
                        timestamp: new Date().toISOString() 
                    });
                    resolve(limitedElements.slice(0, maxElements));
                }, ELEMENT_OPERATION_TIMEOUT / 2);
            });
            
            const prioritizedElements = await Promise.race([
                prioritizationPromise,
                prioritizationTimeoutPromise
            ]);
            
            // Process elements in smaller batches
            const batchSize = 5; // Reduced from 10
            const results = [];
            
            for (let i = 0; i < Math.min(prioritizedElements.length, maxElements); i += batchSize) {
                // If we've already collected enough elements, stop processing
                if (results.length >= maxElements) {
                    break;
                }
                
                const batch = prioritizedElements.slice(i, i + batchSize);
                
                // Process this batch with a shorter timeout
                const batchPromise = Promise.all(batch.map(async (element) => {
                    try {
                        const info = await element.evaluate((el: any) => {
                            const tagName = el.tagName.toLowerCase();
                            const id = el.id || '';
                            const text = el.innerText || el.textContent || el.value || '';
                            const href = el.href || '';
                            const type = el.type || '';
                            const name = el.name || '';
                            const value = el.value || '';
                            const placeholder = el.placeholder || '';
                            const className = el.className || '';
                            const isVisible = el.offsetWidth > 0 && el.offsetHeight > 0;
                            
                            return { 
                                tagName, id, text, href, type, name, 
                                value, placeholder, className, isVisible 
                            };
                        }).catch(() => null);
                        
                        if (!info) return null;
                        
                        // Use a simpler selector strategy
                        return {
                            ...info,
                            selector: info.id ? `#${info.id}` : (info.tagName || 'unknown'),
                            title: info.text || '',
                            url: info.href || ''
                        };
                    } catch (error) {
                        return null;
                    }
                }));
                
                // Set a timeout for this batch
                const batchTimeoutPromise = new Promise<any[]>((resolve) => {
                    setTimeout(() => {
                        resolve(batch.map(() => null));
                    }, ELEMENT_OPERATION_TIMEOUT / 3); // Even shorter timeout for batches
                });
                
                // Race the batch processing against the timeout
                const batchResults = await Promise.race([batchPromise, batchTimeoutPromise]);
                results.push(...batchResults.filter(Boolean));
            }
            
            // Race the entire operation against the timeout
            return await Promise.race([
                Promise.resolve(results),
                timeoutPromise
            ]);
        } catch (err) {
            debug(`Error in element collection for selector: ${selector}`, { error: err });
            return [];
        }
    } catch (err) {
        debug(`Error collecting elements for selector: ${selector}`, { error: err });
        return [];
    }
    
    // Race everything against the master timeout
    return Promise.race([
        Promise.resolve([]),
        masterTimeoutPromise
    ]);
}

/**
 * Analyze a page to extract its structure and content
 * @param page The page to analyze
 * @returns The page analysis result
 */
export async function analyzePage(page: Page, url: string, options: BrowserOptions, browser: BrowserContext): Promise<PageAnalysis> {
    let actionSucceeded = false;
    let plannedActionResults: PlannedActionResult[] = [];

    try {
        // Note: Navigation to the URL is now handled in the index.ts file
        // We're already on the target page at this point
        
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
        const title = await page.title().catch(() => url);
        let description: string | undefined;
        
        try {
            description = await page.$eval('meta[name="description"]', el => el.getAttribute('content') || '').catch(() => undefined);
        } catch (err) {
            // No description meta tag, that's okay
        }
        debug("Page title and description collected", { timestamp: new Date().toISOString() });

        // Use the optimized collection function
        const elementLimit = options.maxElementsPerType || MAX_ELEMENTS_PER_TYPE;
        
        // Set a timeout for the entire collection process
        const collectionTimeoutPromise = new Promise<{ inputs: any[], buttons: any[], links: any[] }>((resolve) => {
            setTimeout(() => {
                debug(`Overall element collection timed out`, { timestamp: new Date().toISOString() });
                resolve({ inputs: [], buttons: [], links: [] });
            }, ELEMENT_OPERATION_TIMEOUT * 2);
        });
        
        // Collect elements in parallel to improve performance
        const collectionPromise = Promise.all([
            collectElements(page, 'input, select, textarea', elementLimit),
            collectElements(page, 'button, input[type="button"], input[type="submit"], [role="button"]', elementLimit),
            collectElements(page, 'a[href]', elementLimit)
        ]).then(([inputs, buttons, links]) => ({ inputs, buttons, links }));
        
        // Race the collection against the timeout
        const { inputs, buttons, links } = await Promise.race([
            collectionPromise,
            collectionTimeoutPromise
        ]);

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