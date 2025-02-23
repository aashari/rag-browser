# RAG Browser

A powerful tool for AI-driven browser automation and analysis, optimized for Retrieval-Augmented Generation (RAG).

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

### Alternative: Install Globally

If you prefer to keep `rag-browser` as a permanent tool:

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

See [Command Line](#command-line) below for more options.

## Features

- Extracts links, buttons, and inputs with unique CSS selectors
- Executes action plans for clicking, typing, and more
- Supports headless and visible modes
- Outputs in JSON or pretty print
- Includes stability checks and debug logging
- Enhanced with comprehensive tests

## Installation

Install with Bun:

```bash
bun install
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

The command will execute each action in sequence, displaying progress with emoji indicators. After completion, you'll see:
- A summary of successful actions
- Page analysis showing inputs, buttons, and links
- The captured HTML content from `#mw-content-text`

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

## Development

### Commands
```bash
# Type check
bun run typecheck

# Run tests
bun test

# Build
bun run build
```

### Project Structure
- `src/cli/`: CLI entry and output formatting
- `src/core/`: Browser automation logic
- `src/utils/`: Helper functions
- `tests/`: Unit and integration tests

### Debugging
Debug logs help troubleshoot:
- Stability checks (mutations, layout shifts)
- Action execution steps
- Selector generation

## Configuration

Adjust key settings in `src/config/constants.ts`:
- `DEFAULT_TIMEOUT`: Max wait time (30000ms)
- `DEFAULT_TYPING_DELAY`: Typing speed (50ms)
- `VISIBLE_MODE_SLOW_MO`: Visible mode speed (100ms)

See the file for more options.

## License

MIT