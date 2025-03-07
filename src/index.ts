#!/usr/bin/env bun
import { runServer } from "./mcp/server";
import { main as runCli } from "./cli/index";

// Check if --url argument is present
const hasUrlArg = process.argv.includes("--url");
// Check if debug mode is enabled
const isDebugMode = process.argv.includes("--debug");

if (hasUrlArg) {
    // Run in CLI mode
    runCli().catch((error: Error) => {
        if (!isDebugMode) {
            console.error("CLI execution failed:", error);
        }
        process.exit(1);
    });
} else {
    // Run in MCP server mode
    runServer().catch((error: Error) => {
        if (!isDebugMode) {
            console.error("Failed to start MCP server:", error);
        }
        process.exit(1);
    });
}
