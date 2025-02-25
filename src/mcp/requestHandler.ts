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
import {
	getAnalyses,
	getAnalysisByUri,
	createResourceUri,
	createResourceName,
	createResourceDescription,
	initializeResources
} from "./resources.js";
import { formatAnalysis } from "../utils/output";

export function setupRequestHandlers(server: Server, tools: Tool[]): void {
	// Initialize resources with server instance
	initializeResources(server);

	// List resources handler
	server.setRequestHandler(ListResourcesRequestSchema, async () => {
		server.sendLoggingMessage({ level: "debug", data: "Handling ListResourcesRequest" });
		const analyses = getAnalyses();
		const resources = analyses.map(stored => ({
			uri: createResourceUri(stored),
			name: createResourceName(stored),
			description: createResourceDescription(stored),
			mimeType: "text/plain",
		}));
		server.sendLoggingMessage({ level: "debug", data: `Returning ${resources.length} resources` });
		return { resources };
	});

	// Read resource handler
	server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
		server.sendLoggingMessage({ level: "debug", data: `Handling ReadResourceRequest for URI: ${request.params.uri}` });
		const stored = getAnalysisByUri(request.params.uri);
		if (!stored) {
			server.sendLoggingMessage({ level: "error", data: `Resource not found: ${request.params.uri}` });
			throw new Error(`Resource not found: ${request.params.uri}`);
		}

		server.sendLoggingMessage({ level: "debug", data: `Returning resource content for: ${request.params.uri}` });

		return {
			contents: [{
				uri: request.params.uri,
				mimeType: "text/plain",
				text: formatAnalysis(stored.analysis),
			}],
		};
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
