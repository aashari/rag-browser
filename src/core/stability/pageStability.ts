import type { Page } from "playwright";
import { DEFAULT_TIMEOUT, NETWORK_IDLE_TIMEOUT } from "../../config/constants";
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
    /** Whether to wait for network idle */
    waitForNetworkIdle?: boolean;
    /** Timeout for network idle */
    networkIdleTimeout?: number;
    /** Whether to check for loading indicators */
    checkLoadingIndicators?: boolean;
    /** Selector for loading indicators */
    loadingIndicatorSelector?: string;
}

/**
 * Default stability options
 */
const DEFAULT_STABILITY_OPTIONS: StabilityOptions = {
    timeout: DEFAULT_TIMEOUT,
    expectNavigation: false,
    waitForNetworkIdle: true,
    networkIdleTimeout: NETWORK_IDLE_TIMEOUT,
    checkLoadingIndicators: true,
    loadingIndicatorSelector: '[aria-busy="true"], [class*="loading"], [id*="loading"], .spinner, .loader'
};

/**
 * Waits for a page to become stable using Playwright's built-in mechanisms
 * This uses a comprehensive approach to ensure the page is fully loaded and stable
 */
export async function waitForPageStability(
    page: Page,
    options: StabilityOptions = {}
): Promise<boolean> {
    // Merge provided options with defaults
    const stabilityOptions = { ...DEFAULT_STABILITY_OPTIONS, ...options };
    const { 
        timeout, 
        expectNavigation, 
        waitForNetworkIdle, 
        networkIdleTimeout,
        checkLoadingIndicators,
        loadingIndicatorSelector
    } = stabilityOptions;
    
    debug("Starting comprehensive page stability check");
    const startTime = Date.now();

    try {
        // Track user interaction time
        const lastInteractionTimeAtStart = getLastUserInteractionTime();
        
        // First wait for domcontentloaded - this is the most essential state
        debug("Waiting for domcontentloaded state");
        await page.waitForLoadState("domcontentloaded", { 
            timeout: Math.min(timeout || DEFAULT_TIMEOUT, 30000) 
        }).catch(err => {
            // Check if user interaction occurred during this wait
            if (getLastUserInteractionTime() > lastInteractionTimeAtStart) {
                debug("User interaction detected during domcontentloaded wait, continuing");
            } else {
                debug("DOMContentLoaded timeout reached, continuing anyway", err);
            }
        });
        
        // Then wait for load state (all resources like images, stylesheets loaded)
        if (Date.now() - startTime < (timeout || DEFAULT_TIMEOUT) - 5000) {
            debug("Waiting for load state");
            await page.waitForLoadState("load", { 
                timeout: 5000 // Short timeout for load state
            }).catch(err => {
                debug("Load state timeout reached, continuing anyway", err);
            });
        }
        
        // Wait for network idle if requested
        if (waitForNetworkIdle && Date.now() - startTime < (timeout || DEFAULT_TIMEOUT) - 5000) {
            debug("Waiting for networkidle state");
            await page.waitForLoadState("networkidle", { 
                timeout: networkIdleTimeout || NETWORK_IDLE_TIMEOUT
            }).catch(err => {
                debug("Network idle timeout reached, continuing anyway", err);
            });
        }
        
        // Check for loading indicators if requested
        if (checkLoadingIndicators && loadingIndicatorSelector && 
            Date.now() - startTime < (timeout || DEFAULT_TIMEOUT) - 3000) {
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
                    timeout: 3000
                }).catch(err => {
                    debug("Loading indicators still present after timeout, continuing anyway", err);
                });
            } else {
                debug("No loading indicators found");
            }
        }
        
        debug("Page stability check complete");
        return true;
    } catch (err) {
        // Always return true to allow the process to continue
        debug("Error during stability check, continuing anyway", err);
        return true;
    }
} 