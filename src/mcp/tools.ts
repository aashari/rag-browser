import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// Define Zod schemas for tool inputs
const NavigateInputSchema = {
  type: "object" as const,
  properties: {
    url: z.string().url(),
    timeout: z.number().optional(),
    waitUntil: z.enum(["load", "domcontentloaded", "networkidle", "commit"]).optional(),
  }
};

const PlanSchema = z.object({
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
});

const ExecuteInputSchema = {
  type: "object" as const,
  properties: {
    plan: PlanSchema,
    headless: z.boolean().optional(),
    selectorMode: z.enum(["full", "simple"]).optional()
  }
};

export function createToolDefinitions(): Tool[] {
  return [
    {
      name: "navigate",
      description: "Navigates to a URL.",
      inputSchema: NavigateInputSchema,
    },
    {
      name: "execute",
      description: "Executes a plan of actions on the current page.",
      inputSchema: ExecuteInputSchema,
    },
  ];
} 