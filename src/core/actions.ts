import type { Page } from "playwright";
import type { Action, ActionResult, BrowserOptions, ActionStatus, Plan, PlannedActionResult } from "../types";
import { waitForActionStability } from "./stability";
import { DEFAULT_TYPING_DELAY, ACTION_STABILITY_TIMEOUT } from "../config/constants";
import { getActionSymbol, getActionDescription } from "../utils/actions";
import { printActionStatus, printActionSummary } from "../cli/printer";
import TurndownService from 'turndown';

// Initialize turndown service with common options
const turndownService = new TurndownService({
	headingStyle: 'atx',
	codeBlockStyle: 'fenced',
	emDelimiter: '*',
	bulletListMarker: '-',
	hr: '---',
	// Add options for better link handling
	linkStyle: 'referenced',
	linkReferenceStyle: 'full'
});

// Add custom rules for Wikipedia search results
turndownService.addRule('searchResult', {
	filter: ['li'],
	replacement: function (content: string, node) {
		const element = node as Element;
		if (element.classList?.contains('mw-search-result')) {
			// Extract components
			const headingEl = element.querySelector('.mw-search-result-heading');
			const heading = turndownService.turndown(headingEl?.innerHTML || '');
			const snippet = element.querySelector('.searchresult')?.textContent?.trim() || '';
			const metadata = element.querySelector('.mw-search-result-data')?.textContent?.trim() || '';
			
			debugLog(`Processing search result:`);
			debugLog(`- Heading HTML: ${headingEl?.innerHTML}`);
			debugLog(`- Heading MD: ${heading}`);
			debugLog(`- Snippet: ${snippet}`);
			debugLog(`- Metadata: ${metadata}`);
			
			// Format as markdown
			return `## ${heading}\n\n${snippet}\n\n*${metadata}*\n\n---\n`;
		}
		return content;
	}
});

// Helper for debug output
function debugLog(message: string) {
	process.stderr.write(`[Debug] ${message}\n`);
}

