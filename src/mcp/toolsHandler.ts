import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { analyzePage } from "../core/browser";
import { printAnalysis } from "../cli/printer";
import type { Plan, Action, SelectorMode } from "../types";
import { storeAnalysis } from "./resources";
import { DEFAULT_TIMEOUT, VISIBLE_MODE_SLOW_MO } from "../config/constants";

// Validate action type and required fields
function validateAction(action: any): action is Action {
	if (!action || typeof action !== "object") return false;
	if (!action.type || typeof action.type !== "string") return false;

	switch (action.type) {
		case "wait":
			return Array.isArray(action.elements) && action.elements.every((e: unknown) => typeof e === "string");
		case "click":
		case "submit":
			return typeof action.element === "string";
		case "typing":
			return typeof action.element === "string" && typeof action.value === "string";
		case "keyPress":
			return typeof action.key === "string" && (!action.element || typeof action.element === "string");
		case "print":
			return Array.isArray(action.elements) && action.elements.every((e: unknown) => typeof e === "string");
		default:
			return false;
	}
}

// Validate plan structure
function validatePlan(planJson: string): { valid: true; plan: Plan } | { valid: false; error: string } {
	try {
		const parsed = JSON.parse(planJson);
		if (!parsed || typeof parsed !== "object") {
			return { valid: false, error: "Plan must be a JSON object" };
		}
		if (!Array.isArray(parsed.actions)) {
			return { valid: false, error: "Plan must have an 'actions' array" };
		}
		for (let i = 0; i < parsed.actions.length; i++) {
			if (!validateAction(parsed.actions[i])) {
				return { valid: false, error: `Invalid action at index ${i}` };
			}
		}
		return { valid: true, plan: parsed as Plan };
	} catch (e) {
		return { valid: false, error: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}` };
	}
}

// Create a single action plan
function createSingleActionPlan(action: Action): Plan {
	return {
		actions: [action],
	};
}

export async function handleToolCall(
	name: string,
	args: Record<string, string>,
	server: Server
): Promise<CallToolResult> {
	try {
		// Validate common parameters
		if (!args.url) {
			return {
				content: [{ type: "text", text: "URL parameter is required" }],
				isError: true,
			};
		}

		// Process display options
		const displayOptions = {
			showInputs: args.inputs === "true",
			showButtons: args.buttons === "true",
			showLinks: args.links === "true"
		};

		// Default browser options
		const options = {
			headless: false,
			slowMo: VISIBLE_MODE_SLOW_MO,
			timeout: DEFAULT_TIMEOUT,
			selectorMode: "full" as const
		};

		switch (name) {
			case "navigate": {
				await server.sendLoggingMessage({
					level: "info",
					data: `Navigate tool called with URL: ${args.url}`,
				});

				const analysisResult = await analyzePage(args.url, options);
				storeAnalysis(analysisResult, args.url);
				return {
					content: [{ type: "text", text: printAnalysis(analysisResult, "pretty", displayOptions) }],
					isError: false,
				};
			}

			case "execute": {
				if (!args.plan) {
					return {
						content: [{ type: "text", text: "Plan parameter is required" }],
						isError: true,
					};
				}

				const planValidation = validatePlan(args.plan);
				if (!planValidation.valid) {
					return {
						content: [{ type: "text", text: `Invalid plan: ${planValidation.error}` }],
						isError: true,
					};
				}

				await server.sendLoggingMessage({
					level: "info",
					data: `Execute tool called with plan: ${args.plan}`,
				});

				const planResult = await analyzePage(args.url, {
					...options,
					plan: planValidation.plan,
				});
				storeAnalysis(planResult, args.url);

				return {
					content: [{ type: "text", text: printAnalysis(planResult, "pretty", displayOptions) }],
					isError: false,
				};
			}

			default:
				return {
					content: [{ type: "text", text: `Unknown tool: ${name}` }],
					isError: true,
				};
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		await server.sendLoggingMessage({
			level: "error",
			data: `Error in tool ${name}: ${errorMessage}`,
		});
		return {
			content: [{ type: "text", text: `Tool execution failed: ${errorMessage}` }],
			isError: true,
		};
	}
}
