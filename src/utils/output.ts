import type { PageAnalysis, Plan, Link, Button, Input, PlannedActionResult, ActionStatus } from "../types";
import { getActionSymbol, getActionDescription } from "./actions";

export type OutputFormat = "json" | "pretty";

export interface DisplayOptions {
	showInputs?: boolean;
	showButtons?: boolean;
	showLinks?: boolean;
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

function printPageHeader(analysis: PageAnalysis): string {
	let output = "";
	output += "\n📄 Page Analysis:\n\n";
	output += `Title: ${analysis.title}\n`;
	if (analysis.description) {
		output += `Description: ${analysis.description}\n`;
	}
	return output;
}

function printInputsSummary(inputs: Input[], showAll: boolean): string {
	let output = "";
	if (!inputs?.length) return output;

	output += `Total Input Elements: ${inputs.length}\n`;
	if (showAll) {
		inputs.forEach((input) => {
			output += `\n🔤 ${input.label || input.type}\n`;
			output += `  Type: ${input.type}\n`;
			if (input.id) output += `  ID: ${input.id}\n`;
			if (!input.isVisible) output += "  Hidden: true\n";
			output += `  Selector: ${input.selector}\n`;
		});
	} else {
		const visibleInputs = inputs.filter(i => i.isVisible).slice(0, 5);
		if (visibleInputs.length) {
			output += "[Showing top visible 5 inputs]\n";
			visibleInputs.forEach(input => {
				output += `- ${input.label || input.type}\n`;
			});
			output += "> to get list of all inputs add --inputs\n";
		}
	}
	return output;
}

function printButtonsSummary(buttons: Button[], showAll: boolean): string {
	let output = "";
	if (!buttons?.length) return output;

	output += `\nTotal Button Elements: ${buttons.length}\n`;
	if (showAll) {
		buttons.forEach((button) => {
			output += `\n🔘 ${button.text || "No text"}\n`;
			output += `  Selector: ${button.selector}\n`;
		});
	} else {
		const topButtons = buttons.slice(0, 5);
		if (topButtons.length) {
			output += "[Showing top visible 5 buttons]\n";
			topButtons.forEach(button => {
				output += `- ${button.text || "No text"}\n`;
			});
			output += "> to get list of all buttons add --buttons\n";
		}
	}
	return output;
}

function printLinksSummary(links: Link[], showAll: boolean): string {
	let output = "";
	if (!links?.length) return output;

	output += `\nTotal Link Elements: ${links.length}\n`;
	if (showAll) {
		links.forEach((link) => {
			output += `\n🔗 ${link.title || "No title"}\n`;
			output += `  URL: ${link.url}\n`;
			output += `  Selector: ${link.selector}\n`;
		});
	} else {
		const topLinks = links.slice(0, 5);
		if (topLinks.length) {
			output += "[Showing top visible 5 links]\n";
			topLinks.forEach(link => {
				output += `- ${link.title || "No title"}\n`;
			});
			output += "> to get list of all links add --links\n";
		}
	}
	return output;
}

function printActionResults(plannedActions: PlannedActionResult[]): string {
	let output = "";
	if (!plannedActions?.length) return output;

	const results = plannedActions.filter(r => !r.error);
	const errorResults = plannedActions.filter(r => r.error);

	if (results.length) {
		output += "\n\nAction Results:\n";
		output += "=".repeat(80) + "\n\n";
		results.forEach((result) => {
			if (!result.error && result.html) {
				output += result.html + "\n\n";
			}
		});
		output += "=".repeat(80) + "\n";
	}

	if (errorResults.length) {
		output += "\nAction Errors:\n";
		errorResults.forEach((result) => {
			output += `\n❌ ${result.selector}\n`;
			output += `  Error: ${result.error}\n`;
		});
	}

	return output;
}

export function printAnalysis(
	analysis: PageAnalysis,
	format: OutputFormat = "pretty",
	options: DisplayOptions = {}
): string {
	if (format === "json") {
		return JSON.stringify(analysis, null, 2);
	}

	let output = "\n📄 Page Analysis:\n\n";

	// Show error first if present
	if (analysis.error) {
		output += "⚠️ Error encountered:\n";
		output += "==================================================\n";
		output += analysis.error + "\n";
		output += "==================================================\n\n";
	}

	output += `Title: ${analysis.title}\n`;
	if (analysis.description) {
		output += `Description: ${analysis.description}\n`;
	}

	output += "\nPage Elements Summary:\n";
	output += "==================================================\n";

	// Show inputs
	output += `Total Input Elements: ${analysis.inputs.length}\n`;
	if (analysis.inputs.length > 0) {
		if (options.showInputs) {
			output += "[Showing all inputs]\n";
			analysis.inputs.forEach((input) => {
				output += `- ${input.label || input.type}${!input.isVisible ? " (hidden)" : ""}\n`;
			});
		} else {
			output += "[Showing top visible 5 inputs]\n";
			analysis.inputs
				.filter((input) => input.isVisible)
				.slice(0, 5)
				.forEach((input) => {
					output += `- ${input.label || input.type}\n`;
				});
			if (analysis.inputs.length > 5) {
				output += "> to get list of all inputs add --inputs\n";
			}
		}
	}
	output += "\n";

	// Show buttons
	output += `Total Button Elements: ${analysis.buttons.length}\n`;
	if (analysis.buttons.length > 0) {
		if (options.showButtons) {
			output += "[Showing all buttons]\n";
			analysis.buttons.forEach((button) => {
				output += `- ${button.text || "No text"}\n`;
			});
		} else {
			output += "[Showing top visible 5 buttons]\n";
			analysis.buttons.slice(0, 5).forEach((button) => {
				output += `- ${button.text || "No text"}\n`;
			});
			if (analysis.buttons.length > 5) {
				output += "> to get list of all buttons add --buttons\n";
			}
		}
	}
	output += "\n";

	// Show links
	output += `Total Link Elements: ${analysis.links.length}\n`;
	if (analysis.links.length > 0) {
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
		output += "\nAction Results:\n";
		output += "================================================================================\n\n";
		
		analysis.plannedActions.forEach((result) => {
			if (result.error) {
				output += `Error capturing ${result.selector}: ${result.error}\n`;
			} else if (result.html) {
				output += result.html + "\n";
			}
		});
		output += "================================================================================\n\n";
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