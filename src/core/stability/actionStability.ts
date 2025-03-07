import type { Page } from "playwright";
import {
    ACTION_STABILITY_TIMEOUT,
    NETWORK_IDLE_TIMEOUT,
} from "../../config/constants";
import { debug, warn } from "../../utils/logging";
import type { StabilityOptions } from "./pageStability";
import { getLastUserInteractionTime } from "../browser/eventHandlers";

/**
 * Default action stability options
 */
const DEFAULT_ACTION_STABILITY_OPTIONS: StabilityOptions = {
    timeout: ACTION_STABILITY_TIMEOUT,
    expectNavigation: false,
    waitForNetworkIdle: true,
    networkIdleTimeout: 5000, // Shorter timeout for actions
    waitForAnimations: true,
    animationSettleTime: 500
};

/**
 * Waits for stability after an action (click, type, etc.) has been performed
 * This is a simplified version that uses basic Playwright methods
 */
export async function waitForActionStability(
    page: Page,
    options: StabilityOptions = {}
): Promise<boolean> {
    // Merge provided options with defaults
    const stabilityOptions = { ...DEFAULT_ACTION_STABILITY_OPTIONS, ...options };
    const {
        timeout,
        expectNavigation,
        abortSignal,
        waitForNetworkIdle,
        networkIdleTimeout,
        waitForAnimations,
        animationSettleTime
    } = stabilityOptions;
    
    debug("Starting simplified action stability check", { 
        timeout,
        expectNavigation,
        waitForNetworkIdle,
        waitForAnimations
    });

    // Track the last user interaction time
    let lastInteractionTimeAtStart = getLastUserInteractionTime();

    // If we expect navigation, wait for navigation events
    if (expectNavigation) {
        try {
            debug("Waiting for navigation to complete");
            await page.waitForLoadState("domcontentloaded", { timeout: Math.min(timeout || ACTION_STABILITY_TIMEOUT, 30000) })
                .catch(() => {
                    // Check if user interaction occurred during this wait
                    if (getLastUserInteractionTime() > lastInteractionTimeAtStart) {
                        debug("User interaction detected during navigation wait, continuing");
                        lastInteractionTimeAtStart = getLastUserInteractionTime();
                    } else {
                        debug("DOMContentLoaded timeout reached, continuing anyway");
                    }
                });
                
            if (waitForNetworkIdle) {
                await page.waitForLoadState("networkidle", { timeout: Math.min(timeout || ACTION_STABILITY_TIMEOUT, 30000) })
                    .catch(() => {
                        // Check if user interaction occurred during this wait
                        if (getLastUserInteractionTime() > lastInteractionTimeAtStart) {
                            debug("User interaction detected during networkidle wait, continuing");
                            lastInteractionTimeAtStart = getLastUserInteractionTime();
                        } else {
                            debug("Network idle timeout reached, continuing anyway");
                        }
                    });
            }
            
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
        // Wait for any network activity to settle if configured
        if (waitForNetworkIdle) {
            debug("Waiting for network to settle after action");
            await page.waitForLoadState("networkidle", { 
                timeout: Math.min(networkIdleTimeout || 5000, 10000) 
            }).catch(() => {
                // Check if user interaction occurred during this wait
                if (getLastUserInteractionTime() > lastInteractionTimeAtStart) {
                    debug("User interaction detected during network wait, continuing");
                    lastInteractionTimeAtStart = getLastUserInteractionTime();
                } else {
                    debug("Network idle timeout reached, continuing anyway");
                }
            });
        }
        
        // Wait for animations to complete if configured
        if (waitForAnimations && animationSettleTime) {
            debug(`Waiting for animations and DOM updates`);
            await page.waitForTimeout(animationSettleTime);
        }
        
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