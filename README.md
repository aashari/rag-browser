# rag-browser

**A Browser Automation Tool for Humans and AI**

`rag-browser` is a versatile tool built with [Playwright](https://playwright.dev/) that enables webpage analysis and automation. It operates in two modes: a **CLI mode** for direct webpage analysis and an **MCP Server mode** for integration with AI systems via the Model Context Protocol (MCP). Whether you're a developer exploring a webpage's structure or an AI system executing complex browser tasks, `rag-browser` provides a robust and flexible solution.

- **Version**: 2.0.0
- **License**: Open-source (MIT, see [LICENSE](LICENSE))
- **Repository**: [github.com/aashari/rag-browser](https://github.com/aashari/rag-browser)
- **Author**: Andi Ashari

---

## Features

- **CLI Mode**: Analyze webpages, extract interactive elements (inputs, buttons, links), and execute custom action plans.
- **MCP Server Mode**: Run as a server for AI systems to perform browser automation tasks programmatically.
- **Action Support**: Wait, click, type, press keys, and capture content (HTML or Markdown).
- **Stability**: Ensures reliable execution with built-in page stability checks (network, layout, mutations).
- **Output Options**: Pretty-printed console output or JSON for machine-readable results.
- **Runtime**: Optimized for [Bun](https://bun.sh/) (recommended), with fallback support for Node.js/npm.

---

## Installation

### Prerequisites

- **Bun** (recommended): `curl -fsSL https://bun.sh/install | bash`
- **Node.js** (optional): Version 16+ with npm
- No local installation required—use `bunx` or `npx` to run directly from GitHub.

### Running the Tool

Use `bunx` (preferred) or `npx` to execute `rag-browser` without cloning the repository:

```bash
# Using Bun (Recommended)
bunx github:aashari/rag-browser --url "https://example.com"

# Using Node.js/npm
npx -y github:aashari/rag-browser --url "https://example.com"
```

To contribute or modify, clone the repository:

```bash
git clone https://github.com/aashari/rag-browser.git
cd rag-browser
bun install
bun run src/index.ts
```

---

## Usage

### CLI Mode

Analyze a webpage or execute a sequence of actions.

#### Simple Page Analysis

```bash
# Using Bun
bunx github:aashari/rag-browser --url "https://example.com"

# Using Node.js/npm
npx -y github:aashari/rag-browser --url "https://example.com"
```

**Output**: Displays page title, description, and top 5 inputs, buttons, and links.

#### Headless Mode with JSON Output

```bash
bunx github:aashari/rag-browser --url "https://example.com" --headless --json
```

**Output**: JSON object with full page analysis.

#### Show All Interactive Elements

```bash
bunx github:aashari/rag-browser --url "https://example.com" --inputs --buttons --links
```

**Output**: Lists all inputs, buttons, and links with selectors.

#### Execute an Action Plan

Search Wikipedia and capture results:

```bash
bunx github:aashari/rag-browser --url "https://wikipedia.org" --plan '{
  "actions": [
    {"type": "wait", "elements": ["#searchInput"]},
    {"type": "typing", "element": "#searchInput", "value": "AI Tools"},
    {"type": "keyPress", "key": "Enter"},
    {"type": "wait", "elements": [".mw-search-results-container"]},
    {"type": "print", "elements": [".mw-search-result"], "format": "markdown"}
  ]
}'
```

**Output**: Executes the plan and prints search results in Markdown.

#### CLI Options

| Option               | Description                     | Example Value           |
| -------------------- | ------------------------------- | ----------------------- |
| `--url`              | Target URL (required)           | `"https://example.com"` |
| `--headless`         | Run without UI                  | (flag)                  |
| `--json`             | Output in JSON format           | (flag)                  |
| `--simple-selectors` | Use simpler CSS selectors       | (flag)                  |
| `--plan`             | JSON string of actions          | See above example       |
| `--timeout`          | Timeout in ms (-1 for infinite) | `5000`                  |
| `--inputs`           | Show all inputs                 | (flag)                  |
| `--buttons`          | Show all buttons                | (flag)                  |
| `--links`            | Show all links                  | (flag)                  |

### MCP Server Mode

Run as a server for AI integration.

#### Start the Server

```bash
# Using Bun
bunx github:aashari/rag-browser

# Using Node.js/npm
npx -y github:aashari/rag-browser
```

#### AI Configuration

Add to your AI system's MCP configuration:

```json
// For Bun
{
  "mcpServers": {
    "rag-browser": {
      "command": "bunx",
      "args": ["github:aashari/rag-browser"]
    }
  }
}

// For Node.js/npm
{
  "mcpServers": {
    "rag-browser": {
      "command": "npx",
      "args": ["-y", "github:aashari/rag-browser"]
    }
  }
}
```

#### Supported Actions

| Action     | Description       | Required Fields                    | Optional Fields                |
| ---------- | ----------------- | ---------------------------------- | ------------------------------ |
| `wait`     | Wait for elements | `elements: string[]`               | `timeout: number`              |
| `click`    | Click an element  | `element: string`                  | -                              |
| `typing`   | Type text         | `element: string`, `value: string` | `delay: number`                |
| `keyPress` | Press a key       | `key: string`                      | `element: string`              |
| `print`    | Capture content   | `elements: string[]`               | `format: "html" \| "markdown"` |

---

## ForHumans

### Why Use rag-browser?

- **Explore Webpages**: Quickly analyze a page's structure and interactive elements.
- **Automate Tasks**: Define and execute browser actions without coding.
- **Debugging**: Use detailed output to understand page behavior.

### Example Workflow

1. Analyze a login page:
   ```bash
   bunx github:aashari/rag-browser --url "https://example.com/login" --inputs --buttons
   ```
2. Create a plan to log in:
   ```json
   {
     "actions": [
       {"type": "typing", "element": "input[name='username']", "value": "user"},
       {"type": "typing", "element": "input[name='password']", "value": "pass"},
       {"type": "click", "element": "button[type='submit']"}
     ]
   }
   ```
3. Execute:
   ```bash
   bunx github:aashari/rag-browser --url "https://example.com/login" --plan '<your_json_here>'
   ```

---

## ForAI

### Integration with AI Systems

`rag-browser` exposes browser automation via MCP, allowing AI to:

- Navigate webpages
- Extract content
- Perform actions

### Example AI Request

```json
{
  "tool": "rag-browser",
  "action": {
    "url": "https://wikipedia.org",
    "plan": {
      "actions": [
        {"type": "wait", "elements": ["#searchInput"]},
        {"type": "typing", "element": "#searchInput", "value": "Machine Learning"},
        {"type": "keyPress", "key": "Enter"},
        {"type": "print", "elements": [".mw-search-result"], "format": "markdown"}
      ]
    }
  }
}
```

**Response**: Markdown content of search results.

### Capabilities

- **Dynamic Interaction**: Responds to page changes (e.g., navigation).
- **Content Extraction**: Returns structured data (HTML/Markdown).
- **Error Handling**: Provides detailed feedback on failures.

---

## Development

### Project Structure

```
src/
├── cli/         # CLI entry point
├── config/      # Constants and versioning
├── core/        # Browser automation logic
├── mcp/         # MCP server implementation
├── types/       # TypeScript types
├── utils/       # Helper functions
└── index.ts     # Main entry point
```

### Build and Run Locally

```bash
bun install
bun run src/index.ts --url "https://example.com"
```

### Contributing

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/new-action`).
3. Commit changes (`git commit -m "Add new action type"`).
4. Push to the branch (`git push origin feature/new-action`).
5. Open a Pull Request.

---

## Troubleshooting

- **Error: "Timeout exceeded"**: Increase `--timeout` or check selector validity.
- **No elements found**: Use `--simple-selectors` or verify page structure.
- **Server not starting**: Ensure port availability and MCP SDK compatibility.

File issues at [github.com/aashari/rag-browser/issues](https://github.com/aashari/rag-browser/issues).

---

## License

MIT © Andi Ashari. See [LICENSE](LICENSE) for details.
