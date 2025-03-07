import type { PageAnalysis, BrowserOptions, StorageState } from "../../types";
import type { Page, Cookie } from "playwright";
import { launchBrowserContext, setupPageConsoleLogging } from "./browserSetup";
import { applyStorageState, saveStorageState, loadStorageState, cleanupStorageFiles, abortActiveOperations } from "./storageManager";
import { setupEventHandlers, onUserInteraction, getLastUserInteractionTime } from "./eventHandlers";
import { analyzePage } from "./pageAnalyzer";
import { info, error, warn, debug } from "../../utils/logging";
import { DEFAULT_TIMEOUT } from "../../config/constants";
import { promiseTracker } from "../../utils/promiseTracker";
import { waitForPageStability } from "../stability/pageStability";

// Track active browser contexts for cleanup
const activeBrowsers = new Set<any>();

export async function analyzeBrowserPage(url: string, options: BrowserOptions): Promise<PageAnalysis> {
    // Try to load storage state from URL if not provided
    if (!options.storageState) {
        options.storageState = await loadStorageState(url);
        
        // Periodically clean up expired storage files (1% chance per call)
        if (Math.random() < 0.01) {
            promiseTracker.track(
                cleanupStorageFiles(),
                'periodicCleanup'
            ).catch(err => {
                debug("Error cleaning up storage files", err);
            });
        }
    }
    
    // Create a timeout controller
    const timeoutController = new AbortController();
    const timeoutSignal = timeoutController.signal;
    let timeoutId: NodeJS.Timeout | null = null;
    
    // Create a timeout promise
    const createTimeoutPromise = (timeoutMs: number) => {
        return new Promise<PageAnalysis>((_, reject) => {
            // Clear any existing timeout
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            
            // Set a new timeout
            timeoutId = setTimeout(() => {
                timeoutController.abort();
                reject(new Error(`Analysis timed out after ${timeoutMs}ms`));
            }, timeoutMs);
        });
    };
    
    // Calculate timeout value
    const timeout = options.timeout ?? DEFAULT_TIMEOUT;
    const timeoutMs = timeout !== -1 ? Math.min(timeout + 5000, 60000) : 60000;
    
    // Initial timeout promise
    let timeoutPromise = createTimeoutPromise(timeoutMs);
    
    // The actual analysis function
    const analysisPromise = async (): Promise<PageAnalysis> => {
        // Launch browser with persistent context
        const browser = await launchBrowserContext(options);
        
        // Track this browser for cleanup
        activeBrowsers.add(browser);
        
        let actionSucceeded = false;
        let page: Page | null = null;
        
        try {
            // Create a new page
            page = await browser.newPage();
            
            // Set up all event handlers
            setupEventHandlers(page);
            
            // Set up console log streaming for this page if in debug mode
            if (options.debug) {
                setupPageConsoleLogging(page);
            }
            
            // Set up timeout reset on user interaction
            const unregisterCallback = onUserInteraction(() => {
                // Reset the timeout promise when user interaction is detected
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutPromise = createTimeoutPromise(timeoutMs);
                    info("Timeout reset due to user interaction", { timestamp: new Date().toISOString() });
                }
            });
            
            // First navigate to a blank page to ensure we don't start with the last visited page
            await page.goto('about:blank', { waitUntil: 'domcontentloaded' }).catch(e => {
                debug("Error navigating to blank page", e);
            });
            
            // Apply storage state if provided
            if (options.storageState) {
                await applyStorageState(page, options.storageState);
            }
            
            // Check if the operation was aborted
            if (timeoutSignal.aborted) {
                throw new Error("Operation was aborted");
            }
            
            // Navigate to the target URL
            info(`Navigating to ${url}`);
            await page.goto(url, {
                timeout: options.timeout || DEFAULT_TIMEOUT,
                waitUntil: 'domcontentloaded',
            });
            
            // Wait for the page to stabilize with configurable options
            await waitForPageStability(page, { 
                timeout: options.timeout || DEFAULT_TIMEOUT,
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
            unregisterCallback();
            
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
            const hasInfiniteWait = options.timeout === -1;
            
            if (actionSucceeded || !hasInfiniteWait) {
                try {
                    info("Starting browser cleanup", { timestamp: new Date().toISOString() });
                    
                    // Get browser state before closing
                    info("Getting browser state", { timestamp: new Date().toISOString() });
                    const state = await browser.storageState();
                    info("Browser state retrieved", { timestamp: new Date().toISOString() });
                    
                    // Save state (tracked by promiseTracker)
                    info("Saving browser state", { timestamp: new Date().toISOString() });
                    await promiseTracker.track(
                        saveStorageState(state, url),
                        `saveBrowserState:${url}`
                    ).catch(e => {
                        error("Error saving browser state", { error: e instanceof Error ? e.message : String(e) });
                    });
                    
                    // Close the browser
                    info("Closing browser", { timestamp: new Date().toISOString() });
                    await browser.close().catch(e => {
                        warn("Error during browser close", { error: e instanceof Error ? e.message : String(e) });
                    });
                    
                    // Remove from active browsers
                    activeBrowsers.delete(browser);
                    
                    info("Browser closed successfully", { timestamp: new Date().toISOString() });
                    
                } catch (closeErr) {
                    error("Error closing browser", closeErr);
                    try {
                        // Wait a short time before trying to close again
                        await new Promise(resolve => setTimeout(resolve, 500));
                        await browser.close();
                        activeBrowsers.delete(browser);
                    } catch (e) {
                        // Ignore additional errors during closure
                    }
                }
            }
            
            // Clean up any remaining resources
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
        }
    };
    
    try {
        // Race the analysis against the timeout
        const result = await Promise.race([analysisPromise(), timeoutPromise]);
        
        // Wait for any pending promises to complete with a short timeout
        await promiseTracker.waitForPending(1000);
        
        return result;
    } catch (err: unknown) {
        // If the timeout was triggered, make sure to clean up
        if (err instanceof Error && err.message.includes('timed out')) {
            // Abort any active operations
            abortActiveOperations();
            
            // Close any active browsers
            for (const browser of activeBrowsers) {
                try {
                    await browser.close().catch(() => {});
                    activeBrowsers.delete(browser);
                } catch (e) {
                    // Ignore errors during forced closure
                }
            }
        }
        
        throw err;
    }
}

/**
 * Clean up all browser resources
 * This should be called during application shutdown
 */
export async function cleanupBrowserResources(): Promise<void> {
    // Abort any active file operations
    abortActiveOperations();
    
    // Close any active browsers
    for (const browser of activeBrowsers) {
        try {
            await browser.close().catch(() => {});
            activeBrowsers.delete(browser);
        } catch (e) {
            // Ignore errors during forced closure
        }
    }
    
    // Wait for any pending promises to complete with a short timeout
    await promiseTracker.waitForPending(1000);
} 