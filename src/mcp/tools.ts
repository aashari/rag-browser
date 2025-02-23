import type { Tool } from "@modelcontextprotocol/sdk/types.js";

// Common properties shared between tools
const commonProperties = {
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
};

// Type for additional properties in tool schemas
type SchemaProperties = Record<string, {
	type: string;
	description: string;
	format?: string;
	enum?: string[];
}>;

// Type for JSON Schema object
type JsonSchema = {
	type: "object";
	properties: Record<string, unknown>;
	required: string[];
};

// Function to create a browser tool schema
function createBrowserToolSchema(additionalProps: SchemaProperties = {}, required: string[] = ["url"]): JsonSchema {
	return {
		type: "object",
		properties: { ...commonProperties, ...additionalProps },
		required,
	};
}

// Function to create a tool definition
function createTool(name: string, description: string, additionalProps: SchemaProperties = {}, required: string[] = ["url"]): Tool {
	return {
		name,
		description,
		inputSchema: createBrowserToolSchema(additionalProps, required),
	};
}

export function createToolDefinitions(): Tool[] {
	return [
		{
			name: "navigate",
			description: "Navigate to a URL and analyze the page",
			inputSchema: {
				type: "object",
				properties: {
					url: {
						type: "string",
						description: "The URL to navigate to",
						format: "uri",
					},
					headless: {
						type: "string",
						description: "Whether to run in headless mode",
						enum: ["true", "false"],
					},
					selectorMode: {
						type: "string",
						description: "Selector mode to use",
						enum: ["full", "simple"],
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
						description: "The URL to navigate to",
						format: "uri",
					},
					headless: {
						type: "string",
						description: "Whether to run in headless mode",
						enum: ["true", "false"],
					},
					selectorMode: {
						type: "string",
						description: "Selector mode to use",
						enum: ["full", "simple"],
					},
					timeout: {
						type: "number",
						description: "Navigation timeout in milliseconds",
					},
					plan: {
						type: "string",
						description: "The plan to execute as a JSON string. Must be an object with an 'actions' array. Each action must have a 'type' and specific required fields:\n" +
							"- wait: elements (string[])\n" +
							"- click: element (string)\n" +
							"- typing: element (string), value (string), delay? (number)\n" +
							"- keyPress: key (string), element? (string)\n" +
							"- submit: element (string)\n" +
							"- print: elements (string[])",
					}
				},
				required: ["url", "plan"],
			},
		},
	];
}
