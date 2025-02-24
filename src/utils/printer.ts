import type { Action, ActionStatus } from "../types";

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
            return "📄";
        case "markdown":
            return "📝";
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
            return `Type "${action.value}" into ${action.element}`;
        case "keyPress":
            return `Press key: ${action.key}`;
        case "print":
            return `Print elements: ${action.elements.join(", ")}`;
        case "markdown":
            return `Convert to markdown: ${action.elements.join(", ")}`;
        default:
            return "Unknown action";
    }
}

export function printActionStatus(status: ActionStatus): string {
    const { step, totalSteps, symbol, description, result } = status;
    const stepStr = `[${step}/${totalSteps}]`;
    const symbolStr = `${symbol}`;
    const resultStr = result?.success ? "✅" : "❌";
    const warningStr = result?.warning ? ` ⚠️ ${result.warning}` : "";
    const errorStr = result?.error ? ` 🔴 ${result.error}` : "";
    return `${stepStr} ${symbolStr} ${description} ${resultStr}${warningStr}${errorStr}`;
}

export function printActionSummary(statuses: ActionStatus[]): string {
    const total = statuses.length;
    const successful = statuses.filter((s) => s.result?.success).length;
    const failed = total - successful;
    return `\nAction Plan Summary:\n${successful}/${total} actions completed successfully${failed ? `, ${failed} failed` : ""}`;
} 