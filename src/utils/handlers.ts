import type { ActionResult, PlannedActionResult } from "../types";

/**
 * Creates a standardized action result from captured content
 * @param results The captured results to format
 * @param format The output format ('html' or 'markdown')
 * @returns Formatted action result
 */
export function createActionResult(
    results: PlannedActionResult[],
    format: 'html' | 'markdown' = 'markdown'
): ActionResult {
    // Update result types and format
    const typedResults = results.map(result => ({
        ...result,
        type: 'print' as const,
        format
    }));

    const successfulResults = typedResults.filter(r => !r.error && r.html);
    const failedResults = typedResults.filter(r => r.error);

    return {
        success: successfulResults.length > 0,
        message: successfulResults
            .map(r => `Content from ${r.selector}:\n=================\n${r.html}\n=================\n`)
            .join("\n"),
        warning: failedResults.length > 0
            ? `Failed to capture some elements: ${failedResults
                .map((r) => `${r.selector} (${r.error})`)
                .join(", ")}`
            : undefined,
        data: typedResults,
    };
} 