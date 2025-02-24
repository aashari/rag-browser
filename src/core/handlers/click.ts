import type { Page } from "playwright";
import type { ClickAction, ActionResult, BrowserOptions } from "../../types";
import { waitForActionStability } from "../stability";
import { error } from "../../utils/logging";

export async function executeClickAction(
    page: Page,
    action: ClickAction,
    options: BrowserOptions
): Promise<ActionResult> {
    try {
        await page.click(action.element);
        const isStable = await waitForActionStability(page, { expectNavigation: true }).catch(() => false);
        return {
            success: true,
            message: "Click successful",
            warning: !isStable ? "Page not fully stable after click" : undefined,
        };
    } catch (err) {
        error('Error in click action', { error: err instanceof Error ? err.message : String(err) });
        if (err instanceof Error && err.message.includes("context was destroyed")) {
            return { success: true, message: "Click completed", warning: "Page navigation occurred" };
        }
        return {
            success: false,
            message: "Failed to click element",
            error: err instanceof Error ? err.message : "Unknown error occurred",
        };
    }
} 