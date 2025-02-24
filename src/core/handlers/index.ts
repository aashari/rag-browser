import type { Page } from "playwright";
import type { Action, ActionResult, BrowserOptions, WaitAction, ClickAction, TypingAction, KeyPressAction } from "../../types";
import { executeWaitAction } from "./wait";
import { executeClickAction } from "./click";
import { executeTypingAction } from "./typing";
import { executePrintAction } from "./print";
import { executeKeyPressAction } from "./keyPress";

type ActionHandler<T extends Action> = (page: Page, action: T, options: BrowserOptions) => Promise<ActionResult>;

export const actionHandlers: Record<string, ActionHandler<Action>> = {
    wait: (page: Page, action: Action, options: BrowserOptions) => {
        if (action.type !== "wait") throw new Error("Invalid action type");
        return executeWaitAction(page, action as WaitAction, options);
    },
    click: (page: Page, action: Action, options: BrowserOptions) => {
        if (action.type !== "click") throw new Error("Invalid action type");
        return executeClickAction(page, action as ClickAction, options);
    },
    typing: (page: Page, action: Action, options: BrowserOptions) => {
        if (action.type !== "typing") throw new Error("Invalid action type");
        return executeTypingAction(page, action as TypingAction, options);
    },
    keyPress: (page: Page, action: Action, options: BrowserOptions) => {
        if (action.type !== "keyPress") throw new Error("Invalid action type");
        return executeKeyPressAction(page, action as KeyPressAction, options);
    },
    print: (page: Page, action: Action, options: BrowserOptions) => {
        if (action.type !== "print") throw new Error("Invalid action type");
        return executePrintAction(page, action, options);
    },
};

export async function executeAction(page: Page, action: Action, options: BrowserOptions): Promise<ActionResult> {
    const handler = actionHandlers[action.type];
    if (!handler) {
        return { success: false, message: "Unknown action type", error: `Action type ${action.type} not supported` };
    }
    try {
        return await handler(page, action, options);
    } catch (error) {
        if (error instanceof Error && error.message.includes("context was destroyed")) {
            return { success: true, message: "Action completed", warning: "Page navigation occurred" };
        }
        return {
            success: false,
            message: "Action failed",
            error: error instanceof Error ? error.message : "Unknown error occurred",
        };
    }
}

export { executeWaitAction, executeClickAction, executeTypingAction, executePrintAction, executeKeyPressAction }; 