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
	// Ensure we have valid options with defaults
	const normalizedOptions: DisplayOptions = {
		showInputs: options.showInputs ?? false,
		showButtons: options.showButtons ?? false,
		showLinks: options.showLinks ?? false
	};
	
	// Normalize the format
	const normalizedFormat = normalizeFormat(format);
	
	// Use the existing printAnalysis function with normalized parameters
	return printAnalysis(analysis, normalizedFormat, normalizedOptions);
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

	// For markdown content, apply minimal formatting to ensure proper display
	if (format === 'markdown') {
		// Fix common markdown formatting issues
		return content
			// Ensure proper newlines around headings
			.replace(/([^\n])(\#{1,6}\s)/g, '$1\n\n$2')
			// Ensure proper spacing around links
			.replace(/\](\()/g, '] $1')
			// Fix newlines around horizontal rules
			.replace(/([^\n])(\-\-\-)/g, '$1\n\n$2')
			.replace(/(\-\-\-)([^\n])/g, '$1\n\n$2')
			// Cleanup excessive newlines
			.replace(/\n{3,}/g, '\n\n');
	}

	// For HTML or undefined format, add some basic formatting to make it more readable
	return content
		.replace(/\n{3,}/g, '\n\n') // Replace 3+ consecutive newlines with 2
		.replace(/<\/p>\s*<p>/g, '\n\n') // Add proper paragraph spacing
		.replace(/<br\s*\/?>/g, '\n') // Replace <br> with newlines
		.replace(/<\/?[^>]+(>|$)/g, ''); // Remove HTML tags for cleaner CLI output
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

	// Add interaction recommendations with more context
	output += "\nPossible interactions:\n";

	// Suggest form interactions if inputs and buttons exist
	if (analysis.inputs.length > 0 && analysis.buttons.length > 0) {
		output += "- This page has forms that can be filled (use typing actions on inputs followed by click actions on buttons)\n";
	}

	// Suggest navigation if links exist
	if (analysis.links.length > 0) {
		output += "- This page has navigation links (use click actions on links to navigate)\n";
	}

	// Suggest content extraction if there's meaningful content
	output += "- Content can be extracted with print actions on specific elements\n";

	// Enhanced action patterns with outcome predictions
	output += "\nRecommended action pattern examples:\n";
	output += "1. To fill a form: wait → type → click → wait for response (expect form submission or validation feedback)\n";
	output += "2. To navigate: wait → click link → wait for new page (expect URL change and page content refresh)\n";
	output += "3. To extract content: wait → print elements with specific selectors (use container selectors for grouped content)\n";
	
	// Add contextual interaction advice based on page type
	if (hasListStructure) {
		output += "4. To interact with list items: wait → identify item by index → click on specific elements within the item\n";
	}
	
	if (hasFormStructure && analysis.inputs.length > 1) {
		output += "5. To complete multi-field forms: wait → type in first field → press Tab or click next field → type → ... → submit\n";
	}
	
	output += "\n";

	// Add page elements summary with enhanced details
	output += "Page Elements Summary:\n";
	output += "=".repeat(50) + "\n";

	// Show input elements with more details
	if (analysis.inputs.length > 0) {
		output += `Total Input Elements: ${analysis.inputs.length}\n`;
		if (options.showInputs) {
			output += "[Showing all inputs]\n";
			analysis.inputs.forEach((input, index) => {
				const inputType = input.type ? `(${input.type})` : '';
				const placeholder = input.placeholder ? ` placeholder="${input.placeholder}"` : '';
				const visibility = input.isVisible === false ? " [hidden]" : " [visible]";
				output += `- ${index + 1}. ${input.label || 'No label'} ${inputType}${placeholder}${visibility}\n`;
				output += `  Selector: ${input.selector}\n`;
			});
		} else {
			output += "[Showing top visible 5 inputs]\n";
			analysis.inputs.slice(0, 5).forEach((input, index) => {
				const inputType = input.type ? `(${input.type})` : '';
				const placeholder = input.placeholder ? ` placeholder="${input.placeholder}"` : '';
				output += `- ${index + 1}. ${input.label || 'No label'} ${inputType}${placeholder}\n`;
				output += `  Selector: ${input.selector}\n`;
			});
			if (analysis.inputs.length > 5) {
				output += "> to get list of all inputs add --inputs\n";
			}
		}
		output += "\n";
	}

	// Show button elements with more details
	if (analysis.buttons.length > 0) {
		output += `Total Button Elements: ${analysis.buttons.length}\n`;
		if (options.showButtons) {
			output += "[Showing all buttons]\n";
			analysis.buttons.forEach((button, index) => {
				output += `- ${index + 1}. ${button.text || 'No text'}\n`;
				output += `  Selector: ${button.selector}\n`;
			});
		} else {
			output += "[Showing top visible 5 buttons]\n";
			analysis.buttons.slice(0, 5).forEach((button, index) => {
				output += `- ${index + 1}. ${button.text || 'No text'}\n`;
				output += `  Selector: ${button.selector}\n`;
			});
			if (analysis.buttons.length > 5) {
				output += "> to get list of all buttons add --buttons\n";
			}
		}
		output += "\n";
	}

	// Show link elements with more details including URLs
	if (analysis.links.length > 0) {
		output += `Total Link Elements: ${analysis.links.length}\n`;
		if (options.showLinks) {
			output += "[Showing all links]\n";
			analysis.links.forEach((link, index) => {
				output += `- ${index + 1}. ${link.title} → ${link.url}\n`;
				output += `  Selector: ${link.selector}\n`;
			});
		} else {
			output += "[Showing top visible 5 links]\n";
			analysis.links.slice(0, 5).forEach((link, index) => {
				output += `- ${index + 1}. ${link.title} → ${link.url}\n`;
				output += `  Selector: ${link.selector}\n`;
			});
			if (analysis.links.length > 5) {
				output += "> to get list of all links add --links\n";
			}
		}
	}
	output += "\n";

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
					output += formatContent(truncatedContent, result.format) + "\n";
					output += `\n⚠️ Content was truncated (${result.html.length} characters, showing first ${MAX_DISPLAYED_CONTENT_LENGTH})\n`;
				} else {
					output += formatContent(result.html, result.format) + "\n";
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
		
		output += "=".repeat(80) + "\n\n";
	}

	// Add action suggestions based on the analysis
	output += "🚀 Next Actions Suggestions:\n";
	output += "=".repeat(50) + "\n";
	
	// Provide concrete next action examples with selectors
	if (analysis.inputs.length > 0) {
		const exampleInput = analysis.inputs[0];
		output += `- Type into input: {"type": "typing", "element": "${exampleInput.selector}", "value": "your text here"}\n`;
	}
	
	if (analysis.buttons.length > 0) {
		const exampleButton = analysis.buttons[0];
		output += `- Click button: {"type": "click", "element": "${exampleButton.selector}"}\n`;
	}
	
	if (analysis.links.length > 0) {
		const exampleLink = analysis.links[0];
		output += `- Click link: {"type": "click", "element": "${exampleLink.selector}"}\n`;
	}
	
	// Add example for waiting for specific elements
	output += `- Wait for element: {"type": "wait", "elements": ["selector_here"], "timeout": 5000}\n`;
	
	// Add example for extracting content
	output += `- Extract content: {"type": "print", "elements": ["selector_here"], "format": "markdown"}\n`;
	output += `- See HTML Structure: {"type": "print", "elements": ["selector_here"], "format": "html"}\n`;
	
	output += "\n";

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
	if (analysis.links.length >= 3) {
		const selectors = analysis.links.map(link => link.selector);
		const commonParentPattern = findCommonSelectorPattern(selectors);
		if (commonParentPattern) return true;
	}
	
	// Check button patterns
	if (analysis.buttons.length >= 3) {
		const selectors = analysis.buttons.map(button => button.selector);
		const commonParentPattern = findCommonSelectorPattern(selectors);
		if (commonParentPattern) return true;
	}
	
	// Look for CSS class names that suggest lists
	const listIndicators = ['list', 'item', 'collection', 'row', 'card', 'grid'];
	
	// Check for list indicators in links
	for (const link of analysis.links) {
		if (listIndicators.some(indicator => link.selector.toLowerCase().includes(indicator))) {
			return true;
		}
	}
	
	// Check for list indicators in buttons
	for (const button of analysis.buttons) {
		if (listIndicators.some(indicator => button.selector.toLowerCase().includes(indicator))) {
			return true;
		}
	}
	
	return false;
}

