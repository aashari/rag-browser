import type { PageAnalysis, BrowserOptions, StorageState } from "../../types";
import { launchBrowserContext } from "./browserSetup";
import { setupEventHandlers } from "./eventHandlers";
import { applyStorageState } from "./storageManager";
import { injectUtilityScripts, injectLinkModifiers } from "./scriptInjector";
import { analyzePage } from "./pageAnalyzer";
import { info, error } from "../../utils/logging";
import type { Cookie } from "playwright";

interface BrowserStorageItem {
    name: string;
    value: string;
}

interface BrowserStorageOrigin {
    origin: string;
    localStorage?: BrowserStorageItem[];
    sessionStorage?: BrowserStorageItem[];
}

export async function analyzeBrowserPage(url: string, options: BrowserOptions): Promise<PageAnalysis> {
    // Launch browser with persistent context
    const browser = await launchBrowserContext(options);
    let actionSucceeded = false;
    
    try {
        // Create a new page
        const page = await browser.newPage();
        
        // Set up all event handlers
        setupEventHandlers(page);
        
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
                // Save browser state
                const state = await browser.storageState();
                
                // Process cookies
                const cookies = state.cookies.map(({ 
                    name, 
                    value, 
                    domain, 
                    path 
                }: Cookie) => ({
                    name,
                    value,
                    domain: domain || '',
                    path: path || '/'
                }));

                // Process origins
                const origins = state.origins.map((origin: BrowserStorageOrigin) => {
                    const processedOrigin: {
                        origin: string;
                        localStorage?: Record<string, string>;
                        sessionStorage?: Record<string, string>;
                    } = {
                        origin: origin.origin,
                    };
                    
                    if (origin.localStorage) {
                        processedOrigin.localStorage = Object.fromEntries(
                            origin.localStorage.map((item: BrowserStorageItem) => [item.name, item.value])
                        );
                    }
                    
                    if (origin.sessionStorage) {
                        processedOrigin.sessionStorage = Object.fromEntries(
                            origin.sessionStorage.map((item: BrowserStorageItem) => [item.name, item.value])
                        );
                    }
                    
                    return processedOrigin;
                });

                // Update the user's storage state for next run
                options.storageState = {
                    cookies,
                    origins
                };

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