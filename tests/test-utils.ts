import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// Increase the test timeout to 60 seconds for all tests
export const TEST_TIMEOUT = 60000;

/**
 * Creates and connects an MCP client to the server
 */
export async function createConnectedClient(): Promise<{
  client: Client;
  transport: StdioClientTransport;
}> {
  // Create a transport that connects to the MCP server
  const transport = new StdioClientTransport({
    command: "bun",
    args: ["run", "src/index.ts"], // Path to the MCP server
  });

  // Create a client
  const client = new Client(
    {
      name: "test-client",
      version: "1.0.0",
    },
    {
      capabilities: {
        resources: {
          list: true,
          read: true,
        },
        tools: {
          version: "1.0.0",
        },
      },
    }
  );

  // Connect to the server
  await client.connect(transport);

  return { client, transport };
}

/**
 * Safely closes an MCP client
 */
export async function closeClient(client: Client): Promise<void> {
  try {
    await client.close();
  } catch (error) {
    console.error("Error closing client:", error);
  }
} 