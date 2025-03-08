import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { TEST_TIMEOUT, createConnectedClient, closeClient } from "./test-utils.js";

describe("Wikipedia Search Tests", () => {
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

  // Test searching Wikipedia
  test("should search Wikipedia", async () => {
    // Create a plan to search Wikipedia for "AI Tools"
    const searchPlan = {
      actions: [
        { type: "wait", elements: ["#searchInput"] },
        { type: "typing", element: "#searchInput", value: "AI Tools" },
        { type: "keyPress", key: "Enter" },
        { type: "wait", elements: [".mw-search-results-container"] },
        { type: "print", elements: [".mw-search-result"], format: "markdown" }
      ]
    };

    const result = await client.callTool({
      name: "action",
      arguments: {
        url: "https://wikipedia.org",
        headless: "true",
        plan: JSON.stringify(searchPlan),
      },
    }) as CallToolResult;

    // Verify that the result is successful
    expect(result.isError).toBe(false);
    expect(result.content).toBeDefined();
    expect(result.content?.length).toBeGreaterThan(0);
    
    // Verify that the content contains search results
    const content = result.content?.[0]?.text as string;
    // The content should contain "Page Analysis"
    expect(content).toContain("Page Analysis");
  }, TEST_TIMEOUT);
}); 