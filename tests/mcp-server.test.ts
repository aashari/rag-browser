import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { TEST_TIMEOUT, createConnectedClient, closeClient } from "./test-utils.js";

describe("RAG Browser MCP Server", () => {
  let client: Client;
  let transport: StdioClientTransport;

  // Set up the client before all tests
  beforeAll(async () => {
    const setup = await createConnectedClient();
    client = setup.client;
    transport = setup.transport;
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
    expect(actionTool?.version).toBe("2.3.0");
  }, TEST_TIMEOUT);

  // Test calling the action tool with a simple example
  test("should analyze a simple webpage", async () => {
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
    
    // Verify that the content contains the expected link
    expect(content).toContain("More information");
    expect(content).toContain("https://www.iana.org/domains/example");
  }, TEST_TIMEOUT);

  // Test executing a plan with multiple actions
  test("should execute a multi-step action plan", async () => {
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
    expect(content).toContain("Found");
    expect(content).toContain("elements matching");
  }, TEST_TIMEOUT);

  // Test listing resources
  test("should list available resources", async () => {
    // First, create a resource by visiting a page
    await client.callTool({
      name: "action",
      arguments: {
        url: "https://example.com",
        headless: "true",
      },
    });

    // Then list the resources
    const resources = await client.listResources();
    
    // Verify that resources are available
    expect(resources).toBeDefined();
    expect(Array.isArray(resources.resources)).toBe(true);
    expect(resources.resources.length).toBeGreaterThan(0);
    
    // Verify that the resource has the expected properties
    const resource = resources.resources[0];
    expect(resource.uri).toBeDefined();
    
    // The resource name might contain either Example Domain or Wikipedia
    // depending on which test ran last, so we'll just check for common patterns
    expect(resource.name).toContain("Page for");
    expect(resource.description).toContain("Page analysis scraped at");
    expect(resource.mimeType).toBe("text/plain");
  }, TEST_TIMEOUT);

  // Test reading a resource
  test("should read a resource", async () => {
    // First, list the resources to get a resource URI
    const resources = await client.listResources();
    expect(resources.resources.length).toBeGreaterThan(0);
    
    // Get the first resource URI
    const resourceUri = resources.resources[0].uri;
    
    // Read the resource
    const resourceContent = await client.readResource({
      uri: resourceUri
    });
    
    // Verify that the resource content is available
    expect(resourceContent).toBeDefined();
    expect(resourceContent.contents).toBeDefined();
    expect(resourceContent.contents?.length).toBeGreaterThan(0);
    
    // Verify that the content contains common elements
    const content = resourceContent.contents?.[0]?.text as string;
    expect(content).toContain("Page Analysis");
  }, TEST_TIMEOUT);
}); 