#!/usr/bin/env bun

import { analyzePage } from '../core/browser';
import type { PageAnalysis, Plan } from '../types';
import { printAnalysis, printPlan } from './printer';
import type { OutputFormat } from './printer';
import { DEFAULT_TIMEOUT, VISIBLE_MODE_SLOW_MO } from '../config/constants';

async function main() {
  const args = process.argv.slice(2);
  const urlIndex = args.indexOf('--url') + 1;
  const planIndex = args.indexOf('--plan') + 1;
  const headless = args.includes('--headless');
  const format = (args.includes('--json') ? 'json' : 'pretty') as OutputFormat;
  const selectorMode = (args.includes('--simple-selectors') ? 'simple' : 'full');

  if (urlIndex === 0 || urlIndex >= args.length) {
    console.error('Usage: bun run browser --url "https://example.com" [--headless] [--json] [--simple-selectors] [--plan \'{"actions":[...]}\']');
    console.error('  --url              The URL to analyze');
    console.error('  --headless         Run in headless mode (optional, default: false)');
    console.error('  --json             Output in JSON format (optional, default: pretty print)');
    console.error('  --simple-selectors Use simple selectors without full paths (optional, default: full paths)');
    console.error('  --plan             JSON string defining actions to perform (optional)');
    process.exit(1);
  }

  const url = args[urlIndex];
  let plan: Plan | undefined;

  if (planIndex > 0 && planIndex < args.length) {
    try {
      plan = JSON.parse(args[planIndex]) as Plan;
      // Basic validation
      if (!plan.actions || !Array.isArray(plan.actions)) {
        throw new Error('Plan must have an actions array');
      }
      // Print the plan before execution
      printPlan(plan);
    } catch (error: any) {
      console.error('Invalid --plan JSON:', error.message);
      process.exit(1);
    }
  }

  console.log(`Running in ${headless ? 'headless' : 'visible'} mode with ${selectorMode} selectors...`);

  try {
    const analysis = await analyzePage(url, {
      headless,
      slowMo: headless ? 0 : VISIBLE_MODE_SLOW_MO,
      timeout: DEFAULT_TIMEOUT,
      selectorMode,
      plan
    });
    printAnalysis(analysis, format);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main(); 