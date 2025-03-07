import type { Page } from "playwright";
import {
    ACTION_STABILITY_TIMEOUT,
    MUTATION_CHECK_INTERVAL,
} from "../../config/constants";
import { debug, warn, error } from "../../utils/logging";
import { injectStabilityScripts } from "./injectedScripts";

/**
 * Waits for stability after an action (click, type, etc.) has been performed
 * This ensures that any resulting page changes have completed before proceeding
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
    const startTime = Date.now();

    if (options.expectNavigation) {
        try {
            await page.waitForLoadState("networkidle", { timeout });
            return true;
        } catch (err) {
            if (
                err instanceof Error &&
                (err.message.includes("Target closed") || err.message.includes("context was destroyed"))
            ) {
                return true;
            }
            warn("Network not idle after navigation, continuing anyway");
            return true;
        }
    }

    try {
        await injectStabilityScripts(page);
    } catch (err) {
        warn("Failed to inject stability scripts for action check", {
            error: err instanceof Error ? err.message : String(err),
        });
        return true;
    }

    let consecutiveStableChecks = 0;
    let lastContent = "";

    while (Date.now() - startTime < timeout && !options.abortSignal?.aborted) {
        try {
            // Check layout stability first
            const isLayoutStable = await page
                .evaluate(() => {
                    return window.checkLayoutStability?.() ?? true;
                })
                .catch((err) => {
                    warn("Error in layout stability check", {
                        error: err instanceof Error ? err.message : String(err),
                    });
                    return true;
                });

            if (!isLayoutStable) {
                consecutiveStableChecks = 0;
                debug("Layout not yet stable");
                await page.waitForTimeout(MUTATION_CHECK_INTERVAL);
                continue;
            }

            // Then check DOM stability
            const isDomStable = await page
                .evaluate(() => {
                    return window.checkPageStability?.() ?? true;
                })
                .catch((err) => {
                    warn("Error in DOM stability check", {
                        error: err instanceof Error ? err.message : String(err),
                    });
                    return true;
                });

            if (!isDomStable) {
                consecutiveStableChecks = 0;
                debug("DOM not yet stable");
                await page.waitForTimeout(MUTATION_CHECK_INTERVAL);
                continue;
            }

            // Check content stability as a final measure
            const content = await page.content().catch(() => "");
            if (lastContent && content !== lastContent) {
                consecutiveStableChecks = 0;
                debug("Content changed");
                lastContent = content;
                await page.waitForTimeout(MUTATION_CHECK_INTERVAL);
                continue;
            }

            lastContent = content;
            consecutiveStableChecks++;
            debug("Action appears stable", { consecutiveChecks: consecutiveStableChecks });

            if (consecutiveStableChecks >= 2) {
                return true;
            }
        } catch (err) {
            if (
                err instanceof Error &&
                (err.message.includes("Target closed") || err.message.includes("context was destroyed"))
            ) {
                if (options.expectNavigation) {
                    return true;
                }
                throw err;
            }
            warn("Error during action stability check", { error: err instanceof Error ? err.message : String(err) });
        }

        await page.waitForTimeout(MUTATION_CHECK_INTERVAL);
    }

    if (options.abortSignal?.aborted) {
        debug("Action stability check aborted");
    } else {
        warn("Action stability check timed out", { duration: Date.now() - startTime });
    }
    
    return true;
} 