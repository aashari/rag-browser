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
                const html = await element.evaluate(el => el.outerHTML);
                results.push({ selector, html, type: 'print' as const });
            }
        } catch (_error) {
            results.push({ selector, error: "Element not found or inaccessible", type: 'print' as const, html: '' });
        }
    }
    return {
        success: results.some((r) => !r.error),
        message: results
            .filter((r) => !r.error)
            .map((r) => `HTML captured for ${r.selector}`)
            .join("\n"),
        warning: results.some((r) => r.error)
            ? `Failed to capture some elements: ${results
                .filter((r) => r.error)
                .map((r) => r.selector)
                .join(", ")}`
            : undefined,
        data: results,
    };
}