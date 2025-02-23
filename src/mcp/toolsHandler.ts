import type { BrowserOptions, PageAnalysis, Plan } from '../types';
import { chromium } from 'playwright';
import { DEFAULT_TIMEOUT, VISIBLE_MODE_SLOW_MO } from '../config/constants';
import { executePlan } from '../core/actions';
import { waitForPageStability } from '../core/stability';
import { getFullPath } from '../core/scripts';
import { log } from '../utils/logging';

// We keep browser, context and page as global variables
let browser: any;
let page: any;

// Debug logging helper
let debugId = 0;
function debug(message: string, data?: any) {
  debugId++;
  console.debug(JSON.stringify({
    jsonrpc: "2.0",
    id: `debug_${debugId}`,
    method: "debug",
    params: {
      message,
      data: data ? JSON.stringify(data) : undefined
    }
  }));
}

export async function navigate(args: { url: string; timeout?: number; waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit" }): Promise<{ success: boolean; message: string }> {
  const { url, timeout, waitUntil } = args;
  debug("Starting navigation", { url, timeout, waitUntil });

  //close browser, context and page if any exist
  if (browser) {
    debug("Closing existing browser instance");
    await browser.close();
    browser = undefined;
    page = undefined;
  }

  try {
    debug("Launching browser");
    browser = await chromium.launch({ headless: false }); // Always visible for now
    const context = await browser.newContext();
    page = await context.newPage();

    debug(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: waitUntil || 'domcontentloaded', timeout: timeout || DEFAULT_TIMEOUT });
    debug('Initial page load complete');

    debug('Waiting for page stability...');
    await waitForPageStability(page);
    debug('Page appears stable');
    
    return { success: true, message: `Navigated to ${url}` };
  }
  catch (error: any) {
    debug('Navigation Error', { error: error.message });
    console.error('Navigation Error:', error);
    return { success: false, message: `Error navigating to ${url}: ${error.message}` };
  }
}

export async function execute(args: { plan: Plan; headless?: boolean; selectorMode?: 'full' | 'simple' }): Promise<{ success: boolean; message: string; actionStatuses?: any; plannedActionResults?: any}> {
  debug("Starting execute", args);
  
  if (!page) {
    debug("No active page found");
    return { success: false, message: 'Navigation is required before executing a plan.' };
  }

  const { plan, headless, selectorMode } = args;
  const options = {
    headless: !!headless, // Convert to boolean (default to false if undefined)
    selectorMode: selectorMode || 'full', // Default to full selectors
  };

  try {
    debug("Injecting utility functions");
    // Inject utility functions
    await page.addInitScript(`
      window.getFullPath = ${getFullPath.toString()};
    `);

    // Execute plan if provided
    if (plan) {
      debug("Executing plan", plan);
      const { actionStatuses, plannedActionResults } = await executePlan(page, plan, options);
      debug("Plan execution complete", { actionStatuses, plannedActionResults });

      return { success: true, message: 'Plan executed successfully.', actionStatuses, plannedActionResults };
    }
    else {
      debug("No plan provided");
      return { success: false, message: 'No plan provided.' };
    }

  } catch (error: any) {
    debug('Execution Error', { error: error.message });
    console.error('Execution Error:', error);
    return { success: false, message: `Error executing plan: ${error.message}` };
  }
}

export async function getPageContent(): Promise<string | null> {
  debug("Getting page content");
  if (page) {
    const content = await page.content();
    debug("Page content retrieved", { length: content.length });
    return content;
  }
  debug("No active page found");
  return null;
} 