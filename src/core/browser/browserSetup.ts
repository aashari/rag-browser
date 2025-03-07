import { chromium } from "playwright";
import * as path from "path";
import * as os from "os";
import type { BrowserOptions } from "../../types";
import { debug, info, warn, error } from "../../utils/logging";

// Helper function to get default user data directory
export function getDefaultUserDataDir(): string {
	return path.join(os.homedir(), '.playwright-user-data');
}

// Launch browser with persistent context
export async function launchBrowserContext(options: BrowserOptions) {
	const userDataDir = options.userDataDir || getDefaultUserDataDir();

	const browser = await chromium.launchPersistentContext(userDataDir, {
		headless: options.headless,
		args: ['--disable-web-security', '--disable-features=IsolateOrigins,site-per-process'],
		bypassCSP: true,
		permissions: ['clipboard-read', 'clipboard-write'],
		// Only enable browser logs when in debug mode
		logger: !options.debug ? {
			isEnabled: () => false,
			log: () => {},
		} : undefined,
	});

	// Set up console log streaming when in debug mode
	if (options.debug) {
		info("Debug mode enabled - streaming browser console logs");
		
		// Add console log listeners to all pages
		browser.on('page', page => {
			page.on('console', message => {
				const type = message.type();
				const text = message.text();
				
				switch (type) {
					case 'log':
						info(`[Browser Console] ${text}`);
						break;
					case 'debug':
						debug(`[Browser Console] ${text}`);
						break;
					case 'info':
						info(`[Browser Console] ${text}`);
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
		});
	}

	return browser;
} 