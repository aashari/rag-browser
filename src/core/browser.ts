import type { PageAnalysis, BrowserOptions, StorageState } from "../types";
import { analyzeBrowserPage, cleanupBrowsers as cleanupBrowserContexts } from "./browser/index";
import { setDebugMode } from "../utils/logging";
import { loadStorageState, saveStorageState, cleanupStorageFiles, abortActiveOperations } from "./browser/storageManager";
import { promiseTracker } from "../utils/promiseTracker";

export async function analyzePage(url: string, options: BrowserOptions): Promise<PageAnalysis> {
	// Set debug mode based on options
	setDebugMode(options.debug || false);
	
	return analyzeBrowserPage(url, options);
}

/**
 * Load storage state for a URL
 */
export function loadBrowserStorage(url: string): Promise<StorageState | null> {
	return loadStorageState(url);
}

/**
 * Save storage state for a URL
 */
export function saveBrowserStorage(url: string, state: StorageState): Promise<void> {
	return saveStorageState(url, state);
}

/**
 * Clean up expired browser storage files
 */
export function cleanupBrowserStorage(): Promise<void> {
	return promiseTracker.track(
		cleanupStorageFiles(),
		'cleanupBrowserStorage'
	);
}

/**
 * Clean up all browser resources
 * This should be called during application shutdown
 */
export async function cleanupResources(): Promise<void> {
	// Abort any active file operations
	abortActiveOperations();
	
	// Clean up browser resources
	await cleanupBrowserContexts();
	
	// Wait for any pending promises to complete with a short timeout
	await promiseTracker.waitForPending(1000);
}

/**
 * Clean up any active browser contexts
 * This is exported for direct use in other modules
 */
export const cleanupBrowsers = cleanupBrowserContexts;
