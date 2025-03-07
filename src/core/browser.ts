import type { PageAnalysis, BrowserOptions, StorageState } from "../types";
import { analyzeBrowserPage, cleanupBrowserResources } from "./browser/index";
import { setDebugMode } from "../utils/logging";
import { loadStorageState, saveStorageState, cleanupStorageFiles, abortActiveOperations } from "./browser/storageManager";
import { promiseTracker } from "../utils/promiseTracker";

export async function analyzePage(url: string, options: BrowserOptions): Promise<PageAnalysis> {
	// Set debug mode based on options
	setDebugMode(options.debug || false);
	
	return analyzeBrowserPage(url, options);
}

/**
 * Load browser storage state for a specific URL
 * @param url The URL to load storage state for
 * @returns The storage state or undefined if not found
 */
export async function loadBrowserState(url: string): Promise<StorageState | undefined> {
	return loadStorageState(url);
}

/**
 * Save browser storage state for a specific URL
 * @param state The storage state to save
 * @param url The URL to associate with this state
 */
export function saveBrowserState(state: StorageState, url: string): Promise<void> {
	return promiseTracker.track(
		saveStorageState(state, url),
		`saveBrowserState:${url}`
	);
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
	await cleanupBrowserResources();
	
	// Wait for any pending promises to complete with a short timeout
	await promiseTracker.waitForPending(1000);
}
