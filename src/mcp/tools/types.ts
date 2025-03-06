import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { VERSION } from "../../config/version.js";

/**
 * Enhanced Tool interface with version and compatibility information
 */
export type EnhancedTool = Tool & {
	version: string;
	compatibility: {
		minVersion: string;
		deprecatedFeatures: string[];
	};
};

/**
 * Compatibility information for tools
 */
export const compatibility = {
	minimumVersion: "1.0.0",
	version: VERSION,
}; 