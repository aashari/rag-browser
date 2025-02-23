# RAG Browser

A versatile browser automation and analysis tool optimized for AI-driven workflows, supporting both a command-line interface (CLI) and Model Context Protocol (MCP) server mode for integration with AI systems like Claude Desktop.

## Quick Start

### CLI Mode

Analyze webpages directly from the command line:

#### Using Bun (Recommended)

1. Install Bun:
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```
2. Run CLI from GitHub:
   ```bash
   bunx github:aashari/rag-browser --url "https://example.com"
   ```

#### Using Node.js/npm

1. Install Node.js from [nodejs.org](https://nodejs.org).
2. Run CLI from GitHub:
   ```bash
   npx -y github:aashari/rag-browser --url "https://example.com"
   ```

### MCP Server Mode

Run as an MCP server for AI integration:

#### Using Node.js/npm

1. Install Node.js from [nodejs.org](https://nodejs.org).
2. Run MCP Server from GitHub:
   ```bash
   npx -y github:aashari/rag-browser
   ```

#### Using Bun (Local Setup Required)

1. Clone the repo:
   ```bash
   git clone https://github.com/aashari/rag-browser.git
   cd rag-browser
   bun install
   ```
2. Run MCP Server:
   ```bash
   bun run start
   ```

### Install Globally

For permanent access:

1. Clone and install as above.
2. Install globally:
   ```bash
   bun install -g
   ```
3. Run CLI:
   ```bash
   rag-browser --url "https://example.com"
   ```
   Or MCP server:
   ```bash
   rag-browser  # Without --url, defaults to MCP mode
   ```

## Features

- **Page Analysis**: Extracts links, buttons, and inputs with unique CSS selectors.
- **Action Plans**: Executes sequences of actions (e.g., clicking, typing, submitting).
- **MCP Integration**: Offers `navigate` and `execute` tools, storing up to 10 recent analyses as resources.
- **Flexible Output**: CLI supports pretty print (default) or JSON, with customizable detail levels (`--inputs`, `--buttons`, `--links`).
- **Stability Checks**: Ensures page stability during analysis and actions.
- **Runtime Support**: Works with Bun (CLI) and Node.js (MCP).

## Installation

For local development:

```bash
bun install
```

## Usage

### CLI Mode

Run via `bunx github:aashari/rag-browser`, `npx -y github:aashari/rag-browser --url`, or `rag-browser` (if installed globally).

#### Basic Analysis

```bash
# Default: Visible mode, top 5 elements
bunx github:aashari/rag-browser --url "https://example.com"

# Headless mode with JSON output
bunx github:aashari/rag-browser --url "https://example.com" --headless --json

# Show all elements
bunx github:aashari/rag-browser --url "https://example.com" --inputs --buttons --links
```

#### With Action Plans

```bash
bunx github:aashari/rag-browser --url "https://www.wikipedia.org" --plan '{
  "actions": [
    {"type": "wait", "elements": ["input#searchInput"]},
    {"type": "typing", "element": "input#searchInput", "value": "AI Tools"},
    {"type": "keyPress", "key": "Enter", "element": "input#searchInput"},
    {"type": "print", "elements": ["#mw-content-text"]}
  ]
}' --inputs
```

- Displays action progress, summary, and detailed input analysis.

#### CLI Options

| Option               | Description                                |
| -------------------- | ------------------------------------------ |
| `--url`              | Target URL (required)                      |
| `--headless`         | Run without UI (default: visible)          |
| `--json`             | Output in JSON (default: pretty print)     |
| `--simple-selectors` | Use simple selectors (default: full paths) |
| `--plan`             | JSON string of actions to execute          |
| `--inputs`           | Show all inputs (default: top 5 visible)   |
| `--buttons`          | Show all buttons (default: top 5)          |
| `--links`            | Show all links (default: top 5)            |

### MCP Server Mode

Run via `npx -y github:aashari/rag-browser` or locally with `bun run start`.

- **Tools**:
  - `navigate`: Analyzes a webpage, optionally with detailed outputs (`inputs`, `buttons`, `links`).
  - `execute`: Executes an action plan and analyzes the result.
- **Resources**: Stores recent analyses (up to 10), accessible via `resources/list` and `resources/read`.

#### MCP Configuration (e.g., for Claude Desktop)

Configure `claude_desktop_config.json`:

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

- **Example Tool Call**:
  ```json
  {"jsonrpc":"2.0","method":"tools/call","params":{"name":"navigate","arguments":{"url":"https://example.com","inputs":"true"}},"id":1}
  ```

### Action Types

| Type       | Required Fields    | Optional Fields | Example                                                     |
| ---------- | ------------------ | --------------- | ----------------------------------------------------------- |
| `wait`     | `elements` (array) | -               | `{"type": "wait", "elements": ["#input"]}`                  |
| `click`    | `element` (string) | -               | `{"type": "click", "element": ".btn"}`                      |
| `typing`   | `element`, `value` | `delay` (ms)    | `{"type": "typing", "element": "#search", "value": "test"}` |
| `keyPress` | `key` (string)     | `element`       | `{"type": "keyPress", "key": "Enter"}`                      |
| `submit`   | `element` (string) | -               | `{"type": "submit", "element": "form"}`                     |
| `print`    | `elements` (array) | -               | `{"type": "print", "elements": ["#content"]}`               |

- **Notes**: `print` results appear in `plannedActions`. Stability is ensured post-action.

## Development

### Commands

```bash
# Type check
bun run typecheck

# Run tests
bun test

# Build for distribution
bun run build

# Start MCP server locally
bun run start

# Clean running processes
bun run clean
```

### Project Structure

- `src/cli/`: CLI logic and output formatting
- `src/core/`: Browser automation and stability
- `src/mcp/`: MCP server, tools, and resources
- `src/utils/`: Helper functions (e.g., selectors, logging)
- `tests/`: Unit and integration tests

### Debugging

Enable verbose logs in `src/config/constants.ts`:

```typescript
export const DEBUG = true;
```

## Configuration

Tune settings in `src/config/constants.ts`:

- `DEFAULT_TIMEOUT`: 30,000ms
- `VISIBLE_MODE_SLOW_MO`: 50ms
- `MAX_STORED_ANALYSES`: 10 (in `src/mcp/resources.ts`)
