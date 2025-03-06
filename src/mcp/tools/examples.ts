/**
 * Description for the plan property with examples
 */
export const planDescription = `A JSON string containing an object with an 'actions' array that will be executed in sequence. Format must be: {"actions": [{action1}, {action2}, ...]}. If omitted, I'll just analyze the URL without executing actions. Each action must have a 'type' property and type-specific properties. The action plan executes sequentially until completion or until an action fails.

Actions include:
- \`wait\`: Waits for elements (e.g., \`elements: ['body', '.login']\`). You can specify a \`timeout\` in milliseconds (default: 30000). Use \`timeout: -1\` for an indefinite wait, which is useful for authentication flows where user interaction is required. If elements aren't found, I should try broader selectors (e.g., 'main', 'article', 'body') to understand the context.
- \`click\`: Clicks an element (e.g., \`element: 'button.submit'\`). Be sure to wait for the element to appear before clicking.
- \`typing\`: Types text (e.g., \`element: 'input', value: 'hello'\`). Optional \`delay\` parameter (in ms) controls typing speed.
- \`keyPress\`: Presses a key (e.g., \`key: 'Enter'\`). Specify an \`element\` to target a specific element, or omit to press the key globally.
- \`print\`: Gets content from elements. Use \`elements: ['selector1', 'selector2']\` to specify target elements. The \`format\` property can be \`'html'\` (default) for raw HTML or \`'markdown'\` for formatted text. Always prioritize markdown format for better readability. If specific selectors fail, I should try broader ones like '.content', 'main', or 'body' to get context.

For selectors, use valid CSS selectors (e.g., '#id', '.class'). For best results, prefer:
- IDs (#login-form) and data attributes ([data-testid='submit'])
- Specific class names (.login-button) over generic ones (.button)
- Multiple selectors for fallbacks ('button.submit, [type="submit"]')
- Always be ready to try broader selectors (main, article, body) if specific ones fail

Common patterns:
- For page load: wait → extract content
- For interaction: wait → interact (click/type) → wait for result → extract content
- For authentication: wait with timeout: -1 → extract content after user logs in
- For exploring unknown pages: wait for 'body' → print 'body' in markdown format → analyze structure

HANDLING AUTHENTICATION WALLS:
When encountering authentication walls or unexpected content:
1. If waiting for specific elements fails (like tweets or dashboard items), the tool will automatically extract broader page content to show what's actually displayed
2. Check the returned page title, URL, and structure - these will often indicate a login page or other block
3. If you see a login form (inputs and buttons), inform the user that authentication is required
4. For sites requiring login, use the infinite wait approach: {"actions": [{"type": "wait", "elements": [".authenticated-content, .login-form"], "timeout": -1}]}
5. Let users know they should manually log in when the browser opens

If an action fails (element not found, timeout, etc.), execution stops and returns results collected up to that point. When wait or print actions fail, broader page content will be automatically captured to help understand the context.

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
- For complex UIs, break down interactions into smaller steps with appropriate waits between them
- When authentication is required, let users know they'll need to log in manually when the browser opens`;

/**
 * Example plans for common scenarios
 */
export const examplePlans = {
    login: {
        actions: [
            { type: "wait", elements: [".login-form, .dashboard"], timeout: -1 },
            { type: "print", elements: ["body"], format: "markdown" }
        ]
    },
    search: {
        actions: [
            { type: "wait", elements: ["input[type='search']"], timeout: 5000 },
            { type: "typing", element: "input[type='search']", value: "search query" },
            { type: "keyPress", key: "Enter" },
            { type: "wait", elements: [".search-results"], timeout: 10000 },
            { type: "print", elements: [".search-results"], format: "markdown" }
        ]
    },
    clickAndCapture: {
        actions: [
            { type: "wait", elements: ["button.show-more"], timeout: 5000 },
            { type: "click", element: "button.show-more" },
            { type: "wait", elements: [".additional-content"], timeout: 5000 },
            { type: "print", elements: [".additional-content"], format: "markdown" }
        ]
    }
}; 