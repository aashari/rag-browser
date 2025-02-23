# RAG Browser

A powerful tool for AI-driven browser automation and analysis, optimized for Retrieval-Augmented Generation (RAG) and now with Model Context Protocol (MCP) support.

## Quick Start for Non-Developers

Run `rag-browser` directly from GitHub without installing permanently! You can use either Bun or Node.js:

1. **Choose your runtime**:

   **Option A: Using Bun (Recommended)**
   - Install Bun:
     ```bash
     curl -fsSL https://bun.sh/install | bash
     ```
   - Run directly from GitHub:
     ```bash
     bunx github:aashari/rag-browser --url "https://example.com"
     ```

   **Option B: Using Node.js/npm**
   - Install Node.js from https://nodejs.org
   - Run directly with npx (includes auto-confirmation):
     ```bash
     npx -y github:aashari/rag-browser --url "https://example.com"
     ```

2. **Try with options**:
   ```bash
   # Using Bun
   bunx github:aashari/rag-browser --url "https://www.wikipedia.org" --headless --json

   # Using npm
   npx -y github:aashari/rag-browser --url "https://www.wikipedia.org" --headless --json
   ```

## Features

- Web page navigation and analysis
- Automated interaction with web elements
- Action plan execution
- Extracts links, buttons, and inputs with unique CSS selectors
- Supports headless and visible modes
- Outputs in JSON or pretty print
- Includes stability checks and debug logging
- MCP server integration for AI agent compatibility
- Docker deployment ready

## Installation

### As CLI Tool

1. Clone the repo:
   ```bash
   git clone https://github.com/aashari/rag-browser.git
   cd rag-browser
   ```

2. Install globally:
   ```bash
   bun install -g
   ```

3. Run anywhere:
   ```bash
   rag-browser --url "https://example.com"
   ```

### As MCP Server

```bash
# Install dependencies
bun install

# Install with Smithery (for MCP integration)
npx @smithery/cli install . --client claude
```

## Usage

### Command Line

#### Basic Usage
```bash
# Visible mode
bun run browser --url "https://example.com"

# Headless mode
bun run browser --url "https://example.com" --headless

# JSON output
bun run browser --url "https://example.com" --json

# Simple selectors
bun run browser --url "https://example.com" --simple-selectors
```

#### Automation with Plans
Run a sequence of actions:

```bash
bun run browser --url "https://www.wikipedia.org" --plan '{
  "actions": [
    {"type": "wait", "elements": ["input#searchInput"]},
    {"type": "typing", "element": "input#searchInput", "value": "AI Tools"},
    {"type": "keyPress", "key": "Enter", "element": "input#searchInput"},
    {"type": "print", "elements": ["#mw-content-text"]}
  ]
}'
```

### As MCP Server

1. Start the server:
```bash
bun start
```

2. Available Tools:

- `navigate`: Navigate to a URL
  ```json
  {
    "name": "navigate",
    "arguments": {
      "url": "https://example.com",
      "timeout": 30000,
      "waitUntil": "networkidle"
    }
  }
  ```

- `execute`: Execute an action plan
  ```json
  {
    "name": "execute",
    "arguments": {
      "plan": {
        "actions": [
          {"type": "wait", "elements": ["input#search"]},
          {"type": "typing", "element": "input#search", "value": "test"},
          {"type": "keyPress", "key": "Enter"}
        ]
      },
      "headless": false,
      "selectorMode": "full"
    }
  }
  ```

3. Available Resources:

- `browser://content`: Get current page content

### Programmatic Usage

#### Basic Analysis
```typescript
import { analyzePage } from 'rag-browser';

const analysis = await analyzePage('https://example.com', { headless: true });
console.log(analysis);
```

#### With Action Plan
```typescript
import { analyzePage } from 'rag-browser';

const analysis = await analyzePage('https://example.com', {
  headless: true,
  plan: {
    actions: [
      { type: 'wait', elements: ['input[name="username"]'] },
      { type: 'typing', element: 'input[name="username"]', value: 'user@example.com' }
    ]
  }
});
console.log(analysis);
```

### Available Action Types

| Type       | Description                     | Required Properties         | Optional Properties | Example                                      |
|------------|---------------------------------|-----------------------------|---------------------|----------------------------------------------|
| `wait`     | Waits for elements to appear   | `elements` (array)          | -                   | `{"type": "wait", "elements": ["#input"]}`   |
| `click`    | Clicks an element              | `element` (string)          | -                   | `{"type": "click", "element": ".btn"}`       |
| `typing`   | Types text into an element     | `element`, `value` (string) | `delay`             | `{"type": "typing", "element": "#search", "value": "test"}` |
| `keyPress` | Presses a key                  | `key` (string)              | `element`           | `{"type": "keyPress", "key": "Enter", "element": "#search"}` |
| `submit`   | Submits a form or element      | `element` (string)          | -                   | `{"type": "submit", "element": "form#login"}`|
| `print`    | Captures element HTML          | `elements` (array)          | -                   | `{"type": "print", "elements": ["#content"]}`|

- **Notes**: 
  - `elements` is an array of CSS selectors; `element` is a single CSS selector.
  - Stability is ensured post-action (except `print`).
  - Results of `print` appear in the `plannedActions` output field.

### Configuration

The server can be configured through environment variables or Smithery config:

- `HEADLESS`: Run browser in headless mode (default: false)
- `DEFAULT_TIMEOUT`: Default timeout in milliseconds (default: 30000)

### Docker Deployment

```bash
# Build the image
docker build -t rag-browser .

# Run the container
docker run -it --rm rag-browser
```

## Development

### Project Structure
- `src/cli/`: CLI entry and output formatting
- `src/core/`: Browser automation logic
- `src/utils/`: Helper functions
- `src/mcp/`: MCP server implementation
- `tests/`: Unit and integration tests

### Commands
```bash
# Run TypeScript type checking
bun run typecheck

# Run tests
bun test

# Build
bun run build
```

## Debug Logging

The server includes comprehensive debug logging. Debug messages are output in JSON format:

```json
{
  "type": "debug",
  "message": "Starting navigation",
  "data": {
    "url": "https://example.com",
    "timeout": 30000
  }
}
```

Debug logs help troubleshoot:
- Stability checks (mutations, layout shifts)
- Action execution steps
- Selector generation
- MCP server operations

## Configuration

Adjust key settings in `src/config/constants.ts`:
- `DEFAULT_TIMEOUT`: Max wait time (30000ms)
- `DEFAULT_TYPING_DELAY`: Typing speed (50ms)
- `VISIBLE_MODE_SLOW_MO`: Visible mode speed (100ms)

See the file for more options.

## License

MIT