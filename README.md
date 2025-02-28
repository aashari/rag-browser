# RAG Browser

A versatile browser automation and analysis tool optimized for AI-driven workflows. It provides both a command-line interface (CLI) and Model Context Protocol (MCP) server mode for seamless integration with AI systems like Claude.

## 🚀 Quick Start

```bash
# Using Bun (Recommended)
# CLI Mode - Analyze a webpage
bunx github:aashari/rag-browser --url "https://example.com"

# MCP Server Mode - Start AI integration server
bunx github:aashari/rag-browser

# Using Node.js/npm
# CLI Mode - Analyze a webpage
npx -y github:aashari/rag-browser --url "https://example.com"

# MCP Server Mode - Start AI integration server
npx -y github:aashari/rag-browser
```

## 🎯 Features

- **Dual Mode Operation**
  - CLI mode for direct webpage analysis
  - MCP server mode for AI tool integration
- **Smart Page Analysis**
  - Extracts interactive elements (links, buttons, inputs)
  - Generates unique, stable CSS selectors
  - Supports both full and simplified selector paths
- **Powerful Automation**
  - Execute complex action sequences
  - Built-in stability detection and waiting
  - Support for authentication flows with infinite wait
- **AI Integration Ready**
  - Full MCP protocol support
  - Built-in error handling and recovery
  - Markdown formatting for human-readable content

## 💻 CLI Mode Usage

### Basic Examples

```bash
# Simple page analysis
bunx github:aashari/rag-browser --url "https://example.com"

# Headless mode with JSON output
bunx github:aashari/rag-browser --url "https://example.com" --headless --json

# Show all interactive elements
bunx github:aashari/rag-browser --url "https://example.com" --inputs --buttons --links
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

### Automation Example

```bash
# Search on Wikipedia
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

## 🤖 MCP Server Mode

### Starting the Server

```bash
# Using Bun (Recommended)
bunx github:aashari/rag-browser

# Using Node.js/npm
npx -y github:aashari/rag-browser
```

### Supported Actions

| Action     | Description                | Required Fields           | Optional Fields          |
| ---------- | -------------------------- | ------------------------- | ------------------------ |
| `wait`     | Wait for elements         | `elements: string[]`      | `timeout: number`        |
| `click`    | Click element             | `element: string`         | -                        |
| `typing`   | Type text                 | `element: string`, `value: string` | `delay: number` |
| `keyPress` | Press keyboard key        | `key: string`             | `element: string`        |
| `print`    | Capture element content   | `elements: string[]`      | `format: 'html' \| 'markdown'` |

### AI Integration

For Claude and other AI systems, add to your configuration:

```json
// Using Bun (Recommended)
{
  "mcpServers": {
    "rag-browser": {
      "command": "bunx",
      "args": ["github:aashari/rag-browser"]
    }
  }
}

// Using Node.js/npm
{
  "mcpServers": {
    "rag-browser": {
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

### Local Development

```bash
# Clone and setup
git clone https://github.com/aashari/rag-browser.git
cd rag-browser
bun install

# Run locally
bun run start    # Start MCP server
```

## 📝 License

MIT License - see [LICENSE](LICENSE) for details.
