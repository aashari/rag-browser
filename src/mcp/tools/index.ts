import { VERSION } from "../../config/version.js";
import type { EnhancedTool } from "./types.js";
import { compatibility } from "./types.js";
import { commonProperties } from "./properties.js";
import { actionToolDescription, actionToolCompatibility } from "./descriptions.js";
import { actionToolSchema } from "./schemas.js";
import { examplePlans } from "./examples.js";

/**
 * Create tool definitions for the MCP server
 */
export function createToolDefinitions(): EnhancedTool[] {
    return [
        {
            name: "action",
            description: actionToolDescription,
            version: VERSION,
            compatibility: actionToolCompatibility,
            inputSchema: {
                type: "object",
                properties: {
                    ...commonProperties,
                    plan: {
                        type: "string",
                        description: actionToolSchema.properties.plan.description
                    }
                },
                required: ["url"]
            }
        }
    ];
}

/**
 * Export tools for direct access
 */
export const tools = {
    action: {
        name: "action",
        version: VERSION,
        // Additional properties as needed
    }
};

// Re-export for convenience
export { compatibility, commonProperties, examplePlans }; 