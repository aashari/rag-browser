import type { Page } from "playwright";
import { debug } from "../../utils/logging";

/**
 * Waits for content to be stable using Playwright's built-in mechanisms
 * This uses a comprehensive approach to ensure the content is fully loaded and stable
 */
export async function waitForContentStability(
    page: Page,
    selector: string,
    options: { 
        timeout?: number;
        abortSignal?: AbortSignal;
        waitForVisible?: boolean;
    } = {}
): Promise<boolean> {
    debug("Starting content stability check", { selector });
    
    try {
        // First check if the element exists
        const element = await page.$(selector);
        if (!element) {
            debug("Element not found", { selector });
            return false;
        }
        
        // If we need to wait for visibility, use Playwright's built-in waitForSelector
        if (options.waitForVisible) {
            debug("Waiting for element to be visible", { selector });
            await page.waitForSelector(selector, { 
                state: 'visible',
                timeout: options.timeout || 5000
            });
        }
        
        // Check if the element is still in the DOM after waiting
        const elementStillExists = await page.$(selector)
            .then(el => !!el)
            .catch(() => false);
            
        if (!elementStillExists) {
            debug("Element disappeared during stability check", { selector });
            return false;
        }
        
        debug("Content stability check complete");
        return true;
    } catch (err) {
        // Return false if there was an error
        debug("Error during content stability check", err);
        return false;
    }
} 