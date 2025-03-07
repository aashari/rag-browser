import type { Page } from "playwright";
import { info, debug } from "../../utils/logging";

// Track the last user interaction time
let lastUserInteractionTime = Date.now();
let timeoutResetCallbacks: (() => void)[] = [];

/**
 * Register a callback to be called when user interaction is detected
 * @param callback Function to call when user interaction is detected
 * @returns Function to unregister the callback
 */
export function onUserInteraction(callback: () => void): () => void {
    timeoutResetCallbacks.push(callback);
    return () => {
        timeoutResetCallbacks = timeoutResetCallbacks.filter(cb => cb !== callback);
    };
}

/**
 * Get the time of the last user interaction
 * @returns Timestamp of the last user interaction
 */
export function getLastUserInteractionTime(): number {
    return lastUserInteractionTime;
}

/**
 * Reset the user interaction timer and call all registered callbacks
 */
function resetUserInteractionTimer(): void {
    lastUserInteractionTime = Date.now();
    debug("User interaction detected, resetting timeout counters");
    
    // Call all registered callbacks
    timeoutResetCallbacks.forEach(callback => {
        try {
            callback();
        } catch (err) {
            debug("Error in user interaction callback", { error: err instanceof Error ? err.message : String(err) });
        }
    });
}

/**
 * Sets up event handlers for the browser page
 * This handles browser events without modifying the page
 */
export function setupEventHandlers(page: Page) {
    // Log navigation events
    page.on('framenavigated', async (frame) => {
        if (frame === page.mainFrame()) {
            const frameUrl = frame.url();
            if (frameUrl !== 'about:blank') {
                info(`Navigation to: ${frameUrl}`);
                // Wait a short time for the page to start loading
                await page.waitForTimeout(500);
            }
        }
    });

    // Handle dialog events (alerts, confirms, prompts)
    page.on('dialog', async (dialog) => {
        info(`Dialog appeared: ${dialog.type()} - ${dialog.message()}`);
        // Auto-dismiss dialogs to prevent blocking
        await dialog.dismiss();
    });
    
    // Handle new page creation (instead of modifying window.open)
    page.context().on('page', async newPage => {
        // Get the URL of the new page
        const url = newPage.url();
        
        // Close the new page
        await newPage.close();
        
        // Navigate the main page to the URL instead
        if (url && url !== 'about:blank') {
            await page.goto(url);
        }
    });

    // Set up user interaction detection
    setupUserInteractionDetection(page);
}

/**
 * Sets up event listeners to detect user interactions with the page
 * @param page The Playwright page object
 */
function setupUserInteractionDetection(page: Page): void {
    // We need to inject a script into the page to listen for user interactions
    page.evaluate(() => {
        // Track user interactions
        const trackInteraction = () => {
            // Send a message to the parent context
            window.postMessage({ type: 'USER_INTERACTION' }, '*');
        };

        // Add event listeners for common user interactions
        window.addEventListener('mousedown', trackInteraction);
        window.addEventListener('keydown', trackInteraction);
        window.addEventListener('touchstart', trackInteraction);
        window.addEventListener('scroll', trackInteraction);
        window.addEventListener('wheel', trackInteraction);
        
        // Return true to indicate successful setup
        return true;
    }).catch(err => {
        debug("Error setting up user interaction detection", { error: err instanceof Error ? err.message : String(err) });
    });

    // Listen for the messages from the page
    page.on('console', message => {
        if (message.text().includes('USER_INTERACTION')) {
            resetUserInteractionTimer();
        }
    });

    // Also listen for CDP events that might indicate user interaction
    page.on('filechooser', () => resetUserInteractionTimer());
    page.on('download', () => resetUserInteractionTimer());
} 