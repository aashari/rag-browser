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
		// Basic navigation and analysis
		createTool(
			"navigate",
			"Navigate to a URL and analyze the page"
		),

		// Plan execution
		createTool(
			"execute",
			"Execute a plan of actions on the current page",
			{
				plan: {
					type: "string",
					description: "The plan to execute (JSON string)",
				},
			},
			["url", "plan"]
		),
	];
}
