import type { Page, BrowserContext, ElementHandle } from "playwright";
import type { PageAnalysis, BrowserOptions, PlannedActionResult, SelectorMode } from "../../types";
import { executePlan } from "../actions";
import { waitForPageStability } from "../stability";
import { getElementInfo, getFullPath } from "../../utils/element";
import { info, error, debug } from "../../utils/logging";
import { DEFAULT_TIMEOUT, LINK_SELECTORS, BUTTON_SELECTORS, INPUT_SELECTORS } from "../../config/constants";

// Add constants for element count limits
const MAX_ELEMENTS_PER_TYPE = 200; // Maximum number of elements to process per type (inputs, buttons, links)
const MAX_ELEMENTS_TOTAL = 500;    // Maximum total elements to process across all types

/**
 * Simplified function to collect elements from the page using Playwright's built-in waiting
 * @param page The page to collect elements from
 * @param selector The CSS selector to use
 * @param maxElements Maximum number of elements to collect
 * @returns Array of element information
 */
async function collectElements(page: Page, selector: string, maxElements: number = MAX_ELEMENTS_PER_TYPE): Promise<any[]> {
    debug(`Starting collection for selector: ${selector}`, { timestamp: new Date().toISOString() });
    
    try {
        // First, check if the selector exists on the page with a reasonable timeout
        const selectorExists = await page.$(selector)
            .then(element => !!element)
            .catch(() => false);
            
        if (!selectorExists) {
            debug(`No elements found for selector: ${selector}`, { timestamp: new Date().toISOString() });
            return [];
        }
        
        // Use Playwright's built-in $$eval which is designed for this purpose
        // This evaluates a function on all elements matching the selector
        const elements = await page.$$eval(selector, (domElements, maxElementsArg) => {
            // Limit the number of elements to process
            const limitedElements = domElements.slice(0, maxElementsArg);
            
            return limitedElements.map(el => {
                // Extract basic information from each element
                const tagName = el.tagName.toLowerCase();
                const id = el.id || '';
                const text = el.textContent?.trim() || '';
                const href = (el as HTMLAnchorElement).href || '';
                const type = (el as HTMLInputElement).type || '';
                const name = (el as HTMLInputElement).name || '';
                const value = (el as HTMLInputElement).value || '';
                const placeholder = (el as HTMLInputElement).placeholder || '';
                
                // Calculate visibility
                const rect = el.getBoundingClientRect();
                const isVisible = rect.width > 0 && rect.height > 0;
                
                // Create a simple selector
                let selector = '';
                if (id) {
                    selector = `#${id}`;
                } else if (name) {
                    selector = `${tagName}[name="${name}"]`;
                } else if (type) {
                    selector = `${tagName}[type="${type}"]`;
                } else {
                    selector = tagName;
                }
                
                return {
                    tagName,
                    id,
                    text,
                    href,
                    type,
                    name,
                    value,
                    placeholder,
                    isVisible,
                    selector,
                    title: text || '',
                    url: href || ''
                };
            });
        }, maxElements).catch(err => {
            debug(`Error evaluating elements for selector: ${selector}`, { error: err });
            return [];
        });
        
        debug(`Collected ${elements.length} elements for selector: ${selector}`, { 
            timestamp: new Date().toISOString() 
        });
        
        return elements;
    } catch (err) {
        debug(`Error collecting elements for selector: ${selector}`, { error: err });
        return [];
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

        // Use the simplified collection function
        const elementLimit = options.maxElementsPerType || MAX_ELEMENTS_PER_TYPE;
        
        // Collect elements in parallel to improve performance
        const [inputs, buttons, links] = await Promise.all([
            collectElements(page, INPUT_SELECTORS, elementLimit),
            collectElements(page, BUTTON_SELECTORS, elementLimit),
            collectElements(page, LINK_SELECTORS, elementLimit)
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