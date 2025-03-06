import { chromium } from "playwright";
import * as path from "path";
import * as os from "os";
import type { BrowserOptions } from "../../types";

// Helper function to get default user data directory
export function getDefaultUserDataDir(): string {
	return path.join(os.homedir(), '.playwright-user-data');
}

// Launch browser with persistent context
export async function launchBrowserContext(options: BrowserOptions) {
	const userDataDir = options.userDataDir || getDefaultUserDataDir();

	return await chromium.launchPersistentContext(userDataDir, {
		headless: options.headless,
		args: ['--disable-web-security', '--disable-features=IsolateOrigins,site-per-process'],
		bypassCSP: true,
		permissions: ['clipboard-read', 'clipboard-write'],
	});
} 