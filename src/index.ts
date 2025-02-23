#!/usr/bin/env bun
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createToolDefinitions } from "./mcp/tools.js";
import { setupRequestHandlers, RESOURCE_URI } from "./mcp/requestHandler.js";

async function runServer() {
  const server = new Server(
    {
      name: "aashari/rag-browser",
      version: "0.1.0",
    },
    {
      capabilities: {
        resources: {
          [RESOURCE_URI]: {}
        },
        tools: {}, // The capabilities are described by the request handlers
      },
    }
  );

  // Create tool definitions
  const TOOLS = createToolDefinitions();

  // Setup request handlers
  setupRequestHandlers(server, TOOLS);

  // Create transport and connect
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

runServer().catch(console.error); 