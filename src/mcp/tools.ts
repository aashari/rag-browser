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
				"A powerful web automation tool for analyzing and interacting with webpages. This guide will help you (AI) effectively use this tool for various web automation tasks.\n\n" +
				"### Understanding the Tool:\n" +
				"This tool allows you to:\n" +
				"1. Analyze webpage structure and content\n" +
				"2. Extract specific information\n" +
				"3. Automate user interactions\n" +
				"4. Handle dynamic content and authentication\n\n" +
				"### Basic Usage Patterns:\n\n" +
				"1. **Simple Page Analysis**:\n" +
				"   ```json\n" +
				"   {\n" +
				"     \"url\": \"https://example.com\",\n" +
				"     \"inputs\": \"true\",\n" +
				"     \"buttons\": \"true\",\n" +
				"     \"links\": \"true\"\n" +
				"   }\n" +
				"   ```\n" +
				"   This returns all interactive elements on the page.\n\n" +
				"2. **Content Extraction**:\n" +
				"   ```json\n" +
				"   {\n" +
				"     \"url\": \"https://example.com/article\",\n" +
				"     \"plan\": {\n" +
				"       \"actions\": [\n" +
				"         {\"type\": \"markdown\", \"elements\": [\"article\"]}\n" +
				"       ]\n" +
				"     }\n" +
				"   }\n" +
				"   ```\n\n" +
				"### Finding Elements - A Step-by-Step Guide:\n\n" +
				"When elements aren't immediately found, follow this process:\n\n" +
				"1. **Start Broad**:\n" +
				"   ```json\n" +
				"   {\"type\": \"print\", \"elements\": [\"body\"]}\n" +
				"   ```\n" +
				"   This gives you the full page content to analyze.\n\n" +
				"2. **Narrow Down**:\n" +
				"   ```json\n" +
				"   {\"type\": \"print\", \"elements\": [\".main-content *\"]}\n" +
				"   ```\n" +
				"   Look for relevant container classes or IDs.\n\n" +
				"3. **Check Visibility**:\n" +
				"   ```json\n" +
				"   {\"type\": \"wait\", \"elements\": [\"button:not([style*='display: none']):not([style*='visibility: hidden'])\"]}\n" +
				"   ```\n" +
				"   Elements might be hidden.\n\n" +
				"4. **Try Alternative Attributes**:\n" +
				"   ```json\n" +
				"   {\"type\": \"wait\", \"elements\": [\"[aria-label*='search' i], [placeholder*='search' i], input[type='search']\"]}\n" +
				"   ```\n" +
				"   Use multiple attribute combinations.\n\n" +
				"### Common Use Cases with Solutions:\n\n" +
				"1. **Login Flows**:\n" +
				"   ```json\n" +
				"   {\n" +
				"     \"url\": \"https://example.com/login\",\n" +
				"     \"plan\": {\n" +
				"       \"actions\": [\n" +
				"         // First, verify we're on login page\n" +
				"         {\"type\": \"wait\", \"elements\": [\"form input[type='password'], .login-form, .sign-in-form\"]},\n" +
				"         // Try multiple possible username field selectors\n" +
				"         {\"type\": \"typing\", \"element\": \"input[type='email'], input[type='text'], #username, [name='username']\", \"value\": \"user@example.com\"},\n" +
				"         // Try multiple possible password field selectors\n" +
				"         {\"type\": \"typing\", \"element\": \"input[type='password'], #password, [name='password']\", \"value\": \"password123\"},\n" +
				"         // Try multiple possible submit button selectors\n" +
				"         {\"type\": \"click\", \"element\": \"button[type='submit'], input[type='submit'], .login-button, .sign-in-button\"},\n" +
				"         // Wait for either success or error\n" +
				"         {\"type\": \"wait\", \"elements\": [\".dashboard, .home-feed, .error-message, .alert-error\"]},\n" +
				"         // Print the result\n" +
				"         {\"type\": \"print\", \"elements\": [\".error-message, .alert-error, .dashboard-welcome, .feed-header\"]}\n" +
				"       ]\n" +
				"     }\n" +
				"   }\n" +
				"   ```\n\n" +
				"2. **Search and Extract**:\n" +
				"   ```json\n" +
				"   {\n" +
				"     \"url\": \"https://example.com\",\n" +
				"     \"plan\": {\n" +
				"       \"actions\": [\n" +
				"         // Find search input using multiple common patterns\n" +
				"         {\"type\": \"wait\", \"elements\": [\"input[type='search'], [aria-label*='search' i], [placeholder*='search' i]\"]},\n" +
				"         // Type search query\n" +
				"         {\"type\": \"typing\", \"element\": \"input[type='search'], [aria-label*='search' i], [placeholder*='search' i]\", \"value\": \"search term\"},\n" +
				"         // Try different ways to submit search\n" +
				"         {\"type\": \"keyPress\", \"key\": \"Enter\"},\n" +
				"         // Wait for results using multiple possible selectors\n" +
				"         {\"type\": \"wait\", \"elements\": [\".search-results, .results-list, #search-results\"]},\n" +
				"         // Extract results\n" +
				"         {\"type\": \"markdown\", \"elements\": [\".search-results, .results-list, #search-results\"]}\n" +
				"       ]\n" +
				"     }\n" +
				"   }\n" +
				"   ```\n\n" +
				"3. **Handling Dynamic Content**:\n" +
				"   ```json\n" +
				"   {\n" +
				"     \"url\": \"https://example.com/feed\",\n" +
				"     \"plan\": {\n" +
				"       \"actions\": [\n" +
				"         // Wait for initial content\n" +
				"         {\"type\": \"wait\", \"elements\": [\".feed-item, .post, .article\"]},\n" +
				"         // Wait for loading to complete\n" +
				"         {\"type\": \"wait\", \"elements\": [\"body:not(:has(.loading-spinner)):not(:has([aria-busy='true']))\"]},\n" +
				"         // Extract first batch\n" +
				"         {\"type\": \"markdown\", \"elements\": [\".feed-item, .post, .article\"]},\n" +
				"         // Click load more if it exists\n" +
				"         {\"type\": \"click\", \"element\": \".load-more, .show-more, button:has-text('Load more')\"},\n" +
				"         // Wait for new items\n" +
				"         {\"type\": \"wait\", \"elements\": [\".feed-item:nth-child(20), .post:nth-child(20), .article:nth-child(20)\"]},\n" +
				"         // Extract new items\n" +
				"         {\"type\": \"markdown\", \"elements\": [\".feed-item:nth-child(n+11), .post:nth-child(n+11), .article:nth-child(n+11)\"]}\n" +
				"       ]\n" +
				"     }\n" +
				"   }\n" +
				"   ```\n\n" +
				"### Debugging Guide:\n\n" +
				"When elements aren't found or actions fail, follow these steps:\n\n" +
				"1. **Verify Page State**:\n" +
				"   ```json\n" +
				"   {\"type\": \"print\", \"elements\": [\"body\"]}\n" +
				"   ```\n" +
				"   - Check if content is present\n" +
				"   - Look for error messages\n" +
				"   - Verify page structure\n\n" +
				"2. **Check Loading State**:\n" +
				"   ```json\n" +
				"   {\"type\": \"wait\", \"elements\": [\"body:not(:has(.loading-spinner)):not(:has([aria-busy='true'])):not(:has(.skeleton-loader))\"]}\n" +
				"   ```\n" +
				"   - Wait for loading indicators to disappear\n" +
				"   - Check for AJAX activity\n\n" +
				"3. **Try Multiple Selector Patterns**:\n" +
				"   ```json\n" +
				"   {\"type\": \"wait\", \"elements\": [\n" +
				"     \"#specific-id\",\n" +
				"     \"[data-testid='element']\",\n" +
				"     \"[aria-label='Element']\",\n" +
				"     \".fallback-class\"\n" +
				"   ]}\n" +
				"   ```\n" +
				"   - Start with specific selectors\n" +
				"   - Fall back to more general ones\n\n" +
				"4. **Handle Iframes and Shadow DOM**:\n" +
				"   ```json\n" +
				"   {\"type\": \"wait\", \"elements\": [\"iframe, [data-iframe], .frame-container\"]}\n" +
				"   ```\n" +
				"   - Check for embedded content\n" +
				"   - Look for shadow roots\n\n" +
				"### Selector Strategies:\n\n" +
				"1. **Priority Order** (try in this sequence):\n" +
				"   ```typescript\n" +
				"   - data-testid=\"element\"           // Test IDs\n" +
				"   - #unique-id                     // IDs\n" +
				"   - [aria-label=\"Element\"]         // Accessibility attributes\n" +
				"   - input[name=\"field\"]           // Form attributes\n" +
				"   - .specific-class               // Unique classes\n" +
				"   - tag[type=\"value\"]             // Element attributes\n" +
				"   - :has() > :nth-child()         // Structural\n" +
				"   ```\n\n" +
				"2. **Resilient Selectors**:\n" +
				"   ```typescript\n" +
				"   - button:has-text(\"Submit\")      // Text content\n" +
				"   - [class*=\"submit\"]             // Partial class\n" +
				"   - div:has(> button)             // Parent-child\n" +
				"   - :not([aria-hidden=\"true\"])    // Visibility\n" +
				"   ```\n\n" +
				"### Error Recovery Patterns:\n\n" +
				"1. **Element Not Found**:\n" +
				"   ```json\n" +
				"   {\n" +
				"     \"actions\": [\n" +
				"       {\"type\": \"wait\", \"elements\": [\"#specific-id\"], \"timeout\": 5000},\n" +
				"       {\"type\": \"wait\", \"elements\": [\"[data-testid='element']\"], \"timeout\": 5000},\n" +
				"       {\"type\": \"wait\", \"elements\": [\".fallback-class\"], \"timeout\": 5000}\n" +
				"     ]\n" +
				"   }\n" +
				"   ```\n\n" +
				"2. **Navigation Issues**:\n" +
				"   ```json\n" +
				"   {\n" +
				"     \"actions\": [\n" +
				"       {\"type\": \"wait\", \"elements\": [\"body:not(.loading)\"]},\n" +
				"       {\"type\": \"wait\", \"elements\": [\"#main-content, .error-page\"]},\n" +
				"       {\"type\": \"print\", \"elements\": [\"#main-content, .error-page, .error-message\"]}\n" +
				"     ]\n" +
				"   }\n" +
				"   ```\n\n" +
				"3. **Form Validation**:\n" +
				"   ```json\n" +
				"   {\n" +
				"     \"actions\": [\n" +
				"       {\"type\": \"typing\", \"element\": \"#input-field\", \"value\": \"test\"},\n" +
				"       {\"type\": \"wait\", \"elements\": [\"#input-field:valid, #input-field:invalid, .error-message\"]},\n" +
				"       {\"type\": \"print\", \"elements\": [\".error-message, .validation-message\"]}\n" +
				"     ]\n" +
				"   }\n" +
				"   ```\n\n" +
				"### Performance Tips:\n\n" +
				"1. **Efficient Waiting**:\n" +
				"   - Use specific selectors when possible\n" +
				"   - Combine multiple conditions in one wait\n" +
				"   - Set appropriate timeouts\n\n" +
				"2. **Batch Operations**:\n" +
				"   - Combine multiple prints/markdown actions\n" +
				"   - Use comma-separated selectors\n" +
				"   - Group related actions\n\n" +
				"3. **Minimize Retries**:\n" +
				"   - Use precise selectors first\n" +
				"   - Fall back to broader ones\n" +
				"   - Cache selector results\n\n" +
				"### Best Practices:\n\n" +
				"1. **Always Start With**:\n" +
				"   ```json\n" +
				"   {\"type\": \"wait\", \"elements\": [\"body:not(.loading):not(.initializing)\"]}\n" +
				"   ```\n\n" +
				"2. **Before Interactions**:\n" +
				"   ```json\n" +
				"   {\"type\": \"wait\", \"elements\": [\"button:not([disabled]):not([aria-disabled='true'])\"]}\n" +
				"   ```\n\n" +
				"3. **After Actions**:\n" +
				"   ```json\n" +
				"   {\"type\": \"wait\", \"elements\": [\"body:not(:has(.loading-spinner)):not(:has([aria-busy='true']))\"]}\n" +
				"   ```\n\n" +
				"4. **Error Checking**:\n" +
				"   ```json\n" +
				"   {\"type\": \"print\", \"elements\": [\".error-message, .alert, .notification\"]}\n" +
				"   ```\n\n" +
				"### Common Authentication Flows:\n\n" +
				"1. **Twitter/X Authentication**:\n" +
				"   ```json\n" +
				"   {\n" +
				"     \"url\": \"https://x.com\",\n" +
				"     \"plan\": {\n" +
				"       \"actions\": [\n" +
				"         // Wait for either timeline or login button\n" +
				"         {\"type\": \"wait\", \"elements\": [\"[aria-label='Timeline: Your Home Timeline'], [data-testid='loginButton']\", \"timeout\": -1]},\n" +
				"         // Check if we're logged in by looking for timeline\n" +
				"         {\"type\": \"print\", \"elements\": [\"[aria-label='Timeline: Your Home Timeline']\"]}\n" +
				"       ]\n" +
				"     }\n" +
				"   }\n" +
				"   ```\n" +
				"   This plan will:\n" +
				"   - Wait indefinitely for either the timeline or login button\n" +
				"   - Confirm authentication by checking for timeline presence\n" +
				"   - Allow manual login if needed\n\n" +
				"2. **Slack Authentication**:\n" +
				"   ```json\n" +
				"   {\n" +
				"     \"url\": \"https://app.slack.com/client\",\n" +
				"     \"plan\": {\n" +
				"       \"actions\": [\n" +
				"         // Wait for either workspace content or sign-in form\n" +
				"         {\"type\": \"wait\", \"elements\": [\".p-workspace__primary_view_contents, .p-signin_form\", \"timeout\": -1]},\n" +
				"         // Verify authentication by checking for workspace content\n" +
				"         {\"type\": \"print\", \"elements\": [\".p-workspace__primary_view_contents, .p-workspace__banner\"]}\n" +
				"       ]\n" +
				"     }\n" +
				"   }\n" +
				"   ```\n" +
				"   This plan will:\n" +
				"   - Wait indefinitely for either workspace content or login form\n" +
				"   - Confirm authentication by checking for workspace content\n" +
				"   - Allow manual login if needed\n\n" +
				"### Authentication Best Practices:\n\n" +
				"1. **Use Infinite Wait**:\n" +
				"   - Set `timeout: -1` for authentication flows\n" +
				"   - Allows time for manual login\n" +
				"   - Prevents premature timeouts\n\n" +
				"2. **Check Multiple States**:\n" +
				"   - Wait for both authenticated and unauthenticated elements\n" +
				"   - Use comma-separated selectors for alternatives\n" +
				"   - Verify final state with print action\n\n" +
				"3. **Handle Different Paths**:\n" +
				"   - Account for various login methods\n" +
				"   - Check for error messages\n" +
				"   - Verify successful authentication\n",
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
							"Optional JSON string defining actions to execute. When omitted, performs page analysis only. Must be a valid JSON object with an 'actions' array when provided. Each action requires a 'type' field and additional fields based on the type:\n" +
							"- **wait**: `elements` (string[]) - Waits for all listed CSS selectors to be present.\n" +
							"- **click**: `element` (string) - Clicks the specified CSS selector.\n" +
							"- **typing**: `element` (string), `value` (string), `delay?` (number) - Types the value into the element.\n" +
							"- **keyPress**: `key` (string), `element?` (string) - Presses the key, optionally focusing an element first.\n" +
							"- **print**: `elements` (string[]) - Captures raw HTML of the listed selectors. Use only when HTML structure analysis is needed.\n" +
							"- **markdown**: `elements` (string[]) - Converts content to markdown format. Preferred for content extraction.\n\n" +
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