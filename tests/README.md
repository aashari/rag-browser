# RAG Browser MCP Server Tests

This directory contains tests for the RAG Browser MCP server. The tests use Bun's built-in test runner and the MCP SDK client to test the server's functionality.

## Test Files

- **mcp-server.test.ts**: Tests the MCP server's core functionality
- **simple-mcp.test.ts**: Tests basic MCP server operations
- **wikipedia-search.test.ts**: Tests searching Wikipedia using the MCP server
- **resource.test.ts**: Tests resource management functionality
- **test-utils.ts**: Common utilities for all test files

## Running Tests

### Using Bun's Test Runner

To run the tests using Bun's built-in test runner:

```bash
# Run all tests
bun test

# Run a specific test file
bun test tests/mcp-server.test.ts

# Run tests with coverage
bun test --coverage
```

### Using npm Scripts

The following npm scripts are available:

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:mcp
npm run test:simple
npm run test:wikipedia
npm run test:resource

# Run tests with coverage
npm run test:coverage
```

## Test Structure

All test files follow a similar structure:

1. **Setup**: Creates a client and connects to the MCP server using the `beforeAll` hook
2. **Tests**: Contains multiple test cases that verify different aspects of the server
3. **Cleanup**: Closes the client connection using the `afterAll` hook

## Writing New Tests

To write new tests, follow this pattern:

```typescript
import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { TEST_TIMEOUT, createConnectedClient, closeClient } from "./test-utils.js";

describe("Test Suite Name", () => {
  let client: Client;

  // Set up the client before all tests
  beforeAll(async () => {
    const setup = await createConnectedClient();
    client = setup.client;
  });

  // Clean up after all tests
  afterAll(async () => {
    await closeClient(client);
  });

  // Test case
  test("should do something", async () => {
    // Test code here
    expect(result).toBe(expectedValue);
  }, TEST_TIMEOUT);
});
```

## Troubleshooting

- **Timeouts**: If tests are timing out, increase the timeout value in the test-utils.ts file
- **Connection Errors**: Make sure the MCP server is running and accessible
- **Type Errors**: Make sure to use type-only imports for types from the MCP SDK
- **Bun Types**: If you get errors about 'bun:test', make sure your tsconfig.json includes "types": ["bun-types"] 