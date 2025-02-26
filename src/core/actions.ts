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

    // Track page context changes
    let contextChanges = 0;
    let lastUrl = page.url();

    for (const [index, action] of plan.actions.entries()) {
        const step = index + 1;
        const symbol = getActionSymbol(action);
        const description = getActionDescription(action);
        const status: ActionStatus = { step, totalSteps, action, symbol, description };
        
        // Check if navigation occurred between steps
        const currentUrl = page.url();
        if (currentUrl !== lastUrl) {
            info(`Page navigation detected: ${lastUrl} → ${currentUrl}`);
            contextChanges++;
            lastUrl = currentUrl;
        }

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
            
            // Log warning if present in result
            if ('warning' in status.result && status.result.warning) {
                info(`Warning: ${status.result.warning}`);
            }
        }

        // If action failed, include detailed error information
        if (!status.result?.success) {
            // Include error message in results
            plannedActionResults.push({
                type: "print",
                selector: "error-details",
                html: `<div class="error-details">
                    <h3>Error Details</h3>
                    <p><strong>Action:</strong> ${description}</p>
                    <p><strong>Error:</strong> ${status.result?.error || "Unknown error"}</p>
                    <p><strong>Current URL:</strong> ${page.url()}</p>
                    ${status.result?.warning ? `<p><strong>Warning:</strong> ${status.result.warning}</p>` : ''}
                    <p><em>Suggestion: Try using broader selectors to see what's on the page.</em></p>
                </div>`,
                format: "html",
                error: status.result?.error || "Action failed"
            });
            
            // Include any additional data provided with the error
            if (status.result?.data && status.result.data.length > 0) {
                for (const dataItem of status.result.data) {
                    plannedActionResults.push(dataItem);
                }
            }
            // If no data was provided with the error, try a fallback content extraction
            else if (contextChanges > 0) {
                info(`Action failed after navigation. Attempting to extract content from current page...`);
                
                try {
                    // Create a fallback print action to extract content from the current page
                    const fallbackAction = {
                        type: "print" as const,
                        elements: ['h1', 'main', 'article', '#content', '.content', 'body']
                    };
                    
                    const fallbackResult = await executeAction(page, fallbackAction, options);
                    
                    if (fallbackResult.success && fallbackResult.data?.[0]) {
                        plannedActionResults.push({
                            ...fallbackResult.data[0],
                            selector: "navigation-fallback",
                            html: fallbackResult.data[0].html || "Navigation content captured"
                        });
                        
                        info('Successfully captured content after navigation');
                    }
                } catch (fallbackError) {
                    // Just log and continue with normal flow
                    info(`Failed to capture fallback content: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
                }
            }
            
            break;
        }
    }

    info(printActionSummary(actionStatuses));
    return { actionStatuses, plannedActionResults };
} 