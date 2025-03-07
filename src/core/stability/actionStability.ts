import type { Page } from "playwright";
import { ACTION_STABILITY_TIMEOUT } from "../../config/constants";
import { debug } from "../../utils/logging";
import type { StabilityOptions } from "./pageStability";
import { getLastUserInteractionTime } from "../browser/eventHandlers";

/**
 * Default action stability options
 */
const DEFAULT_ACTION_STABILITY_OPTIONS: StabilityOptions = {
    timeout: ACTION_STABILITY_TIMEOUT,
    expectNavigation: false
};

/**
 * Simplified function to wait for stability after an action
 * Only performs basic checks with minimal waiting
 */
export async function waitForActionStability(
    page: Page,
    options: StabilityOptions = {}
): Promise<boolean> {
    // Merge provided options with defaults
    const stabilityOptions = { ...DEFAULT_ACTION_STABILITY_OPTIONS, ...options };
    const { timeout, expectNavigation } = stabilityOptions;
    
    debug("Starting simplified action stability check");

    try {
        // Track user interaction time
        const lastInteractionTimeAtStart = getLastUserInteractionTime();

        // If we expect navigation, wait for domcontentloaded
        if (expectNavigation) {
            debug("Waiting for navigation to complete");
            await page.waitForLoadState("domcontentloaded", { 
                timeout: Math.min(timeout || ACTION_STABILITY_TIMEOUT, 30000) 
            }).catch(() => {
                // Check if user interaction occurred during this wait
                if (getLastUserInteractionTime() > lastInteractionTimeAtStart) {
                    debug("User interaction detected during wait, continuing");
                } else {
                    debug("DOMContentLoaded timeout reached, continuing anyway");
                }
            });
        }
        
        // Simple fixed wait to allow for any final rendering
        await page.waitForTimeout(300);
        
        debug("Action stability check complete");
        return true;
    } catch (err) {
        // Always return true to allow the process to continue
        debug("Error during action stability check, continuing anyway");
        return true;
    }
} 