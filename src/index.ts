#!/usr/bin/env node

import { runServer } from "./mcp/server";

runServer().catch((error: Error) => {
    console.error("Failed to start MCP server:", error);
    process.exit(1);
});
