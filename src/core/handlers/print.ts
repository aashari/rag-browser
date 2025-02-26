import type { Page } from "playwright";
import { error, info } from "../../utils/logging";
import type { Action, ActionResult, BrowserOptions, PlannedActionResult, PrintAction } from "../../types";
import { convertToMarkdown } from "../../utils/markdown";
import { waitForPageStability } from "../stability";

// Maximum length for captured HTML content to prevent excessive content sizes
const MAX_CONTENT_LENGTH = 10000;

// Additional metadata we'll track internally
interface ExtendedMetadata {
	elementCount: number;
	truncated: boolean;
	originalLength: number;
}

/**
 * Capture HTML content from specified selectors
 */
export async function captureElementsHtml(
	page: Page,
	selectors: string[],
	format: "html" | "markdown" = "html",
	options: BrowserOptions
): Promise<PlannedActionResult> {
	// Default result with error state
	const result: PlannedActionResult = {
		selector: selectors.join(", "),
		type: 'print',
		format,
		error: "No content captured",
		html: "" // Add empty html to satisfy the type
	};

	// Track additional metadata that's not part of the PlannedActionResult interface
	let extendedMetadata: ExtendedMetadata | undefined;

	try {
		// Wait for stability before capturing content
		await waitForPageStability(page, options);

		// For each selector, try to find elements
		for (const selector of selectors) {
			info('Searching for elements:', { selector });
			const elements = await page.$$(selector);

			if (elements.length > 0) {
				// Capture HTML content from all matching elements
				const htmlContents: string[] = [];
				let totalContentLength = 0;
				let truncated = false;
				
				// Add a header with element count information
				const headerText = `Found ${elements.length} element${elements.length > 1 ? 's' : ''} matching "${selector}"`;
				htmlContents.push(`## ${headerText}`);
				
				for (const element of elements) {
					// Get HTML content
					const html = await page.evaluate((el) => {
						// Clone the element to avoid modifying the original
						const clone = el.cloneNode(true) as HTMLElement;
						
						// Remove scripts and styles to clean up the content
						const scripts = clone.querySelectorAll('script');
						scripts.forEach(script => script.remove());
						
						const styles = clone.querySelectorAll('style');
						styles.forEach(style => style.remove());
						
						// Remove empty divs to clean up the content
						const emptyDivs = clone.querySelectorAll('div:empty');
						emptyDivs.forEach(div => div.remove());
						
						return clone.outerHTML;
					}, element);
					
					// Check if adding this content would exceed the maximum length
					if (totalContentLength + html.length > MAX_CONTENT_LENGTH) {
						truncated = true;
						break;
					}
					
					// Get element metadata for better context
					const elementMetadata = await page.evaluate((el) => {
						return {
							tagName: el.tagName.toLowerCase(),
							id: el.id || '',
							className: Array.from(el.classList).join(' ') || '',
							attributes: Array.from(el.attributes)
								.map(attr => `${attr.name}="${attr.value}"`)
								.join(' ')
						};
					}, element);
					
					// Add element metadata as a comment
					const metadataText = `<!-- Element: ${elementMetadata.tagName}${elementMetadata.id ? ` id="${elementMetadata.id}"` : ''}${elementMetadata.className ? ` class="${elementMetadata.className}"` : ''} -->`;
					htmlContents.push(metadataText);
					
					// Set the metadata for the first element in the result
					if (!result.metadata) {
						result.metadata = elementMetadata;
					}
					
					// Add the actual HTML content
					htmlContents.push(html);
					
					// Add a separator between elements if there are multiple
					if (elements.length > 1) {
						htmlContents.push('---');
					}
					
					totalContentLength += html.length;
				}
				
				// Join all HTML content
				let combinedHtml = htmlContents.join('\n\n');
				
				// Check if content exceeds maximum length
				if (truncated || combinedHtml.length > MAX_CONTENT_LENGTH) {
					combinedHtml = combinedHtml.substring(0, MAX_CONTENT_LENGTH);
					truncated = true;
				}
				
				// Add truncation notice if needed
				if (truncated) {
					combinedHtml += `\n\n**Note: Content was truncated to ${MAX_CONTENT_LENGTH} characters. Some elements may have been omitted.**`;
				}
				
				// Convert to markdown if requested
				if (format === "markdown") {
					try {
						// convertToMarkdown returns a PlannedActionResult
						const markdownResult = convertToMarkdown(combinedHtml, selector);
						// Update our result with the markdown content
						result.html = markdownResult.html;
						result.format = 'markdown';
						info('Successfully converted content to markdown');
					} catch (conversionError) {
						// If markdown conversion fails, fall back to HTML
						result.html = combinedHtml;
						result.format = 'html';
						info('Error converting to markdown, falling back to HTML:', { error: conversionError });
					}
				} else {
					// For HTML format, just use the HTML content
					result.html = combinedHtml;
					result.format = 'html';
					info('Successfully captured HTML content');
				}
				
				// We found content, so we can remove the error
				delete result.error;
				
				// Store extended metadata for use in the action result message
				extendedMetadata = {
					elementCount: elements.length,
					truncated,
					originalLength: totalContentLength
				};
				
				// We found content, so we can stop looking
				break;
			} else {
				info('No elements found for selector:', { selector });
			}
		}
		
		return result;
	} catch (err) {
		error('Error capturing content:', { error: err instanceof Error ? err.message : String(err) });
		result.error = err instanceof Error ? err.message : String(err);
		return result;
	}
}

/**
 * Execute a print action
 */
export async function executePrintAction(
	page: Page,
	action: Action,
	options: BrowserOptions
): Promise<ActionResult> {
	try {
		// Check if action is a PrintAction
		if (action.type !== "print") {
			throw new Error(`Invalid action type: ${action.type}`);
		}
		
		const printAction = action as PrintAction;
		
		if (!printAction.elements || !Array.isArray(printAction.elements) || printAction.elements.length === 0) {
			throw new Error("No elements specified for print action");
		}
		
		const format = printAction.format || "html";
		const result = await captureElementsHtml(page, printAction.elements, format, options);
		
		// Get element count from the result for the success message
		const elementCount = result.html.includes('Found ') ? 
			result.html.match(/Found (\d+) element/)?.[1] : 
			'';
		
		return {
			success: !result.error,
			message: result.error || `Content captured successfully${elementCount ? ` (${elementCount} elements)` : ''}`,
			data: [result] // Wrap in array to match ActionResult.data type
		};
	} catch (err) {
		return {
			success: false,
			message: err instanceof Error ? err.message : String(err)
		};
	}
}