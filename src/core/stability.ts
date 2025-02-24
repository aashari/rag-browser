import type { Page, ElementHandle } from "playwright";
import {
	DEFAULT_TIMEOUT,
	LOADING_INDICATORS,
	MUTATION_STABILITY_TIMEOUT,
	LAYOUT_STABILITY_TIMEOUT,
	ACTION_STABILITY_TIMEOUT,
	MUTATION_CHECK_INTERVAL,
	NETWORK_IDLE_TIMEOUT,
} from "../config/constants";
import { getFullPath, checkPageStability, checkLayoutStability } from "./scripts";
import { debug, info, warn, error } from "../utils/logging";

declare global {
	interface Window {
		getFullPath: (element: Element) => string;
		checkPageStability: (mutationTimeout: number) => Promise<boolean>;
		checkLayoutStability: (layoutTimeout: number) => Promise<boolean>;
		stabilityScriptsInjected?: boolean;
	}
}

async function injectStabilityScripts(page: Page): Promise<void> {
	try {
		debug("Injecting stability scripts");
		await page.waitForLoadState("domcontentloaded").catch(() => {
			warn("domcontentloaded wait failed");
		});

		const isInjected = await page
			.evaluate(() => {
				return (
					window.stabilityScriptsInjected === true &&
					typeof window.getFullPath === "function" &&
					typeof window.checkPageStability === "function" &&
					typeof window.checkLayoutStability === "function"
				);
			})
			.catch(() => false);

		if (isInjected) {
			debug("Scripts already injected and verified, skipping");
			return;
		}

		// Inject each function separately to ensure proper evaluation
		await page
			.evaluate(
				`
      window.getFullPath = ${getFullPath.toString()};
      window.checkPageStability = ${checkPageStability.toString()};
      window.checkLayoutStability = ${checkLayoutStability.toString()};
      window.stabilityScriptsInjected = true;
      console.warn('Scripts injected successfully');
    `
			)
			.catch((err) => {
				throw new Error(`Failed to inject scripts: ${err instanceof Error ? err.message : String(err)}`);
			});

		// Verify injection
		const verified = await page
			.evaluate(() => {
				return (
					typeof window.getFullPath === "function" &&
					typeof window.checkPageStability === "function" &&
					typeof window.checkLayoutStability === "function"
				);
			})
			.catch(() => false);

		if (!verified) {
			throw new Error("Script injection verification failed");
		}

		info("Stability scripts injection complete and verified");
	} catch (err) {
		error("Error injecting stability scripts", { error: err instanceof Error ? err.message : String(err) });
		throw err;
	}
}

