import { VERSION } from "../../config/version.js";

/**
 * Description for the action tool
 */
export const actionToolDescription = `A proactive web automation tool that enables me (the AI) to interact with webpages in a browser for you. I can open sites, wait for page loads or authentication, click buttons, type text, extract data, and more—based on your intent. My goal is to assist with tasks like opening apps, fetching content, or automating actions, even if you don't specify every step.

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

### Element Selection Strategy:
- Always PROACTIVELY check for what elements are actually available on the page
- When specific selectors fail, I should automatically try broader selectors to understand the page context
- Use a progression from specific to broad: exact element → container → main content → body
- If waiting for specific elements fails, I'll get broader page content to analyze why (e.g., login wall, error page)
- For initial exploration, try 'body' or common content containers ('main', 'article', '.content') to see what's available

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
   - The plan first waits for the search box, types the query, presses Enter, waits for results, and finally extracts the tweets.`;

/**
 * Tool compatibility information
 */
export const actionToolCompatibility = {
    minVersion: "1.0.0",
    deprecatedFeatures: [],
}; 