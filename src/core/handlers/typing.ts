import type { Page } from "playwright";
import type { TypingAction, ActionResult, BrowserOptions } from "../../types";
import { waitForActionStability } from "../stability";
import { error, info } from "../../utils/logging";

// Simplified typing speed range in milliseconds
const MIN_DELAY = 200;
const MAX_DELAY = 500;

/**
 * Generate a random delay within a range
 */
function getRandomDelay(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Execute a typing action with simple random delays
 */
export async function executeTypingAction(
    page: Page,
    action: TypingAction,
    options: BrowserOptions
): Promise<ActionResult> {
    try {
        // Focus on the element first
        await page.focus(action.element);
        
        // Clear any existing text if the element is not empty
        await page.evaluate((selector) => {
            const element = document.querySelector(selector);
            if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
                element.value = '';
            } else if (element && 'textContent' in element) {
                element.textContent = '';
            }
        }, action.element);
        
        // Brief pause after clearing
        await page.waitForTimeout(getRandomDelay(200, 300));
        
        // Use the provided delay or default to our range
        const baseDelay = action.delay || getRandomDelay(MIN_DELAY, MAX_DELAY);
        
        info('Typing text with random delays', { 
            element: action.element, 
            textLength: action.value.length,
            baseDelay
        });
        
        // Type the text character by character with random delays
        for (let i = 0; i < action.value.length; i++) {
            const char = action.value[i];
            
            // Random delay for each character
            const charDelay = getRandomDelay(MIN_DELAY, MAX_DELAY);
            
            // Type the character with the delay
            await page.type(action.element, char, { delay: charDelay });
        }
        
        // Wait for stability after typing
        const isStable = await waitForActionStability(page).catch(() => false);
        
        // Mark the action as completed
        action.completed = true;
        
        return {
            success: true,
            message: `Typed "${action.value}" into ${action.element}`,
            warning: !isStable ? "Page not fully stable after typing" : undefined,
        };
    } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        error('Error during typing action', { error: errorMessage, element: action.element });
        return {
            success: false,
            message: `Failed to type text: ${errorMessage}`
        };
    }
} 