export async function waitForPageStability(
	page: Page,
	options: { 
		timeout?: number; 
		expectNavigation?: boolean;
		abortSignal?: AbortSignal;
	} = {}
): Promise<boolean> {
	const startTime = Date.now();
	const timeout = options.timeout || DEFAULT_TIMEOUT;
	debug("Starting page stability check", { timeout });

	try {
		// Wait for initial load state with a shorter timeout
		await Promise.race([
			page.waitForLoadState("domcontentloaded"),
			new Promise((resolve) => setTimeout(resolve, NETWORK_IDLE_TIMEOUT)),
		]).catch(() => {
			warn("Initial domcontentloaded wait failed");
		});

		// Check for abort before continuing
		if (options.abortSignal?.aborted) {
			throw new Error("Stability check aborted");
		}

		// Try to inject scripts, but continue even if it fails
		try {
			await injectStabilityScripts(page);
		} catch (err) {
			warn("Failed to inject stability scripts, will use basic stability check", {
				error: err instanceof Error ? err.message : String(err),
			});
			await page.waitForTimeout(NETWORK_IDLE_TIMEOUT);
			return true;
		}

		// Check if we're on a known dynamic app
		let isKnownDynamicApp = false;
		try {
			const url = page.url();
			// Use generic detection based on WebSocket connections and dynamic content
			isKnownDynamicApp = await page.evaluate(() => {
				return window.WebSocket !== undefined && 
					   document.querySelector('[data-testid], [role="application"], [role="main"]') !== null;
			});
		} catch (err) {
			warn("Failed to check dynamic app status", { error: err instanceof Error ? err.message : String(err) });
		}

		// For dynamic apps, we only need basic DOM readiness
		if (isKnownDynamicApp) {
			debug("Dynamic app detected, using simplified stability check");
			try {
				// Wait for basic DOM readiness
				await page.waitForFunction(() => {
					return document.readyState === 'complete' && 
						   document.body !== null &&
						   document.body.children.length > 0;
				}, { timeout: NETWORK_IDLE_TIMEOUT });
				
				// Short delay to allow initial content to load
				await page.waitForTimeout(1000);
				
				debug("Dynamic app basic stability confirmed");
				return true;
			} catch (err) {
				warn("Dynamic app stability check failed", { 
					error: err instanceof Error ? err.message : String(err) 
				});
				return true;
			}
		}

		// Regular stability check for non-dynamic apps
		let checkCount = 0;
		let lastLoadingIndicatorCount = -1;
		let consecutiveStableChecks = 0;
		let navigationTimeout = false;

		// Set a navigation timeout
		const navigationTimer = setTimeout(() => {
			navigationTimeout = true;
			warn("Navigation timeout reached", { duration: Date.now() - startTime });
		}, timeout);

		while (Date.now() - startTime < timeout && !options.abortSignal?.aborted && !navigationTimeout) {
			checkCount++;
			debug("Stability check iteration", { iteration: checkCount });

			try {
				// Check if we're still on the same page
				let currentUrl = '';
				try {
					currentUrl = await page.url();
				} catch {
					warn("Page context lost during stability check");
					break;
				}

				await page
					.waitForLoadState("networkidle", { timeout: NETWORK_IDLE_TIMEOUT })
					.catch(() => warn("Network not idle"));

				const loadingIndicators = await page.$$(LOADING_INDICATORS).catch(() => []);
				const currentLoadingCount = loadingIndicators.length;

				if (currentLoadingCount !== lastLoadingIndicatorCount) {
					lastLoadingIndicatorCount = currentLoadingCount;
					consecutiveStableChecks = 0;
					await page.waitForTimeout(MUTATION_CHECK_INTERVAL);
					continue;
				}

				if (currentLoadingCount === 0) {
					debug("Checking page stability");
					const isStable = await page
						.evaluate((timeout) => {
							return window.checkPageStability?.(timeout) ?? true;
						}, MUTATION_STABILITY_TIMEOUT)
						.catch((err) => {
							warn("Error in stability check", {
								error: err instanceof Error ? err.message : String(err),
							});
							return true;
						});

					if (isStable) {
						consecutiveStableChecks++;
						debug("Page reported as stable", { consecutiveChecks: consecutiveStableChecks });
						if (consecutiveStableChecks >= 2) {
							clearTimeout(navigationTimer);
							return true;
						}
					} else {
						consecutiveStableChecks = 0;
						debug("Page not yet stable");
					}
				}
			} catch (err) {
				if (err instanceof Error &&
					(err.message.includes("Target closed") || err.message.includes("context was destroyed"))) {
					debug("Page context destroyed", { error: err.message });
					if (options.expectNavigation) {
						clearTimeout(navigationTimer);
						return true;
					}
					throw err;
				}
				warn("Error during stability check", { error: err instanceof Error ? err.message : String(err) });
				await page.waitForTimeout(MUTATION_CHECK_INTERVAL);
			}
			await page.waitForTimeout(MUTATION_CHECK_INTERVAL);
		}

		clearTimeout(navigationTimer);

		if (options.abortSignal?.aborted) {
			debug("Stability check aborted");
		} else if (navigationTimeout) {
			warn("Navigation timeout reached", { duration: Date.now() - startTime });
		} else {
			warn("Stability check timed out", { duration: Date.now() - startTime });
		}
		return true;
	} catch (err) {
		error("Fatal error in stability check", { error: err instanceof Error ? err.message : String(err) });
		return true;
	}
}

