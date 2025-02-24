import type { Tool } from "@modelcontextprotocol/sdk/types.js";

// Common properties shared between tools
const commonProperties = {
	url: {
		type: "string",
		format: "uri",
		description: "The target webpage URL to analyze or interact with. Must be a valid URL starting with 'http://' or 'https://'. This URL is loaded in a browser instance and serves as the starting point for analysis or actions. Examples: 'https://www.wikipedia.org', 'https://example.com/login'. Invalid URLs (e.g., missing protocol, non-existent domains) will result in an error.",
	},
	inputs: {
		type: "string",
		enum: ["true", "false"],
		description: "Controls the level of detail for input elements in the output. Set to 'true' to return comprehensive details about all input elements (e.g., text fields, textareas, dropdowns, hidden inputs) including type, ID, name, value, placeholder, visibility, and selectors. When 'false' (default), only the top 5 visible inputs are summarized with basic info (label, type, selector). Use 'true' when you need exhaustive form data or to interact with specific inputs.",
	},
	buttons: {
		type: "string",
		enum: ["true", "false"],
		description: "Controls the level of detail for button elements in the output. Set to 'true' to return detailed information about all buttons (e.g., standard buttons, submit/reset buttons, clickable elements with role='button') including text content, selectors, and visibility. When 'false' (default), only the top 5 visible buttons are summarized with basic info (text, selector). Use 'true' when you need to identify all clickable elements for navigation or submission.",
	},
	links: {
		type: "string",
		enum: ["true", "false"],
		description: "Controls the level of detail for hyperlinks in the output. Set to 'true' to return complete details about all links (e.g., anchor tags with 'href') including URL, text content, selectors, and whether they are internal or external. When 'false' (default), only the top 5 visible links are summarized with basic info (title, URL, selector). Use 'true' when you need a full navigation map or to follow specific links.",
	},
};

// Type for additional properties in tool schemas
type SchemaProperties = Record<
	string,
	{
		type: string;
		description: string;
		format?: string;
		enum?: string[];
	}
>;

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
			name: "action",
			description:
				"Analyzes and interacts with a webpage. This tool combines page analysis and action execution capabilities.\n\n" +
				"### Process:\n" +
				"1. **Loads the Webpage**: Opens the provided URL in a browser instance.\n" +
				"2. **Optional Plan Execution**: If a plan is provided, executes each action sequentially.\n" +
				"3. **Ensures Stability**: Monitors page stability during loading and after each action.\n" +
				"4. **Analyzes State**: Returns a structured analysis of the page's current state.\n\n" +
				"### When to Use:\n" +
				"- **Static Analysis**: To explore a webpage's structure and elements (without a plan).\n" +
				"- **Automation**: To perform tasks like form filling, clicking, or searching (with a plan).\n" +
				"- **Information Retrieval**: To extract page content or element details.\n" +
				"- **Multi-step Workflows**: To navigate through processes like login or checkout.\n\n" +
				"### Usage Guidelines:\n" +
				"- Always requires a valid 'url'.\n" +
				"- Optional 'plan' parameter for executing actions.\n" +
				"- Set 'inputs', 'buttons', or 'links' to 'true' for detailed element analysis.\n" +
				"- Results are stored as an MCP resource for later retrieval.\n\n" +
				"### Action Types (when using plan):\n" +
				"1. **wait**: Waits for elements to appear.\n" +
				"   - Required: `elements` (array of CSS selectors)\n" +
				"   - Example: `{'type': 'wait', 'elements': ['input#search']}`\n" +
				"2. **click**: Clicks a single element.\n" +
				"   - Required: `element` (CSS selector)\n" +
				"   - Example: `{'type': 'click', 'element': '.submit-btn'}`\n" +
				"3. **typing**: Types text into an input field.\n" +
				"   - Required: `element` (CSS selector), `value` (text to type)\n" +
				"   - Optional: `delay` (ms between keystrokes)\n" +
				"   - Example: `{'type': 'typing', 'element': '#username', 'value': 'user123'}`\n" +
				"4. **keyPress**: Simulates a key press.\n" +
				"   - Required: `key` (key name)\n" +
				"   - Optional: `element` (CSS selector to focus)\n" +
				"   - Example: `{'type': 'keyPress', 'key': 'Enter', 'element': '#search'}`\n" +
				"5. **submit**: Submits a form or clicks a submit-like element.\n" +
				"   - Required: `element` (CSS selector)\n" +
				"   - Example: `{'type': 'submit', 'element': 'form#login'}`\n" +
				"6. **print**: Captures HTML of specified elements.\n" +
				"   - Required: `elements` (array of CSS selectors)\n" +
				"   - Example: `{'type': 'print', 'elements': ['#content']}`\n\n" +
				"### Example Scenarios:\n" +
				"1. **Simple Analysis**: Just explore a page\n" +
				"   ```json\n" +
				"   {\n" +
				"     \"url\": \"https://www.wikipedia.org\",\n" +
				"     \"inputs\": \"true\",\n" +
				"     \"links\": \"true\"\n" +
				"   }\n" +
				"   ```\n\n" +
				"2. **Search Workflow**: Analyze and perform search\n" +
				"   ```json\n" +
				"   {\n" +
				"     \"url\": \"https://www.wikipedia.org\",\n" +
				"     \"plan\": {\n" +
				"       \"actions\": [\n" +
				"         {\"type\": \"wait\", \"elements\": [\"#searchInput\"]},\n" +
				"         {\"type\": \"typing\", \"element\": \"#searchInput\", \"value\": \"AI Tools\"},\n" +
				"         {\"type\": \"keyPress\", \"key\": \"Enter\"},\n" +
				"         {\"type\": \"print\", \"elements\": [\"#mw-content-text\"]}\n" +
				"       ]\n" +
				"     }\n" +
				"   }\n" +
				"   ```",
			inputSchema: {
				type: "object",
				properties: {
					...commonProperties,
					plan: {
						type: "string",
						description:
							"Optional JSON string defining actions to execute. When omitted, performs page analysis only. Must be a valid JSON object with an 'actions' array when provided. Each action requires a 'type' field and additional fields based on the type:\n" +
							"- **wait**: `elements` (string[]) - Waits for all listed CSS selectors to be present.\n" +
							"- **click**: `element` (string) - Clicks the specified CSS selector.\n" +
							"- **typing**: `element` (string), `value` (string), `delay?` (number) - Types the value into the element.\n" +
							"- **keyPress**: `key` (string), `element?` (string) - Presses the key, optionally focusing an element first.\n" +
							"- **submit**: `element` (string) - Submits the form or clicks the element.\n" +
							"- **print**: `elements` (string[]) - Captures HTML of the listed selectors.\n\n" +
							"### Guidelines:\n" +
							"- Use valid CSS selectors (e.g., '#id', '.class', 'input[name=\"field\"]').\n" +
							"- Escape quotes in JSON correctly.\n" +
							"- Include 'wait' before interactions for async elements."
					}
				},
				required: ["url"]
			}
		}
	];
}