export async function executeAction(page: Page, action: Action, options: BrowserOptions): Promise<ActionResult> {
	try {
		switch (action.type) {
			case "wait": {
				await Promise.all(
					action.elements.map((selector) =>
						page.waitForSelector(selector, { timeout: options.timeout || 30000 })
					)
				);
				const isStable = await waitForActionStability(page).catch(() => false);
				return {
					success: true,
					message: "Elements found and stable",
					warning: !isStable ? "Page not fully stable, but elements are present" : undefined,
				};
			}

			case "click": {
				await page.click(action.element);
				const isStable = await waitForActionStability(page, { expectNavigation: true }).catch(() => false);
				return {
					success: true,
					message: "Click successful",
					warning: !isStable ? "Page not fully stable after click" : undefined,
				};
			}

			case "typing": {
				const element = await page.waitForSelector(action.element);
				if (!element) {
					return {
						success: false,
						message: "Element not found",
						error: `Element not found: ${action.element}`,
					};
				}

				await element.evaluate((el) => {
					if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
						el.value = "";
					}
				});

				await page.type(action.element, action.value, { delay: action.delay || DEFAULT_TYPING_DELAY });

				// Use a shorter stability timeout for tests
				const stabilityTimeout = options.headless ? 2000 : ACTION_STABILITY_TIMEOUT;
				const isStable = await waitForActionStability(page, { timeout: stabilityTimeout }).catch(() => false);
				return {
					success: true,
					message: "Text entered",
					warning: !isStable ? "Page not fully stable after typing" : undefined,
				};
			}

			case "keyPress": {
				if (action.element) {
					await page.focus(action.element);
				}
				await page.keyboard.press(action.key);
				// Use a shorter stability timeout for tests
				const stabilityTimeout = options.headless ? 2000 : ACTION_STABILITY_TIMEOUT;
				const isStable = await waitForActionStability(page, { timeout: stabilityTimeout }).catch(() => false);
				return {
					success: true,
					message: "Key pressed",
					warning: !isStable ? "Page not fully stable after key press" : undefined,
				};
			}

			case "submit": {
				await page.evaluate((selector) => {
					const element = document.querySelector(selector);
					if (element) {
						if (element instanceof HTMLFormElement) {
							element.submit();
						} else if (element instanceof HTMLElement) {
							element.click();
						}
					}
				}, action.element);
				const isStable = await waitForActionStability(page).catch(() => false);
				return {
					success: true,
					message: "Form submitted",
					warning: !isStable ? "Page not fully stable after submission" : undefined,
				};
			}

			case "print": {
				const results = [];
				for (const selector of action.elements) {
					try {
						debugLog(`Getting HTML for selector: ${selector}`);
						// Get all matching elements
						const elements = await page.$$(selector);
						debugLog(`Found ${elements.length} elements matching ${selector}`);

						for (const element of elements) {
							const html = await element.evaluate(el => el.outerHTML);
							debugLog(`Print HTML result: ${html.substring(0, 100)}...`);
							results.push({ selector, html, type: 'print' as const });
						}
					} catch (_error) {
						debugLog(`Error getting HTML for selector: ${selector} - ${_error instanceof Error ? _error.message : String(_error)}`);
						results.push({ selector, error: "Element not found or inaccessible" });
					}
				}
				return {
					success: results.some((r) => !r.error),
					message: results
							.filter((r) => !r.error)
							.map((r) => `HTML captured for ${r.selector}`)
							.join("\n"),
					warning: results.some((r) => r.error)
							? `Failed to capture some elements: ${results
									.filter((r) => r.error)
									.map((r) => r.selector)
									.join(", ")}`
							: undefined,
					data: results,
				};
			}

			case "markdown": {
				const results = [];
				for (const selector of action.elements) {
					try {
						debugLog(`Getting HTML for selector: ${selector}`);
						// Get all matching elements
						const elements = await page.$$(selector);
						debugLog(`Found ${elements.length} elements matching ${selector}`);
						
						for (const element of elements) {
							const html = await element.evaluate(el => el.outerHTML);
							debugLog(`Converting HTML to Markdown: ${html.substring(0, 100)}...`);
							const markdown = turndownService.turndown(html);
							debugLog(`Markdown result: ${markdown.substring(0, 100)}...`);
							results.push({ selector, html: markdown });
						}
					} catch (_error) {
						debugLog(`Error getting HTML for selector: ${selector} - ${_error instanceof Error ? _error.message : String(_error)}`);
						results.push({ selector, error: "Element not found or inaccessible" });
					}
				}
				return {
					success: results.some((r) => !r.error),
					message: results
						.filter((r) => !r.error)
						.map((r) => `Markdown captured for ${r.selector}`)
						.join("\n"),
					warning: results.some((r) => r.error)
						? `Failed to capture some elements: ${results
								.filter((r) => r.error)
								.map((r) => r.selector)
								.join(", ")}`
						: undefined,
					data: results,
				};
			}

			default: {
				const unknownAction = action as { type: string };
				return {
					success: false,
					message: "Unknown action type",
					error: `Action type ${unknownAction.type} not supported`,
				};
			}
		}
	} catch (error) {
		if (error instanceof Error && error.message.includes("context was destroyed")) {
			// This is expected during navigation, treat it as a warning
			return {
				success: true,
				message: "Action completed",
				warning: "Page navigation occurred",
			};
		}
		return {
			success: false,
			message: "Action failed",
			error: error instanceof Error ? error.message : "Unknown error occurred",
		};
	}
}

export async function executePlan(
	page: Page,
	plan: Plan,
	options: BrowserOptions
): Promise<{
	actionStatuses: ActionStatus[];
	plannedActionResults: PlannedActionResult[];
}> {
	const actionStatuses: ActionStatus[] = [];
	const plannedActionResults: PlannedActionResult[] = [];
	const totalSteps = plan.actions.length;

	for (const [index, action] of plan.actions.entries()) {
		const step = index + 1;
		const symbol = getActionSymbol(action);
		const description = getActionDescription(action);
		const status: ActionStatus = { step, totalSteps, action, symbol, description };

		status.result = await executeAction(page, action, options);

		// Print status and store it
		console.warn(printActionStatus(status));
		actionStatuses.push(status);

		// Collect print and markdown results
		if ((action.type === "print" || action.type === "markdown") && status.result?.data) {
			plannedActionResults.push(...status.result.data);
		}

		// If action failed, stop execution
		if (!status.result?.success) {
			break;
		}
	}

	// Print final summary
	console.warn(printActionSummary(actionStatuses));

	return { actionStatuses, plannedActionResults };
}
