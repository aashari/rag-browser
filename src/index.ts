#!/usr/bin/env bun
import { runServer } from './mcp/server';

// Run the MCP server
runServer().catch((error: Error) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
});
