import type { Page } from "playwright";
import type { TypingAction, ActionResult, BrowserOptions } from "../../types";
import { waitForActionStability } from "../stability";
import { error } from "../../utils/logging";
export async function executeTypingAction(
    page: Page,
    action: TypingAction,
    options: BrowserOptions
): Promise<ActionResult> {
    try {
        await page.fill(action.element, action.value);
        const isStable = await waitForActionStability(page).catch(() => false);
        return {
            success: true,
            message: "Text input successful",
            warning: !isStable ? "Page not fully stable after typing" : undefined,
        };
    } catch (err) {
        error('Error in typing action', { error: err instanceof Error ? err.message : String(err) });
        return {
            success: false,
            message: "Failed to input text",
            error: err instanceof Error ? err.message : "Unknown error occurred",
        };
    }
} 