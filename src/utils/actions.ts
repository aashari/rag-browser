import type { Action } from "../types";
import chalk from "chalk";

export function getActionSymbol(action: Action): string {
	switch (action.type) {
		case "wait":
			return "⏳";
		case "click":
			return "🖱️";
		case "typing":
			return "⌨️";
		case "keyPress":
			return "🔤";
		case "submit":
			return "📤";
		case "print":
			return "📝";
		default:
			return "❓";
	}
}

export function getActionDescription(action: Action): string {
	switch (action.type) {
		case "wait":
			return `Wait for elements: ${chalk.cyan(action.elements.join(", "))}`;
		case "click":
			return `Click element: ${chalk.cyan(action.element)}`;
		// Simplified typing action - pressKey and submit are now handled by separate actions
		case "typing":
			const extraInfo = action.delay ? chalk.gray(` (delay ${action.delay}ms)`) : "";
			return `Type ${chalk.green(`"${action.value}"`)} into ${chalk.cyan(action.element)}${extraInfo}`;
		case "keyPress":
			return `Press ${chalk.yellow(action.key)}${action.element ? ` on ${chalk.cyan(action.element)}` : ""}`;
		case "submit":
			return `Submit form: ${chalk.cyan(action.element)}`;
		case "print":
			return `Print HTML for: ${chalk.cyan(action.elements.join(", "))}`;
		default:
			return "Unknown action";
	}
}
