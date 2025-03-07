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

// Get detailed validation error message with suggestions
function getActionValidationError(action: any): string {
	if (!action || typeof action !== "object") {
		return "Action must be a valid object. Example: {\"type\":\"wait\",\"elements\":[\".selector\"]}";
	}
	
	if (!action.type || typeof action.type !== "string") {
		return "Action must have a valid 'type' property. Supported types: wait, click, submit, typing, keyPress, print";
	}
	
	switch (action.type) {
		case "wait":
			if (!Array.isArray(action.elements)) {
				return "Wait action requires an 'elements' array. Example: {\"type\":\"wait\",\"elements\":[\".selector\"]}";
			}
			if (!action.elements.every((e: unknown) => typeof e === "string")) {
				return "All elements in the 'elements' array must be strings (CSS selectors)";
			}
			break;
		case "click":
		case "submit":
			if (typeof action.element !== "string") {
				return `${action.type} action requires an 'element' string. Example: {\"type\":\"${action.type}\",\"element\":\".button\"}`;
			}
			break;
		case "typing":
			if (typeof action.element !== "string") {
				return "Typing action requires an 'element' string. Example: {\"type\":\"typing\",\"element\":\"#input\",\"value\":\"text\"}";
			}
			if (typeof action.value !== "string") {
				return "Typing action requires a 'value' string. Example: {\"type\":\"typing\",\"element\":\"#input\",\"value\":\"text\"}";
			}
			break;
		case "keyPress":
			if (typeof action.key !== "string") {
				return "KeyPress action requires a 'key' string. Example: {\"type\":\"keyPress\",\"key\":\"Enter\"}";
			}
			if (action.element && typeof action.element !== "string") {
				return "If specified, 'element' must be a string selector. Example: {\"type\":\"keyPress\",\"key\":\"Enter\",\"element\":\"#input\"}";
			}
			break;
		case "print":
			if (!Array.isArray(action.elements)) {
				return "Print action requires an 'elements' array. Example: {\"type\":\"print\",\"elements\":[\".content\"]}";
			}
			if (!action.elements.every((e: unknown) => typeof e === "string")) {
				return "All elements in the 'elements' array must be strings (CSS selectors)";
			}
			break;
		default:
			return `Unsupported action type: ${action.type}. Supported types: wait, click, submit, typing, keyPress, print`;
	}
	
	return "";
}

// Validate plan structure with detailed error messages
function validatePlan(planJson: string): { valid: true; plan: Plan } | { valid: false; error: string } {
	try {
		const parsed = JSON.parse(planJson);
		if (!parsed || typeof parsed !== "object") {
			return { valid: false, error: "Plan must be a JSON object. Example: {\"actions\":[{\"type\":\"wait\",\"elements\":[\".selector\"]}]}" };
		}
		if (!Array.isArray(parsed.actions)) {
			return { valid: false, error: "Plan must have an 'actions' array. Example: {\"actions\":[{\"type\":\"wait\",\"elements\":[\".selector\"]}]}" };
		}
		for (let i = 0; i < parsed.actions.length; i++) {
			if (!validateAction(parsed.actions[i])) {
				const errorDetails = getActionValidationError(parsed.actions[i]);
				return { valid: false, error: `Invalid action at index ${i}: ${errorDetails}` };
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
				content: [{ 
					type: "text", 
					text: "URL parameter is required. Please provide a valid URL using the 'url' parameter. Example: --url https://example.com" 
				}],
				isError: true,
				code: MCP_ERROR_CODES.MISSING_PARAMS
			};
		}

		const urlValidation = validateUrl(args.url);
		if (!urlValidation.valid) {
			return {
				content: [{ 
					type: "text", 
					text: `${urlValidation.error || "Invalid URL"}. Please provide a valid URL starting with http:// or https://` 
				}],
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
			debug?: boolean;
		} = {
			headless: args.headless === "true",
			slowMo: VISIBLE_MODE_SLOW_MO,
			timeout: DEFAULT_TIMEOUT,
			selectorMode: args.selectorMode as "full" | "simple" || "full",
			debug: args.debug === "true"
		};

		// Parse timeout with validation
		if (args.timeout) {
			const parsedTimeout = parseInt(args.timeout, 10);
			if (isNaN(parsedTimeout)) {
				return {
					content: [{ 
						type: "text", 
						text: `Invalid timeout value: "${args.timeout}". Please provide a valid number or -1 for infinite wait.` 
					}],
					isError: true,
					code: MCP_ERROR_CODES.INVALID_PARAMS
				};
			}
			options.timeout = parsedTimeout;
		}

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

			try {
				const analysisResult = await analyzePage(args.url, options);
				storeAnalysis(analysisResult, args.url);
				return {
					content: [{ type: "text", text: formatAnalysis(analysisResult, format, displayOptions) }],
					isError: false
				};
			} catch (analysisError) {
				// Provide more helpful error messages for common issues
				const errorMessage = analysisError instanceof Error ? analysisError.message : String(analysisError);
				let userFriendlyMessage = errorMessage;
				
				// Enhance error messages for common scenarios
				if (errorMessage.includes("timeout") || errorMessage.includes("Timeout")) {
					userFriendlyMessage = `Timeout error: The page took too long to load or an element wasn't found in time. Try increasing the timeout value (current: ${options.timeout}ms) or check if the selectors in your plan are correct.`;
				} else if (errorMessage.includes("Navigation failed")) {
					userFriendlyMessage = `Navigation failed: Could not navigate to ${args.url}. Please check if the URL is accessible and the website is online.`;
				} else if (errorMessage.includes("selector") || errorMessage.includes("element")) {
					userFriendlyMessage = `Element error: ${errorMessage}. Please check if the selectors in your plan are correct. Consider using more general selectors or adding fallback selectors.`;
				}
				
				return {
					content: [{ type: "text", text: userFriendlyMessage }],
					isError: true,
					code: MCP_ERROR_CODES.EXECUTION_ERROR
				};
			}
		}

		return {
			content: [{ 
				type: "text", 
				text: `Unknown tool: ${name}. Currently supported tools: action` 
			}],
			isError: true,
			code: MCP_ERROR_CODES.INVALID_TOOL
		};
	} catch (err) {
		error('Error in tool call', { error: err instanceof Error ? err.message : String(err) });
		const errorMessage = err instanceof Error ? err.message : String(err);
		
		// Provide a more user-friendly error message
		return {
			content: [{ 
				type: "text", 
				text: `An error occurred while processing your request: ${errorMessage}. Please check your parameters and try again.` 
			}],
			isError: true,
			code: MCP_ERROR_CODES.UNKNOWN_ERROR
		};
	}
}
