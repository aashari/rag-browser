import type { Page } from "playwright";
import {
    DEFAULT_TIMEOUT,
    LOADING_INDICATORS,
    NETWORK_IDLE_TIMEOUT,
} from "../../config/constants";
import { debug, info, warn } from "../../utils/logging";

/**
 * Waits for a page to become stable
 * This is a simplified version that uses basic Playwright methods
 */
export async function waitForPageStability(
    page: Page,
    options: { 
        timeout?: number; 
        expectNavigation?: boolean;
        abortSignal?: AbortSignal;
    } = {}
): Promise<boolean> {
    const timeout = options.timeout || DEFAULT_TIMEOUT;
    debug("Starting simplified page stability check", { timeout });

    try {
        // Wait for the page to load
        debug("Waiting for domcontentloaded state");
        await page.waitForLoadState("domcontentloaded", { timeout: Math.min(timeout, 30000) })
            .catch(() => debug("DOMContentLoaded timeout reached, continuing anyway"));
        
        // Wait for network to be idle
        debug("Waiting for networkidle state");
        await page.waitForLoadState("networkidle", { timeout: Math.min(timeout, 30000) })
            .catch(() => debug("Network idle timeout reached, continuing anyway"));
        
        // Check for loading indicators once after network is idle
        debug("Checking for loading indicators");
        const hasLoadingIndicators = await page.$(LOADING_INDICATORS)
            .then(el => !!el)
            .catch(() => false);
            
        if (hasLoadingIndicators) {
            debug("Loading indicators found, but continuing anyway after network idle");
        }
        
        // Wait a bit more for any animations to complete
        await page.waitForTimeout(500);
        
        debug("Page stability check complete");
        return true;
    } catch (err) {
        if (err instanceof Error && 
            (err.message.includes("Target closed") || 
             err.message.includes("context was destroyed") ||
             err.message.includes("Execution context was destroyed"))) {
            debug("Page context destroyed during stability check");
            if (options.expectNavigation) {
                return true;
            }
            // Don't throw, just return true to allow the process to continue
            return true;
        }
        
        warn("Error during stability check", { error: err instanceof Error ? err.message : String(err) });
        return true; // Return true to allow the process to continue
    }
} 