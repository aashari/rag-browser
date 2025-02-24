import type { Page } from "playwright";
import type { PrintAction, ActionResult, BrowserOptions, PlannedActionResult } from "../../types";

export async function executePrintAction(
    page: Page,
    action: PrintAction,
    _options: BrowserOptions
): Promise<ActionResult> {
    const results: PlannedActionResult[] = [];
    for (const selector of action.elements) {
        try {
            const elements = await page.$$(selector);
            for (const element of elements) {
                const text = await element.evaluate(el => el.textContent?.trim() || '');
                if (text) {
                    results.push({ selector, html: text, type: 'print' as const });
                }
            }
        } catch (_error) {
            results.push({ selector, error: "Element not found or inaccessible", type: 'print' as const, html: '' });
        }
    }

    // Format the output to show actual content
    const formattedResults = results
        .filter(r => !r.error && r.html)
        .map(r => `Content from ${r.selector}:\n---\n${r.html}\n---\n`);

    return {
        success: results.some((r) => !r.error),
        message: formattedResults.length > 0 
            ? formattedResults.join("\n")
            : "No content captured",
        warning: results.some((r) => r.error)
            ? `Failed to capture some elements: ${results
                .filter((r) => r.error)
                .map((r) => r.selector)
                .join(", ")}`
            : undefined,
        data: results,
    };
}