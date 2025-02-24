#!/usr/bin/env node

import { analyzePage } from "../core/browser";
import type { Plan } from "../types";
import { printAnalysis, printPlan, type OutputFormat } from "../utils/output";
import { DEFAULT_TIMEOUT, VISIBLE_MODE_SLOW_MO } from "../config/constants";
import { fileURLToPath } from 'url';

export async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const urlIndex = args.indexOf("--url") + 1;
	const planIndex = args.indexOf("--plan") + 1;
	const headless = args.includes("--headless");
	const format = (args.includes("--json") ? "json" : "pretty") as OutputFormat;
	const selectorMode = args.includes("--simple-selectors") ? "simple" : "full";
	
	// New display options
	const showInputs = args.includes("--inputs");
	const showButtons = args.includes("--buttons");
	const showLinks = args.includes("--links");

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
		console.error("\nDisplay Options:");
		console.error("  --inputs           Show all input elements (optional, default: top 5)");
		console.error("  --buttons          Show all buttons (optional, default: top 5)");
		console.error("  --links            Show all links (optional, default: top 5)");
		process.exit(1);
	}

	const url = args[urlIndex];
	let plan: Plan | undefined;

	if (planIndex > 0 && planIndex < args.length) {
		try {
			plan = JSON.parse(args[planIndex]) as Plan;
			if (!plan.actions || !Array.isArray(plan.actions)) {
				throw new Error("Plan must have an actions array");
			}
			console.warn(printPlan(plan));
		} catch (error) {
			console.error("Invalid --plan JSON:", error instanceof Error ? error.message : String(error));
			process.exit(1);
		}
	}

	console.warn(`Running in ${headless ? "headless" : "visible"} mode with ${selectorMode} selectors...`);

	try {
		const analysis = await analyzePage(url, {
			headless,
			slowMo: headless ? 0 : VISIBLE_MODE_SLOW_MO,
			timeout: DEFAULT_TIMEOUT,
			selectorMode,
			plan,
		});
		console.warn(printAnalysis(analysis, format, { showInputs, showButtons, showLinks }));
	} catch (error) {
		console.error("Error:", error instanceof Error ? error.message : String(error));
		process.exit(1);
	}
}

// Only run main if this file is being executed directly
if (fileURLToPath(import.meta.url) === process.argv[1]) {
    main().catch(error => {
        console.error("Fatal error:", error instanceof Error ? error.message : String(error));
        process.exit(1);
    });
}
