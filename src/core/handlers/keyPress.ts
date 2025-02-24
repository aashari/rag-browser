import type { Page } from "playwright";
import type { KeyPressAction, ActionResult, BrowserOptions } from "../../types";
import { waitForActionStability } from "../stability";
import { ACTION_STABILITY_TIMEOUT } from "../../config/constants";

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
        
        return {
            success: true,
            message: "Key pressed",
            warning: !isStable ? "Page not fully stable after key press" : undefined,
        };
    } catch (error) {
        return {
            success: false,
            message: "Failed to press key",
            error: error instanceof Error ? error.message : "Unknown error occurred",
        };
    }
} 