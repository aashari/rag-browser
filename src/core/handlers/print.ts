import type { Page } from "playwright";
import type { PrintAction, ActionResult, BrowserOptions, PlannedActionResult } from "../../types";
import { error, info } from "../../utils/logging";
import { createActionResult } from "../../utils/handlers";
import { convertToMarkdown } from "../../utils/markdown";

// Shared function to capture HTML content from elements
export async function captureElementsHtml(page: Page, selectors: string[], format: 'html' | 'markdown' = 'markdown'): Promise<PlannedActionResult[]> {
    const results: PlannedActionResult[] = [];
    
    for (const selector of selectors) {
        try {
            info('Searching for elements:', { selector });
            
            // Use page.evaluate to get HTML content directly and clean it
            const content = await page.evaluate((sel) => {
                const elements = Array.from(document.querySelectorAll(sel));
                if (elements.length === 0) return '';
                
                // Create a temporary container
                const container = document.createElement('div');
                
                // Clone each element into the container
                elements.forEach(el => {
                    const clone = el.cloneNode(true) as Element;
                    container.appendChild(clone);
                });
                
                // Remove scripts and styles from the container
                const scripts = container.getElementsByTagName('script');
                const styles = container.getElementsByTagName('style');
                
                // Remove in reverse order to avoid index changes
                for (let i = scripts.length - 1; i >= 0; i--) {
                    scripts[i].remove();
                }
                for (let i = styles.length - 1; i >= 0; i--) {
                    styles[i].remove();
                }
                
                // Clean up attributes
                const cleanAttributes = (element: Element) => {
                    // Remove style and class attributes
                    element.removeAttribute('style');
                    element.removeAttribute('class');
                    
                    // Clean child elements recursively
                    Array.from(element.children).forEach(child => {
                        cleanAttributes(child);
                    });
                };
                
                // Clean all elements in the container
                cleanAttributes(container);
                
                // Remove empty divs
                const removeEmptyDivs = (element: Element) => {
                    Array.from(element.children).forEach(child => {
                        if (child.tagName.toLowerCase() === 'div' && !child.textContent?.trim()) {
                            child.remove();
                        } else {
                            removeEmptyDivs(child);
                        }
                    });
                };
                
                removeEmptyDivs(container);
                
                return container.innerHTML;
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
            
        } catch (err) {
            error('Error capturing content:', { error: err instanceof Error ? err.message : String(err) });
            results.push({ 
                selector, 
                error: err instanceof Error ? err.message : "Failed to capture element content", 
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