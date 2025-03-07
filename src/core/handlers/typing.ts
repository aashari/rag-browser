import type { Page } from "playwright";
import type { TypingAction, ActionResult, BrowserOptions } from "../../types";
import { waitForActionStability } from "../stability";
import { DEFAULT_TYPING_DELAY } from "../../config/constants";
import { debug, info } from "../../utils/logging";

/**
 * Execute a typing action
 */
export async function executeTypingAction(
    page: Page,
    action: TypingAction,
    options: BrowserOptions
): Promise<ActionResult> {
    try {
        // First try to click the element to focus it
        await page.click(action.element);
        
        // Clear the input field first
        await page.evaluate((selector) => {
            const el = document.querySelector(selector) as HTMLInputElement;
            if (el && 'value' in el) {
                el.value = '';
            }
        }, action.element).catch(() => debug("Failed to clear input field"));
        
        // Type the value with a consistent delay
        info(`Typing "${action.value}" into ${action.element}`);
        await page.type(action.element, action.value, { delay: DEFAULT_TYPING_DELAY });
        
        // Wait for stability after typing
        const isStable = await waitForActionStability(page).catch(() => false);
        
        // Mark the action as completed
        action.completed = true;
        
        return {
            success: true,
            message: `Typed "${action.value}" into ${action.element}`,
            warning: !isStable ? "Page not fully stable after typing" : undefined,
        };
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        debug("Error during typing action", { error: errorMessage, element: action.element });
        return {
            success: false,
            message: `Failed to type text: ${errorMessage}`
        };
    }
} 