import type { Page } from "playwright";
import { DEFAULT_TIMEOUT } from "../../config/constants";
import { debug, info } from "../../utils/logging";
import { getLastUserInteractionTime } from "../browser/eventHandlers";

/**
 * Configuration options for page stability checks
 */
export interface StabilityOptions {
    /** Overall timeout for stability checks in milliseconds */
    timeout?: number;
    /** Whether to expect navigation during the stability check */
    expectNavigation?: boolean;
    /** Signal to abort the stability check */
    abortSignal?: AbortSignal;
}

/**
 * Default stability options
 */
const DEFAULT_STABILITY_OPTIONS: StabilityOptions = {
    timeout: DEFAULT_TIMEOUT,
    expectNavigation: false
};

/**
 * Simplified function to wait for a page to become stable
 * Only waits for essential load states and a short timeout
 */
export async function waitForPageStability(
    page: Page,
    options: StabilityOptions = {}
): Promise<boolean> {
    // Merge provided options with defaults
    const stabilityOptions = { ...DEFAULT_STABILITY_OPTIONS, ...options };
    const { timeout, expectNavigation } = stabilityOptions;
    
    debug("Starting simplified page stability check");

    try {
        // Track user interaction time
        const lastInteractionTimeAtStart = getLastUserInteractionTime();
        
        // Wait for the page to load (domcontentloaded is the most essential state)
        debug("Waiting for domcontentloaded state");
        await page.waitForLoadState("domcontentloaded", { 
            timeout: Math.min(timeout || DEFAULT_TIMEOUT, 30000) 
        }).catch(() => {
            // Check if user interaction occurred during this wait
            if (getLastUserInteractionTime() > lastInteractionTimeAtStart) {
                debug("User interaction detected during wait, continuing");
            } else {
                debug("DOMContentLoaded timeout reached, continuing anyway");
            }
        });
        
        // Simple fixed wait to allow for any final rendering
        await page.waitForTimeout(300);
        
        debug("Page stability check complete");
        return true;
    } catch (err) {
        // Always return true to allow the process to continue
        debug("Error during stability check, continuing anyway");
        return true;
    }
} 