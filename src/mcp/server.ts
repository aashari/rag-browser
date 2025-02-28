#!/usr/bin/env bun

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createToolDefinitions } from "./tools.js";
import { setupRequestHandlers } from "./requestHandler.js";
import { VERSION, PACKAGE_NAME } from "../config/version.js";

export async function runServer(): Promise<void> {
	const server = new Server(
		{
			name: PACKAGE_NAME,
			version: VERSION,
		},
		{
			capabilities: {
				resources: {
					list: true,
					read: true,
					templates: false,
					streaming: false, // Future support for streaming resource content
					caching: false,   // Future support for resource caching
				},
				tools: {
					version: VERSION,      // Explicit tool versioning tied to server version
					features: ["action"], // Supported tool capabilities
				},
				logging: {
					levels: ["info", "error", "debug"], // Supported log levels
				},
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

	// Enhanced startup log with version
	console.warn(
		JSON.stringify({
			jsonrpc: "2.0",
			method: "server.started",
			id: "startup-1",
			params: {
				name: PACKAGE_NAME,
				version: VERSION,
				mode: "MCP Server",
				capabilities: {
					resources: true,
					tools: true,
					logging: true,
				},
			},
		})
	);
}
