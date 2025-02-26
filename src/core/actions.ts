import type { Page } from "playwright";
import type { ActionStatus, BrowserOptions, Plan, PlannedActionResult } from "../types";
import { getActionSymbol, getActionDescription } from "../utils/actions";
import { executeAction } from "./handlers";
import { printActionStatus, printActionSummary } from "../utils/output";
import { info } from "../utils/logging";

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
        info(printActionStatus(status));
        actionStatuses.push(status);

        // Track success for all actions
        if (status.result?.success) {
            plannedActionResults.push({
                type: "print",
                selector: action.type === "wait" || action.type === "print"
                    ? action.elements[0] 
                    : action.type === "click" || action.type === "typing"
                    ? action.element
                    : "",
                // Use actual content from data if available, otherwise fall back to message
                html: status.result.data?.[0]?.html || status.result.message,
                // Include the format from the result data
                format: status.result.data?.[0]?.format
            });
        }

        if (!status.result?.success) break;
    }

    info(printActionSummary(actionStatuses));
    return { actionStatuses, plannedActionResults };
} 