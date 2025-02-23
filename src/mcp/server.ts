#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createToolDefinitions } from "./tools.js";
import { setupRequestHandlers } from "./requestHandler.js";

async function runServer(): Promise<void> {
	const server = new Server(
		{
			name: "ai-tools-browser",
			version: "1.0.0",
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
	await server.connect(transport);

	console.warn(
		JSON.stringify({
			jsonrpc: "2.0",
			method: "server.started",
			id: "startup-1",
		})
	);
}

runServer().catch(console.error);
