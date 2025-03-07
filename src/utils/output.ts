import type { PageAnalysis, Plan, ActionStatus } from "../types";
import { getActionSymbol, getActionDescription } from "./actions";

export type OutputFormat = "json" | "pretty";

export interface DisplayOptions {
	showInputs?: boolean;
	showButtons?: boolean;
	showLinks?: boolean;
}

// Maximum character limit for each planned action result
const MAX_DISPLAYED_CONTENT_LENGTH = 50000;

// Helper function to normalize format
function normalizeFormat(format: string | undefined): OutputFormat {
	if (format === "json") {
		return "json";
	}
	return "pretty"; // Default to pretty if not specified or invalid
}

// New centralized formatting function
export function formatAnalysis(
	analysis: PageAnalysis,
	format: OutputFormat | string = "pretty",
	options: DisplayOptions = {}
): string {
	// Normalize the format
	const normalizedFormat = normalizeFormat(format);
	
	// Use the existing printAnalysis function with normalized parameters
	return printAnalysis(analysis, normalizedFormat, options);
}

export function printPlan(plan: Plan): string {
	let output = "";
	output += "\n📋 Plan to Execute:\n";
	output += "=".repeat(50) + "\n";
	plan.actions.forEach((action, index) => {
		const symbol = getActionSymbol(action);
		output += `${symbol} Step ${index + 1}/${plan.actions.length}: ${getActionDescription(action)}\n`;
	});
	output += "=".repeat(50) + "\n\n";
	return output;
}

// Helper function to create consistent section headers
function createSectionHeader(title: string): string {
	return `\n${title}\n${"=".repeat(80)}\n`;
}

// Helper function to create consistent section dividers
function createSectionDivider(): string {
	return `\n${"-".repeat(80)}\n`;
}

