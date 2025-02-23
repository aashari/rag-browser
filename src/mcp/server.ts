#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createToolDefinitions } from "./tools.js";
import { setupRequestHandlers } from "./requestHandler.js";

export async function runServer(): Promise<void> {
	const server = new Server(
		{
			name: "ai-tools-browser",
			version: "1.3.0",
		},
		{
			capabilities: {
				resources: {
					list: true,
					read: true,
					templates: false,
				},
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
