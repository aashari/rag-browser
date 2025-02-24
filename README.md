# RAG Browser

A versatile browser automation and analysis tool optimized for AI-driven workflows. It provides both a command-line interface (CLI) and Model Context Protocol (MCP) server mode for seamless integration with AI systems like Claude Desktop.

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
bun run browser      # CLI mode
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
  - Built-in stability checks
  - Supports headless operation
- **AI Integration Ready**
  - MCP protocol support
  - Resource management (stores recent analyses)
  - Structured JSON output option

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
    {"type": "keyPress", "key": "Enter"}
  ]
}'
```

### CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--url` | Target webpage URL | Required |
| `--headless` | Run without UI | false |
| `--json` | JSON output format | false (pretty print) |
| `--simple-selectors` | Use simplified selectors | false (full paths) |
| `--plan` | Action sequence to execute | None |
| `--inputs` | Show all input elements | false (top 5) |
| `--buttons` | Show all buttons | false (top 5) |
| `--links` | Show all links | false (top 5) |

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
      "plan": {
        "actions": [
          {"type": "wait", "elements": ["#searchInput"]},
          {"type": "typing", "element": "#searchInput", "value": "test"}
        ]
      }
    }
  }
}
```

### Supported Actions

| Action | Description | Required Fields | Optional Fields |
|--------|-------------|-----------------|-----------------|
| `wait` | Wait for elements | `elements: string[]` | - |
| `click` | Click element | `element: string` | - |
| `typing` | Type text | `element: string`, `value: string` | `delay: number` |
| `keyPress` | Press keyboard key | `key: string` | `element: string` |
| `submit` | Submit form | `element: string` | - |
| `print` | Capture HTML | `elements: string[]` | - |

### Claude Desktop Integration

Add to your `claude_desktop_config.json`:
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
├── core/         # Core browser automation
├── mcp/          # MCP server implementation
├── utils/        # Shared utilities
└── types/        # TypeScript definitions
```

### Available Commands

```bash
bun run typecheck   # Type checking
bun run test        # Run tests
bun run build       # Build for distribution
bun run start       # Start MCP server
bun run clean       # Clean processes
```

### Configuration

Key settings in `src/config/constants.ts`:
```typescript
export const DEFAULT_TIMEOUT = 30000;
export const MAX_STORED_ANALYSES = 10;
export const DEBUG = false;
```

## 📝 License

MIT License - see [LICENSE](LICENSE) for details.

## 🤝 Contributing

Contributions are welcome! Please check our [Contributing Guidelines](CONTRIBUTING.md) for details.
