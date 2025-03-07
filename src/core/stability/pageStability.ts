import type { Page } from "playwright";
import {
    DEFAULT_TIMEOUT,
    LOADING_INDICATORS,
    MUTATION_STABILITY_TIMEOUT,
    MUTATION_CHECK_INTERVAL,
    NETWORK_IDLE_TIMEOUT,
} from "../../config/constants";
import { debug, info, warn, error } from "../../utils/logging";
import { injectStabilityScripts } from "./injectedScripts";

/**
 * Waits for a page to become stable (no significant DOM mutations or layout shifts)
 * This is used when initially loading a page to ensure it's ready for analysis
 */
export async function waitForPageStability(
    page: Page,
    options: { 
        timeout?: number; 
        expectNavigation?: boolean;
        abortSignal?: AbortSignal;
    } = {}
): Promise<boolean> {
    const startTime = Date.now();
    const timeout = options.timeout || DEFAULT_TIMEOUT;
    debug("Starting page stability check", { timeout });

    // Create a promise that resolves after the safety timeout
    // Use a very short safety timeout to prevent hanging
    const safetyTimeoutPromise = new Promise<boolean>((resolve) => {
        setTimeout(() => {
            warn("Safety timeout reached in waitForPageStability", { timeout });
            resolve(true);
        }, Math.min(3000, timeout / 2)); // Use at most 3 seconds or half the timeout
    });

    // Race the actual stability check with the safety timeout
    return Promise.race([
        _doWaitForPageStability(page, options),
        safetyTimeoutPromise
    ]);
}

