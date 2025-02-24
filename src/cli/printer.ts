import type { PageAnalysis, Plan, ActionStatus } from "../types";
import { getActionSymbol, getActionDescription } from "../utils/actions";
import chalk from "chalk";

export type OutputFormat = "pretty" | "json";

export function printPlan(plan: Plan): string {
	let output = "";
	output += `\n📋 ${chalk.bold("Plan to Execute:")}\n`;
	output += "=".repeat(50) + "\n";
	plan.actions.forEach((action, index) => {
		const symbol = getActionSymbol(action);
		output += `${symbol} Step ${index + 1}/${plan.actions.length}: ${getActionDescription(action)}\n`;
	});
	output += "=".repeat(50) + "\n\n";
	return output;
}

export function printActionStatus(status: ActionStatus): string {
	const { step, totalSteps, symbol, description, result } = status;
	let output = "";

	// Print the action header
	output += `\n${symbol} [${step}/${totalSteps}] ${description}\n`;

	// Print the result if available
	if (result) {
		if (result.success) {
			output += chalk.green(`✅ ${result.message}\n`);
		}
		if (result.warning) {
			output += chalk.yellow(`⚠️  ${result.warning}\n`);
		}
		if (result.error) {
			output += chalk.red(`❌ ${result.error}\n`);
		}
	}
	return output;
}

export function printActionSummary(statuses: ActionStatus[]): string {
	const total = statuses.length;
	const successful = statuses.filter((s) => s.result?.success).length;
	const failed = total - successful;

	let output = "";
	output += `\n📊 ${chalk.bold("Action Summary:")}\n`;
	output += "=".repeat(50) + "\n";
	output += `Total Actions: ${total}\n`;
	output += `Successful: ${chalk.green(successful)}\n`;
	if (failed > 0) {
		output += `Failed: ${chalk.red(failed)}\n`;
	}
	output += "=".repeat(50) + "\n\n";
	return output;
}

export function printAnalysis(analysis: PageAnalysis, format: OutputFormat = "pretty", options: { showInputs?: boolean, showButtons?: boolean, showLinks?: boolean } = {}): string {
	if (format === "json") {
		return JSON.stringify(analysis, null, 2);
	}

	let output = "";
	output += `\n📄 ${chalk.bold("Page Analysis:")}\n\n`;
	output += `${chalk.bold("Title:")} ${chalk.cyan(analysis.title)}\n`;
	if (analysis.description) {
		output += `${chalk.bold("Description:")} ${chalk.gray(analysis.description)}\n`;
	}

	// Page elements summary first
	output += `\n${chalk.bold("Page Elements Summary:")}\n`;
	output += chalk.gray("=".repeat(50)) + "\n";

	// Inputs summary
	if (analysis.inputs?.length) {
		output += `${chalk.bold("Total Input Elements:")} ${chalk.cyan(analysis.inputs.length)}\n`;
		if (options.showInputs) {
			analysis.inputs.forEach((input) => {
				output += `\n🔤 ${chalk.bold(input.label || input.type)}\n`;
				output += chalk.gray(`  Type: ${input.type}\n`);
				if (input.id) output += chalk.gray(`  ID: ${input.id}\n`);
				if (!input.isVisible) output += chalk.yellow("  Hidden: true\n");
				output += chalk.gray(`  Selector: ${input.selector}\n`);
			});
		} else {
			// Show top 5 visible inputs
			const visibleInputs = analysis.inputs.filter(i => i.isVisible).slice(0, 5);
			if (visibleInputs.length) {
				output += "[Showing top visible 5 inputs]\n";
				visibleInputs.forEach(input => {
					output += `- ${chalk.cyan(input.label || input.type)}\n`;
				});
				output += chalk.gray("> to get list of all inputs add --inputs\n");
			}
		}
	}

	// Buttons summary
	if (analysis.buttons?.length) {
		output += `\n${chalk.bold("Total Button Elements:")} ${chalk.cyan(analysis.buttons.length)}\n`;
		if (options.showButtons) {
			analysis.buttons.forEach((button) => {
				output += `\n🔘 ${chalk.bold(button.text || "No text")}\n`;
				output += chalk.gray(`  Selector: ${button.selector}\n`);
			});
		} else {
			// Show top 5 buttons
			const topButtons = analysis.buttons.slice(0, 5);
			if (topButtons.length) {
				output += "[Showing top visible 5 buttons]\n";
				topButtons.forEach(button => {
					output += `- ${chalk.cyan(button.text || "No text")}\n`;
				});
				output += chalk.gray("> to get list of all buttons add --buttons\n");
			}
		}
	}

	// Links summary
	if (analysis.links?.length) {
		output += `\n${chalk.bold("Total Link Elements:")} ${chalk.cyan(analysis.links.length)}\n`;
		if (options.showLinks) {
			analysis.links.forEach((link) => {
				output += `\n🔗 ${chalk.bold(link.title || "No title")}\n`;
				output += chalk.gray(`  URL: ${link.url}\n`);
				output += chalk.gray(`  Selector: ${link.selector}\n`);
			});
		} else {
			// Show top 5 links
			const topLinks = analysis.links.slice(0, 5);
			if (topLinks.length) {
				output += "[Showing top visible 5 links]\n";
				topLinks.forEach(link => {
					output += `- ${chalk.cyan(link.title || "No title")}\n`;
				});
				output += chalk.gray("> to get list of all links add --links\n");
			}
		}
	}

	// Print action results after page elements
	if (analysis.plannedActions?.length) {
		const results = analysis.plannedActions.filter(r => !r.error);
		const errorResults = analysis.plannedActions.filter(r => r.error);

		if (results.length) {
			output += `\n\n${chalk.bold("Action Results:")}\n`;
			output += chalk.yellow("=".repeat(80)) + "\n\n";
			results.forEach((result) => {
				if (result.html) {
					if (result.selector.includes('print')) {
						// For print action, show both HTML and markdown
						output += chalk.bold("HTML Output:") + "\n";
						output += chalk.gray(result.rawHtml || '') + "\n\n";
						output += chalk.bold("Markdown Output:") + "\n";
					}
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
			});
			output += chalk.yellow("=".repeat(80)) + "\n";
		}

		if (errorResults.length) {
			output += `\n${chalk.bold("Action Errors:")}\n`;
			errorResults.forEach((result) => {
				output += `\n❌ ${chalk.bold(result.selector)}\n`;
				output += chalk.red(`  Error: ${result.error}\n`);
			});
		}
	}

	output += "\n";
	return output;
}
