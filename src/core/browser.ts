import { chromium } from "playwright";
import type { PageAnalysis, BrowserOptions, PlannedActionResult } from "../types";
import { DEFAULT_TIMEOUT, LINK_SELECTORS, BUTTON_SELECTORS, INPUT_SELECTORS } from "../config/constants";
import { executePlan } from "./actions";
import { waitForPageStability } from "./stability";
import { getFullPath } from "./scripts";
import { getElementInfo } from "../utils/element";
import { info, error } from "../utils/logging";

declare global {
	interface Window {
		getFullPath: (element: Element) => string;
	}
}

export async function analyzePage(url: string, options: BrowserOptions): Promise<PageAnalysis> {
	const browser = await chromium.launch({
		headless: options.headless,
		slowMo: options.slowMo || 0,
	});

	const page = await browser.newPage();
	let plannedActionResults: PlannedActionResult[] = [];

	try {
		// Inject utility functions
		await page.addInitScript(`
      window.getFullPath = ${getFullPath.toString()};
    `);

		info("Starting navigation", { url, options });
		await page.goto(url, { waitUntil: "domcontentloaded", timeout: options.timeout || DEFAULT_TIMEOUT });
		info("Initial page load complete");

		await waitForPageStability(page);
		info("Page stability confirmed");

		// Extract inputs first
		const inputElements = await page.$$(INPUT_SELECTORS);
		const inputs = await Promise.all(inputElements.map((element) => getElementInfo(page, element)));
		info("Input elements extracted", { count: inputs.length });

		// Execute plan if provided
		if (options.plan) {
			info("Executing action plan", { plan: options.plan });
			const { plannedActionResults: results } = await executePlan(page, options.plan, options);
			plannedActionResults = results;
			info("Action plan execution complete", { results });
		}

		// Re-inject utility functions after navigation
		await page.addInitScript(`
      window.getFullPath = ${getFullPath.toString()};
    `);

		// Extract page content
		const analysis = await page.evaluate(
			({ linkSelectors, buttonSelectors }) => {
				const getAllElements = (selector: string): Element[] => Array.from(document.querySelectorAll(selector));

				// Extract page metadata
				const title = document.title;
				const description = document.querySelector('meta[name="description"]')?.getAttribute("content") || "";

				// Extract links
				const linkElements = getAllElements(linkSelectors);
				const links = linkElements
					.map((link) => {
						const element = link as HTMLElement;
						const text = element.textContent?.trim() || "";
						return {
							title: text,
							url: element.getAttribute("href") || "",
							selector: window.getFullPath(element),
						};
					})
					.filter((link) => link.url && !link.url.startsWith("javascript:"));

				// Extract buttons
				const buttonElements = getAllElements(buttonSelectors);
				const buttons = buttonElements.map((button) => {
					const element = button as HTMLElement;
					return {
						text: element.textContent?.trim() || "",
						selector: window.getFullPath(element),
					};
				});

				return { title, description, links, buttons };
			},
			{
				linkSelectors: LINK_SELECTORS,
				buttonSelectors: BUTTON_SELECTORS,
				selectorMode: options.selectorMode,
			}
		);

		info("Page analysis complete", {
			title: analysis.title,
			linksCount: analysis.links.length,
			buttonsCount: analysis.buttons.length,
			inputsCount: inputs.length,
		});

		return {
			...analysis,
			inputs,
			plannedActions: plannedActionResults.length > 0 ? plannedActionResults : undefined,
		};
	} catch (err) {
		error("Fatal error during page analysis", { error: err instanceof Error ? err.message : String(err) });
		throw err;
	} finally {
		await browser.close();
	}
}