// The actual implementation of waitForPageStability
async function _doWaitForPageStability(
    page: Page,
    options: { 
        timeout?: number; 
        expectNavigation?: boolean;
        abortSignal?: AbortSignal;
    } = {}
): Promise<boolean> {
    const startTime = Date.now();
    const timeout = options.timeout || DEFAULT_TIMEOUT;

    try {
        // Wait for initial load state with a shorter timeout
        debug("Waiting for initial domcontentloaded state");
        await Promise.race([
            page.waitForLoadState("domcontentloaded"),
            new Promise((resolve) => setTimeout(resolve, NETWORK_IDLE_TIMEOUT)),
        ]).catch(() => {
            warn("Initial domcontentloaded wait failed");
        });
        debug("Initial domcontentloaded wait completed");

        // Check for abort before continuing
        if (options.abortSignal?.aborted) {
            throw new Error("Stability check aborted");
        }

        // Try to inject scripts, but continue even if it fails
        try {
            debug("Attempting to inject stability scripts");
            await injectStabilityScripts(page);
            debug("Stability scripts injected successfully");
        } catch (err) {
            warn("Failed to inject stability scripts, will use basic stability check", {
                error: err instanceof Error ? err.message : String(err),
            });
            await page.waitForTimeout(NETWORK_IDLE_TIMEOUT);
            return true;
        }

        // Check if we're on a known dynamic app
        let isKnownDynamicApp = false;
        try {
            debug("Checking if page is a dynamic application");
            const _url = page.url();
            // Use generic detection based on WebSocket connections and dynamic content
            isKnownDynamicApp = await page.evaluate(() => {
                return window.WebSocket !== undefined && 
                       document.querySelector('[data-testid], [role="application"], [role="main"]') !== null;
            });
            debug("Dynamic app detection result", { isDynamicApp: isKnownDynamicApp });
        } catch (err) {
            warn("Failed to check dynamic app status", { error: err instanceof Error ? err.message : String(err) });
        }

        // For dynamic apps, we only need basic DOM readiness
        if (isKnownDynamicApp) {
            debug("Dynamic app detected, using simplified stability check");
            try {
                // Wait for basic DOM readiness
                debug("Waiting for basic DOM readiness");
                await page.waitForFunction(() => {
                    return document.readyState === 'complete' && 
                           document.body !== null &&
                           document.body.children.length > 0;
                }, { timeout: NETWORK_IDLE_TIMEOUT });
                
                // Short delay to allow initial content to load
                debug("Basic DOM ready, waiting short delay for initial content");
                await page.waitForTimeout(1000);
                
                debug("Dynamic app basic stability confirmed");
                return true;
            } catch (err) {
                warn("Dynamic app stability check failed", { 
                    error: err instanceof Error ? err.message : String(err) 
                });
                return true;
            }
        }

        // Regular stability check for non-dynamic apps
        debug("Starting regular stability check for non-dynamic app");
        let checkCount = 0;
        let lastLoadingIndicatorCount = -1;
        let consecutiveStableChecks = 0;
        let navigationTimeout = false;

        // Set a navigation timeout
        const navigationTimer = setTimeout(() => {
            navigationTimeout = true;
            warn("Navigation timeout reached", { duration: Date.now() - startTime });
        }, timeout);

        while (Date.now() - startTime < timeout && !options.abortSignal?.aborted && !navigationTimeout) {
            checkCount++;
            debug("Stability check iteration", { iteration: checkCount });

            try {
                // Check if we're still on the same page
                let _currentUrl = '';
                try {
                    _currentUrl = await page.url();
                    debug("Current page URL", { url: _currentUrl });
                } catch {
                    warn("Page context lost during stability check");
                    break;
                }

                debug("Waiting for networkidle state");
                await page
                    .waitForLoadState("networkidle", { timeout: NETWORK_IDLE_TIMEOUT })
                    .catch(() => warn("Network not idle"));

                debug("Checking for loading indicators");
                const loadingIndicators = await page.$$(LOADING_INDICATORS).catch(() => []);
                const currentLoadingCount = loadingIndicators.length;
                debug("Loading indicators found", { count: currentLoadingCount });

                if (currentLoadingCount !== lastLoadingIndicatorCount) {
                    lastLoadingIndicatorCount = currentLoadingCount;
                    consecutiveStableChecks = 0;
                    debug("Loading indicator count changed, resetting stability check");
                    await page.waitForTimeout(MUTATION_CHECK_INTERVAL);
                    continue;
                }

                if (currentLoadingCount === 0) {
                    debug("No loading indicators, checking page stability");
                    
                    // Run stability check and wait for a short time to ensure it completes
                    const isStable = await page
                        .evaluate(() => {
                            const result = window.checkPageStability?.() ?? true;
                            return result;
                        })
                        .catch((err) => {
                            warn("Error in stability check", {
                                error: err instanceof Error ? err.message : String(err),
                            });
                            return true;
                        });
                    
                    debug("Page stability check result", { isStable });
                    
                    // Wait a short time to ensure any setTimeout in the stability check completes
                    await page.waitForTimeout(200);

                    if (isStable) {
                        consecutiveStableChecks++;
                        debug("Page reported as stable", { consecutiveChecks: consecutiveStableChecks });
                        if (consecutiveStableChecks >= 2) {
                            debug("Page stability confirmed after consecutive stable checks");
                            clearTimeout(navigationTimer);
                            return true;
                        }
                    } else {
                        consecutiveStableChecks = 0;
                        debug("Page not yet stable");
                    }
                }
            } catch (err) {
                if (err instanceof Error &&
                    (err.message.includes("Target closed") || err.message.includes("context was destroyed"))) {
                    debug("Page context destroyed", { error: err.message });
                    if (options.expectNavigation) {
                        clearTimeout(navigationTimer);
                        return true;
                    }
                    throw err;
                }
                warn("Error during stability check", { error: err instanceof Error ? err.message : String(err) });
                await page.waitForTimeout(MUTATION_CHECK_INTERVAL);
            }
            await page.waitForTimeout(MUTATION_CHECK_INTERVAL);
        }

        clearTimeout(navigationTimer);

        if (options.abortSignal?.aborted) {
            debug("Stability check aborted");
        } else if (navigationTimeout) {
            warn("Navigation timeout reached", { duration: Date.now() - startTime });
        } else {
            warn("Stability check timed out", { duration: Date.now() - startTime });
        }
        return true;
    } catch (err) {
        error("Fatal error in stability check", { error: err instanceof Error ? err.message : String(err) });
        return true;
    }
} 