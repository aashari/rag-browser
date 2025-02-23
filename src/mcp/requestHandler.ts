import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

import { z } from "zod";
import { navigate, execute, getPageContent } from "./toolsHandler.js";
import type { Action } from "../types";

export const RESOURCE_URI = "browser://content";

export function setupRequestHandlers(server: Server, tools: Tool[]) {
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      {
        uri: RESOURCE_URI,
        mimeType: "text/plain",
        name: "Browser",
      }
    ],
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    if (uri.toString() !== RESOURCE_URI) {
      throw new Error(`Unknown resource: ${uri.toString()}`);
    }
      
    try {
      // Get page content
      const pageContent = await getPageContent();
      if (pageContent) {
        return {
          contents: [
            {
              uri: RESOURCE_URI,
              mimeType: "text/html",
              text: pageContent,
            },
          ],
        };
      } else {
        return {
          contents: [
            {
              uri: RESOURCE_URI,
              mimeType: "text/plain",
              text: "Browser not initialized or no content available.",
            },
          ],
        };
      }
    } catch(error: any) {
      return {
        contents: [
          {
            uri: RESOURCE_URI,
            mimeType: "text/plain",
            text: `Error: ${error.message}`
          },
        ],
      };
    }
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    // Parse arguments using Zod (best practice for type safety)
    try {
      if (request.params.name === "navigate") {
        const args = z.object({
          url: z.string().url(),
          timeout: z.number().optional(),
          waitUntil: z.enum(["load", "domcontentloaded", "networkidle", "commit"]).optional(),
        }).parse(request.params.arguments);
        const result = await navigate(args);
        return {
          content: [{
            type: "text",
            text: result.message,
          }],
          isError: !result.success,
        };
      } else if (request.params.name === "execute") {
        const args = z.object({
          plan: z.object({
            actions: z.array(
              z.object({
                type: z.enum(["wait", "click", "typing", "keyPress", "submit", "print"]),
                element: z.string().optional(),
                elements: z.array(z.string()).optional(),
                value: z.string().optional(),
                key: z.string().optional(),
                delay: z.number().optional(),
              })
            )
          }),
          headless: z.boolean().optional(),
          selectorMode: z.enum(["full", "simple"]).optional()
        }).parse(request.params.arguments) as { plan: { actions: Action[] }; headless?: boolean; selectorMode?: 'full' | 'simple' };
        const result = await execute(args);
        if (result.success) {
          return {
            content: [
              ...result.actionStatuses.map((status: any) => ({
                type: "text" as "text",  //Needs inline type assertion
                text: status.result?.message
              })),
            ],
            isError: false,
          };
        }
        else {
          return {
            content: [{
              type: "text",
              text: result.message,
            }],
            isError: true,
          };
        }
      } else {
        return {
          content: [{
            type: "text",
            text: `Unknown tool: ${request.params.name}`,
          }],
          isError: true,
        };
      }
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error: ${error.message}`,
        }],
        isError: true,
      };
    }
  });
} 