export async function waitForActionStability(
	page: Page,
	options: { 
		timeout?: number; 
		expectNavigation?: boolean;
		abortSignal?: AbortSignal;
	} = {}
): Promise<boolean> {
	const timeout = options.timeout || ACTION_STABILITY_TIMEOUT;
	const startTime = Date.now();

	if (options.expectNavigation) {
		try {
			await page.waitForLoadState("networkidle", { timeout });
			return true;
		} catch (err) {
			if (
				err instanceof Error &&
				(err.message.includes("Target closed") || err.message.includes("context was destroyed"))
			) {
				return true;
			}
			warn("Network not idle after navigation, continuing anyway");
			return true;
		}
	}

	try {
		await injectStabilityScripts(page);
	} catch (err) {
		warn("Failed to inject stability scripts for action check", {
			error: err instanceof Error ? err.message : String(err),
		});
		return true;
	}

	let consecutiveStableChecks = 0;
	let lastContent = "";

	while (Date.now() - startTime < timeout && !options.abortSignal?.aborted) {
		try {
			// Check layout stability
			const isLayoutStable = await page
				.evaluate((timeout) => {
					return window.checkLayoutStability?.(timeout) ?? true;
				}, LAYOUT_STABILITY_TIMEOUT)
				.catch(() => true);

			// Check for loading indicators
			const loadingIndicators = await page.$$(LOADING_INDICATORS).catch(() => []);

			// Get current content for comparison
			const currentContent = await page
				.evaluate(() => {
					const observer = new MutationObserver(() => {});
					observer.observe(document.body, {
						childList: true,
						subtree: true,
						characterData: true,
					});
					const content = document.body.textContent || "";
					observer.disconnect();
					return content;
				})
				.catch(() => "");

			if (isLayoutStable && loadingIndicators.length === 0 && currentContent === lastContent) {
				consecutiveStableChecks++;
				if (consecutiveStableChecks >= 2) {
					return true;
				}
			} else {
				consecutiveStableChecks = 0;
				lastContent = currentContent;
			}
		} catch (err) {
			if (
				err instanceof Error &&
				(err.message.includes("Target closed") || err.message.includes("context was destroyed"))
			) {
				debug("Context destroyed during stability check, likely due to navigation");
				return true;
			}
			warn("Error during action stability check", { error: err instanceof Error ? err.message : String(err) });
		}
		await page.waitForTimeout(MUTATION_CHECK_INTERVAL);
	}

	if (options.abortSignal?.aborted) {
		debug("Action stability check aborted");
	} else {
		warn("Action stability check timed out", { duration: Date.now() - startTime });
	}
	return true;
}

export async function waitForSearchInput(
	page: Page,
	selector: string,
	options: { timeout?: number } = {}
): Promise<ElementHandle<SVGElement | HTMLElement> | null> {
	const timeout = options.timeout || DEFAULT_TIMEOUT;
	try {
		// First try to find the input directly
		const input = await page.waitForSelector(selector, { timeout: NETWORK_IDLE_TIMEOUT, state: "visible" });
		if (input) return input;
	} catch {
		// If not found, look for a search button/container that might reveal the input
		const searchTriggers = [
			".search-input-container button",
			'[aria-label="Search"]',
			'[aria-label="Search or jump to..."]',
		];

		for (const trigger of searchTriggers) {
			try {
				const searchButton = await page.waitForSelector(trigger, {
					timeout: NETWORK_IDLE_TIMEOUT,
					state: "visible",
				});
				if (searchButton) {
					await searchButton.click();
					// After clicking, wait for the actual input to appear
					return await page.waitForSelector(selector, { timeout: timeout - 2000, state: "visible" });
				}
			} catch {
				continue;
			}
		}
	}
	throw new Error(`Could not find search input with selector: ${selector}`);
}
