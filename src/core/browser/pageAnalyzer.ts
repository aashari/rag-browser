import type { Page, BrowserContext } from "playwright";
import type { PageAnalysis, BrowserOptions, PlannedActionResult, SelectorMode } from "../../types";
import { executePlan } from "../actions";
import { waitForPageStability } from "../stability";
import { getElementInfo } from "../../utils/element";
import { info, error } from "../../utils/logging";
import { DEFAULT_TIMEOUT, LINK_SELECTORS, BUTTON_SELECTORS, INPUT_SELECTORS } from "../../config/constants";

export async function analyzePage(page: Page, url: string, options: BrowserOptions, browser: BrowserContext): Promise<PageAnalysis> {
    let actionSucceeded = false;
    let plannedActionResults: PlannedActionResult[] = [];

    try {
        // Navigate to the URL
        info(`Navigating to ${url}`);
        await page.goto(url, {
            timeout: options.timeout || DEFAULT_TIMEOUT,
            waitUntil: 'domcontentloaded',
        });

        // Wait for the page to stabilize
        await waitForPageStability(page, { timeout: options.timeout || DEFAULT_TIMEOUT });

        // If there's a plan, execute it
        if (options.plan) {
            info("Executing plan...");
            const result = await executePlan(page, options.plan, options);
            
            plannedActionResults = result.plannedActionResults || [];
            actionSucceeded = result.actionStatuses.every(status => status.result?.success || false);
            
            if (!actionSucceeded) {
                error("Plan execution failed");
            }
        }

        // Collect page information
        const title = await page.title();
        let description: string | undefined;
        
        try {
            description = await page.$eval('meta[name="description"]', el => el.getAttribute('content') || '') || undefined;
        } catch (err) {
            // No description meta tag, that's okay
        }

        // Collect form inputs
        const inputElements = await page.$$(INPUT_SELECTORS);
        const inputs = [];
        
        for (const element of inputElements) {
            const info = await getElementInfo(page, element);
            if (info) inputs.push(info);
        }

        // Collect buttons
        const buttonElements = await page.$$(BUTTON_SELECTORS);
        const buttons = [];
        
        for (const element of buttonElements) {
            try {
                const text = await element.evaluate(el => el.textContent?.trim() || '');
                const selector = await element.evaluate(el => {
                    if (typeof window.getFullPath === 'function') {
                        return window.getFullPath(el);
                    }
                    return '';
                });
                
                if (selector) {
                    buttons.push({ text, selector });
                }
            } catch (err) {
                // Skip this button if there's an error
            }
        }

        // Collect links
        const linkElements = await page.$$(LINK_SELECTORS);
        const links = [];
        
        for (const element of linkElements) {
            try {
                const title = await element.evaluate(el => el.textContent?.trim() || '');
                const url = await element.evaluate(el => el.getAttribute('href') || '');
                const selector = await element.evaluate(el => {
                    if (typeof window.getFullPath === 'function') {
                        return window.getFullPath(el);
                    }
                    return '';
                });
                
                if (selector && url && !url.startsWith('javascript:')) {
                    links.push({ title, url, selector });
                }
            } catch (err) {
                // Skip this link if there's an error
            }
        }

        return {
            title,
            description,
            inputs,
            buttons,
            links,
            plannedActions: plannedActionResults.length > 0 ? plannedActionResults : undefined,
            timestamp: Date.now(),
        };
    } catch (err) {
        error("Error during page analysis", err);
        return {
            title: url,
            error: err instanceof Error ? err.message : String(err),
            inputs: [],
            buttons: [],
            links: [],
            plannedActions: plannedActionResults.length > 0 ? plannedActionResults : undefined,
        };
    }
} 