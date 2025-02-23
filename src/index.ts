#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createToolDefinitions } from "./mcp/tools.js";
import { setupRequestHandlers } from "./mcp/requestHandler.js";

// Create and run the MCP server
const server = new Server(
    {
        name: "ai-tools-browser",
        version: "0.1.0",
    },
    {
        capabilities: {
            resources: {},
            tools: {},
            logging: {},
        },
    }
);

// Create tool definitions
const TOOLS = createToolDefinitions();

// Setup request handlers
setupRequestHandlers(server, TOOLS);

// Create transport and connect
const transport = new StdioServerTransport();
server.connect(transport).catch((error: Error) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
});

// Signal that we're ready
console.warn(
    JSON.stringify({
        jsonrpc: "2.0",
        method: "server.started",
        id: "startup-1",
    })
);
