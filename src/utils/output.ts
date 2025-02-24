import type { PageAnalysis, Plan, Link, Button, Input, PlannedActionResult, ActionStatus } from "../types";
import { getActionSymbol, getActionDescription } from "./actions";

export type OutputFormat = "pretty" | "json";

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
				if (result.type === 'print') {
					output += "HTML Output:\n";
					output += result.html + "\n\n";
				} else if (result.type === 'markdown') {
					output += "Markdown Output:\n";
					// Remove duplicate link references
					const lines = result.html.split('\n');
					const seenRefs = new Set<string>();
					const uniqueLines = lines.filter(line => {
						if (line.match(/^\[.*\]:/)) {
							if (seenRefs.has(line)) return false;
							seenRefs.add(line);
						}
						return true;
					});
					output += uniqueLines.join('\n') + "\n";
				}
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
	options: { showInputs?: boolean, showButtons?: boolean, showLinks?: boolean } = {}
): string {
	if (format === "json") {
		return JSON.stringify(analysis, null, 2);
	}

	let output = printPageHeader(analysis);

	// Page elements summary
	output += "\nPage Elements Summary:\n";
	output += "=".repeat(50) + "\n";

	// Print each section
	output += printInputsSummary(analysis.inputs, options.showInputs || false);
	output += printButtonsSummary(analysis.buttons, options.showButtons || false);
	output += printLinksSummary(analysis.links, options.showLinks || false);

	// Print action results if any
	if (analysis.plannedActions?.length) {
		output += printActionResults(analysis.plannedActions);
	}

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