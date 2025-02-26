import type { PageAnalysis, Plan, Link, Button, Input, PlannedActionResult, ActionStatus } from "../types";
import { getActionSymbol, getActionDescription } from "./actions";

export type OutputFormat = "json" | "pretty";

export interface DisplayOptions {
	showInputs?: boolean;
	showButtons?: boolean;
	showLinks?: boolean;
}

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

// Maximum character limit for each planned action result
const MAX_DISPLAYED_CONTENT_LENGTH = 5000;

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
	
	// For markdown content, we return as is with minimal cleanup
	if (format === 'markdown') {
		return content;
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

	// Add title and description
	output += "\n📄 Page Analysis:\n\n";
	if (analysis.title) {
		output += `Title: ${analysis.title}\n`;
	}
	if (analysis.description) {
		output += `Description: ${analysis.description}\n`;
	}
	output += "\n";

	// Add page elements summary
	output += "Page Elements Summary:\n";
	output += "=".repeat(50) + "\n";

	// Show input elements
	if (analysis.inputs.length > 0) {
		output += `Total Input Elements: ${analysis.inputs.length}\n`;
		if (options.showInputs) {
			output += "[Showing all inputs]\n";
			analysis.inputs.forEach((input) => {
				output += `- ${input.label || 'No label'}\n`;
			});
		} else {
			output += "[Showing top visible 5 inputs]\n";
			analysis.inputs.slice(0, 5).forEach((input) => {
				output += `- ${input.label || 'No label'}\n`;
			});
			if (analysis.inputs.length > 5) {
				output += "> to get list of all inputs add --inputs\n";
			}
		}
		output += "\n";
	}

	// Show button elements
	if (analysis.buttons.length > 0) {
		output += `Total Button Elements: ${analysis.buttons.length}\n`;
		if (options.showButtons) {
			output += "[Showing all buttons]\n";
			analysis.buttons.forEach((button) => {
				output += `- ${button.text || 'No text'}\n`;
			});
		} else {
			output += "[Showing top visible 5 buttons]\n";
			analysis.buttons.slice(0, 5).forEach((button) => {
				output += `- ${button.text || 'No text'}\n`;
			});
			if (analysis.buttons.length > 5) {
				output += "> to get list of all buttons add --buttons\n";
			}
		}
		output += "\n";
	}

	// Show link elements
	if (analysis.links.length > 0) {
		output += `Total Link Elements: ${analysis.links.length}\n`;
		if (options.showLinks) {
			output += "[Showing all links]\n";
			analysis.links.forEach((link) => {
				output += `- ${link.title}\n`;
			});
		} else {
			output += "[Showing top visible 5 links]\n";
			analysis.links.slice(0, 5).forEach((link) => {
				output += `- ${link.title}\n`;
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
				output += `⚠️ Error: ${result.error}\n`;
			} else if (result.html) {
				// Check if content exceeds the maximum length
				if (result.html.length > MAX_DISPLAYED_CONTENT_LENGTH) {
					// Truncate the content and add a warning
					const truncatedContent = result.html.substring(0, MAX_DISPLAYED_CONTENT_LENGTH);
					output += formatContent(truncatedContent, result.format) + "\n";
					output += `\n⚠️ Content was truncated (${result.html.length} characters, showing first ${MAX_DISPLAYED_CONTENT_LENGTH})\n`;
				} else {
					output += formatContent(result.html, result.format) + "\n";
				}
			}
		});
		
		output += "=".repeat(80) + "\n\n";
	}

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