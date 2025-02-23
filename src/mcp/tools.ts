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
			name: "navigate",
			description:
				"Analyzes a webpage by navigating to the specified URL and extracting detailed information about its interactive elements. This tool is designed for static analysis and exploration of a webpage’s structure without performing actions.\n\n" +
				"### Process:\n" +
				"1. **Loads the Webpage**: Opens the provided URL in a browser instance.\n" +
				"2. **Waits for Stability**: Ensures the page is fully loaded and stable (no pending network requests or DOM mutations).\n" +
				"3. **Analyzes Elements**: Identifies all interactive elements (inputs, buttons, links) and collects their details.\n" +
				"4. **Returns Analysis**: Outputs a structured text response with page title, description, and element details based on the 'inputs', 'buttons', and 'links' parameters.\n\n" +
				"### When to Use:\n" +
				"- **Exploration**: To understand a webpage’s layout, structure, or available interactive elements (e.g., forms, navigation links).\n" +
				"- **Preparation**: To gather selectors or element details for planning subsequent actions (e.g., filling a form, clicking a button).\n" +
				"- **Information Retrieval**: To extract metadata (title, description) or a list of links without modifying the page.\n" +
				"- **Debugging**: To inspect a page’s state before automation.\n\n" +
				"### Usage Guidelines:\n" +
				"- Use with a valid URL only; invalid URLs will fail with an error.\n" +
				"- Set 'inputs', 'buttons', or 'links' to 'true' for detailed output when needed; otherwise, expect a concise summary (top 5 visible elements).\n" +
				"- Results are stored as an MCP resource, accessible via 'resources/list' and 'resources/read' for later retrieval.\n\n" +
				"### Example Scenarios:\n" +
				"1. **User Request**: 'Open Wikipedia and list its links.'\n" +
				"   - Call: `navigate` with `url: 'https://www.wikipedia.org', links: 'true'`\n" +
				"   - Output: Page title, description, and all links with URLs and selectors.\n" +
				"2. **User Request**: 'What inputs are on a login page?'\n" +
				"   - Call: `navigate` with `url: 'https://example.com/login', inputs: 'true'`\n" +
				"   - Output: Detailed list of all input fields (e.g., username, password).\n\n" +
				"### Output Format:\n" +
				"- Text response with sections for title, description, inputs, buttons, and links.\n" +
				"- Detailed output (when 'true') includes full element attributes; otherwise, a summary of top 5 visible elements per category.",
			inputSchema: {
				type: "object",
				properties: {
					url: commonProperties.url,
					inputs: commonProperties.inputs,
					buttons: commonProperties.buttons,
					links: commonProperties.links,
				},
				required: ["url"],
			},
		},
		{
			name: "execute",
			description:
				"Executes a sequence of automated actions on a webpage and returns an analysis of the resulting page state. This tool is designed for dynamic interaction with a webpage, such as filling forms, clicking buttons, or navigating through processes.\n\n" +
				"### Process:\n" +
				"1. **Loads the Webpage**: Opens the provided URL in a browser instance.\n" +
				"2. **Executes the Plan**: Performs each action in the provided 'plan' sequentially (e.g., wait, click, type).\n" +
				"3. **Ensures Stability**: Monitors page stability after each action to ensure reliable execution.\n" +
				"4. **Analyzes Final State**: Returns a structured text response with the page’s final state, including title, description, and element details based on 'inputs', 'buttons', and 'links' parameters.\n\n" +
				"### When to Use:\n" +
				"- **Automation**: To perform tasks like logging in, submitting forms, or searching on a webpage.\n" +
				"- **Workflow Execution**: To navigate multi-step processes (e.g., checkout, registration).\n" +
				"- **Verification**: To check the page state after interactions (e.g., confirming a search result).\n" +
				"- **Data Extraction**: To capture specific content (via 'print' action) after actions are performed.\n\n" +
				"### Usage Guidelines:\n" +
				"- Requires a valid 'url' and a well-formed 'plan' JSON string.\n" +
				"- The 'plan' must contain an 'actions' array with valid action objects (see below).\n" +
				"- Use 'wait' actions to ensure elements are present before interacting.\n" +
				"- Set 'inputs', 'buttons', or 'links' to 'true' for detailed output of the final state.\n" +
				"- Results are stored as an MCP resource for later retrieval.\n\n" +
				"### Action Types:\n" +
				"1. **wait**: Waits for specified elements to appear.\n" +
				"   - Required: `elements` (array of CSS selectors)\n" +
				"   - Example: `{'type': 'wait', 'elements': ['input#search']}`\n" +
				"2. **click**: Clicks a single element.\n" +
				"   - Required: `element` (CSS selector)\n" +
				"   - Example: `{'type': 'click', 'element': '.submit-btn'}`\n" +
				"3. **typing**: Types text into an input field.\n" +
				"   - Required: `element` (CSS selector), `value` (text to type)\n" +
				"   - Optional: `delay` (ms between keystrokes)\n" +
				"   - Example: `{'type': 'typing', 'element': '#username', 'value': 'user123'}`\n" +
				"4. **keyPress**: Simulates a key press (e.g., Enter).\n" +
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
				"1. **User Request**: 'Search for AI Tools on Wikipedia.'\n" +
				"   - Call: `execute` with `url: 'https://www.wikipedia.org', plan: '{\"actions\": [{\"type\": \"wait\", \"elements\": [\"input#searchInput\"]}, {\"type\": \"typing\", \"element\": \"input#searchInput\", \"value\": \"AI Tools\"}, {\"type\": \"keyPress\", \"key\": \"Enter\", \"element\": \"input#searchInput\"}, {\"type\": \"print\", \"elements\": [\"#mw-content-text\"]}]}', inputs: 'true'`\n" +
				"   - Output: Final page title, description, detailed inputs, and printed content.\n" +
				"2. **User Request**: 'Log into a site.'\n" +
				"   - Call: `execute` with `url: 'https://example.com/login', plan: '{\"actions\": [{\"type\": \"typing\", \"element\": \"#username\", \"value\": \"user123\"}, {\"type\": \"typing\", \"element\": \"#password\", \"value\": \"pass456\"}, {\"type\": \"submit\", \"element\": \"form#login\"}]}'`\n" +
				"   - Output: Post-login page analysis.\n\n" +
				"### Output Format:\n" +
				"- Text response with action execution details, final page title, description, and element details.\n" +
				"- Includes 'plannedActions' results (e.g., HTML from 'print') if present in the plan.",
			inputSchema: {
				type: "object",
				properties: {
					url: commonProperties.url,
					inputs: commonProperties.inputs,
					buttons: commonProperties.buttons,
					links: commonProperties.links,
					plan: {
						type: "string",
						description:
							"A JSON string defining a sequence of actions to execute on the webpage. Must be a valid JSON object with an 'actions' array. Each action requires a 'type' field and additional fields based on the type:\n" +
							"- **wait**: `elements` (string[]) - Waits for all listed CSS selectors to be present.\n" +
							"- **click**: `element` (string) - Clicks the specified CSS selector.\n" +
							"- **typing**: `element` (string), `value` (string), `delay?` (number) - Types the value into the element with an optional delay between keystrokes.\n" +
							"- **keyPress**: `key` (string), `element?` (string) - Presses the key, optionally focusing an element first.\n" +
							"- **submit**: `element` (string) - Submits the form or clicks the element.\n" +
							"- **print**: `elements` (string[]) - Captures HTML of the listed selectors.\n\n" +
							"### Guidelines:\n" +
							"- Use valid CSS selectors (e.g., '#id', '.class', 'input[name=\"field\"]').\n" +
							"- Escape quotes in JSON correctly (e.g., `\"` instead of `'`).\n" +
							"- Include 'wait' before interactions if elements may load asynchronously.\n\n" +
							"### Example:\n" +
							`'{\"actions\": [{\"type\": \"wait\", \"elements\": [\"input#searchInput\"]}, {\"type\": \"typing\", \"element\": \"input#searchInput\", \"value\": \"AI Tools\"}, {\"type\": \"keyPress\", \"key\": \"Enter\", \"element\": \"input#searchInput\"}, {\"type\": \"print\", \"elements\": [\"#mw-content-text\"]}]}'`,
					},
				},
				required: ["url", "plan"],
			},
		},
	];
}