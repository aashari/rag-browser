import type { Page } from "playwright";
import type { MarkdownAction, ActionResult, BrowserOptions } from "../../types";
import { turndownService } from "../../utils/markdown";
import { captureElementsHtml } from "./print";
import { info } from "../../utils/logging";

export async function executeMarkdownAction(
    page: Page,
    action: MarkdownAction,
    _options: BrowserOptions
): Promise<ActionResult> {
    // Use shared function to capture HTML
    const results = await captureElementsHtml(page, action.elements);
    
    info('Converting HTML to markdown for', { count: results.length, results });
    
    // Convert HTML to markdown for successful captures
    const markdownResults = results.map(result => {
        if (result.error || !result.html) {
            return result;
        }
        
        try {
            info('Converting HTML to markdown:', { html: result.html.substring(0, 100) + '...' });
            const markdown = turndownService.turndown(result.html);
            info('Successfully converted to markdown');
            
            return {
                ...result,
                html: markdown,
                type: 'markdown' as const
            };
        } catch (error) {
            info('Error converting to markdown:', { error });
            return {
                ...result,
                error: error instanceof Error ? error.message : 'Markdown conversion failed',
                type: 'markdown' as const
            };
        }
    });

    const successfulResults = markdownResults.filter(r => !r.error && r.html);
    const failedResults = markdownResults.filter(r => r.error);

    info('Conversion results:', { 
        successful: successfulResults.length,
        failed: failedResults.length
    });

    return {
        success: successfulResults.length > 0,
        message: successfulResults
            .map(r => r.html)
            .join("\n\n---\n\n"),
        warning: failedResults.length > 0
            ? `Failed to capture ${failedResults.length} elements: ${failedResults
                .map(r => `${r.selector} (${r.error})`)
                .join(", ")}`
            : undefined,
        data: markdownResults,
    };
} 