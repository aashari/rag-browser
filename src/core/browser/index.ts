import type { PageAnalysis, BrowserOptions, StorageState } from "../../types";
import type { Page, Cookie } from "playwright";
import { launchBrowserContext, setupPageConsoleLogging } from "./browserSetup";
import { applyStorageState, saveStorageState, loadStorageState, cleanupStorageFiles, abortActiveOperations } from "./storageManager";
import { setupEventHandlers, onUserInteraction, getLastUserInteractionTime } from "./eventHandlers";
import { analyzePage } from "./pageAnalyzer";
import { info, error, warn, debug } from "../../utils/logging";
import { DEFAULT_TIMEOUT } from "../../config/constants";
import { waitForPageStability } from "../stability/pageStability";

// Track active browser contexts for cleanup
const activeBrowsers = new Set<any>();

/**
 * Analyze a page in a browser context
 */
export async function analyzeBrowserPage(url: string, options: BrowserOptions): Promise<PageAnalysis> {
    // Try to load storage state from URL if not provided
    if (!options.storageState) {
        try {
            const storageState = await loadStorageState(url);
            if (storageState) {
                options.storageState = storageState;
                info(`Loaded storage state for ${url}`);
            }
        } catch (err) {
            warn(`Failed to load storage state for ${url}`, err);
        }
    }

    let browser: any = null;
    let page: Page | null = null;
    let unregisterCallback: (() => void) | null = null;
    let actionSucceeded = false;

    try {
        // Launch browser
        browser = await launchBrowserContext(options);
        activeBrowsers.add(browser);

        // Get the first page or create a new one
        const pages = browser.pages();
        page = pages.length > 0 ? pages[0] : await browser.newPage();

        // Set up console logging if in debug mode
        if (options.debug && page) {
            setupPageConsoleLogging(page);
        }

        // Register user interaction callback
        unregisterCallback = onUserInteraction(() => {
            // Empty callback just to track user interaction
        });

        // Apply storage state if provided
        if (options.storageState && page) {
            debug("Applying storage state");
            try {
                // Apply the storage state (this will handle navigation to about:blank internally)
                await applyStorageState(page, options.storageState);
                debug("Storage state applied successfully");
            } catch (err) {
                warn("Error applying storage state", err);
            }
        }

        // Set up abort signal handler
        if (options.abortSignal) {
            options.abortSignal.addEventListener('abort', () => {
                debug("Abort signal received, cleaning up browser");
                if (browser) {
                    abortActiveOperations();
                    browser.close().catch(() => {});
                    activeBrowsers.delete(browser);
                }
            });
        }

        // Execute the analysis with a timeout
        const analysisPromise = async (): Promise<PageAnalysis> => {
            if (!page) {
                throw new Error("Page is null");
            }
            
            // Navigate to the URL with appropriate wait options
            info(`Navigating to ${url}`, { timestamp: new Date().toISOString() });
            
            await page.goto(url, {
                timeout: options.timeout || DEFAULT_TIMEOUT,
                waitUntil: 'domcontentloaded',
            });
            
            // Wait for the page to stabilize with configurable options
            await waitForPageStability(page, { 
                timeout: options.timeout || DEFAULT_TIMEOUT,
                waitForNetworkIdle: true,
                ...options.stabilityOptions
            });
            
            // Analyze the page
            info("Starting page analysis", { timestamp: new Date().toISOString() });
            const analysis = await analyzePage(page, url, options, browser);
            info("Page analysis completed", { timestamp: new Date().toISOString() });
            
            // Set actionSucceeded based on planned actions
            actionSucceeded = analysis.plannedActions ? 
                !analysis.plannedActions.some(action => action.error) : 
                true;
            
            // Clean up the user interaction callback
            if (unregisterCallback) {
                unregisterCallback();
                unregisterCallback = null;
            }
            
            return analysis;
        };

        // Execute the analysis
        const analysis = await analysisPromise();

        // Save storage state if action succeeded
        if (actionSucceeded && page) {
            try {
                const storageState = await page.context().storageState();
                await saveStorageState(url, storageState);
                info(`Saved storage state for ${url}`);
            } catch (err) {
                warn(`Failed to save storage state for ${url}`, err);
            }
        }

        // Clean up browser
        if (browser) {
            await browser.close().catch(() => {});
            activeBrowsers.delete(browser);
        }

        return analysis;
    } catch (err) {
        error("Error during browser analysis", err);

        // Clean up resources
        if (unregisterCallback) {
            unregisterCallback();
        }

        if (browser) {
            await browser.close().catch(() => {});
            activeBrowsers.delete(browser);
        }

        // Return error state
        return {
            title: url,
            error: err instanceof Error ? err.message : String(err),
            inputs: [],
            buttons: [],
            links: []
        };
    }
}

/**
 * Clean up any active browser contexts
 */
export async function cleanupBrowsers(): Promise<void> {
    debug(`Cleaning up ${activeBrowsers.size} active browser contexts`);
    
    const closePromises = Array.from(activeBrowsers).map(browser => 
        browser.close().catch((err: any) => {
            warn("Error closing browser", err);
        })
    );
    
    await Promise.all(closePromises);
    activeBrowsers.clear();
    
    // Also clean up any storage files
    await cleanupStorageFiles();
} 