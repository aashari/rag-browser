import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
	ListResourcesRequestSchema,
	ReadResourceRequestSchema,
	ListToolsRequestSchema,
	CallToolRequestSchema,
	ListResourceTemplatesRequestSchema,
	type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { handleToolCall } from "./toolsHandler.js";

export function setupRequestHandlers(server: Server, tools: Tool[]): void {
	// List resources handler
	server.setRequestHandler(ListResourcesRequestSchema, async () => ({
		resources: [],
	}));

	// Read resource handler
	server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
		throw new Error(`Resource not found: ${request.params.uri}`);
	});

	// List templates handler
	server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
		resourceTemplates: [],
	}));

	// List tools handler
	server.setRequestHandler(ListToolsRequestSchema, async () => ({
		tools: tools,
	}));

	// Call tool handler
	server.setRequestHandler(CallToolRequestSchema, async (request) =>
		handleToolCall(request.params.name, (request.params.arguments as Record<string, string>) ?? {}, server)
	);
}
