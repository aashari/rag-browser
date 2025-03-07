import type { Page, Cookie as PlaywrightCookie } from "playwright";
import type { StorageState } from "../../types";
import { info, warn, error, debug } from "../../utils/logging";
import { promiseTracker } from "../../utils/promiseTracker";
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

// Define our internal storage item type
interface StorageItem {
	name: string;
	value: string;
}

// Define the type for an origin entry
interface OriginEntry {
	origin: string;
	localStorage?: Record<string, string>;
	sessionStorage?: Record<string, string>;
}

// In-memory cache for storage states
const stateCache = new Map<string, {
	state: StorageState,
	timestamp: number
}>();

// Cache expiration time (30 minutes)
const CACHE_EXPIRATION_MS = 30 * 60 * 1000;

// Maximum number of cache entries
const MAX_CACHE_ENTRIES = 20;

// Storage directory
const STORAGE_DIR = path.join(os.homedir(), '.rag-browser', 'storage');

// Storage file expiration (7 days)
const STORAGE_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000;

// Track active file operations for cleanup
const activeOperations = new Map<string, AbortController>();

/**
 * Generate a hash for a URL to use as a cache key
 */
function generateUrlHash(url: string): string {
	return crypto.createHash('md5').update(url).digest('hex');
}

/**
 * Get the path to the storage state file for a specific URL
 */
function getStorageStatePath(urlOrHash: string): string {
	// If the input is already a hash (32 hex chars), use it directly
	const hash = urlOrHash.length === 32 && /^[a-f0-9]+$/.test(urlOrHash) 
		? urlOrHash 
		: generateUrlHash(urlOrHash);
	
	return path.join(STORAGE_DIR, `${hash}.json`);
}

/**
 * Ensure the storage directory exists
 */
async function ensureStorageDir(): Promise<void> {
	try {
		await fs.mkdir(STORAGE_DIR, { recursive: true });
	} catch (err) {
		error("Failed to create storage directory", err);
		throw err;
	}
}

/**
 * Save storage state to a file
 * Returns a promise that resolves when the cache is updated, but tracks the file operation
 */
export function saveStorageState(url: string, state: any): Promise<void> {
	return new Promise<void>(async (resolve, reject) => {
		try {
			// Process the state
			const processedState = processState(state);
			
			// Generate hash for the URL
			const urlHash = generateUrlHash(url);
			
			// Update the cache immediately
			stateCache.set(urlHash, {
				state: processedState,
				timestamp: Date.now()
			});
			
			// Ensure we don't exceed the maximum cache size
			if (stateCache.size > MAX_CACHE_ENTRIES) {
				// Find the oldest entry
				let oldestKey = '';
				let oldestTime = Date.now();
				
				for (const [key, entry] of stateCache.entries()) {
					if (entry.timestamp < oldestTime) {
						oldestTime = entry.timestamp;
						oldestKey = key;
					}
				}
				
				// Remove the oldest entry
				if (oldestKey) {
					stateCache.delete(oldestKey);
				}
			}
			
			// Resolve now that the cache is updated
			resolve();
			
			// Save to disk in the background, but track the promise
			const diskSavePromise = (async () => {
				try {
					// Ensure storage directory exists
					await ensureStorageDir();
					
					// Create an AbortController for this operation
					const abortController = new AbortController();
					const signal = abortController.signal;
					const filePath = getStorageStatePath(urlHash);
					
					// Register this operation
					activeOperations.set(filePath, abortController);
					
					// Set a timeout to abort the operation if it takes too long
					const timeoutId = setTimeout(() => {
						abortController.abort();
						activeOperations.delete(filePath);
						warn("Storage state save operation timed out");
					}, 3000);
					
					try {
						// Write the file with the abort signal
						await fs.writeFile(
							filePath,
							JSON.stringify(processedState),
							{ signal }
						);
						debug("Browser state saved to disk successfully");
					} catch (writeErr: unknown) {
						if (writeErr instanceof Error && writeErr.name === 'AbortError') {
							warn("Storage state save operation was aborted");
						} else {
							warn("Failed to save browser state to disk", writeErr);
						}
					} finally {
						clearTimeout(timeoutId);
						activeOperations.delete(filePath);
					}
				} catch (err) {
					error("Error in background state processing", err);
				}
			})();
			
			// Track the background promise
			promiseTracker.track(diskSavePromise, `saveStorageState:${url}`);
			
		} catch (err) {
			error("Error processing state for saving", err);
			reject(err);
		}
	});
}

/**
 * Process the state to filter out problematic entries and convert to the correct format
 */
