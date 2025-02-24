import type { Page } from "playwright";
import type { WaitAction, ActionResult, BrowserOptions } from "../../types";
import { waitForActionStability } from "../stability";
import { DEFAULT_TIMEOUT } from "../../config/constants";

export async function executeWaitAction(
    page: Page,
    action: WaitAction,
    options: BrowserOptions
): Promise<ActionResult> {
    try {
        await Promise.all(
            action.elements.map((selector) =>
                page.waitForSelector(selector, { timeout: options.timeout || DEFAULT_TIMEOUT })
            )
        );
        const isStable = await waitForActionStability(page).catch(() => false);
        return {
            success: true,
            message: "Elements found and stable",
            warning: !isStable ? "Page not fully stable, but elements are present" : undefined,
        };
    } catch (error) {
        return {
            success: false,
            message: "Failed to find elements",
            error: error instanceof Error ? error.message : "Unknown error occurred",
        };
    }
} 