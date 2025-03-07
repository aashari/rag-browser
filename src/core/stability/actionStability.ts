import type { Page } from "playwright";
import {
    ACTION_STABILITY_TIMEOUT,
} from "../../config/constants";
import { debug, warn } from "../../utils/logging";

/**
 * Waits for stability after an action (click, type, etc.) has been performed
 * This is a simplified version that uses basic Playwright methods
 */
export async function waitForActionStability(
    page: Page,
    options: { 
        timeout?: number; 
        expectNavigation?: boolean;
        abortSignal?: AbortSignal;
    } = {}
): Promise<boolean> {
    const timeout = options.timeout || ACTION_STABILITY_TIMEOUT;
    debug("Starting simplified action stability check", { timeout });

    // If we expect navigation, wait for navigation events
    if (options.expectNavigation) {
        try {
            debug("Waiting for navigation to complete");
            await page.waitForLoadState("domcontentloaded", { timeout: Math.min(timeout, 30000) })
                .catch(() => debug("DOMContentLoaded timeout reached, continuing anyway"));
                
            await page.waitForLoadState("networkidle", { timeout: Math.min(timeout, 30000) })
                .catch(() => debug("Network idle timeout reached, continuing anyway"));
            
            debug("Navigation completed");
            return true;
        } catch (err) {
            if (
                err instanceof Error &&
                (err.message.includes("Target closed") || 
                 err.message.includes("context was destroyed") ||
                 err.message.includes("Execution context was destroyed"))
            ) {
                debug("Page context destroyed during navigation");
                return true;
            }
            warn("Error during navigation wait", { error: err instanceof Error ? err.message : String(err) });
            return true;
        }
    }

    // For regular actions, wait a short time for any effects to complete
    try {
        // Wait for any network activity to settle
        debug("Waiting for network to settle after action");
        await page.waitForLoadState("networkidle", { timeout: Math.min(timeout, 5000) })
            .catch(() => debug("Network idle timeout reached, continuing anyway"));
        
        // Wait a short time for any animations or DOM updates
        debug("Waiting for animations and DOM updates");
        await page.waitForTimeout(500);
        
        debug("Action stability check complete");
        return true;
    } catch (err) {
        if (
            err instanceof Error &&
            (err.message.includes("Target closed") || 
             err.message.includes("context was destroyed") ||
             err.message.includes("Execution context was destroyed"))
        ) {
            debug("Page context destroyed during action stability check");
            return true;
        }
        warn("Error during action stability check", { error: err instanceof Error ? err.message : String(err) });
        return true;
    }
} 