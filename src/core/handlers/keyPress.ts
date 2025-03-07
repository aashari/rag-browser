import type { Page } from "playwright";
import type { KeyPressAction, ActionResult, BrowserOptions } from "../../types";
import { waitForActionStability } from "../stability";
import { ACTION_STABILITY_TIMEOUT } from "../../config/constants";
import { error } from "../../utils/logging";
export async function executeKeyPressAction(
    page: Page,
    action: KeyPressAction,
    options: BrowserOptions
): Promise<ActionResult> {
    try {
        if (action.element) {
            await page.focus(action.element);
        }
        await page.keyboard.press(action.key);
        
        // Use a shorter stability timeout for tests
        const stabilityTimeout = options.headless ? 2000 : ACTION_STABILITY_TIMEOUT;
        const isStable = await waitForActionStability(page, { timeout: stabilityTimeout }).catch(() => false);
        
        // Mark the action as completed
        action.completed = true;
        
        return {
            success: true,
            message: `Pressed key "${action.key}"${action.element ? ` on ${action.element}` : ''}`,
            warning: !isStable ? "Page not fully stable after key press" : undefined,
        };
    } catch (err) {
        error('Error in key press action', { error: err instanceof Error ? err.message : String(err) });
        return {
            success: false,
            message: "Failed to press key",
            error: err instanceof Error ? err.message : "Unknown error occurred",
        };
    }
} 