import type { Page } from "playwright";
import type { MarkdownAction, ActionResult, BrowserOptions, PlannedActionResult } from "../../types";
import { turndownService } from "../../utils/markdown";

export async function executeMarkdownAction(
    page: Page,
    action: MarkdownAction,
    _options: BrowserOptions
): Promise<ActionResult> {
    const results: PlannedActionResult[] = [];
    for (const selector of action.elements) {
        try {
            const elements = await page.$$(selector);
            for (const element of elements) {
                const html = await element.evaluate(el => {
                    // Get both the outer HTML and inner text for better conversion
                    const outerHTML = el.outerHTML;
                    const innerText = el.textContent || '';
                    const attributes = Array.from(el.attributes).map(attr => `${attr.name}="${attr.value}"`).join(' ');
                    return { outerHTML, innerText, attributes };
                });

                // Convert to markdown, preserving important attributes
                let markdown = turndownService.turndown(html.outerHTML);
                if (html.attributes) {
                    markdown = `<!-- ${html.attributes} -->\n${markdown}`;
                }

                results.push({ 
                    selector, 
                    html: markdown, 
                    type: 'markdown' as const 
                });
            }
        } catch (error) {
            console.error('Error in markdown conversion:', error);
            results.push({ 
                selector, 
                error: "Element not found or inaccessible", 
                type: 'markdown' as const, 
                html: '' 
            });
        }
    }

    return {
        success: results.some((r) => !r.error),
        message: results
            .filter((r) => !r.error)
            .map((r) => `Markdown captured for ${r.selector}`)
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