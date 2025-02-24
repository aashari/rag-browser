import type { Page } from "playwright";
import type { PrintAction, ActionResult, BrowserOptions, PlannedActionResult } from "../../types";
import { info } from "../../utils/logging";

// Shared function to capture HTML content from elements
export async function captureElementsHtml(page: Page, selectors: string[]): Promise<PlannedActionResult[]> {
    const results: PlannedActionResult[] = [];
    
    for (const selector of selectors) {
        try {
            info('Searching for elements:', { selector });
            const elements = await page.$$(selector);
            
            if (elements.length === 0) {
                info('No elements found for selector:', { selector });
                results.push({ 
                    selector, 
                    error: "No elements found", 
                    type: 'print' as const, 
                    html: '' 
                });
                continue;
            }

            info('Found elements:', { count: elements.length, selector });
            
            for (const element of elements) {
                try {
                    const html = await element.evaluate(el => el.outerHTML);
                    info('Successfully captured HTML for element');
                    results.push({ 
                        selector, 
                        html,
                        type: 'print' as const
                    });
                } catch (evalError) {
                    info('Error evaluating element:', { error: evalError });
                    results.push({ 
                        selector, 
                        error: evalError instanceof Error ? evalError.message : "Failed to capture element HTML", 
                        type: 'print' as const, 
                        html: '' 
                    });
                }
            }
        } catch (error) {
            info('Error finding elements:', { error });
            results.push({ 
                selector, 
                error: error instanceof Error ? error.message : "Element not found or inaccessible", 
                type: 'print' as const, 
                html: '' 
            });
        }
    }
    
    return results;
}

export async function executePrintAction(
    page: Page,
    action: PrintAction,
    _options: BrowserOptions
): Promise<ActionResult> {
    const results = await captureElementsHtml(page, action.elements);

    const successfulResults = results.filter(r => !r.error && r.html);
    const failedResults = results.filter(r => r.error);

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
        data: results,
    };
}