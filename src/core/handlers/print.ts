import type { Page } from "playwright";
import type { PrintAction, ActionResult, BrowserOptions, PlannedActionResult } from "../../types";
import { info } from "../../utils/logging";
import { createActionResult } from "../../utils/handlers";
import { convertToMarkdown } from "../../utils/markdown";

// Shared function to capture HTML content from elements
export async function captureElementsHtml(page: Page, selectors: string[], format: 'html' | 'markdown' = 'markdown'): Promise<PlannedActionResult[]> {
    const results: PlannedActionResult[] = [];
    
    for (const selector of selectors) {
        try {
            info('Searching for elements:', { selector });
            
            // Use page.evaluate to get HTML content directly
            const content = await page.evaluate((sel) => {
                const elements = Array.from(document.querySelectorAll(sel));
                if (elements.length === 0) return '';
                
                // Combine HTML from all matching elements
                return elements
                    .map(el => el.outerHTML)
                    .join('\n');
            }, selector);
            
            if (!content) {
                info('No elements found for selector:', { selector });
                results.push({ 
                    selector, 
                    error: "No elements found", 
                    type: 'print' as const, 
                    html: '',
                    format 
                });
                continue;
            }

            info('Successfully captured HTML content');
            
            // Convert to markdown if requested
            if (format === 'markdown') {
                try {
                    const result = convertToMarkdown(content, selector);
                    info('Successfully converted content to markdown');
                    results.push({
                        ...result,
                        type: 'print' as const,
                        format
                    });
                } catch (conversionError) {
                    info('Error converting to markdown, falling back to HTML:', { error: conversionError });
                    results.push({ 
                        selector, 
                        html: content,
                        type: 'print' as const,
                        format: 'html',
                        error: conversionError instanceof Error ? conversionError.message : "Failed to convert to markdown"
                    });
                }
            } else {
                results.push({ 
                    selector, 
                    html: content,
                    type: 'print' as const,
                    format
                });
            }
            
        } catch (error) {
            info('Error capturing content:', { error });
            results.push({ 
                selector, 
                error: error instanceof Error ? error.message : "Failed to capture element content", 
                type: 'print' as const, 
                html: '',
                format 
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
    const results = await captureElementsHtml(page, action.elements, action.format);
    return createActionResult(results, action.format);
}