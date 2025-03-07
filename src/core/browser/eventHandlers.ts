import type { Page } from "playwright";
import { info } from "../../utils/logging";

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
} 