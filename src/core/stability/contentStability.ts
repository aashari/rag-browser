import type { Page, ElementHandle } from "playwright";
import { DEFAULT_TIMEOUT, NETWORK_IDLE_TIMEOUT } from "../../config/constants";
import { debug, warn, error } from "../../utils/logging";

// Define constants for content stability
const REDIRECT_CHECK_INTERVAL = 500;
const STABILITY_POLL_INTERVAL = 200;
const STABILITY_MIN_ITERATIONS = 2;

/**
 * Helper function to check if a URL is valid
 */
function _isValidUrl(urlString: string): boolean {
    try {
        new URL(urlString);
        return true;
    } catch {
        return false;
    }
}

/**
 * Waits for a search input element to be ready for interaction
 */
export async function waitForSearchInput(
    page: Page,
    selector: string,
    options: { timeout?: number } = {}
): Promise<ElementHandle<SVGElement | HTMLElement> | null> {
    const timeout = options.timeout || DEFAULT_TIMEOUT;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        try {
            const element = await page.$(selector);
            if (element) {
                const isVisible = await element.isVisible().catch(() => false);
                const isEnabled = await element.isEnabled().catch(() => false);

                if (isVisible && isEnabled) {
                    return element;
                }
            }
        } catch (err) {
            warn("Error checking search input", { error: err instanceof Error ? err.message : String(err) });
        }

        await page.waitForTimeout(100);
    }

    warn("Timed out waiting for search input", { selector });
    return null;
}

/**
 * Checks if the page is redirecting to another URL
 */
export async function checkForRedirects(page: Page, options: { timeout?: number, checkInterval?: number } = {}): Promise<boolean> {
    const timeout = options.timeout || DEFAULT_TIMEOUT;
    const checkInterval = options.checkInterval || REDIRECT_CHECK_INTERVAL;
    const startTime = Date.now();
    let initialUrl = await page.url();

    while (Date.now() - startTime < timeout) {
        await page.waitForTimeout(checkInterval);
        const currentUrl = await page.url();

        if (_isValidUrl(currentUrl) && currentUrl !== initialUrl) {
            debug("Redirect detected", { from: initialUrl, to: currentUrl });
            return true;
        }
    }

    return false;
}

/**
 * Waits for the page content to stabilize by checking for changes in the DOM
 */
export async function waitForPageContentStability(page: Page, options: { timeout?: number, checkInterval?: number, minIterations?: number, abortSignal?: AbortSignal } = {}): Promise<boolean> {
    const timeout = options.timeout || DEFAULT_TIMEOUT;
    const checkInterval = options.checkInterval || STABILITY_POLL_INTERVAL;
    const minIterations = options.minIterations || STABILITY_MIN_ITERATIONS;
    const startTime = Date.now();
    
    let lastContent = "";
    let stableIterations = 0;
    let iteration = 0;

    debug("Starting content stability check", { timeout, checkInterval, minIterations });

    while (Date.now() - startTime < timeout && !options.abortSignal?.aborted) {
        iteration++;
        try {
            // Get current page content
            const content = await page.content().catch(() => "");
            
            if (content === lastContent) {
                stableIterations++;
                debug("Content stable", { iteration, stableIterations });
                
                if (stableIterations >= minIterations) {
                    debug("Content stability confirmed", { 
                        duration: Date.now() - startTime,
                        iterations: iteration
                    });
                    return true;
                }
            } else {
                stableIterations = 0;
                debug("Content changed", { iteration });
                lastContent = content;
            }
        } catch (err) {
            warn("Error checking content stability", { 
                error: err instanceof Error ? err.message : String(err),
                iteration
            });
            
            // If page is closed, exit
            if (err instanceof Error && 
                (err.message.includes("Target closed") || err.message.includes("context was destroyed"))) {
                return true;
            }
        }
        
        await page.waitForTimeout(checkInterval);
    }
    
    if (options.abortSignal?.aborted) {
        debug("Content stability check aborted");
    } else {
        warn("Content stability check timed out", { 
            duration: Date.now() - startTime,
            iterations: iteration
        });
    }
    
    return false;
}

/**
 * Detects if an element is being re-rendered (common in React/Vue apps)
 */
export async function detectReRendering(page: Page, selector: string, options: { timeout?: number, abortSignal?: AbortSignal } = {}): Promise<boolean> {
    const timeout = options.timeout || DEFAULT_TIMEOUT;
    const startTime = Date.now();
    let reRenderDetected = false;
    
    try {
        // Add a data attribute to the element to track re-renders
        await page.evaluate((sel) => {
            const element = document.querySelector(sel);
            if (element) {
                element.setAttribute('data-stability-marker', Date.now().toString());
            }
        }, selector).catch(() => {});
        
        // Check if the attribute is preserved (if not, element was re-rendered)
        while (Date.now() - startTime < timeout && !options.abortSignal?.aborted && !reRenderDetected) {
            const markerExists = await page.evaluate((sel) => {
                const element = document.querySelector(sel);
                return element && element.hasAttribute('data-stability-marker');
            }, selector).catch(() => false);
            
            if (!markerExists) {
                debug("Re-rendering detected", { selector });
                reRenderDetected = true;
                break;
            }
            
            await page.waitForTimeout(100);
        }
        
        // Clean up the marker
        await page.evaluate((sel) => {
            const element = document.querySelector(sel);
            if (element) {
                element.removeAttribute('data-stability-marker');
            }
        }, selector).catch(() => {});
        
        return reRenderDetected;
    } catch (err) {
        warn("Error detecting re-rendering", { 
            error: err instanceof Error ? err.message : String(err),
            selector
        });
        return false;
    }
} 