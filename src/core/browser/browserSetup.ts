import { chromium } from "playwright";
import * as path from "path";
import * as os from "os";
import type { BrowserOptions } from "../../types";
import { debug, info, warn, error } from "../../utils/logging";
import type { BrowserContext, Page } from 'playwright';

// Helper function to get default user data directory
export function getDefaultUserDataDir(): string {
	return path.join(os.homedir(), '.playwright-user-data');
}

/**
 * Launch a browser context with the specified options
 */
export async function launchBrowserContext(options: BrowserOptions) {
	// Set up browser launch options
	const launchOptions = {
		headless: options.headless !== false,
		slowMo: options.headless === false ? 100 : undefined,
	};
	
	// Launch browser with persistent context if userDataDir is provided
	const browser = await chromium.launchPersistentContext(
		options.userDataDir || '',
		{
			...launchOptions,
			viewport: { width: 1280, height: 800 },
			acceptDownloads: true,
			ignoreHTTPSErrors: true,
		}
	);
	
	// Set up console log streaming when in debug mode
	if (options.debug) {
		info("Debug mode enabled - streaming browser console logs");
		setupConsoleLogging(browser);
	}
	
	return browser;
}

/**
 * Helper function to set up console log streaming for a BrowserContext
 */
export function setupConsoleLogging(browser: BrowserContext) {
	browser.on('page', page => {
		setupPageConsoleLogging(page);
	});
}

/**
 * Helper function to set up console log streaming for a Page
 */
export function setupPageConsoleLogging(page: Page) {
	page.on('console', message => {
		const type = message.type();
		const text = message.text();
		
		// Log with appropriate level based on console message type
		switch (type) {
			case 'log':
			case 'info':
				info(`[Browser Console] ${text}`);
				break;
			case 'debug':
				debug(`[Browser Console] ${text}`);
				break;
			case 'warning':
				warn(`[Browser Console] ${text}`);
				break;
			case 'error':
				error(`[Browser Console] ${text}`);
				break;
			default:
				info(`[Browser Console] [${type}] ${text}`);
		}
	});
	
	// Also capture page errors
	page.on('pageerror', exception => {
		error(`[Browser Exception] ${exception.message}`);
	});
} 