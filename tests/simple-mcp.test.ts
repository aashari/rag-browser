import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { TEST_TIMEOUT, createConnectedClient, closeClient } from "./test-utils.js";

describe("Simple MCP Tests", () => {
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

  // Test listing tools
  test("should list available tools", async () => {
    const tools = await client.listTools();
    
    // Verify that the tools object exists and has a tools array
    expect(tools).toBeDefined();
    expect(Array.isArray(tools.tools)).toBe(true);
    
    // Verify that the action tool is available
    const actionTool = tools.tools.find(tool => tool.name === "action");
    expect(actionTool).toBeDefined();
    expect(actionTool?.name).toBe("action");
  }, TEST_TIMEOUT);

  // Test calling the action tool with a simple example
  test("should analyze example.com", async () => {
    const result = await client.callTool({
      name: "action",
      arguments: {
        url: "https://example.com",
        headless: "true",
      },
    }) as CallToolResult;

    // Verify that the result is successful
    expect(result.isError).toBe(false);
    expect(result.content).toBeDefined();
    expect(result.content?.length).toBeGreaterThan(0);
    
    // Verify that the content contains the expected page title
    const content = result.content?.[0]?.text as string;
    expect(content).toContain("Example Domain");
  }, TEST_TIMEOUT);
}); 