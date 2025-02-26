import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { analyzePage } from "../core/browser.js";
import { validateUrl } from "../utils/security.js";
import { VERSION } from "../config/version.js";
import type { BrowserOptions, PageAnalysis } from "../types";

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
	format: {
		type: "string",
		enum: ["json", "pretty"],
		description: "Controls the output format for the page analysis. Set to 'json' to return the analysis as a structured JSON object (useful for programmatic processing), or 'pretty' (default) for a human-readable formatted text. Note: This is different from the 'format' property in print actions, which controls HTML vs markdown output for captured content.",
	}
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
		version: "1.16.0",
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
				"- Extract content (e.g., unread messages, channel lists) in either markdown format (for readable text) or raw HTML (for structured data).\n" +
				"- Perform interactions like typing text, clicking elements, or pressing keys (e.g., search forms, navigation, form submission).\n" +
				"- Handle dynamic pages and authentication by waiting for specific elements to appear before proceeding.\n" +
				"- Process forms, navigate between pages, and extract data across multiple steps.\n\n" +
				"### How I'll Respond:\n" +
				"1. I'll confirm what I'm doing (e.g., 'Let me open Slack and wait for you to log in if needed').\n" +
				"2. I'll execute the tool with a crafted `plan` (a sequence of actions like wait, extract, click, etc.).\n" +
				"3. I'll share the results or ask for clarification if stuck (e.g., 'Here are your unread messages' or 'I need more details').\n" +
				"4. If an action fails (element not found, timeout), I'll provide feedback and suggest alternatives.\n\n" +
				"### Key Examples:\n" +
				"1. **Simple page load - User: 'open Slack'**\n" +
				"   - I say: 'Let me open Slack. If you're not logged in, I'll wait for you.'\n" +
				"   - I run: `{\"url\": \"https://app.slack.com/client\", \"plan\": {\"actions\": [{\"type\": \"wait\", \"elements\": [\".p-workspace__primary_view_contents, .p-signin_form\"], \"timeout\": -1}]}}`\n" +
				"   - This opens Slack and waits indefinitely for either the workspace view or login form to appear.\n\n" +
				"2. **Extract data - User: 'open Slack give me unread messages'**\n" +
				"   - I say: 'I'll open Slack and fetch your unread messages.'\n" +
				"   - I run: `{\"url\": \"https://app.slack.com/client\", \"plan\": {\"actions\": [{\"type\": \"wait\", \"elements\": [\".p-channel_sidebar__channel--unread span.p-channel_sidebar__name\"], \"timeout\": -1}, {\"type\": \"print\", \"elements\": [\".p-channel_sidebar__channel--unread span.p-channel_sidebar__name\"], \"format\": \"markdown\"}]}}`\n" +
				"   - The plan first waits for unread channels to appear, then extracts their names as markdown text.\n\n" +
				"3. **Interactive sequence - User: 'search Twitter for AI news'**\n" +
				"   - I say: 'I'm opening Twitter to search for AI news.'\n" +
				"   - I run: `{\"url\": \"https://x.com\", \"plan\": {\"actions\": [{\"type\": \"wait\", \"elements\": [\"input[data-testid='SearchBox_Search_Input']\"], \"timeout\": -1}, {\"type\": \"typing\", \"element\": \"input[data-testid='SearchBox_Search_Input']\", \"value\": \"AI news\"}, {\"type\": \"keyPress\", \"key\": \"Enter\"}, {\"type\": \"wait\", \"elements\": [\"[data-testid='tweet']\"], \"timeout\": 5000}, {\"type\": \"print\", \"elements\": [\"[data-testid='tweet']\"], \"format\": \"markdown\"}]}}`\n" +
				"   - The plan first waits for the search box, types the query, presses Enter, waits for results, and finally extracts the tweets.\n\n" +
				"### Best Practices:\n" +
				"- **Always start with a wait action** to ensure the page is loaded before any interaction.\n" +
				"- For authentication flows, use `timeout: -1` in wait actions to pause until the user has logged in.\n" +
				"- After any interaction (click/type), include another wait action to ensure the page has responded.\n" +
				"- Use specific selectors when possible (IDs, data-testid attributes) for better reliability.\n" +
				"- For forms, wait → type → wait → click (submit) → wait → extract results is a reliable pattern.\n" +
				"- If extracting content fails, try different selectors or check if authentication is needed.\n\n" +
				"### Tips for You:\n" +
				"- Use natural phrases like 'open Slack,' 'list channels,' or 'search X'—I'll handle the technical details.\n" +
				"- If I need more specific information (e.g., search terms, login credentials), I'll ask you.\n" +
				"- To override this tool, say 'don't use the browser' or similar.\n\n" +
				"Give me a task, and I'll create an appropriate plan to accomplish it!",
			version: VERSION,
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
							"A JSON string containing an object with an 'actions' array that will be executed in sequence. Format must be: {\"actions\": [{action1}, {action2}, ...]}. If omitted, I'll just analyze the URL without executing actions. Each action must have a 'type' property and type-specific properties. The action plan executes sequentially until completion or until an action fails.\n\n" +
							"Actions include:\n" +
							"- `wait`: Waits for elements (e.g., `elements: ['body', '.login']`). You can specify a `timeout` in milliseconds (default: 30000). Use `timeout: -1` for an indefinite wait, which is useful for authentication flows where user interaction is required.\n" +
							"- `click`: Clicks an element (e.g., `element: 'button.submit'`). Be sure to wait for the element to appear before clicking.\n" +
							"- `typing`: Types text (e.g., `element: 'input', value: 'hello'`). Optional `delay` parameter (in ms) controls typing speed.\n" +
							"- `keyPress`: Presses a key (e.g., `key: 'Enter'`). Specify an `element` to target a specific element, or omit to press the key globally.\n" +
							"- `print`: Gets content from elements. Use `elements: ['selector1', 'selector2']` to specify target elements. The `format` property can be `'html'` (default) for raw HTML or `'markdown'` for formatted text.\n\n" +
							"For selectors, use valid CSS selectors (e.g., '#id', '.class'). For best results, prefer:\n" +
							"- IDs (#login-form) and data attributes ([data-testid='submit'])\n" +
							"- Specific class names (.login-button) over generic ones (.button)\n" +
							"- Multiple selectors for fallbacks ('button.submit, [type=\"submit\"]')\n\n" +
							"Common patterns:\n" +
							"- For page load: wait → extract content\n" +
							"- For interaction: wait → interact (click/type) → wait for result → extract content\n" +
							"- For authentication: wait with timeout: -1 → extract content after user logs in\n\n" +
							"If an action fails (element not found, timeout, etc.), execution stops and returns results collected up to that point."
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
		version: VERSION,
		// ... existing code ...
	}
};

export const compatibility = {
	minimumVersion: "1.0.0",
	version: "1.16.0",
	// ... existing code ...
};