function processState(state: any): StorageState {
	const processedState: StorageState = {
		cookies: [],
		origins: []
	};
	
	// Process cookies if needed
	if (state.cookies && Array.isArray(state.cookies)) {
		// Filter out any problematic cookies and convert to our format
		processedState.cookies = state.cookies
			.filter((cookie: any) => {
				// Filter out cookies with invalid domains or paths
				if (!cookie.domain || !cookie.path) {
					return false;
				}
				
				// Filter out cookies with extremely large values
				if (cookie.value && cookie.value.length > 4096) {
					return false;
				}
				
				// Keep all other cookies
				return true;
			})
			.map((cookie: any) => ({
				name: cookie.name,
				value: cookie.value,
				domain: cookie.domain,
				path: cookie.path,
				expires: cookie.expires || -1,
				httpOnly: cookie.httpOnly || false,
				secure: cookie.secure || false,
				sameSite: cookie.sameSite || "Lax"
			}));
	}

	// Process origins if needed
	if (state.origins && Array.isArray(state.origins)) {
		// Convert origins to our format
		processedState.origins = state.origins.map((origin: any) => {
			const result: OriginEntry = {
				origin: origin.origin
			};
			
			// Convert localStorage if it exists
			if (origin.localStorage) {
				if (Array.isArray(origin.localStorage)) {
					// Convert from array of {name, value} to Record<string, string>
					const localStorage: Record<string, string> = {};
					for (const item of origin.localStorage) {
						if (item && typeof item.name === 'string' && typeof item.value === 'string') {
							localStorage[item.name] = item.value;
						}
					}
					result.localStorage = localStorage;
				} else if (typeof origin.localStorage === 'object') {
					// Already in Record<string, string> format
					result.localStorage = origin.localStorage;
				}
			}
			
			// Convert sessionStorage if it exists
			if (origin.sessionStorage) {
				if (Array.isArray(origin.sessionStorage)) {
					// Convert from array of {name, value} to Record<string, string>
					const sessionStorage: Record<string, string> = {};
					for (const item of origin.sessionStorage) {
						if (item && typeof item.name === 'string' && typeof item.value === 'string') {
							sessionStorage[item.name] = item.value;
						}
					}
					result.sessionStorage = sessionStorage;
				} else if (typeof origin.sessionStorage === 'object') {
					// Already in Record<string, string> format
					result.sessionStorage = origin.sessionStorage;
				}
			}
			
			return result;
		});
	}
	
	return processedState;
}

/**
 * Load storage state for a specific URL
 * Checks the in-memory cache first, then falls back to disk
 */
export async function loadStorageState(url: string): Promise<StorageState | null> {
	try {
		const urlHash = generateUrlHash(url);
		
		// Check if we have a cached state that's not expired
		const cachedEntry = stateCache.get(urlHash);
		if (cachedEntry && (Date.now() - cachedEntry.timestamp) < CACHE_EXPIRATION_MS) {
			debug("Using cached storage state");
			return cachedEntry.state;
		}
		
		// No valid cache entry, try to load from disk
		const filePath = getStorageStatePath(urlHash);
		
		// Check if file exists
		try {
			await fs.access(filePath);
		} catch {
			debug("No storage state file exists for this URL");
			return null; // File doesn't exist
		}
		
		// Get file stats to check age
		const stats = await fs.stat(filePath);
		const fileAge = Date.now() - stats.mtime.getTime();
		
		// Check if file is too old
		if (fileAge > STORAGE_EXPIRATION_MS) {
			debug("Storage state file is expired, deleting");
			await fs.unlink(filePath).catch(() => {}); // Ignore errors
			return null;
		}
		
		// Create an AbortController for this operation
		const abortController = new AbortController();
		const signal = abortController.signal;
		
		// Register this operation
		activeOperations.set(filePath, abortController);
		
		// Set a timeout to abort the operation if it takes too long
		const timeoutId = setTimeout(() => {
			abortController.abort();
			activeOperations.delete(filePath);
			warn("Storage state load operation timed out");
		}, 2000);
		
		try {
			// Read the file with the abort signal
			const data = await fs.readFile(filePath, { signal, encoding: 'utf8' });
			const state = JSON.parse(data) as StorageState;
			
			// Update the cache
			stateCache.set(urlHash, {
				state,
				timestamp: Date.now()
			});
			
			debug("Storage state loaded from disk");
			return state;
		} catch (readErr: unknown) {
			if (readErr instanceof Error && readErr.name === 'AbortError') {
				warn("Storage state load operation was aborted");
			} else {
				warn("Failed to load browser state from disk", readErr);
			}
			return null;
		} finally {
			clearTimeout(timeoutId);
			activeOperations.delete(filePath);
		}
	} catch (err) {
		warn("Failed to load browser state", err);
		return null;
	}
}

/**
 * Apply storage state to the browser context
 * This applies cookies and storage for their respective domains
 */
