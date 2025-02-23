import type { Tool } from "@modelcontextprotocol/sdk/types.js";

// Common properties shared between tools
const commonProperties = {
	url: {
		type: "string",
		format: "uri",
		description: "The target webpage URL to analyze. Must be a valid URL starting with http:// or https://. The page will be loaded and analyzed for interactive elements.",
	},
	inputs: {
		type: "string",
		enum: ["true", "false"],
		description: "When set to 'true', displays detailed information about all input elements found on the page, including hidden inputs, form fields, text areas, and select dropdowns. Default behavior shows only top 5 visible inputs with basic information.",
	},
	buttons: {
		type: "string",
		enum: ["true", "false"],
		description: "When set to 'true', shows comprehensive details about all button elements, including submit buttons, clickable divs, and button-like elements. Default behavior shows only top 5 visible buttons with basic information.",
	},
	links: {
		type: "string",
		enum: ["true", "false"],
		description: "When set to 'true', provides complete information about all hyperlinks on the page, including their URLs, text content, and selectors. Default behavior shows only top 5 visible links with basic information.",
	}
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
			description: "Analyzes a webpage by navigating to it and extracting information about interactive elements. This tool:\n" +
				"1. Loads the specified webpage\n" +
				"2. Waits for the page to be fully loaded and stable\n" +
				"3. Identifies and analyzes all interactive elements (inputs, buttons, links)\n" +
				"4. Returns a structured analysis with element details\n\n" +
				"Use this tool when you need to:\n" +
				"- Understand the structure and interactive elements of a webpage\n" +
				"- Get information about forms and input fields\n" +
				"- Find navigation links and clickable elements\n" +
				"- Prepare for automation by identifying selectors\n" +
				"\n" +
				"Example: User ask to open wikipedia",
			inputSchema: {
				type: "object",
				properties: {
					url: {
						type: "string",
						description: "The webpage URL to analyze. Must be a valid URL starting with http:// or https://. The page will be loaded and analyzed for interactive elements.",
						format: "uri",
					},
					inputs: {
						type: "string",
						description: "Set to 'true' to get detailed information about all input elements, including:\n" +
							"- Text inputs, textareas, and form fields\n" +
							"- Hidden inputs and their values\n" +
							"- Select dropdowns and their options\n" +
							"- Input attributes (type, id, name, placeholder)\n" +
							"Default 'false' shows only top 5 visible inputs.",
						enum: ["true", "false"],
					},
					buttons: {
						type: "string",
						description: "Set to 'true' to get comprehensive details about all buttons, including:\n" +
							"- Standard button elements\n" +
							"- Submit and reset buttons\n" +
							"- Clickable elements with button roles\n" +
							"- Button text and accessibility attributes\n" +
							"Default 'false' shows only top 5 visible buttons.",
						enum: ["true", "false"],
					},
					links: {
						type: "string",
						description: "Set to 'true' to get complete information about all hyperlinks, including:\n" +
							"- Link URLs and their targets\n" +
							"- Link text and titles\n" +
							"- Navigation and menu links\n" +
							"- Internal and external links\n" +
							"Default 'false' shows only top 5 visible links.",
						enum: ["true", "false"],
					}
				},
				required: ["url"],
			},
		},
		{
			name: "execute",
			description: "Executes a series of automated actions on a webpage while analyzing the page state. This tool:\n" +
				"1. Loads the specified webpage\n" +
				"2. Executes the provided action plan step by step\n" +
				"3. Monitors page stability between actions\n" +
				"4. Returns analysis of the final page state\n\n" +
				"Use this tool when you need to:\n" +
				"- Automate interactions with a webpage\n" +
				"- Fill out forms and submit them\n" +
				"- Navigate through multi-step processes\n" +
				"- Verify page state after interactions\n" +
				"\n" +
				"Example: User ask to open wikipedia and search for 'AI Tools'",
			inputSchema: {
				type: "object",
				properties: {
					url: {
						type: "string",
						description: "The webpage URL to execute actions on. Must be a valid URL starting with http:// or https://. The page will be loaded before executing the plan.\n" +
							"Example URL: https://www.wikipedia.org",
						format: "uri",
					},
					inputs: {
						type: "string",
						description: "Set to 'true' to get detailed information about all input elements after plan execution, including:\n" +
							"- Updated input values and states\n" +
							"- Form field changes\n" +
							"- New or modified inputs\n" +
							"Default 'false' shows only top 5 visible inputs.",
						enum: ["true", "false"],
					},
					buttons: {
						type: "string",
						description: "Set to 'true' to get comprehensive details about all buttons after plan execution, including:\n" +
							"- Button states (enabled/disabled)\n" +
							"- Changes in button visibility\n" +
							"- New or modified buttons\n" +
							"Default 'false' shows only top 5 visible buttons.",
						enum: ["true", "false"],
					},
					links: {
						type: "string",
						description: "Set to 'true' to get complete information about all hyperlinks after plan execution, including:\n" +
							"- Updated link states\n" +
							"- New or modified links\n" +
							"- Changes in navigation structure\n" +
							"Default 'false' shows only top 5 visible links.",
						enum: ["true", "false"],
					},
					plan: {
						type: "string",
						description: "A JSON string defining the sequence of actions to execute. The plan must be an object with an 'actions' array. Each action must have:\n" +
							"1. A 'type' field specifying the action type:\n" +
							"   - 'wait': Wait for elements to be present\n" +
							"   - 'click': Click on an element\n" +
							"   - 'typing': Enter text into an input\n" +
							"   - 'keyPress': Simulate keyboard input\n" +
							"   - 'submit': Submit a form\n" +
							"   - 'print': Capture element HTML\n\n" +
							"2. Required fields based on type:\n" +
							"   - wait: elements (string[])\n" +
							"   - click: element (string)\n" +
							"   - typing: element (string), value (string)\n" +
							"   - keyPress: key (string), element? (string)\n" +
							"   - submit: element (string)\n" +
							"   - print: elements (string[])\n\n" +
							"Example plan:\n" +
							'{ "actions": [ {"type": "wait", "elements": ["input#searchInput"]}, {"type": "typing", "element": "input#searchInput", "value": "AI Tools"}, {"type": "keyPress", "key": "Enter", "element": "input#searchInput"}, {"type": "print", "elements": ["#mw-content-text"]} ] }'
					}
				},
				required: ["url", "plan"],
			},
		},
	];
}
