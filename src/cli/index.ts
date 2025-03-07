#!/usr/bin/env bun

import { analyzePage } from "../core/browser";
import type { Plan } from "../types";
import { formatAnalysis, printPlan, type OutputFormat } from "../utils/output";
import { DEFAULT_TIMEOUT, VISIBLE_MODE_SLOW_MO } from "../config/constants";
import { fileURLToPath } from 'url';

export async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const urlIndex = args.indexOf("--url") + 1;
	const planIndex = args.indexOf("--plan") + 1;
	const timeoutIndex = args.indexOf("--timeout") + 1;
	const headless = args.includes("--headless");
	const format = (args.includes("--json") ? "json" : "pretty") as OutputFormat;
	const selectorMode = args.includes("--simple-selectors") ? "simple" : "full";
	const debug = args.includes("--debug");

	if (urlIndex === 0 || urlIndex >= args.length) {
		console.error(
			'Usage: bun run browser --url "https://example.com" [options]'
		);
		console.error("\nOptions:");
		console.error("  --url              The URL to analyze");
		console.error("  --headless         Run in headless mode (optional, default: false)");
		console.error("  --json             Output in JSON format (optional, default: pretty print)");
		console.error("  --simple-selectors Use simple selectors without full paths (optional, default: full paths)");
		console.error("  --plan             JSON string defining actions to perform (optional)");
		console.error("  --timeout          Timeout in ms, use -1 for infinite wait (optional, default: 30000)");
		console.error("  --debug            Run in debug mode, suppressing all logs (optional, default: false)");
		process.exit(1);
	}

	const url = args[urlIndex];
	let plan: Plan | undefined;
	let timeout = DEFAULT_TIMEOUT;

	if (timeoutIndex > 0 && timeoutIndex < args.length) {
		timeout = parseInt(args[timeoutIndex], 10);
		if (isNaN(timeout)) {
			console.error("Invalid timeout value. Must be a number or -1 for infinite wait.");
			process.exit(1);
		}
	}

	if (planIndex > 0 && planIndex < args.length) {
		try {
			plan = JSON.parse(args[planIndex]) as Plan;
			if (!plan.actions || !Array.isArray(plan.actions)) {
				throw new Error("Plan must have an actions array");
			}
			if (!debug) {
				console.warn(printPlan(plan));
			}
		} catch (error) {
			console.error("Invalid --plan JSON:", error instanceof Error ? error.message : String(error));
			process.exit(1);
		}
	}

	if (!debug) {
		console.warn(`Running in ${headless ? "headless" : "visible"} mode with ${selectorMode} selectors...`);
	}

	try {
		const analysis = await analyzePage(url, {
			headless,
			slowMo: headless ? 0 : VISIBLE_MODE_SLOW_MO,
			timeout,
			selectorMode,
			plan,
			debug,
		});
		
		// Only output the analysis if not in debug mode
		if (!debug) {
			console.warn(formatAnalysis(analysis, format));
		}
	} catch (error) {
		if (!debug) {
			console.error("Error:", error instanceof Error ? error.message : String(error));
		}
		process.exit(1);
	}
}

// Only run main if this file is being executed directly
if (fileURLToPath(import.meta.url) === process.argv[1]) {
	main().catch(error => {
		// Check if debug mode is enabled
		if (!process.argv.includes("--debug")) {
			console.error("Fatal error:", error instanceof Error ? error.message : String(error));
		}
		process.exit(1);
	});
}
