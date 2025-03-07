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

	// For HTML format, preserve the HTML tags but clean up whitespace
	if (format === 'html') {
		return content
			.replace(/\n{3,}/g, '\n\n') // Replace 3+ consecutive newlines with 2
			.replace(/>\s+</g, '>\n<'); // Add newlines between tags for better readability
	}

	// For undefined format, add some basic formatting to make it more readable
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

	// Show input elements with more details - always show top 5 only
	if (visibleInputs.length > 0) {
		output += `Total Input Elements: ${analysis.inputs.length}\n`;
		output += "[Showing top visible 5 inputs]\n";
		visibleInputs.slice(0, 5).forEach((input, index) => {
			const inputType = input.type ? `(${input.type})` : '';
			const placeholder = input.placeholder ? ` placeholder="${input.placeholder}"` : '';
			output += `- ${index + 1}. ${input.label || 'No label'} ${inputType}${placeholder}\n`;
			output += `  Selector: ${input.selector}\n`;
		});
		output += "\n";
	}

	// Filter visible buttons (those with a valid selector)
	const visibleButtons = analysis.buttons.filter(button => button && button.selector && button.selector.trim() !== '');

	// Show button elements with more details - always show top 5 only
	if (visibleButtons.length > 0) {
		output += `Total Button Elements: ${analysis.buttons.length}\n`;
		output += "[Showing top visible 5 buttons]\n";
		visibleButtons.slice(0, 5).forEach((button, index) => {
			output += `- ${index + 1}. ${button.text || 'No text'}\n`;
			output += `  Selector: ${button.selector}\n`;
		});
		output += "\n";
	}

	// Filter visible links (those with a valid selector)
	const visibleLinks = analysis.links.filter(link => link && link.selector && link.selector.trim() !== '');

	// Show link elements with more details including URLs - always show top 5 only
	if (visibleLinks.length > 0) {
		output += `Total Link Elements: ${analysis.links.length}\n`;
		output += "[Showing top visible 5 links]\n";
		visibleLinks.slice(0, 5).forEach((link, index) => {
			output += `- ${index + 1}. ${link.title || ''} → ${link.url || ''}\n`;
			output += `  Selector: ${link.selector}\n`;
		});
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

	// Add next actions suggestions
	output += "\n🚀 Next Actions Suggestions:\n";
	output += "=".repeat(50) + "\n";
	
	// Suggest typing into inputs
	if (visibleInputs.length > 0) {
		const firstInput = visibleInputs[0];
		output += `- Type into input: {"type": "typing", "element": "${firstInput.selector}", "value": "your text here"}\n`;
	}
	
	// Suggest clicking buttons
	if (visibleButtons.length > 0) {
		const firstButton = visibleButtons[0];
		output += `- Click button: {"type": "click", "element": "${firstButton.selector}"}\n`;
	}
	
	// Suggest clicking links
	if (visibleLinks.length > 0) {
		const firstLink = visibleLinks[0];
		output += `- Click link: {"type": "click", "element": "${firstLink.selector}"}\n`;
	}
	
	// Always suggest these generic actions
	output += `- Wait for element: {"type": "wait", "elements": ["selector_here"], "timeout": 5000}\n`;
	output += `- Extract content: {"type": "print", "elements": ["selector_here"], "format": "markdown"}\n`;
	output += `- See HTML Structure: {"type": "print", "elements": ["selector_here"], "format": "html"}\n`;

	output += "\n\nAnalysis complete.\n";

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