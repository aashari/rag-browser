import type { Action } from "../types";

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
		case "print":
			return "📝";
		case "markdown":
			return "📄";
		default:
			return "❓";
	}
}

export function getActionDescription(action: Action): string {
	switch (action.type) {
		case "wait":
			return `Wait for elements: ${action.elements.join(", ")}`;
		case "click":
			return `Click element: ${action.element}`;
		case "typing":
			return `Type "${action.value}" into: ${action.element}`;
		case "keyPress":
			return `Press ${action.key}${action.element ? ` on ${action.element}` : ""}`;
		case "print":
			return `Print HTML content of: ${action.elements.join(", ")}`;
		case "markdown":
			return `Convert HTML to Markdown: ${action.elements.join(", ")}`;
		default:
			return "Unknown action";
	}
}
