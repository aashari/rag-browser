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

// Enhanced Tool interface with version and compatibility
interface EnhancedTool extends Tool {
	version: string;
	compatibility: {
		minVersion: string;
		deprecatedFeatures: string[];
	};
}

// Function to create a browser tool schema
function createBrowserToolSchema(additionalProps: SchemaProperties = {}, required: string[] = ["url"]): JsonSchema {
	return {
		type: "object",
		properties: { ...commonProperties, ...additionalProps },
		required,
	};
}

// Function to create a tool definition
function createTool(name: string, description: string, additionalProps: SchemaProperties = {}, required: string[] = ["url"]): EnhancedTool {
	return {
		name,
		description,
		version: "1.15.0",
		compatibility: {
			minVersion: "1.0.0",
			deprecatedFeatures: [], // No deprecated features yet
		},
		inputSchema: createBrowserToolSchema(additionalProps, required),
	};
}

export function createToolDefinitions(): EnhancedTool[] {
	return [
		{
			name: "action",
			description:
				"A proactive web automation tool that enables me (the AI) to interact with webpages in a browser for you. I can open sites, wait for page loads or authentication, click buttons, type text, extract data, and more—based on your intent. My goal is to assist with tasks like opening apps, fetching content, or automating actions, even if you don't specify every step.\n\n" +
				"### When I'll Use This Tool:\n" +
				"- Automatically when you ask me to 'open' a webpage or app (e.g., 'open Slack,' 'open Twitter').\n" +
				"- When you request data from a webpage (e.g., 'give me unread messages,' 'list Slack channels').\n" +
				"- When you imply an action on a site (e.g., 'search Twitter for AI news').\n" +
				"I'll assume you want me to use this tool unless you explicitly say otherwise (e.g., 'don't use the browser').\n\n" +
				"### What I Can Do:\n" +
				"- Open a URL and wait for it to load or for you to authenticate (e.g., Slack, Twitter).\n" +
				"- Extract content (e.g., unread messages, channel lists) as markdown or raw HTML.\n" +
				"- Perform actions like typing, clicking, or pressing keys (e.g., search, submit forms).\n" +
				"- Handle dynamic pages by waiting for specific elements to appear.\n\n" +
				"### How I'll Respond:\n" +
				"1. I'll confirm what I'm doing (e.g., 'Let me open Slack and wait for you to log in if needed').\n" +
				"2. I'll execute the tool with a crafted `plan` (e.g., wait, extract, etc.).\n" +
				"3. I'll share the results or ask for clarification if stuck (e.g., 'Here are your unread messages' or 'I need more details').\n\n" +
				"### Key Examples:\n" +
				"1. **User: 'open Slack'**\n" +
				"   - I say: 'Let me open Slack. If you're not logged in, I'll wait for you.'\n" +
				"   - I run: `{\"url\": \"https://app.slack.com/client\", \"plan\": {\"actions\": [{\"type\": \"wait\", \"elements\": [\".p-workspace__primary_view_contents, .p-signin_form\"], \"timeout\": -1}]}}`\n" +
				"   - Next: Confirm it's loaded or wait for your input.\n\n" +
				"2. **User: 'open Slack give me unread messages'**\n" +
				"   - I say: 'I'll open Slack and fetch your unread messages.'\n" +
				"   - I run: `{\"url\": \"https://app.slack.com/client\", \"plan\": {\"actions\": [{\"type\": \"wait\", \"elements\": [\".p-channel_sidebar__channel--unread span.p-channel_sidebar__name\"], \"timeout\": -1}, {\"type\": \"markdown\", \"elements\": [\".p-channel_sidebar__channel--unread span.p-channel_sidebar__name\"]}]}}`\n" +
				"   - I say: 'Here are your unread Slack channels: #channel1, #channel2...'\n\n" +
				"3. **User: 'search Twitter for AI news'**\n" +
				"   - I say: 'I'm opening Twitter to search for AI news.'\n" +
				"   - I run: `{\"url\": \"https://x.com\", \"plan\": {\"actions\": [{\"type\": \"wait\", \"elements\": [\"input[data-testid='SearchBox_Search_Input']\"], \"timeout\": -1}, {\"type\": \"typing\", \"element\": \"input[data-testid='SearchBox_Search_Input']\", \"value\": \"AI news\"}, {\"type\": \"keyPress\", \"key\": \"Enter\"}, {\"type\": \"wait\", \"elements\": [\"[data-testid='tweet']\"], \"timeout\": 5000}, {\"type\": \"markdown\", \"elements\": [\"[data-testid='tweet']\"]}]}}`\n" +
				"   - I say: 'Here's what I found on Twitter about AI news...'\n\n" +
				"### My Approach:\n" +
				"- I'll start with a `wait` action to ensure the page is ready (e.g., key elements are loaded).\n" +
				"- For authentication, I'll use `timeout: -1` to wait indefinitely until you're logged in.\n" +
				"- I'll prioritize specific selectors (e.g., IDs, data attributes) and fall back to broader ones if needed.\n" +
				"- If elements are missing or the page fails to load, I'll adjust or ask you for help.\n\n" +
				"### Tips for You:\n" +
				"- Use natural phrases like 'open Slack,' 'list channels,' or 'search X'—I'll handle the details.\n" +
				"- If I need more info (e.g., search terms), I'll ask.\n" +
				"- To override this tool, say 'don't use the browser' or similar.\n\n" +
				"Give me a task, and I'll jump in with a plan to make it happen!",
			version: "1.15.0",
			compatibility: {
				minVersion: "1.0.0",
				deprecatedFeatures: [],
			},
			inputSchema: {
				type: "object",
				properties: {
					...commonProperties,
					plan: {
						type: "string",
						description:
							"A JSON string with an 'actions' array I'll use to interact with the page. If omitted, I'll just analyze the URL. Actions include:\n" +
							"- `wait`: Waits for elements (e.g., `elements: ['body', '.login']`).\n" +
							"- `click`: Clicks an element (e.g., `element: 'button.submit'`).\n" +
							"- `typing`: Types text (e.g., `element: 'input', value: 'hello'`).\n" +
							"- `keyPress`: Presses a key (e.g., `key: 'Enter'`).\n" +
							"- `print`: Gets raw HTML from elements.\n" +
							"- `markdown`: Extracts content as markdown.\n" +
							"Use CSS selectors (e.g., '#id', '.class'). I'll build this for you based on your request."
					}
				},
				required: ["url"]
			}
		}
	];
}

export const tools = {
	action: {
		name: "action",
		version: "1.15.0",
		// ... existing code ...
	}
};

export const compatibility = {
	minimumVersion: "1.0.0",
	version: "1.15.0",
	// ... existing code ...
};