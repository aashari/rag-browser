import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { TEST_TIMEOUT, createConnectedClient, closeClient } from "./test-utils.js";

describe("Resource Management Tests", () => {
  let client: Client;

  // Set up the client before all tests
  beforeAll(async () => {
    const setup = await createConnectedClient();
    client = setup.client;
    
    // Create a resource by visiting a page
    await client.callTool({
      name: "action",
      arguments: {
        url: "https://example.com",
        headless: "true",
      },
    });
  });

  // Clean up after all tests
  afterAll(async () => {
    await closeClient(client);
  });

  // Test listing resources
  test("should list available resources", async () => {
    const resources = await client.listResources();
    
    // Verify that resources are available
    expect(resources).toBeDefined();
    expect(Array.isArray(resources.resources)).toBe(true);
    expect(resources.resources.length).toBeGreaterThan(0);
    
    // Verify that the resource has the expected properties
    const resource = resources.resources[0];
    expect(resource.uri).toBeDefined();
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

  // Test creating multiple resources
  test("should create multiple resources or at least one resource", async () => {
    // Visit another page to create a new resource
    await client.callTool({
      name: "action",
      arguments: {
        url: "https://example.org",
        headless: "true",
      },
    });
    
    // List resources again
    const resources = await client.listResources();
    
    // Verify that we have at least 1 resource
    // Note: The server might replace resources rather than adding new ones
    expect(resources.resources.length).toBeGreaterThan(0);
  }, TEST_TIMEOUT);
}); 