import type { Page } from "playwright";
import { error, info, debug } from "../../utils/logging";
import type { Action, ActionResult, BrowserOptions, PlannedActionResult, PrintAction } from "../../types";
import { convertToMarkdown } from "../../utils/markdown";
import { waitForPageStability } from "../stability";
import { analyzePageStructure, identifyMainContent } from "../analysis";

// Maximum length for captured content to prevent excessive content sizes
const MAX_CAPTURED_CONTENT_LENGTH = 50000;

// Minimum number of items to capture before considering truncation
const MIN_ELEMENTS_TO_CAPTURE = 5;

// Additional metadata we'll track internally
interface ExtendedMetadata {
	elementCount: number;
	truncated: boolean;
	originalLength: number;
}

/**
 * Capture content from specified selectors in either HTML or markdown format
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
	let _extendedMetadata: ExtendedMetadata | undefined;

	try {
		// Wait for stability before capturing content
		await waitForPageStability(page, options);

		// For each selector, try to find elements
		for (const selector of selectors) {
			info('Searching for elements:', { selector });
			const elements = await page.$$(selector);

			if (elements.length > 0) {
				// Capture content from all matching elements
				const htmlContents: string[] = [];
				let totalContentLength = 0;
				let truncated = false;
				
				// Add a header with element count information
				const headerText = `Found ${elements.length} element${elements.length > 1 ? 's' : ''} matching "${selector}"`;
				htmlContents.push(`<h2>${headerText}</h2>`);
				
				for (const element of elements) {
					// Get element content in HTML format (will be converted to markdown later if requested)
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
					// Always capture at least MIN_ELEMENTS_TO_CAPTURE elements if possible
					if (totalContentLength + html.length > MAX_CAPTURED_CONTENT_LENGTH && 
						htmlContents.length > (MIN_ELEMENTS_TO_CAPTURE * 3)) { // * 3 because each element adds 3 entries (metadata, content, separator)
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
						htmlContents.push('<hr class="element-separator" style="margin: 20px 0;"/>');
					}
					
					totalContentLength += html.length;
				}
				
				// Join all HTML content
				let combinedHtml = htmlContents.join('\n\n');
				
				// Check if content exceeds maximum length
				if (truncated || combinedHtml.length > MAX_CAPTURED_CONTENT_LENGTH) {
					combinedHtml = combinedHtml.substring(0, MAX_CAPTURED_CONTENT_LENGTH);
					truncated = true;
				}
				
				// Add truncation notice if needed
				if (truncated) {
					combinedHtml += `\n\n**Note: Content was truncated to ${MAX_CAPTURED_CONTENT_LENGTH} characters. Some elements may have been omitted.**`;
				}
				
				// Convert to markdown if requested, otherwise keep as HTML
				if (format === "markdown") {
					try {
						// convertToMarkdown returns a PlannedActionResult
						const markdownResult = convertToMarkdown(combinedHtml, selector, 'markdown');
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
					// For HTML format, keep the original HTML content
					// Use convertToMarkdown to properly clean the HTML
					const htmlResult = convertToMarkdown(combinedHtml, selector, 'html');
					result.html = htmlResult.html;
					result.format = 'html';
					info('Successfully captured content in HTML format');
				}
				
				// We found content, so we can remove the error
				delete result.error;
				
				// Store extended metadata for use in the action result message
				_extendedMetadata = {
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
		
		// If no content found with specified selectors, try enhanced content discovery
		if (result.error && page.url() !== '') {
			info('Primary selectors not found, attempting enhanced content discovery');
			
			// First, try to identify the main content using our new analysis
			try {
				const mainContent = await identifyMainContent(page);
				
				if (mainContent && mainContent.selector) {
					info(`Identified main content with selector: ${mainContent.selector} (confidence: ${mainContent.confidence})`);
					
					// Capture content from the main content selector
					const mainContentResult = await captureElementsHtml(
							page, 
							[mainContent.selector], 
							format,
							options
					);
					
					if (!mainContentResult.error) {
						return {
								success: true,
								message: `Main content captured with selector: ${mainContent.selector}`,
								warning: `Original selectors "${printAction.elements.join(', ')}" not found; used main content selector "${mainContent.selector}"`,
								data: [mainContentResult]
						};
					}
				}
			} catch (analysisErr) {
				debug(`Error during main content identification: ${analysisErr instanceof Error ? analysisErr.message : String(analysisErr)}`);
			}
			
			// If main content identification failed, try analyzing page structure
			try {
				const pageStructure = await analyzePageStructure(page);
				
				// Try to find a suitable component based on the requested elements
				const componentTypes = ['main', 'article', 'navigation', 'form', 'header', 'footer'];
				const requestedTypes = printAction.elements.map(el => {
						if (el.includes('nav') || el.includes('menu')) return 'navigation';
						if (el.includes('main') || el.includes('content')) return 'main';
						if (el.includes('article') || el.includes('post')) return 'article';
						if (el.includes('form')) return 'form';
						if (el.includes('header')) return 'header';
						if (el.includes('footer')) return 'footer';
						return null;
				}).filter(Boolean);
				
				// Find matching components
				const matchingComponents = pageStructure.components.filter(component => {
						// If we have requested types, check for matches
						if (requestedTypes.length > 0) {
								return requestedTypes.includes(component.type as 'navigation' | 'form' | 'main' | 'article' | 'header' | 'footer' | null);
						}
						// Otherwise, prefer main content
						return componentTypes.includes(component.type as any);
				});
				
				if (matchingComponents.length > 0) {
						// Sort by confidence
						matchingComponents.sort((a, b) => b.confidence - a.confidence);
						const bestComponent = matchingComponents[0];
						
						info(`Found matching component: ${bestComponent.type} with selector: ${bestComponent.selector} (confidence: ${bestComponent.confidence})`);
						
						// Capture content from the component selector
						const componentResult = await captureElementsHtml(
								page, 
								[bestComponent.selector], 
								format,
								options
						);
						
						if (!componentResult.error) {
								return {
										success: true,
										message: `${bestComponent.type} content captured with selector: ${bestComponent.selector}`,
										warning: `Original selectors "${printAction.elements.join(', ')}" not found; used ${bestComponent.type} component selector "${bestComponent.selector}"`,
										data: [componentResult]
								};
						}
				}
			} catch (structureErr) {
				debug(`Error during page structure analysis: ${structureErr instanceof Error ? structureErr.message : String(structureErr)}`);
			}
			
			// If all else fails, fall back to common content container selectors
			const fallbackSelectors = [
					'main', 'article', '#content', '#main-content', '.content', 
					'h1', // At minimum, grab the headline
					'body' // Last resort, grab everything
			];
			
			// Try each fallback selector
			for (const selector of fallbackSelectors) {
					const fallbackResult = await captureElementsHtml(page, [selector], format, options);
					if (!fallbackResult.error) {
							return {
									success: true,
									message: `Fallback content captured from ${selector}`,
									warning: `Original selectors "${printAction.elements.join(', ')}" not found; used fallback selector "${selector}"`,
									data: [fallbackResult]
							};
					}
			}
		}
		
		// Get element count from the result for the success message
		const elementCount = result.html.includes('Found ') ? 
				result.html.match(/Found (\d+) element/)?.[1] : 
				'';
		
		// Combine all results
		const combinedResults = await Promise.all([result]);
		
		// Mark the action as completed
		action.completed = true;
		
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