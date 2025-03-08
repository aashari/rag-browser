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
    /** Whether to check for DOM stability using MutationObserver */
    checkDOMStability?: boolean;
    /** Interval for DOM stability in milliseconds */
    domStabilityInterval?: number;
    /** Whether to check for resource stability using Performance API */
    checkResourceStability?: boolean;
    /** Whether to check for visual stability using Layout Instability API */
    checkVisualStability?: boolean;
    /** Interval for visual stability in milliseconds */
    visualStabilityInterval?: number;
}

/**
 * Default stability options
 */
const DEFAULT_STABILITY_OPTIONS: StabilityOptions = {
    timeout: DEFAULT_TIMEOUT,
    expectNavigation: false,
    waitForNetworkIdle: true,
    networkIdleTimeout: NETWORK_IDLE_TIMEOUT,
    checkDOMStability: true,
    domStabilityInterval: 500,
    checkResourceStability: true,
    checkVisualStability: true,
    visualStabilityInterval: 500
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
        checkDOMStability,
        domStabilityInterval,
        checkResourceStability,
        checkVisualStability,
        visualStabilityInterval
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
        
        // Advanced stability checks
        if (checkDOMStability && Date.now() - startTime < (timeout || DEFAULT_TIMEOUT) - 3000) {
            debug("Waiting for DOM stability");
            await waitForDOMStability(page, domStabilityInterval).catch(err => {
                debug("DOM stability check failed, continuing anyway", err);
            });
        }
        
        if (checkResourceStability && Date.now() - startTime < (timeout || DEFAULT_TIMEOUT) - 3000) {
            debug("Waiting for resource stability");
            await waitForResourceStability(page).catch(err => {
                debug("Resource stability check failed, continuing anyway", err);
            });
        }
        
        if (checkVisualStability && Date.now() - startTime < (timeout || DEFAULT_TIMEOUT) - 3000) {
            debug("Waiting for visual stability");
            await waitForVisualStability(page, visualStabilityInterval).catch(err => {
                debug("Visual stability check failed, continuing anyway", err);
            });
        }
        
        debug("Advanced page stability checks complete");
        return true;
    } catch (err) {
        // Always return true to allow the process to continue
        debug("Error during stability check, continuing anyway", err);
        return true;
    }
}

// Export these helper functions so they can be used in actionStability.ts
export async function waitForDOMStability(page: Page, interval = 500): Promise<void> {
    await page.evaluate(async (stabilityInterval) => {
        await new Promise(resolve => {
            let timeout: NodeJS.Timeout;
            const observer = new MutationObserver(() => {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    observer.disconnect();
                    resolve(true);
                }, stabilityInterval);
            });
            observer.observe(document.body, { childList: true, subtree: true, attributes: true });
            timeout = setTimeout(() => {
                observer.disconnect();
                resolve(true);
            }, stabilityInterval);
        });
    }, interval);
}

export async function waitForResourceStability(page: Page, interval = 500): Promise<void> {
    await page.waitForFunction((interval) => {
        const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        return resources.every(r => r.responseEnd > 0);
    }, interval);
}

export async function waitForVisualStability(page: Page, interval = 500): Promise<void> {
    await page.evaluate(async (stabilityInterval) => {
        await new Promise(resolve => {
            let lastShiftTime = Date.now();
            new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    lastShiftTime = Date.now();
                }
            }).observe({ type: 'layout-shift', buffered: true });

            const checkStability = () => {
                if (Date.now() - lastShiftTime > stabilityInterval) {
                    resolve(true);
                } else {
                    requestAnimationFrame(checkStability);
                }
            };
            checkStability();
        });
    }, interval);
} 