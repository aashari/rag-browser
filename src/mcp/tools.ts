import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export function createToolDefinitions(): Tool[] {
	return [
		{
			name: "navigate",
			description: "Navigate to a URL",
			inputSchema: {
				type: "object",
				properties: {
					url: {
						type: "string",
						format: "uri",
						description: "The URL to navigate to",
					},
					headless: {
						type: "string",
						enum: ["true", "false"],
						description: "Whether to run in headless mode",
					},
					selectorMode: {
						type: "string",
						enum: ["full", "simple"],
						description: "Selector mode to use",
					},
					timeout: {
						type: "number",
						description: "Navigation timeout in milliseconds",
					},
				},
				required: ["url"],
			},
		},
		{
			name: "execute",
			description: "Execute a plan of actions on the current page",
			inputSchema: {
				type: "object",
				properties: {
					url: {
						type: "string",
						format: "uri",
						description: "The URL to navigate to",
					},
					plan: {
						type: "string",
						description: "The plan to execute",
					},
					headless: {
						type: "string",
						enum: ["true", "false"],
						description: "Whether to run in headless mode",
					},
					selectorMode: {
						type: "string",
						enum: ["full", "simple"],
						description: "Selector mode to use",
					},
					timeout: {
						type: "number",
						description: "Navigation timeout in milliseconds",
					},
				},
				required: ["plan", "plan"],
			},
		},
	];
}
