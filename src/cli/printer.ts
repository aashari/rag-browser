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

export function printAnalysis(analysis: PageAnalysis, format: OutputFormat = "pretty"): string {
	if (format === "json") {
		return JSON.stringify(analysis, null, 2);
	}

	let output = "";
	output += `\n📄 ${chalk.bold("Page Analysis:")}\n`;
	output += "=".repeat(50) + "\n";
	output += `${chalk.bold("Title:")} ${chalk.cyan(analysis.title)}\n`;
	if (analysis.description) {
		output += `${chalk.bold("Description:")} ${chalk.gray(analysis.description)}\n`;
	}

	if (analysis.inputs?.length) {
		output += `${chalk.bold("\nInputs:")} ${chalk.cyan(analysis.inputs.length)}\n`;
		analysis.inputs.forEach((input) => {
			output += `\n🔤 ${chalk.bold(input.label || input.type)}\n`;
			output += chalk.gray(`  Type: ${input.type}\n`);
			if (input.id) output += chalk.gray(`  ID: ${input.id}\n`);
			if (input.role) output += chalk.gray(`  Role: ${input.role}\n`);
			if (!input.isVisible) output += chalk.yellow("  Hidden: true\n");
			output += chalk.gray(`  Selector: ${input.selector}\n`);
		});
	}

	if (analysis.buttons?.length) {
		output += `${chalk.bold("\nButtons:")} ${chalk.cyan(analysis.buttons.length)}\n`;
		analysis.buttons.forEach((button) => {
			output += `\n🔘 ${chalk.bold(button.text || "No text")}\n`;
			output += chalk.gray(`  Selector: ${button.selector}\n`);
		});
	}

	if (analysis.links?.length) {
		output += `${chalk.bold("\nLinks:")} ${chalk.cyan(analysis.links.length)}\n`;
		analysis.links.forEach((link) => {
			output += `\n🔗 ${chalk.bold(link.title || "No title")}\n`;
			output += chalk.gray(`  URL: ${link.url}\n`);
			output += chalk.gray(`  Selector: ${link.selector}\n`);
		});
	}

	if (analysis.plannedActions?.length) {
		output += `${chalk.bold("\nPlanned Actions Results:")} ${chalk.cyan(analysis.plannedActions.length)}\n`;
		analysis.plannedActions.forEach((action) => {
			output += `\n📝 ${chalk.bold(action.selector)}\n`;
			if (action.html) {
				output += chalk.gray(`  HTML:\n${action.html}\n`);
			} else {
				output += chalk.yellow("  HTML: Not captured\n");
			}
			if (action.error) {
				output += chalk.red(`  Error: ${action.error}\n`);
			}
		});
	}

	output += "\n" + "=".repeat(50) + "\n";
	return output;
}