function detectFormStructure(analysis: PageAnalysis): boolean {
	// Forms typically have inputs and submit buttons
	if (analysis.inputs.length === 0) return false;
	
	// Check for submit buttons or buttons near inputs
	const hasSubmitButton = analysis.buttons.some(button => {
		const text = button.text.toLowerCase();
		return text.includes('submit') || 
				   text.includes('search') || 
				   text.includes('send') || 
				   text.includes('save') ||
				   text.includes('log in') ||
				   text.includes('sign in');
	});
	
	if (hasSubmitButton) return true;
	
	// Look for forms by checking input types
	const hasFormInputs = analysis.inputs.some(input => {
		return input.type === 'text' || 
				   input.type === 'password' || 
				   input.type === 'email' || 
				   input.type === 'checkbox' ||
				   input.type === 'radio';
	});
	
	return hasFormInputs;
}

function detectNavigationMenu(analysis: PageAnalysis): boolean {
	// Navigation menus typically have multiple links in a common container
	if (analysis.links.length < 3) return false;
	
	// Check for common navigation terms in link text
	const navTerms = ['home', 'about', 'contact', 'menu', 'nav', 'navigation'];
	
	// Count links with navigation-like terms
	const navLinks = analysis.links.filter(link => {
		const title = link.title.toLowerCase();
		return navTerms.some(term => title.includes(term));
	});
	
	if (navLinks.length >= 2) return true;
	
	// Check for common selector patterns in navigation menus
	const selectors = analysis.links.map(link => link.selector);
	const navSelectors = selectors.filter(selector => {
		return selector.toLowerCase().includes('nav') || 
				   selector.toLowerCase().includes('menu') ||
				   selector.toLowerCase().includes('header');
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