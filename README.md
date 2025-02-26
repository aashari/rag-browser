# RAG Browser

A versatile browser automation and analysis tool optimized for AI-driven workflows. It provides both a command-line interface (CLI) and Model Context Protocol (MCP) server mode for seamless integration with AI systems like Claude.

[![Version](https://img.shields.io/npm/v/@aashari/rag-browser)](https://www.npmjs.com/package/@aashari/rag-browser)
[![License](https://img.shields.io/npm/l/@aashari/rag-browser)](https://github.com/aashari/rag-browser/blob/main/LICENSE)

## 🚀 Quick Start

### One-Line Usage

```bash
# CLI Mode - Analyze a webpage
bunx github:aashari/rag-browser --url "https://example.com"

# MCP Server Mode - Start AI integration server
bunx github:aashari/rag-browser
```

### Installation Options

Choose the method that best suits your needs:

#### 1. Direct Execution (No Installation)

Using Bun (Recommended):

```bash
bunx github:aashari/rag-browser [--url "https://example.com"]
```

Using Node.js:

```bash
npx -y github:aashari/rag-browser [--url "https://example.com"]
```

#### 2. Global Installation

```bash
# Install globally
npm install -g @aashari/rag-browser

# Then use anywhere
rag-browser [--url "https://example.com"]
```

#### 3. Local Development Setup

```bash
# Clone and setup
git clone https://github.com/aashari/rag-browser.git
cd rag-browser
bun install

# Run locally
bun run start        # MCP server mode
bun run browser      # CLI mode with --url parameter
```

## 🎯 Features

- **Dual Mode Operation**
  - CLI mode for direct webpage analysis
  - MCP server mode for AI tool integration
- **Smart Page Analysis**
  - Extracts interactive elements (links, buttons, inputs)
  - Generates unique, stable CSS selectors
  - Supports both full and simplified selector paths
  - Detects page structures (lists, forms, navigation menus)
- **Powerful Automation**
  - Execute complex action sequences
  - Built-in stability detection and waiting
  - Support for authentication flows with infinite wait
  - Fallback content extraction on navigation
- **AI Integration Ready**
  - Full MCP protocol support (v1.5.0+)
  - Resource management with caching
  - Built-in error handling and recovery
  - Markdown formatting for human-readable content

## 💻 CLI Mode Usage

### Basic Examples

```bash
# Simple page analysis
rag-browser --url "https://example.com"

# Headless mode with JSON output
rag-browser --url "https://example.com" --headless --json

# Show all interactive elements
rag-browser --url "https://example.com" --inputs --buttons --links
```

### Automation Example

```bash
# Search on Wikipedia
rag-browser --url "https://wikipedia.org" --plan '{
  "actions": [
    {"type": "wait", "elements": ["#searchInput"]},
    {"type": "typing", "element": "#searchInput", "value": "AI Tools"},
    {"type": "keyPress", "key": "Enter"},
    {"type": "wait", "elements": [".mw-search-results-container"]},
    {"type": "print", "elements": [".mw-search-result"], "format": "markdown"}
  ]
}'

# Wait indefinitely for authentication
rag-browser --url "https://app.slack.com" --plan '{
  "actions": [
    {"type": "wait", "elements": [".p-workspace__primary_view_contents, .p-signin_form"], "timeout": -1},
    {"type": "print", "elements": [".p-channel_sidebar__channel--unread"], "format": "markdown"}
  ]
}' --timeout -1
```

### CLI Options

| Option               | Description                | Default              |
| -------------------- | -------------------------- | -------------------- |
| `--url`              | Target webpage URL         | Required             |
| `--headless`         | Run without UI             | false                |
| `--json`             | JSON output format         | false (pretty print) |
| `--simple-selectors` | Use simplified selectors   | false (full paths)   |
| `--plan`             | Action sequence to execute | None                 |
| `--inputs`           | Show all input elements    | false (top 5)        |
| `--buttons`          | Show all buttons           | false (top 5)        |
| `--links`            | Show all links             | false (top 5)        |
| `--timeout`          | Action timeout in ms       | 30000 (-1 for infinite) |

## 🤖 MCP Server Mode

### Starting the Server

```bash
# Using npx
npx -y github:aashari/rag-browser

# Using bun
bunx github:aashari/rag-browser

# If installed globally
rag-browser
```

### MCP Inspector Tool

For testing and debugging the MCP server, you can use the MCP Inspector:

```bash
# Run the MCP Inspector with the rag-browser server
bun run inspector
```

This will start both the rag-browser MCP server and the inspector UI, allowing you to:
- Test tool calls interactively
- View resources stored by the server
- Examine request and response formats
- Debug action plans before using them with AI

### Tool: `action`

A unified tool for both analysis and automation:

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "action",
    "arguments": {
      "url": "https://example.com",
      "inputs": "true",
      "plan": "{\"actions\": [
        {\"type\": \"wait\", \"elements\": [\"#searchInput\"]},
        {\"type\": \"typing\", \"element\": \"#searchInput\", \"value\": \"test\"}
      ]}"
    }
  },
  "id": 1
}
```

### Supported Actions

| Action     | Description                                                   | Required Fields           | Optional Fields          |
| ---------- | ------------------------------------------------------------- | ------------------------- | ------------------------ |
| `wait`     | Wait for elements to appear                                   | `elements: string[]`      | `timeout: number`        |
| `click`    | Click element                                                 | `element: string`         | -                        |
| `typing`   | Type text                                                     | `element: string`, `value: string` | `delay: number` |
| `keyPress` | Press keyboard key                                            | `key: string`             | `element: string`        |
| `print`    | Capture content from elements                                 | `elements: string[]`      | `format: 'html' \| 'markdown'` |

### Action Plan Patterns

For best results, use these established patterns:

1. **Authentication Flow**:
   ```json
   {
     "actions": [
       {"type": "wait", "elements": [".authenticated-content, .login-form"], "timeout": -1},
       {"type": "print", "elements": [".content-container"], "format": "markdown"}
     ]
   }
   ```

2. **Form Submission**:
   ```json
   {
     "actions": [
       {"type": "wait", "elements": ["form input"], "timeout": 5000},
       {"type": "typing", "element": "input[name='search']", "value": "search query"},
       {"type": "keyPress", "key": "Enter"},
       {"type": "wait", "elements": [".results"], "timeout": 10000},
       {"type": "print", "elements": [".results"], "format": "markdown"}
     ]
   }
   ```

3. **Navigation and Content Extraction**:
   ```json
   {
     "actions": [
       {"type": "wait", "elements": ["nav a"], "timeout": 5000},
       {"type": "click", "element": "a.next-page"},
       {"type": "wait", "elements": [".content"], "timeout": 5000},
       {"type": "print", "elements": [".content"], "format": "markdown"}
     ]
   }
   ```

### AI Integration

For Claude and other AI systems, add to your configuration:

```json
{
  "mcpServers": {
    "@aashari/rag-browser": {
      "command": "npx",
      "args": ["-y", "github:aashari/rag-browser"]
    }
  }
}
```

## 🛠️ Development

### Project Structure

```
src/
├── cli/          # CLI implementation
├── config/       # Configuration and constants
├── core/         # Core browser automation
│   ├── browser/  # Browser control functions
│   ├── handlers/ # Action type handlers
├── mcp/          # MCP server implementation
├── utils/        # Shared utilities
└── types/        # TypeScript definitions
```

### Available Commands

```bash
bun run browser     # Run CLI
bun run start       # Start MCP server
bun run inspector   # Run with MCP Inspector
bun run typecheck   # Type checking
bun run test        # Run tests
bun run build       # Build for distribution
bun run clean       # Clean processes
bun run lint        # Lint codebase
bun run lint:fix    # Fix linting issues
bun run version:sync # Sync version across files
```

### Configuration

Key settings in `src/config/constants.ts` and `src/config/version.ts`:

```typescript
// Version
export const VERSION = "1.22.3";

// Constants
export const DEFAULT_TIMEOUT = 30000;
export const MAX_STORED_ANALYSES = 10;
```

## 📝 License

MIT License - see [LICENSE](LICENSE) for details.

## 🤝 Contributing

Contributions are welcome! Please check our [Contributing Guidelines](CONTRIBUTING.md) for details.
