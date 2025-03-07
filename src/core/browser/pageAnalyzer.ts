import type { Page, BrowserContext, ElementHandle } from "playwright";
import type { PageAnalysis, BrowserOptions, PlannedActionResult, SelectorMode } from "../../types";
import { executePlan } from "../actions";
import { waitForPageStability } from "../stability";
import { getElementInfo, getFullPath } from "../../utils/element";
import { info, error, debug } from "../../utils/logging";
import { DEFAULT_TIMEOUT, LINK_SELECTORS, BUTTON_SELECTORS, INPUT_SELECTORS } from "../../config/constants";

// Add a selector cache to avoid recalculating selectors for the same elements
const selectorCache = new Map<string, string>();

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
        // Try to get a full path using the utility function
        const selector = await element.evaluate(getFullPath);
        
        // Cache the result
        selectorCache.set(cacheKey, selector);
        
        debug('Completed getElementSelector (success)', { 
            timestamp: new Date().toISOString(),
            duration: new Date().getTime() - startTime.getTime()
        });
        
        return selector;
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
 * Analyze a page to extract its structure and content
 * @param page The page to analyze
 * @returns The page analysis result
 */
export async function analyzePage(page: Page, url: string, options: BrowserOptions, browser: BrowserContext): Promise<PageAnalysis> {
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

        // Collect form inputs
        debug("Starting input collection", { timestamp: new Date().toISOString() });
        const inputElements = await page.$$(INPUT_SELECTORS);
        debug(`Found ${inputElements.length} input elements`, { timestamp: new Date().toISOString() });
        const inputs = [];
        
        for (const element of inputElements) {
            const info = await getElementInfo(page, element);
            if (info) inputs.push(info);
        }
        debug(`Processed ${inputs.length} input elements`, { timestamp: new Date().toISOString() });

        // Collect buttons
        debug("Starting button collection", { timestamp: new Date().toISOString() });
        const buttonElements = await page.$$(BUTTON_SELECTORS);
        debug(`Found ${buttonElements.length} button elements`, { timestamp: new Date().toISOString() });
        const buttons = [];
        
        for (const element of buttonElements) {
            try {
                const text = await element.evaluate(el => el.textContent?.trim() || '');
                const selector = await getElementSelector(element);
                
                if (selector) {
                    buttons.push({ text, selector });
                }
            } catch (err) {
                // Skip this button if there's an error
            }
        }
        debug(`Processed ${buttons.length} button elements`, { timestamp: new Date().toISOString() });

        // Collect links
        debug("Starting link collection", { timestamp: new Date().toISOString() });
        const linkElements = await page.$$(LINK_SELECTORS);
        debug(`Found ${linkElements.length} link elements`, { timestamp: new Date().toISOString() });
        const links = [];
        
        for (const element of linkElements) {
            try {
                const title = await element.evaluate(el => el.textContent?.trim() || '');
                const url = await element.evaluate(el => el.getAttribute('href') || '');
                const selector = await getElementSelector(element);
                
                if (selector && url && !url.startsWith('javascript:')) {
                    links.push({ title, url, selector });
                }
            } catch (err) {
                // Skip this link if there's an error
            }
        }
        debug(`Processed ${links.length} link elements`, { timestamp: new Date().toISOString() });

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
 * @returns An array of input elements
 */
async function collectInputs(page: Page): Promise<any[]> {
    debug('Starting input collection', { timestamp: new Date().toISOString() });
    
    // Get all input elements
    const inputElements = await page.$$('input, select, textarea');
    debug(`Found ${inputElements.length} input elements`, { timestamp: new Date().toISOString() });
    
    // Process inputs in batches to improve performance
    const batchSize = 10;
    const inputs = [];
    
    for (let i = 0; i < inputElements.length; i += batchSize) {
        const batch = inputElements.slice(i, i + batchSize);
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
 * @returns An array of button elements
 */
async function collectButtons(page: Page): Promise<any[]> {
    debug('Starting button collection', { timestamp: new Date().toISOString() });
    
    // Get all button elements
    const buttonElements = await page.$$('button, input[type="button"], input[type="submit"], [role="button"]');
    debug(`Found ${buttonElements.length} button elements`, { timestamp: new Date().toISOString() });
    
    // Process buttons in batches to improve performance
    const batchSize = 10;
    const buttons = [];
    
    for (let i = 0; i < buttonElements.length; i += batchSize) {
        const batch = buttonElements.slice(i, i + batchSize);
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
 * @returns An array of link elements
 */
async function collectLinks(page: Page): Promise<any[]> {
    debug('Starting link collection', { timestamp: new Date().toISOString() });
    
    // Get all link elements
    const linkElements = await page.$$('a');
    debug(`Found ${linkElements.length} link elements`, { timestamp: new Date().toISOString() });
    
    // Process links in batches to improve performance
    const batchSize = 10;
    const links = [];
    
    for (let i = 0; i < linkElements.length; i += batchSize) {
        const batch = linkElements.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(async (element: any) => {
            try {
                const info = await page.evaluate((el: any) => {
                    // Extract basic info directly in one evaluation to reduce Playwright calls
                    const tagName = el.tagName.toLowerCase();
                    const id = el.id || '';
                    const text = el.innerText || '';
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
                    selector
                };
            } catch (error) {
                return null;
            }
        }));
        
        links.push(...batchResults.filter(Boolean));
    }
    
    debug(`Processed ${links.length} link elements`, { timestamp: new Date().toISOString() });
    return links;
} 