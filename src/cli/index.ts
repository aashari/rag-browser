#!/usr/bin/env bun

import { Command } from 'commander';
import { analyzePage } from "../core/browser";
import type { Plan, PageAnalysis } from "../types";
import { formatAnalysis, printPlan, type OutputFormat } from "../utils/output";
import { DEFAULT_TIMEOUT, VISIBLE_MODE_SLOW_MO } from "../config/constants";
import { fileURLToPath } from 'url';
import { error, info, debug as logDebug } from "../utils/logging";
import { VERSION, PACKAGE_NAME } from "../config/version";
import type { StabilityOptions } from "../core/stability/pageStability";

export async function main(): Promise<PageAnalysis> {
	const program = new Command();
	
	program
		.name(PACKAGE_NAME)
		.description('Browser automation and analysis tool for RAG applications')
		.version(VERSION)
		.requiredOption('--url <url>', 'The URL to analyze')
		.option('--headless', 'Run in headless mode', false)
		.option('--json', 'Output in JSON format (default: pretty print)', false)
		.option('--simple-selectors', 'Use simple selectors without full paths', false)
		.option('--plan <json>', 'JSON string defining actions to perform')
		.option('--timeout <ms>', 'Timeout in ms, use -1 for infinite wait', DEFAULT_TIMEOUT.toString())
		.option('--debug', 'Enable verbose debug logging', false)
		.option('--expect-navigation', 'Expect navigation during stability checks', false)
		.addHelpText('after', `
Examples:
  $ bun run src/index.ts --url https://example.com
  $ bun run src/index.ts --url https://example.com --headless --json
  $ bun run src/index.ts --url https://example.com --plan '{"actions":[{"type":"wait","elements":[".main-content"]}]}'
  $ bun run src/index.ts --url https://example.com --expect-navigation
		`);
	
	program.parse();
	const options = program.opts();
	
	// Extract and validate options
	const url = options.url;
	const headless = options.headless;
	const format = (options.json ? "json" : "pretty") as OutputFormat;
	const selectorMode = options.simpleSelectors ? "simple" : "full";
	const debug = options.debug;
	
	// Parse and validate timeout
	let timeout = DEFAULT_TIMEOUT;
	try {
		timeout = parseInt(options.timeout, 10);
		if (isNaN(timeout)) {
			throw new Error("Invalid timeout value");
		}
	} catch (err) {
		console.error("Invalid timeout value. Must be a number or -1 for infinite wait.");
		process.exit(1);
	}
	
	// Parse and validate stability options
	const stabilityOptions: StabilityOptions = {
		timeout,
		expectNavigation: options.expectNavigation
	};
	
	// Parse and validate plan if provided
	let plan: Plan | undefined;
	if (options.plan) {
		try {
			plan = JSON.parse(options.plan) as Plan;
			if (!plan.actions || !Array.isArray(plan.actions)) {
				throw new Error("Plan must have an actions array");
			}
			console.warn(printPlan(plan));
		} catch (err) {
			console.error("Invalid --plan JSON:", err instanceof Error ? err.message : String(err));
			process.exit(1);
		}
	}
	
	console.warn(`Running in ${headless ? "headless" : "visible"} mode with ${selectorMode} selectors...`);
	
	if (debug) {
		console.warn("Stability options:", JSON.stringify(stabilityOptions, null, 2));
	}
	
	try {
		const analysis = await analyzePage(url, {
			headless,
			slowMo: headless ? 0 : VISIBLE_MODE_SLOW_MO,
			timeout,
			selectorMode,
			plan,
			debug,
			stabilityOptions
		});
		
		console.warn(formatAnalysis(analysis, format));
		
		// Log completion message
		console.warn("Analysis complete.");
		
		// Return the analysis result
		return analysis;
	} catch (err) {
		console.error("Error:", err instanceof Error ? err.message : String(err));
		// Don't set process.exitCode as it might kill the MCP server
		throw err; // Re-throw to allow proper handling by caller
	}
}

// Only run main if this file is being executed directly
if (fileURLToPath(import.meta.url) === process.argv[1]) {
	// Check if we're running in a direct CLI environment (not as an MCP server)
	const isDirectCLI = !process.env.MCP_SERVER && !process.env.IS_SERVER_MODE;
	
	main().catch(err => {
		// Check if debug mode is enabled
		if (!process.argv.includes("--debug")) {
			console.error("Fatal error:", err instanceof Error ? err.message : String(err));
		} else {
			console.error("Fatal error with stack trace:", err);
		}
		
		// Only set exit code if running directly in CLI mode
		if (isDirectCLI) {
			process.exitCode = 1;
		}
	});
}
