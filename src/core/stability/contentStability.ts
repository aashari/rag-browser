import type { Page } from "playwright";
import { debug, warn } from "../../utils/logging";
import { CONTENT_STABILITY_TIMEOUT } from "../../config/constants";

/**
 * Waits for content stability on a specific element
 * This is a simplified version that uses basic Playwright methods without page modification
 */
export async function waitForContentStability(
    page: Page,
    selector: string,
    options: { 
        timeout?: number;
        abortSignal?: AbortSignal;
    } = {}
): Promise<boolean> {
    const timeout = options.timeout || CONTENT_STABILITY_TIMEOUT;
    const startTime = Date.now();
    
    debug("Starting content stability check", { selector, timeout });
    
    try {
        // First check if the element exists
        const element = await page.$(selector);
        if (!element) {
            debug("Element not found", { selector });
            return false;
        }
        
        // Take a snapshot of the element's content
        const initialContent = await element.textContent().catch(() => "");
        
        // Wait a short time
        await page.waitForTimeout(500);
        
        // Check if the content has changed
        const currentContent = await element.textContent().catch(() => "");
        
        if (initialContent !== currentContent) {
            debug("Content changed during stability check", { selector });
            return false;
        }
        
        debug("Content appears stable", { selector });
        return true;
    } catch (err) {
        if (err instanceof Error && 
            (err.message.includes("Target closed") || 
             err.message.includes("context was destroyed") ||
             err.message.includes("Execution context was destroyed"))) {
            debug("Page context destroyed during content stability check");
            return false;
        }
        
        warn("Error during content stability check", { error: err instanceof Error ? err.message : String(err) });
        return false;
    }
} 