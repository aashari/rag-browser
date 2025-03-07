import type { Page } from "playwright";
import { debug } from "../../utils/logging";

/**
 * Simplified function to check if content is stable
 * Only performs a basic check with minimal waiting
 */
export async function waitForContentStability(
    page: Page,
    selector: string,
    options: { 
        timeout?: number;
        abortSignal?: AbortSignal;
    } = {}
): Promise<boolean> {
    debug("Starting simplified content stability check", { selector });
    
    try {
        // Check if the element exists
        const element = await page.$(selector);
        if (!element) {
            debug("Element not found", { selector });
            return false;
        }
        
        // Simple fixed wait
        await page.waitForTimeout(300);
        
        debug("Content stability check complete");
        return true;
    } catch (err) {
        // Return false if there was an error
        debug("Error during content stability check, continuing anyway");
        return false;
    }
} 