// Helper function to format content based on format type
function formatContent(content: string, format: 'html' | 'markdown' | undefined): string {
	// Skip formatting for empty content or "Content captured successfully" messages
	if (!content || content.startsWith('Content captured successfully')) {
		return content;
	}

	// For markdown content, apply enhanced formatting to ensure proper display
	if (format === 'markdown') {
		// Fix common markdown formatting issues and improve readability
		return content
			// Ensure proper newlines around headings
			.replace(/([^\n])(\#{1,6}\s)/g, '$1\n\n$2')
			// Ensure proper spacing around links
			.replace(/\](\()/g, '] $1')
			// Fix newlines around horizontal rules
			.replace(/([^\n])(\-\-\-)/g, '$1\n\n$2')
			.replace(/(\-\-\-)([^\n])/g, '$1\n\n$2')
			// Improve list formatting
			.replace(/([^\n])(\-\s|\*\s|\d+\.\s)/g, '$1\n\n$2')
			// Improve code block formatting
			.replace(/([^\n])```/g, '$1\n\n```')
			.replace(/```([^\n])/g, '```\n$1')
			// Cleanup excessive newlines
			.replace(/\n{3,}/g, '\n\n');
	}

	// For HTML format, preserve the HTML tags but clean up whitespace and improve readability
	if (format === 'html') {
		return content
			// Replace 3+ consecutive newlines with 2
			.replace(/\n{3,}/g, '\n\n')
			// Add newlines between tags for better readability
			.replace(/>\s*</g, '>\n<')
			// Indent nested tags for better readability
			.replace(/(<[^\/][^>]*>)\n/g, '$1\n  ')
			// Clean up excessive whitespace
			.replace(/\s{2,}/g, ' ')
			// Ensure proper spacing around attributes
			.replace(/([a-zA-Z0-9])=(["\'])/g, '$1 = $2');
	}

	// For undefined format, add some basic formatting to make it more readable
	return content
		// Replace 3+ consecutive newlines with 2
		.replace(/\n{3,}/g, '\n\n')
		// Clean up excessive whitespace
		.replace(/\s{2,}/g, ' ')
		// Add newlines after periods for better readability
		.replace(/\.\s+([A-Z])/g, '.\n$1');
}

export function printAnalysis(
	analysis: PageAnalysis,
	format: OutputFormat = "pretty",
	options: DisplayOptions = {}
): string {
	if (format === "json") {
		return JSON.stringify(analysis, null, 2);
	}

	let output = "";

	// Add title and description with improved formatting
	output += "\n📄 Page Analysis:\n\n";
	if (analysis.title) {
		output += `Title: ${analysis.title}\n`;
	}
	if (analysis.description) {
		output += `Description: ${analysis.description}\n`;
	}
	output += "\n";

	// Add error information if present in the analysis
	if (analysis.error) {
		output += "⚠️ Error Information:\n";
		output += "=".repeat(50) + "\n";
		output += `${analysis.error}\n\n`;
	}

	// Add AI-friendly guidance section with enhanced structure analysis
	output += "🤖 AI Action Guidance:\n";
	output += "=".repeat(50) + "\n";
	output += `This page contains ${analysis.inputs.length} input elements, ${analysis.buttons.length} buttons, and ${analysis.links.length} links.\n`;

	// Analyze page structure and patterns
	const hasListStructure = detectListStructure(analysis);
	const hasFormStructure = detectFormStructure(analysis);
	const hasNavigationMenu = detectNavigationMenu(analysis);
	
	// Add page structure insights
	if (hasListStructure || hasFormStructure || hasNavigationMenu) {
		output += "\nPage Structure Insights:\n";
		
		if (hasListStructure) {
			output += "- This page contains a list/collection of items (likely repeating elements with similar structure)\n";
		}
		
		if (hasFormStructure) {
			output += "- This page contains form(s) with input fields and submission buttons\n";
		}
		
		if (hasNavigationMenu) {
			output += "- This page has a navigation menu structure with multiple links\n";
		}
	}

	// Add possible interactions based on element types
	output += "\nPossible interactions:\n";
	if (analysis.inputs.length > 0) {
		output += "- This page has forms that can be filled (use typing actions on inputs followed by click actions on buttons)\n";
	}
	if (analysis.links.length > 0) {
		output += "- This page has navigation links (use click actions on links to navigate)\n";
	}
	output += "- Content can be extracted with print actions on specific elements\n";

	// Add recommended action patterns
	output += "\nRecommended action pattern examples:\n";
	output += "1. To fill a form: wait → type → click → wait for response (expect form submission or validation feedback)\n";
	output += "2. To navigate: wait → click link → wait for new page (expect URL change and page content refresh)\n";
	output += "3. To extract content: wait → print elements with specific selectors (use container selectors for grouped content)\n";
	if (analysis.inputs.length > 1) {
		output += "5. To complete multi-field forms: wait → type in first field → press Tab or click next field → type → ... → submit\n";
	}

	output += "\nPage Elements Summary:\n";
	output += "=".repeat(50) + "\n";

	// Filter visible inputs (those with a valid selector)
	const visibleInputs = analysis.inputs.filter(input => input && input.selector && input.selector.trim() !== '');

	// Group inputs by type
	const textInputs = visibleInputs.filter(input => 
			['text', 'textarea', 'search', 'email', 'password'].includes(input.type || ''));
	const buttonInputs = visibleInputs.filter(input => 
			['submit', 'button', 'reset'].includes(input.type || ''));
	const checkboxInputs = visibleInputs.filter(input => 
			['checkbox', 'radio'].includes(input.type || ''));
	const otherInputs = visibleInputs.filter(input => 
			!textInputs.includes(input) && 
			!buttonInputs.includes(input) && 
			!checkboxInputs.includes(input));

	// Show input elements with more details
	if (visibleInputs.length > 0) {
		output += `Total Input Elements: ${analysis.inputs.length}\n`;
		
		if (textInputs.length > 0) {
			output += "[Text Inputs]\n";
			textInputs.slice(0, 3).forEach((input, index) => {
				const placeholder = input.placeholder ? ` placeholder="${input.placeholder}"` : '';
				output += `- ${index + 1}. ${input.label || 'No label'} (${input.type || 'text'})${placeholder}\n`;
				output += `  Selector: ${input.selector}\n`;
			});
			if (textInputs.length > 3) {
				output += `  ... and ${textInputs.length - 3} more text inputs\n`;
			}
			output += "\n";
		}
		
		if (buttonInputs.length > 0) {
			output += "[Button Inputs]\n";
			buttonInputs.slice(0, 2).forEach((input, index) => {
				output += `- ${index + 1}. ${input.label || 'No label'} (${input.type})\n`;
				output += `  Selector: ${input.selector}\n`;
			});
			if (buttonInputs.length > 2) {
				output += `  ... and ${buttonInputs.length - 2} more button inputs\n`;
			}
			output += "\n";
		}
		
		if (checkboxInputs.length > 0) {
			output += "[Checkbox/Radio Inputs]\n";
			checkboxInputs.slice(0, 2).forEach((input, index) => {
				output += `- ${index + 1}. ${input.label || 'No label'} (${input.type})\n`;
				output += `  Selector: ${input.selector}\n`;
			});
			if (checkboxInputs.length > 2) {
				output += `  ... and ${checkboxInputs.length - 2} more checkbox/radio inputs\n`;
			}
			output += "\n";
		}
		
		if (otherInputs.length > 0) {
			output += "[Other Inputs]\n";
			otherInputs.slice(0, 2).forEach((input, index) => {
				output += `- ${index + 1}. ${input.label || 'No label'} (${input.type || 'unknown'})\n`;
				output += `  Selector: ${input.selector}\n`;
			});
			if (otherInputs.length > 2) {
				output += `  ... and ${otherInputs.length - 2} more inputs\n`;
			}
			output += "\n";
		}
	}

	// Filter visible buttons (those with a valid selector)
	const visibleButtons = analysis.buttons.filter(button => button && button.selector && button.selector.trim() !== '');

	// Group buttons by their characteristics
	const primaryButtons = visibleButtons.filter(button => 
			button.text && button.text.toLowerCase().match(/(submit|search|login|sign in|continue|save|confirm)/));
	const navigationButtons = visibleButtons.filter(button => 
			button.text && button.text.toLowerCase().match(/(next|previous|back|menu|nav|navigation)/));
	const otherButtons = visibleButtons.filter(button => 
			!primaryButtons.includes(button) && 
			!navigationButtons.includes(button));

	// Show button elements with more details - always show top 5 only
	if (visibleButtons.length > 0) {
		output += `Total Button Elements: ${analysis.buttons.length}\n`;
		
		if (primaryButtons.length > 0) {
			output += "[Primary Action Buttons]\n";
			primaryButtons.slice(0, 2).forEach((button, index) => {
				output += `- ${index + 1}. ${button.text || 'No text'}\n`;
				output += `  Selector: ${button.selector}\n`;
			});
			if (primaryButtons.length > 2) {
				output += `  ... and ${primaryButtons.length - 2} more primary buttons\n`;
			}
			output += "\n";
		}
		
		if (navigationButtons.length > 0) {
			output += "[Navigation Buttons]\n";
			navigationButtons.slice(0, 2).forEach((button, index) => {
				output += `- ${index + 1}. ${button.text || 'No text'}\n`;
				output += `  Selector: ${button.selector}\n`;
			});
			if (navigationButtons.length > 2) {
				output += `  ... and ${navigationButtons.length - 2} more navigation buttons\n`;
			}
			output += "\n";
		}
		
		if (otherButtons.length > 0) {
			output += "[Other Buttons]\n";
			otherButtons.slice(0, 3).forEach((button, index) => {
				output += `- ${index + 1}. ${button.text || 'No text'}\n`;
				output += `  Selector: ${button.selector}\n`;
			});
			if (otherButtons.length > 3) {
				output += `  ... and ${otherButtons.length - 3} more buttons\n`;
			}
			output += "\n";
		}
	}

	// Filter visible links (those with a valid selector)
	const visibleLinks = analysis.links.filter(link => link && link.selector && link.selector.trim() !== '');

	// Group links by purpose
	const navigationLinks = visibleLinks.filter(link => 
			link.title && link.title.toLowerCase().match(/(home|menu|about|contact|login|sign|account|profile|settings)/));
	const contentLinks = visibleLinks.filter(link => 
			!navigationLinks.includes(link) && link.url && !link.url.startsWith('http'));
	const externalLinks = visibleLinks.filter(link => 
			!navigationLinks.includes(link) && !contentLinks.includes(link));

	// Show link elements with more details including URLs - always show top 5 only
	if (visibleLinks.length > 0) {
		output += `Total Link Elements: ${analysis.links.length}\n`;
		
		if (navigationLinks.length > 0) {
			output += "[Navigation Links]\n";
			navigationLinks.slice(0, 3).forEach((link, index) => {
				output += `- ${index + 1}. ${link.title || ''} → ${link.url || ''}\n`;
				output += `  Selector: ${link.selector}\n`;
			});
			if (navigationLinks.length > 3) {
				output += `  ... and ${navigationLinks.length - 3} more navigation links\n`;
			}
			output += "\n";
		}
		
		if (contentLinks.length > 0) {
			output += "[Content Links]\n";
			contentLinks.slice(0, 3).forEach((link, index) => {
				output += `- ${index + 1}. ${link.title || ''} → ${link.url || ''}\n`;
				output += `  Selector: ${link.selector}\n`;
			});
			if (contentLinks.length > 3) {
				output += `  ... and ${contentLinks.length - 3} more content links\n`;
			}
			output += "\n";
		}
		
		if (externalLinks.length > 0) {
			output += "[External Links]\n";
			externalLinks.slice(0, 3).forEach((link, index) => {
				output += `- ${index + 1}. ${link.title || ''} → ${link.url || ''}\n`;
				output += `  Selector: ${link.selector}\n`;
			});
			if (externalLinks.length > 3) {
				output += `  ... and ${externalLinks.length - 3} more external links\n`;
			}
		}
	}

	// Show action results if present
	if (analysis.plannedActions && analysis.plannedActions.length > 0) {
		output += createSectionHeader("📊 Action Results");
		
		analysis.plannedActions.forEach((result, index) => {
			// Add a divider between results if not the first one
			if (index > 0) {
				output += createSectionDivider();
			}
			
			// Add a header for each result with selector and format info
			const formatLabel = result.format === 'markdown' ? '(Markdown)' : '(HTML)';
			output += `📌 Content from: ${result.selector} ${formatLabel}\n\n`;
			
			if (result.error) {
				output += `⚠️ Error: ${result.error}\n\n`;
			}
			
			// Always show content if available, even if there was an error
			if (result.html) {
				// Check if content exceeds the maximum length
				if (result.html.length > MAX_DISPLAYED_CONTENT_LENGTH) {
					// Truncate the content and add a warning
					const truncatedContent = result.html.substring(0, MAX_DISPLAYED_CONTENT_LENGTH);
					output += truncatedContent + "\n\n";
					output += `⚠️ Content was truncated (${result.html.length} characters, showing first ${MAX_DISPLAYED_CONTENT_LENGTH})\n`;
				} else {
					output += result.html + "\n";
				}
				
				// Add metadata if available for easier element referencing in future actions
				if (result.metadata) {
					output += "\nElement metadata:\n";
					if (result.metadata.tagName) output += `  Tag: ${result.metadata.tagName}\n`;
					if (result.metadata.id) output += `  ID: ${result.metadata.id}\n`;
					if (result.metadata.className) output += `  Classes: ${result.metadata.className}\n`;
				}
			}
		});
		
		output += createSectionDivider();
	}

	// Next Actions Suggestions
	output += "\n🚀 Next Actions Suggestions:\n";

	// Detect page structure to provide contextual suggestions
	const hasForm = detectFormStructure(analysis);
	const hasList = detectListStructure(analysis);
	const hasNavigation = navigationLinks.length > 0 || navigationButtons.length > 0;

	// Form interaction suggestions
	if (textInputs.length > 0 && (primaryButtons.length > 0 || buttonInputs.length > 0)) {
		// Get the first text input for suggestion
		if (textInputs.length > 0) {
			const firstInput = textInputs[0];
			output += `- Type into ${firstInput.label || 'input field'}: \`--type "${firstInput.selector}" "your text"\`\n`;
		}
		
		// Get the first button for suggestion
		const submitButton = primaryButtons.length > 0 ? primaryButtons[0] : 
							(buttonInputs.length > 0 ? buttonInputs[0] : null);
		if (submitButton) {
			output += `- Submit form: \`--click "${submitButton.selector}"\`\n`;
		}
		
		// Suggest form fill and submit as a sequence
		if (textInputs.length > 0 && submitButton) {
			output += `- Fill and submit form: \`--plan '{"actions":[{"type":"type","selector":"${textInputs[0].selector}","text":"your text"},{"type":"click","selector":"${submitButton.selector}"}]}'\`\n`;
		}
	}

	// Navigation suggestions
	if (hasNavigation) {
		// Suggest clicking a navigation link
		if (navigationLinks.length > 0) {
			output += `- Navigate to ${navigationLinks[0].title || 'link'}: \`--click "${navigationLinks[0].selector}"\`\n`;
		}
		
		// Suggest clicking a navigation button
		if (navigationButtons.length > 0) {
			output += `- Open menu: \`--click "${navigationButtons[0].selector}"\`\n`;
		}
	}

	// Content extraction suggestions
	// Suggest extracting list content if detected
	if (hasList) {
		output += `- Extract list content: \`--extract ".list-item, li, .item"\`\n`;
	}

	// Suggest extracting form fields if form detected
	if (hasForm) {
		output += `- Extract form fields: \`--extract "input, select, textarea"\`\n`;
	}

	// Always suggest extracting main content
	output += `- Extract main content: \`--extract "main, #content, .content, article"\`\n`;

	// Advanced interaction suggestions
	// Multi-field form submission if multiple text inputs
	if (textInputs.length > 1) {
		const submitButton = primaryButtons.length > 0 ? primaryButtons[0] : 
							(buttonInputs.length > 0 ? buttonInputs[0] : null);
		if (submitButton) {
			output += `- Fill multiple fields: \`--plan '{"actions":[{"type":"type","selector":"${textInputs[0].selector}","text":"text1"},{"type":"type","selector":"${textInputs[1].selector}","text":"text2"},{"type":"click","selector":"${submitButton.selector}"}]}'\`\n`;
		}
	}

	// Generic actions
	output += `- Wait for element: \`--wait "selector"\`\n`;
	output += `- Extract content: \`--extract "selector"\`\n`;
	output += `- View HTML structure: \`--debug\`\n`;

	return output;
}

export function printActionStatus(status: ActionStatus): string {
	const { step, totalSteps, symbol, description, result } = status;
	let output = `[${step}/${totalSteps}] ${symbol} ${description}`;
	
	if (result) {
		if (result.success) {
			output += " ✅";
		} else {
			output += " ❌";
			if (result.message) {
				output += ` (${result.message})`;
			}
		}
	}
	
	return output;
}

export function printActionSummary(statuses: ActionStatus[]): string {
	const total = statuses.length;
	const successful = statuses.filter(s => s.result?.success).length;
	const failed = total - successful;
	
	let output = "\nAction Summary:\n";
	output += "=".repeat(50) + "\n";
	output += `Total Actions: ${total}\n`;
	output += `Successful: ${successful} ✅\n`;
	if (failed > 0) {
		output += `Failed: ${failed} ❌\n`;
	}
	output += "=".repeat(50) + "\n";
	
	return output;
}

// Helper functions to detect common page structures

function detectListStructure(analysis: PageAnalysis): boolean {
	// Look for repeated element patterns that might indicate a list
	// Common indicators: multiple similar selectors, class names containing 'list', 'item', etc.

	// Check link patterns
	if (analysis.links && analysis.links.length >= 3) {
		const selectors = analysis.links
			.filter(link => link && typeof link.selector === 'string')
			.map(link => link.selector);
			
		const commonParentPattern = findCommonSelectorPattern(selectors);
		if (commonParentPattern) return true;
	}

	// Check button patterns
	if (analysis.buttons && analysis.buttons.length >= 3) {
		const selectors = analysis.buttons
			.filter(button => button && typeof button.selector === 'string')
			.map(button => button.selector);
			
		const commonParentPattern = findCommonSelectorPattern(selectors);
		if (commonParentPattern) return true;
	}

	const listIndicators = ['list', 'item', 'collection', 'row', 'card', 'grid'];

	// Check for list indicators in links
	if (analysis.links) {
		for (const link of analysis.links) {
			if (link && typeof link.selector === 'string' && 
				listIndicators.some(indicator => link.selector.toLowerCase().includes(indicator))) {
				return true;
			}
		}
	}

	// Check for list indicators in buttons
	if (analysis.buttons) {
		for (const button of analysis.buttons) {
			if (button && typeof button.selector === 'string' && 
				listIndicators.some(indicator => button.selector.toLowerCase().includes(indicator))) {
				return true;
			}
		}
	}

	return false;
}

function detectFormStructure(analysis: PageAnalysis): boolean {
	// Forms typically have inputs and submit buttons
	if (!analysis.inputs || analysis.inputs.length === 0) return false;

	// Check for submit buttons or buttons near inputs
	if (analysis.buttons && analysis.buttons.length > 0) {
		const hasSubmitButton = analysis.buttons.some(button => {
			if (!button || typeof button.text !== 'string') return false;
			
			const text = button.text.toLowerCase();
			return text.includes('submit') || 
					   text.includes('search') || 
					   text.includes('send') || 
					   text.includes('save') ||
					   text.includes('log in') ||
					   text.includes('sign in');
		});

		if (hasSubmitButton) return true;
	}

	// Check for input types that suggest forms
	const hasFormInputs = analysis.inputs.some(input => {
		return input && (
			(input.type === 'text') || 
			(input.type === 'password') || 
			(input.type === 'email') ||
			(input.type === 'search')
		);
	});

	return hasFormInputs;
}

function detectNavigationMenu(analysis: PageAnalysis): boolean {
	// Navigation menus typically have multiple links in a common container
	if (!analysis.links || analysis.links.length < 3) return false;

	// Check for common navigation terms in link text
	const navTerms = ['home', 'about', 'contact', 'menu', 'nav', 'navigation'];

	// Count links with navigation-like terms
	const navLinks = analysis.links.filter(link => {
		// Ensure link and link.title exists before calling toLowerCase
		if (!link || typeof link.title !== 'string') return false;
		
		const title = link.title.toLowerCase();
		return navTerms.some(term => title.includes(term));
	});

	if (navLinks.length >= 2) return true;

	// Check for common selector patterns in navigation menus
	const selectors = analysis.links
		.filter(link => link && typeof link.selector === 'string')
		.map(link => link.selector);
		
	const navSelectors = selectors.filter(selector => {
		if (!selector) return false;
		
		const lowerSelector = selector.toLowerCase();
		return lowerSelector.includes('nav') || 
			   lowerSelector.includes('menu') ||
			   lowerSelector.includes('header');
	});

	return navSelectors.length >= 2;
}

function findCommonSelectorPattern(selectors: string[]): string | null {
	// If fewer than 3 selectors, not enough to establish a pattern
	if (selectors.length < 3) return null;
	
	// Split each selector by spaces to analyze parts
	const selectorParts = selectors.map(selector => selector.split(' '));
	
	// Find the maximum depth that's common across all selectors
	const minDepth = Math.min(...selectorParts.map(parts => parts.length));
	
	// Try to find a common pattern at each depth level
	for (let depth = minDepth; depth >= 1; depth--) {
		// Check if all selectors at this depth follow a similar pattern
		const partsAtDepth = selectorParts.map(parts => parts.slice(0, depth).join(' '));
		
		// Check for similarity in these parts
		const firstPart = partsAtDepth[0];
		const similarityCount = partsAtDepth.filter(part => 
				part === firstPart || 
				(part.includes('[') && firstPart.includes('[')) || // Handle attribute selectors
				(part.includes('#') && firstPart.includes('#')) || // Handle ID selectors
				(part.includes('.') && firstPart.includes('.'))    // Handle class selectors
		).length;
		
		// If most selectors follow a similar pattern, return it
		if (similarityCount >= selectors.length * 0.7) {
				return firstPart;
		}
	}
	
	return null;
}