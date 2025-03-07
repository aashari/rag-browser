import type { PageAnalysis, BrowserOptions, StorageState } from "../../types";
import { launchBrowserContext } from "./browserSetup";
import { setupEventHandlers } from "./eventHandlers";
import { applyStorageState } from "./storageManager";
import { injectUtilityScripts, injectLinkModifiers } from "./scriptInjector";
import { analyzePage } from "./pageAnalyzer";
import { info, error, warn } from "../../utils/logging";
import type { Cookie } from "playwright";
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
            page.on('console', message => {
                const type = message.type();
                const text = message.text();
                
                // Log with appropriate level based on console message type
                switch (type) {
                    case 'log':
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
        }
        
        // Apply storage state if provided
        if (options.storageState) {
            await applyStorageState(page, options.storageState);
        }
        
        // Inject utility scripts
        await injectUtilityScripts(page);
        
        // Inject link modifiers
        await injectLinkModifiers(page);
        
        // Analyze the page
        const analysis = await analyzePage(page, url, options, browser);
        
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
        if (actionSucceeded || options.timeout !== -1) {
            try {
                // Get browser state before closing
                const state = await browser.storageState();
                
                // Process and save state before closing the browser
                await processAndSaveState(state, options);
                
                // Unroute all routes to prevent "Target page, context or browser has been closed" errors
                if (options.debug) {
                    info("Cleaning up browser routes before closing");
                    const pages = browser.pages();
                    for (const page of pages) {
                        try {
                            await page.unrouteAll({ behavior: 'ignoreErrors' });
                        } catch (e) {
                            // Ignore errors during unrouting
                        }
                    }
                }
                
                // Add a small delay to ensure all operations are complete
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Close the browser
                info("Closing browser");
                await browser.close();
                
            } catch (closeErr) {
                error("Error closing browser", closeErr);
                try {
                    await browser.close();
                } catch (e) {
                    // Ignore additional errors during closure
                }
            }
        }
    }
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