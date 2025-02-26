import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { analyzePage } from "../core/browser";
import { formatAnalysis } from "../utils/output";
import type { Plan, Action } from "../types";
import { storeAnalysis } from "./resources";
import { DEFAULT_TIMEOUT, VISIBLE_MODE_SLOW_MO } from "../config/constants";
import { MCP_ERROR_CODES, type McpErrorCode } from "../config/errorCodes";
import { validateUrl } from "../utils/security";
import { error } from "../utils/logging";

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

interface ExtendedCallToolResult extends CallToolResult {
	code?: McpErrorCode;
}

export async function handleToolCall(
	name: string,
	args: Record<string, string>,
	server: Server
): Promise<ExtendedCallToolResult> {
	try {
		// Validate common parameters
		if (!args.url) {
			return {
				content: [{ type: "text", text: "URL parameter is required" }],
				isError: true,
				code: MCP_ERROR_CODES.MISSING_PARAMS
			};
		}

		const urlValidation = validateUrl(args.url);
		if (!urlValidation.valid) {
			return {
				content: [{ type: "text", text: urlValidation.error || "Invalid URL" }],
				isError: true,
				code: MCP_ERROR_CODES.MISSING_PARAMS
			};
		}

		// Process display options
		const displayOptions = {
			showInputs: args.inputs === "true",
			showButtons: args.buttons === "true",
			showLinks: args.links === "true"
		};

		// Get format option (default to "pretty" if not specified)
		const format = args.format || "pretty";

		// Default browser options
		const options: {
			headless: boolean;
			slowMo: number;
			timeout: number;
			selectorMode: "full" | "simple";
			plan?: Plan;
		} = {
			headless: args.headless === "true",
			slowMo: VISIBLE_MODE_SLOW_MO,
			timeout: args.timeout ? parseInt(args.timeout, 10) : DEFAULT_TIMEOUT,
			selectorMode: args.selectorMode as "full" | "simple" || "full"
		};

		if (name === "action") {
			await server.sendLoggingMessage({
				level: "info",
				data: `Action tool called with URL: ${args.url}${args.plan ? " and plan" : ""}${args.timeout === "-1" ? " (infinite wait)" : ""}`
			});

			// If plan is provided, validate it
			if (args.plan) {
				const planValidation = validatePlan(args.plan);
				if (!planValidation.valid) {
					return {
						content: [{ type: "text", text: `Invalid plan: ${planValidation.error}` }],
						isError: true,
						code: MCP_ERROR_CODES.MISSING_PARAMS
					};
				}
				options.plan = planValidation.plan;
			}

			const analysisResult = await analyzePage(args.url, options);
			storeAnalysis(analysisResult, args.url);
			return {
				content: [{ type: "text", text: formatAnalysis(analysisResult, format, displayOptions) }],
				isError: false
			};
		}

		return {
			content: [{ type: "text", text: `Unknown tool: ${name}` }],
			isError: true,
			code: MCP_ERROR_CODES.INVALID_TOOL
		};
	} catch (err) {
		error('Error in tool call', { error: err instanceof Error ? err.message : String(err) });
		const errorMessage = err instanceof Error ? err.message : String(err);
		await server.sendLoggingMessage({
			level: "error",
			data: `Error in tool ${name}: ${errorMessage}`,
		});
		return {
			content: [{ type: "text", text: `Tool execution failed: ${errorMessage}` }],
			isError: true,
			code: MCP_ERROR_CODES.INTERNAL_ERROR
		};
	}
}
