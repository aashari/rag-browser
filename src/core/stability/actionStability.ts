import type { Page } from "playwright";
import { ACTION_STABILITY_TIMEOUT, NETWORK_IDLE_TIMEOUT } from "../../config/constants";
import { debug } from "../../utils/logging";
import type { StabilityOptions } from "./pageStability";
import { getLastUserInteractionTime } from "../browser/eventHandlers";

/**
 * Default action stability options
 */
const DEFAULT_ACTION_STABILITY_OPTIONS: StabilityOptions = {
    timeout: ACTION_STABILITY_TIMEOUT,
    expectNavigation: false,
    waitForNetworkIdle: true,
    networkIdleTimeout: NETWORK_IDLE_TIMEOUT,
    checkLoadingIndicators: true,
    loadingIndicatorSelector: '[aria-busy="true"], [class*="loading"], [id*="loading"], .spinner, .loader'
};

/**
 * Waits for stability after an action using Playwright's built-in mechanisms
 * This uses a comprehensive approach to ensure the page is stable after an action
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
        waitForNetworkIdle, 
        networkIdleTimeout,
        checkLoadingIndicators,
        loadingIndicatorSelector
    } = stabilityOptions;
    
    debug("Starting comprehensive action stability check");
    const startTime = Date.now();

    try {
        // Track user interaction time
        const lastInteractionTimeAtStart = getLastUserInteractionTime();

        // If we expect navigation, wait for domcontentloaded
        if (expectNavigation) {
            debug("Waiting for navigation to complete (domcontentloaded)");
            await page.waitForLoadState("domcontentloaded", { 
                timeout: Math.min(timeout || ACTION_STABILITY_TIMEOUT, 30000) 
            }).catch(err => {
                // Check if user interaction occurred during this wait
                if (getLastUserInteractionTime() > lastInteractionTimeAtStart) {
                    debug("User interaction detected during domcontentloaded wait, continuing");
                } else {
                    debug("DOMContentLoaded timeout reached, continuing anyway", err);
                }
            });
            
            // Then wait for load state if we have time
            if (Date.now() - startTime < (timeout || ACTION_STABILITY_TIMEOUT) - 3000) {
                debug("Waiting for load state after navigation");
                await page.waitForLoadState("load", { 
                    timeout: 3000 // Short timeout for load state
                }).catch(err => {
                    debug("Load state timeout reached, continuing anyway", err);
                });
            }
        }
        
        // Wait for network idle if requested and we have time
        if (waitForNetworkIdle && Date.now() - startTime < (timeout || ACTION_STABILITY_TIMEOUT) - 3000) {
            debug("Waiting for networkidle state");
            await page.waitForLoadState("networkidle", { 
                timeout: networkIdleTimeout || NETWORK_IDLE_TIMEOUT
            }).catch(err => {
                debug("Network idle timeout reached, continuing anyway", err);
            });
        }
        
        // Check for loading indicators if requested and we have time
        if (checkLoadingIndicators && loadingIndicatorSelector && 
            Date.now() - startTime < (timeout || ACTION_STABILITY_TIMEOUT) - 2000) {
            debug("Checking for loading indicators");
            
            // First check if any loading indicators exist
            const hasLoadingIndicators = await page.$(loadingIndicatorSelector)
                .then(element => !!element)
                .catch(() => false);
                
            if (hasLoadingIndicators) {
                debug("Loading indicators found, waiting for them to disappear");
                // Wait for loading indicators to disappear with a reasonable timeout
                await page.waitForSelector(loadingIndicatorSelector, { 
                    state: 'detached',
                    timeout: 2000
                }).catch(err => {
                    debug("Loading indicators still present after timeout, continuing anyway", err);
                });
            } else {
                debug("No loading indicators found");
            }
        }
        
        debug("Action stability check complete");
        return true;
    } catch (err) {
        // Always return true to allow the process to continue
        debug("Error during action stability check, continuing anyway", err);
        return true;
    }
} 