export async function applyStorageState(page: Page, storageState: StorageState) {
	try {
		// Apply cookies
		if (storageState.cookies && storageState.cookies.length > 0) {
			debug(`Applying ${storageState.cookies.length} cookies`);
			try {
				await page.context().addCookies(storageState.cookies);
				debug("Cookies applied successfully");
			} catch (cookieErr) {
				warn("Error applying cookies", { error: cookieErr instanceof Error ? cookieErr.message : String(cookieErr) });
				
				// Try applying cookies one by one to identify problematic ones
				let appliedCount = 0;
				for (const cookie of storageState.cookies) {
					try {
						await page.context().addCookies([cookie]);
						appliedCount++;
					} catch (singleCookieErr) {
						debug(`Skipping problematic cookie: ${cookie.name} for domain ${cookie.domain}`);
					}
				}
				debug(`Applied ${appliedCount} out of ${storageState.cookies.length} cookies individually`);
			}
		}

		// Apply localStorage and sessionStorage for each origin
		if (storageState.origins && storageState.origins.length > 0) {
			debug(`Applying storage for ${storageState.origins.length} origins`);
			
			// First navigate to about:blank to ensure we're starting fresh
			await page.goto('about:blank', { waitUntil: 'domcontentloaded' });
			
			// Apply storage for each origin
			for (const origin of storageState.origins) {
				try {
					// Skip if origin is not valid
					if (!origin.origin || (!origin.localStorage && !origin.sessionStorage)) {
						continue;
					}
					
					// Extract the domain from the origin
					const url = new URL(origin.origin);
					const domain = url.origin;
					
					debug(`Applying storage for domain: ${domain}`);
					
					// Navigate to the domain temporarily to set storage
					// Use a special path that's unlikely to exist to minimize loading
					await page.goto(`${domain}/__storage_state_setter__`, { 
						waitUntil: 'domcontentloaded',
						timeout: 5000
					}).catch(() => {
						// Ignore navigation errors - the page might not exist
						// We just need to be on the correct domain
					});
					
					// Check if we're on the correct domain
					const currentUrl = page.url();
					if (!currentUrl.startsWith(domain) && !currentUrl.includes(url.hostname)) {
						debug(`Failed to navigate to ${domain}, skipping storage application`);
						continue;
					}
					
					// Apply localStorage if it exists
					if (origin.localStorage) {
						await page.evaluate((storage) => {
							try {
								// Clear existing localStorage
								localStorage.clear();
								
								// Set new localStorage items
								for (const [key, value] of Object.entries(storage)) {
									localStorage.setItem(key, value);
								}
								return true;
							} catch (e) {
								console.error('Error setting localStorage:', e);
								return false;
							}
						}, origin.localStorage);
						debug(`Applied localStorage for ${domain}`);
					}
					
					// Apply sessionStorage if it exists
					if (origin.sessionStorage) {
						await page.evaluate((storage) => {
							try {
								// Clear existing sessionStorage
								sessionStorage.clear();
								
								// Set new sessionStorage items
								for (const [key, value] of Object.entries(storage)) {
									sessionStorage.setItem(key, value);
								}
								return true;
							} catch (e) {
								console.error('Error setting sessionStorage:', e);
								return false;
							}
						}, origin.sessionStorage);
						debug(`Applied sessionStorage for ${domain}`);
					}
				} catch (originErr) {
					warn(`Error applying storage for origin ${origin.origin}`, originErr);
				}
			}
			
			// Navigate back to about:blank
			await page.goto('about:blank', { waitUntil: 'domcontentloaded' });
		}
	} catch (err) {
		warn("Error applying storage state", { error: err instanceof Error ? err.message : String(err) });
	}
}

/**
 * Clean up expired storage files
 * This should be called periodically to prevent disk space issues
 */
export async function cleanupStorageFiles(): Promise<void> {
	try {
		// Ensure storage directory exists
		await ensureStorageDir();
		
		// Get all files in the storage directory
		const files = await fs.readdir(STORAGE_DIR);
		
		// Current time
		const now = Date.now();
		
		// Process each file
		for (const file of files) {
			if (!file.endsWith('.json')) continue;
			
			try {
				const filePath = path.join(STORAGE_DIR, file);
				const stats = await fs.stat(filePath);
				
				// Check if file is expired
				if (now - stats.mtime.getTime() > STORAGE_EXPIRATION_MS) {
					debug(`Deleting expired storage file: ${file}`);
					await fs.unlink(filePath);
				}
			} catch (fileErr) {
				// Ignore errors for individual files
				debug(`Error processing storage file ${file}`, fileErr);
			}
		}
	} catch (err) {
		warn("Error cleaning up storage files", err);
	}
}

/**
 * Abort all active file operations
 * This should be called during cleanup to ensure no operations are left hanging
 */
export function abortActiveOperations(): void {
	if (activeOperations.size > 0) {
		debug(`Aborting ${activeOperations.size} active file operations`);
		for (const [filePath, controller] of activeOperations.entries()) {
			debug(`Aborting operation for ${filePath}`);
			controller.abort();
		}
		activeOperations.clear();
	}
}