import type { PageAnalysis, BrowserOptions, StorageState } from "../../types";
import type { Page, Cookie } from "playwright";
import { launchBrowserContext, setupPageConsoleLogging } from "./browserSetup";
import { applyStorageState } from "./storageManager";
import { setupEventHandlers } from "./eventHandlers";
import { analyzePage } from "./pageAnalyzer";
import { info, error, warn } from "../../utils/logging";
import { DEFAULT_TIMEOUT } from "../../config/constants";
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

interface BrowserStorageItem {
    name: string;
    value: string;
}

interface BrowserStorageOrigin {
    origin: string;
    localStorage?: BrowserStorageItem[];
    sessionStorage?: BrowserStorageItem[];
}

// Get the path to the storage state file
function getStorageStatePath(): string {
    const storageDir = path.join(os.homedir(), '.rag-browser');
    return path.join(storageDir, 'storage-state.json');
}

// Save storage state to a file asynchronously
async function saveStorageStateToFile(state: any): Promise<void> {
    try {
        const storageDir = path.join(os.homedir(), '.rag-browser');
        
        // Create directory if it doesn't exist
        await fs.mkdir(storageDir, { recursive: true });
        
        // Write state to file
        await fs.writeFile(
            getStorageStatePath(),
            JSON.stringify(state, null, 2),
            'utf8'
        );
        
        info("Browser state saved successfully");
    } catch (err) {
        error("Failed to save browser state", err);
    }
}

// Load storage state from file
export async function loadStorageStateFromFile(): Promise<StorageState | undefined> {
    try {
        const filePath = getStorageStatePath();
        
        // Check if file exists
        try {
            await fs.access(filePath);
        } catch {
            return undefined; // File doesn't exist
        }
        
        // Read and parse file
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data) as StorageState;
    } catch (err) {
        error("Failed to load browser state", err);
        return undefined;
    }
}

export async function analyzeBrowserPage(url: string, options: BrowserOptions): Promise<PageAnalysis> {
    // Try to load storage state from file if not provided
    if (!options.storageState) {
        options.storageState = await loadStorageStateFromFile();
    }
    
    // Create a timeout promise to ensure the function doesn't run indefinitely
    const timeoutPromise = new Promise<PageAnalysis>((_, reject) => {
        // Handle the case where options.timeout is undefined
        const timeout = options.timeout ?? DEFAULT_TIMEOUT;
        // Use a reasonable timeout that won't hang the process
        const timeoutMs = timeout !== -1 ? Math.min(timeout + 5000, 60000) : 60000;
        setTimeout(() => {
            reject(new Error(`Analysis timed out after ${timeoutMs}ms`));
        }, timeoutMs);
    });
    
    // The actual analysis function
    const analysisPromise = async (): Promise<PageAnalysis> => {
        // Launch browser with persistent context
        const browser = await launchBrowserContext(options);
        let actionSucceeded = false;
        
        try {
            // Create a new page
            const page = await browser.newPage();
            
            // Set up all event handlers
            setupEventHandlers(page);
            
            // Set up console log streaming for this page if in debug mode
            if (options.debug) {
                setupPageConsoleLogging(page);
            }
            
            // Apply storage state if provided
            if (options.storageState) {
                await applyStorageState(page, options.storageState);
            }
            
            // Analyze the page
            info("Starting page analysis", { timestamp: new Date().toISOString() });
            const analysis = await analyzePage(page, url, options, browser);
            info("Page analysis completed", { timestamp: new Date().toISOString() });
            
            // Set actionSucceeded based on planned actions
            actionSucceeded = analysis.plannedActions ? 
                !analysis.plannedActions.some(action => action.error) : 
                true;
            
            return analysis;
        } catch (err) {
            error("Error during browser analysis", err);
            
            // Return error state
            return {
                title: url,
                error: err instanceof Error ? err.message : String(err),
                inputs: [],
                buttons: [],
                links: []
            };
        } finally {
            // Always show analysis summary before closing
            try {
                // Log final state summary
                info("Final execution state", {
                    url,
                    actionSucceeded,
                    hasTimeout: options.timeout !== -1
                });
            } catch (err) {
                error("Error in cleanup", { error: err instanceof Error ? err.message : String(err) });
            }

            // Close browser unless we're in infinite wait and action hasn't succeeded
            // For infinite wait actions (like login forms), keep the browser open until the action succeeds
            const hasInfiniteWait = options.timeout === -1;
            
            if (actionSucceeded || !hasInfiniteWait) {
                try {
                    info("Starting browser cleanup", { timestamp: new Date().toISOString() });
                    
                    // Get browser state before closing
                    info("Getting browser state", { timestamp: new Date().toISOString() });
                    const state = await browser.storageState();
                    info("Browser state retrieved", { timestamp: new Date().toISOString() });
                    
                    // Process and save state before closing the browser
                    info("Processing and saving state", { timestamp: new Date().toISOString() });
                    await processAndSaveState(state, options);
                    info("State processed and saved", { timestamp: new Date().toISOString() });
                    
                    // Unroute all routes before closing
                    info("Unrouting all routes", { timestamp: new Date().toISOString() });
                    for (const page of browser.pages()) {
                        if (page.isClosed()) continue;
                        
                        try {
                            // First remove all listeners to prevent callbacks after closing
                            page.removeAllListeners();
                            
                            // Then unroute all routes
                            await page.unrouteAll({ behavior: 'ignoreErrors' });
                        } catch (e) {
                            // Ignore errors during unrouting
                        }
                    }
                    info("All routes unrouted", { timestamp: new Date().toISOString() });
                    
                    // Wait a longer time to ensure all operations are complete
                    info("Starting wait before browser close", { timestamp: new Date().toISOString() });
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    info("Wait completed", { timestamp: new Date().toISOString() });
                    
                    // Close the browser
                    info("Closing browser", { timestamp: new Date().toISOString() });
                    await browser.close().catch(e => {
                        warn("Error during browser close", { error: e instanceof Error ? e.message : String(e) });
                    });
                    info("Browser closed successfully", { timestamp: new Date().toISOString() });
                    
                } catch (closeErr) {
                    error("Error closing browser", closeErr);
                    try {
                        // Wait a short time before trying to close again
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        await browser.close();
                    } catch (e) {
                        // Ignore additional errors during closure
                    }
                }
            }
        }
    };
    
    // Race the analysis against the timeout
    return Promise.race([analysisPromise(), timeoutPromise]);
}

// Process and save browser state
async function processAndSaveState(state: any, options: BrowserOptions): Promise<void> {
    try {
        // Process cookies if needed
        if (state.cookies) {
            // Filter out any problematic cookies if needed
            state.cookies = state.cookies.filter((cookie: Cookie) => {
                // Keep all cookies by default
                return true;
            });
        }

        // Process origins if needed
        if (state.origins) {
            // Filter out any problematic origins if needed
            state.origins = state.origins.filter((origin: BrowserStorageOrigin) => {
                // Keep all origins by default
                return true;
            });
        }

        // Save the processed state to a file
        await saveStorageStateToFile(state);
    } catch (err) {
        error("Error processing browser state", err);
    }
} 