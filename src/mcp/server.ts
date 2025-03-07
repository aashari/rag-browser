#!/usr/bin/env bun

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createToolDefinitions } from "./tools.js";
import { setupRequestHandlers } from "./requestHandler.js";
import { VERSION, PACKAGE_NAME } from "../config/version.js";
import { handleToolCall } from "./toolsHandler";
import { setDebugMode } from "../utils/logging";
import { cleanupResources as cleanupBrowserResources } from "../core/browser";
import { promiseTracker } from "../utils/promiseTracker";
import { info, debug } from "../utils/logging";

/**
 * Clean up resources before exiting
 */
async function cleanupResources(): Promise<void> {
	// Clean up browser resources
	await cleanupBrowserResources();
	
	// Wait for any pending promises to complete
	await promiseTracker.waitForPending(1000);
	
	debug("Resources cleaned up successfully");
}

export async function runServer(debug: boolean = false): Promise<void> {
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

	// Enhanced startup log with version - only show when in debug mode
	if (debug) {
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

	// Set up cleanup on process exit signals
	process.on('SIGINT', async () => {
		await cleanupResources();
		process.exit(0);
	});
	
	process.on('SIGTERM', async () => {
		await cleanupResources();
		process.exit(0);
	});

	// Keep the process running but ensure resources are periodically cleaned up
	return new Promise<void>(() => {
		// Periodically clean up resources to prevent memory leaks and ensure timely process termination
		setInterval(async () => {
			await cleanupResources();
		}, 30000); // Clean up every 30 seconds
	});
}
