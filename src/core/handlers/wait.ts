import type { Page } from "playwright";
import type { WaitAction, ActionResult, BrowserOptions } from "../../types";
import { waitForActionStability } from "../stability";
import { DEFAULT_TIMEOUT } from "../../config/constants";

export async function executeWaitAction(
    page: Page,
    action: WaitAction,
    options: BrowserOptions
): Promise<ActionResult> {
    // Use action-specific timeout if provided, otherwise use global options
    const isInfiniteWait = action.timeout === -1 || options.timeout === -1;
    const timeout = isInfiniteWait ? 0 : (action.timeout || options.timeout || DEFAULT_TIMEOUT);
    let abortController: AbortController | undefined;

    try {
        if (!isInfiniteWait) {
            // Normal wait with timeout
            await Promise.all(
                action.elements.map(async (selector) => {
                    await page.waitForSelector(selector, { timeout });
                })
            );
        } else {
            // Infinite wait - keep retrying until element is found
            abortController = new AbortController();
            const signal = abortController.signal;

            while (!signal.aborted) {
                try {
                    await Promise.all(
                        action.elements.map(async (selector) => {
                            await page.waitForSelector(selector, { timeout: 1000 });
                        })
                    );
                    // If we get here, all elements were found
                    break;
                } catch (err) {
                    if (signal.aborted) {
                        throw new Error("Wait operation interrupted");
                    }
                    // Element not found, wait a bit and retry
                    await page.waitForTimeout(1000);
                    continue;
                }
            }
        }

        const isStable = await waitForActionStability(page, { 
            timeout: isInfiniteWait ? undefined : timeout,
            abortSignal: abortController?.signal
        }).catch(() => false);

        return {
            success: true,
            message: "Elements found and stable",
            warning: !isStable ? "Page not fully stable, but elements are present" : undefined,
        };
    } catch (error) {
        if (isInfiniteWait) {
            return {
                success: false,
                message: "Infinite wait interrupted",
                error: error instanceof Error ? error.message : "Unknown error occurred",
            };
        }
        return {
            success: false,
            message: "Failed to find elements",
            error: error instanceof Error ? error.message : "Unknown error occurred",
        };
    } finally {
        // Clean up abort controller
        if (abortController) {
            abortController.abort();
        }
    }
} 