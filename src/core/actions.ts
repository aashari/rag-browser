import type { Page } from "playwright";
import type { ActionStatus, BrowserOptions, Plan, PlannedActionResult } from "../types";
import { getActionSymbol, getActionDescription } from "../utils/actions";
import { executeAction } from "./handlers";
import { printActionStatus, printActionSummary } from "../utils/output";

export async function executePlan(
    page: Page,
    plan: Plan,
    options: BrowserOptions
): Promise<{
    actionStatuses: ActionStatus[];
    plannedActionResults: PlannedActionResult[];
}> {
    const actionStatuses: ActionStatus[] = [];
    const plannedActionResults: PlannedActionResult[] = [];
    const totalSteps = plan.actions.length;

    for (const [index, action] of plan.actions.entries()) {
        const step = index + 1;
        const symbol = getActionSymbol(action);
        const description = getActionDescription(action);
        const status: ActionStatus = { step, totalSteps, action, symbol, description };

        status.result = await executeAction(page, action, options);
        console.warn(printActionStatus(status));
        actionStatuses.push(status);

        // Track success for all actions
        if (status.result?.success) {
            plannedActionResults.push({
                type: action.type as "print" | "markdown",
                selector: action.type === "wait" || action.type === "print" || action.type === "markdown" 
                    ? action.elements[0] 
                    : action.type === "click" || action.type === "typing"
                    ? action.element
                    : "",
                html: status.result.message
            });
        }

        if (!status.result?.success) break;
    }

    console.warn(printActionSummary(actionStatuses));
    return { actionStatuses, plannedActionResults };
} 