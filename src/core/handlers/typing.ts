import type { Page } from "playwright";
import type { TypingAction, ActionResult, BrowserOptions } from "../../types";
import { waitForActionStability } from "../stability";

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
    } catch (error) {
        return {
            success: false,
            message: "Failed to input text",
            error: error instanceof Error ? error.message : "Unknown error occurred",
        };
    }
} 