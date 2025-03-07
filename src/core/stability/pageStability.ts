import type { Page } from "playwright";
import {
    DEFAULT_TIMEOUT,
    LOADING_INDICATORS,
    NETWORK_IDLE_TIMEOUT,
} from "../../config/constants";
import { debug, info, warn } from "../../utils/logging";
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
    /** Whether to wait for network idle state */
    waitForNetworkIdle?: boolean;
    /** Timeout for network idle in milliseconds */
    networkIdleTimeout?: number;
    /** Whether to check for loading indicators */
    checkLoadingIndicators?: boolean;
    /** Custom loading indicator selector */
    loadingIndicatorSelector?: string;
    /** Whether to wait for animations to complete */
    waitForAnimations?: boolean;
    /** Animation settling time in milliseconds */
    animationSettleTime?: number;
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
    loadingIndicatorSelector: LOADING_INDICATORS,
    waitForAnimations: true,
    animationSettleTime: 500
};

/**
 * Waits for a page to become stable
 * This is a simplified version that uses basic Playwright methods
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
        abortSignal,
        waitForNetworkIdle,
        networkIdleTimeout,
        checkLoadingIndicators,
        loadingIndicatorSelector,
        waitForAnimations,
        animationSettleTime
    } = stabilityOptions;
    
    debug("Starting simplified page stability check", { 
        timeout,
        waitForNetworkIdle,
        checkLoadingIndicators,
        waitForAnimations
    });

    // Track the start time and last user interaction time
    const startTime = Date.now();
    let lastInteractionTimeAtStart = getLastUserInteractionTime();

    try {
        // Wait for the page to load
        debug("Waiting for domcontentloaded state");
        await page.waitForLoadState("domcontentloaded", { timeout: Math.min(timeout || DEFAULT_TIMEOUT, 30000) })
            .catch(() => {
                // Check if user interaction occurred during this wait
                if (getLastUserInteractionTime() > lastInteractionTimeAtStart) {
                    debug("User interaction detected during domcontentloaded wait, continuing");
                    lastInteractionTimeAtStart = getLastUserInteractionTime();
                } else {
                    debug("DOMContentLoaded timeout reached, continuing anyway");
                }
            });
        
        // Wait for network to be idle if configured
        if (waitForNetworkIdle) {
            debug("Waiting for networkidle state");
            await page.waitForLoadState("networkidle", { 
                timeout: Math.min(networkIdleTimeout || NETWORK_IDLE_TIMEOUT, 30000) 
            }).catch(() => {
                // Check if user interaction occurred during this wait
                if (getLastUserInteractionTime() > lastInteractionTimeAtStart) {
                    debug("User interaction detected during networkidle wait, continuing");
                    lastInteractionTimeAtStart = getLastUserInteractionTime();
                } else {
                    debug("Network idle timeout reached, continuing anyway");
                }
            });
        }
        
        // Check for loading indicators if configured
        if (checkLoadingIndicators) {
            debug("Checking for loading indicators");
            const hasLoadingIndicators = await page.$(loadingIndicatorSelector || LOADING_INDICATORS)
                .then(el => !!el)
                .catch(() => false);
                
            if (hasLoadingIndicators) {
                debug("Loading indicators found, but continuing anyway after network idle");
            }
        }
        
        // Wait for animations to complete if configured
        if (waitForAnimations && animationSettleTime) {
            debug(`Waiting ${animationSettleTime}ms for animations to settle`);
            await page.waitForTimeout(animationSettleTime);
        }
        
        debug("Page stability check complete");
        return true;
    } catch (err) {
        if (err instanceof Error && 
            (err.message.includes("Target closed") || 
             err.message.includes("context was destroyed") ||
             err.message.includes("Execution context was destroyed"))) {
            debug("Page context destroyed during stability check");
            if (expectNavigation) {
                return true;
            }
            // Don't throw, just return true to allow the process to continue
            return true;
        }
        
        warn("Error during stability check", { error: err instanceof Error ? err.message : String(err) });
        return true; // Return true to allow the process to continue
    }
} 