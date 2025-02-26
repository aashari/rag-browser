import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { VERSION } from "../config/version.js";

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

// Enhanced Tool interface with version and compatibility
interface EnhancedTool extends Tool {
	version: string;
	compatibility: {
		minVersion: string;
		deprecatedFeatures: string[];
	};
}

export function createToolDefinitions(): EnhancedTool[] {
	return [
		{
			name: "action",
			description:
				`A proactive web automation tool that enables me (the AI) to interact with webpages in a browser for you. I can open sites, wait for page loads or authentication, click buttons, type text, extract data, and more—based on your intent. My goal is to assist with tasks like opening apps, fetching content, or automating actions, even if you don't specify every step.

### When I'll Use This Tool:
- Automatically when you ask me to 'open' a webpage or app (e.g., 'open Slack,' 'open Twitter').
- When you request data from a webpage (e.g., 'give me unread messages,' 'list Slack channels').
- When you imply an action on a site (e.g., 'search Twitter for AI news').
I'll assume you want me to use this tool unless you explicitly say otherwise (e.g., 'don't use the browser').

### What I Can Do:
- Open a URL and wait for it to load or for you to authenticate (e.g., Slack, Twitter).
- Extract content (e.g., unread messages, channel lists) in either markdown format (for readable text) or raw HTML (for structured data).
- Perform interactions like typing text, clicking elements, or pressing keys (e.g., search forms, navigation, form submission).
- Handle dynamic pages and authentication by waiting for specific elements to appear before proceeding.
- Process forms, navigate between pages, and extract data across multiple steps.

### How I'll Respond:
1. I'll confirm what I'm doing (e.g., 'Let me open Slack and wait for you to log in if needed').
2. I'll execute the tool with a crafted \`plan\` (a sequence of actions like wait, extract, click, etc.).
3. I'll share the results or ask for clarification if stuck (e.g., 'Here are your unread messages' or 'I need more details').
4. If an action fails (element not found, timeout), I'll provide feedback and suggest alternatives.

### Understanding Results:
When I use this tool, the results will contain:
- Page analysis: Title, description, and summary of elements (inputs, buttons, links)
- Action guidance: Recommended patterns for interaction based on page structure
- Detected elements: Lists of inputs, buttons, and links with their selectors (use these in follow-up actions)
- Action results: Content extracted from the elements (in HTML or markdown format)
- Next action suggestions: Example actions with selectors that you can use for follow-up commands

For best results, I'll:
1. First analyze the page structure to understand what's available
2. Use selectors provided in the results for follow-up actions
3. Follow recommended action patterns (e.g., wait → interact → wait → extract)
4. Use appropriate timeouts for dynamic content
5. Extract content in markdown format for human-readable text or HTML for structured data analysis

### Key Examples:
1. **Simple page load - User: 'open Slack'**
   - I say: 'Let me open Slack. If you're not logged in, I'll wait for you.'
   - I run: \`{"url": "https://app.slack.com/client", "plan": {"actions": [{"type": "wait", "elements": [".p-workspace__primary_view_contents, .p-signin_form"], "timeout": -1}]}}\`
   - This opens Slack and waits indefinitely for either the workspace view or login form to appear.

2. **Extract data - User: 'open Slack give me unread messages'**
   - I say: 'I'll open Slack and fetch your unread messages.'
   - I run: \`{"url": "https://app.slack.com/client", "plan": {"actions": [{"type": "wait", "elements": [".p-channel_sidebar__channel--unread span.p-channel_sidebar__name"], "timeout": -1}, {"type": "print", "elements": [".p-channel_sidebar__channel--unread span.p-channel_sidebar__name"], "format": "markdown"}]}}\`
   - The plan first waits for unread channels to appear, then extracts their names as markdown text.

3. **Interactive sequence - User: 'search Twitter for AI news'**
   - I say: 'I'm opening Twitter to search for AI news.'
   - I run: \`{"url": "https://x.com", "plan": {"actions": [{"type": "wait", "elements": ["input[data-testid='SearchBox_Search_Input']"], "timeout": -1}, {"type": "typing", "element": "input[data-testid='SearchBox_Search_Input']", "value": "AI news"}, {"type": "keyPress", "key": "Enter"}, {"type": "wait", "elements": ["[data-testid='tweet']"], "timeout": 5000}, {"type": "print", "elements": ["[data-testid='tweet']"], "format": "markdown"}]}}\`
   - The plan first waits for the search box, types the query, presses Enter, waits for results, and finally extracts the tweets.`,
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
							`A JSON string containing an object with an 'actions' array that will be executed in sequence. Format must be: {"actions": [{action1}, {action2}, ...]}. If omitted, I'll just analyze the URL without executing actions. Each action must have a 'type' property and type-specific properties. The action plan executes sequentially until completion or until an action fails.

Actions include:
- \`wait\`: Waits for elements (e.g., \`elements: ['body', '.login']\`). You can specify a \`timeout\` in milliseconds (default: 30000). Use \`timeout: -1\` for an indefinite wait, which is useful for authentication flows where user interaction is required.
- \`click\`: Clicks an element (e.g., \`element: 'button.submit'\`). Be sure to wait for the element to appear before clicking.
- \`typing\`: Types text (e.g., \`element: 'input', value: 'hello'\`). Optional \`delay\` parameter (in ms) controls typing speed.
- \`keyPress\`: Presses a key (e.g., \`key: 'Enter'\`). Specify an \`element\` to target a specific element, or omit to press the key globally.
- \`print\`: Gets content from elements. Use \`elements: ['selector1', 'selector2']\` to specify target elements. The \`format\` property can be \`'html'\` (default) for raw HTML or \`'markdown'\` for formatted text.

For selectors, use valid CSS selectors (e.g., '#id', '.class'). For best results, prefer:
- IDs (#login-form) and data attributes ([data-testid='submit'])
- Specific class names (.login-button) over generic ones (.button)
- Multiple selectors for fallbacks ('button.submit, [type="submit"]')

Common patterns:
- For page load: wait → extract content
- For interaction: wait → interact (click/type) → wait for result → extract content
- For authentication: wait with timeout: -1 → extract content after user logs in

If an action fails (element not found, timeout, etc.), execution stops and returns results collected up to that point.

PRACTICAL EXAMPLES:

1. Login to a site (wait for user authentication):
   {"actions": [
     {"type": "wait", "elements": [".login-form, .dashboard"], "timeout": -1},
     {"type": "print", "elements": ["body"], "format": "markdown"}
   ]}

2. Fill a search form and get results:
   {"actions": [
     {"type": "wait", "elements": ["input[type='search']"], "timeout": 5000},
     {"type": "typing", "element": "input[type='search']", "value": "search query"},
     {"type": "keyPress", "key": "Enter"},
     {"type": "wait", "elements": [".search-results"], "timeout": 10000},
     {"type": "print", "elements": [".search-results"], "format": "markdown"}
   ]}

3. Click a button and capture the resulting content:
   {"actions": [
     {"type": "wait", "elements": ["button.show-more"], "timeout": 5000},
     {"type": "click", "element": "button.show-more"},
     {"type": "wait", "elements": [".additional-content"], "timeout": 5000},
     {"type": "print", "elements": [".additional-content"], "format": "markdown"}
   ]}

4. Navigate through pagination:
   {"actions": [
     {"type": "wait", "elements": [".pagination a.next"], "timeout": 5000},
     {"type": "click", "element": ".pagination a.next"},
     {"type": "wait", "elements": [".content", ".items"], "timeout": 5000},
     {"type": "print", "elements": [".content, .items"], "format": "markdown"}
   ]}

5. Extract specific information from a dashboard:
   {"actions": [
     {"type": "wait", "elements": [".dashboard"], "timeout": 10000},
     {"type": "print", "elements": [".user-info", ".stats", ".notifications"], "format": "markdown"}
   ]}

ERROR HANDLING TIPS:
- If an element isn't found, try using a more general selector or multiple alternative selectors
- For pages with dynamic content, increase timeout values (e.g., 10000 or 15000 ms)
- For complex UIs, break down interactions into smaller steps with appropriate waits between them`
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