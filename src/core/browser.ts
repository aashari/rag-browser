import { chromium } from "playwright";
import type { PageAnalysis, BrowserOptions, PlannedActionResult, Input } from "../types";
import { DEFAULT_TIMEOUT, LINK_SELECTORS, BUTTON_SELECTORS, INPUT_SELECTORS } from "../config/constants";
import { executePlan } from "./actions";
import { waitForPageStability } from "./stability";
import { getFullPath, checkPageStability, checkLayoutStability } from "./scripts";
import { getElementInfo } from "../utils/element";
import { info, error } from "../utils/logging";
import * as path from "path";
import * as os from "os";
import type { BrowserContext, Cookie, BrowserContextOptions } from 'playwright';

interface StorageState {
	cookies: Array<{
		name: string;
		value: string;
		domain: string;
		path: string;
	}>;
	origins: Array<{
		origin: string;
		localStorage?: Record<string, string>;
		sessionStorage?: Record<string, string>;
	}>;
}

interface BrowserStorageItem {
	name: string;
	value: string;
}

interface BrowserStorageOrigin {
	origin: string;
	localStorage?: BrowserStorageItem[];
	sessionStorage?: BrowserStorageItem[];
}

declare global {
	interface Window {
		getFullPath: (element: Element) => string;
	}
}

// Helper function to get default user data directory
function getDefaultUserDataDir(): string {
	return path.join(os.homedir(), '.playwright-user-data');
}

export async function analyzePage(url: string, options: BrowserOptions): Promise<PageAnalysis> {
	const userDataDir = options.userDataDir || getDefaultUserDataDir();
	let actionSucceeded = false;
	
	// Launch browser with persistent context
	const browser = await chromium.launchPersistentContext(userDataDir, {
		headless: options.headless,
		args: ['--disable-web-security', '--disable-features=IsolateOrigins,site-per-process'],
		bypassCSP: true,
		permissions: ['clipboard-read', 'clipboard-write'],
	});

	const page = await browser.newPage();

	// Handle window.open calls
	await page.addInitScript(() => {
		window.open = function(url) {
			if (url && url !== 'about:blank') {
				window.location.href = url.toString();
			}
			return null;
		};
	});

	// Re-inject utility functions after any navigation
	page.on('framenavigated', async (frame) => {
		if (frame === page.mainFrame()) {
			const frameUrl = frame.url();
			if (frameUrl !== 'about:blank') {
				info(`Navigation to: ${frameUrl}`);
				// Re-inject utility functions after a short delay
				await page.waitForTimeout(500);
				await page.addInitScript(`
					window.getFullPath = ${getFullPath.toString()};
					window.checkPageStability = ${checkPageStability.toString()};
					window.checkLayoutStability = ${checkLayoutStability.toString()};
					window.stabilityScriptsInjected = true;
				`);
			}
		}
	});

	// Intercept new window/tab requests
	await page.addInitScript(() => {
		document.addEventListener('click', (e) => {
			const target = e.target as HTMLElement;
			const link = target.closest('a');
			if (link) {
				const href = link.getAttribute('href');
				if (href && !href.startsWith('javascript:')) {
					e.preventDefault();
					window.location.href = href;
				}
			}
		}, true);
	});

	// Monitor navigation events for debugging
	page.on('framenavigated', async (frame) => {
		if (frame === page.mainFrame()) {
			const frameUrl = frame.url();
			if (frameUrl !== 'about:blank') {
				info(`Navigation to: ${frameUrl}`);
			}
		}
	});

	// Handle any remaining popup attempts
	browser.on('page', async (newPage) => {
		const newUrl = newPage.url();
		if (newUrl && newUrl !== 'about:blank') {
			info(`Intercepted popup: ${newUrl}`);
			try {
				await page.goto(newUrl);
			} catch (err) {
				error(`Failed to navigate to: ${newUrl}`, err);
			}
		}
		await newPage.close().catch(() => {});
	});

	// Track WebSocket connections
	const wsConnections = new Set<string>();
	page.on('websocket', ws => {
		wsConnections.add(ws.url());
		info("WebSocket opened", { url: ws.url() });
		
		ws.on('close', () => {
			wsConnections.delete(ws.url());
			info("WebSocket closed", { url: ws.url() });
		});
	});

	// Monitor network requests
	page.on('request', request => {
		if (request.resourceType() === 'xhr' || request.resourceType() === 'fetch') {
			info("API request", { 
				url: request.url(),
				method: request.method(),
				resourceType: request.resourceType()
			});
		}
	});

	// Handle frames
	page.on('frameattached', async frame => {
		info("Frame attached", { url: frame.url(), name: frame.name() });
		// Wait for frame to load
		await frame.waitForLoadState('domcontentloaded').catch(() => {});
	});

	let plannedActionResults: PlannedActionResult[] = [];

	try {
		// Apply storage state if provided
		if (options.storageState) {
			if (options.storageState.cookies) {
				await page.context().addCookies(options.storageState.cookies);
			}
			
			if (options.storageState.origins) {
				for (const origin of options.storageState.origins) {
					// Set localStorage
					if (origin.localStorage && Object.keys(origin.localStorage).length > 0) {
						await page.route('**/*', async route => {
							await page.evaluate((storage: Record<string, string>) => {
								for (const [key, value] of Object.entries(storage)) {
									window.localStorage.setItem(key, value);
								}
							}, origin.localStorage as Record<string, string>);
							await route.continue();
						});
					}
					
					// Set sessionStorage
					if (origin.sessionStorage && Object.keys(origin.sessionStorage).length > 0) {
						await page.route('**/*', async route => {
							await page.evaluate((storage: Record<string, string>) => {
								for (const [key, value] of Object.entries(storage)) {
									window.sessionStorage.setItem(key, value);
								}
							}, origin.sessionStorage as Record<string, string>);
							await route.continue();
						});
					}
				}
			}
		}

		// Inject utility functions
		await page.addInitScript(`
			window.getFullPath = ${getFullPath.toString()};
			
			// Prevent links from opening in new tabs
			function modifyLinks() {
				// Function to modify a single link
				function modifySingleLink(link) {
					// Remove target and rel attributes
					link.removeAttribute('target');
					link.removeAttribute('rel');
					
					// Remove existing click listeners
					const clone = link.cloneNode(true);
					link.parentNode?.replaceChild(clone, link);
					
					// Add our own click handler
					clone.addEventListener('click', (e) => {
						const href = clone.getAttribute('href');
						if (href && !href.startsWith('javascript:')) {
							e.preventDefault();
							e.stopPropagation();
							window.location.href = href;
						}
					}, true);  // Use capture to handle event before other listeners
				}

				// Process all links immediately
				document.querySelectorAll('a').forEach(modifySingleLink);

				// Override window.open
				const originalOpen = window.open;
				window.open = function(url, target, features) {
					if (url) {
						window.location.href = url;
						return null;
					}
					return originalOpen.call(window, url, '_self', features);
				};

				// Watch for new links and modify them
				const observer = new MutationObserver(mutations => {
					mutations.forEach(mutation => {
						// Handle added nodes
						mutation.addedNodes.forEach(node => {
							if (node.nodeType === 1) { // ELEMENT_NODE
								const element = node as Element;
								// Check the added node itself
								if (element.tagName === 'A') {
									modifySingleLink(element);
								}
								// Check children of added node
								element.querySelectorAll('a').forEach(modifySingleLink);
							}
						});

						// Also check modified attributes
						if (mutation.type === 'attributes' && 
							mutation.target.nodeType === 1 &&
							(mutation.target as Element).tagName === 'A') {
							modifySingleLink(mutation.target as HTMLAnchorElement);
						}
					});
				});

				observer.observe(document.body, {
					childList: true,
					subtree: true,
					attributes: true,
					attributeFilter: ['target', 'href', 'rel']
				});

				// Override Ctrl/Cmd + Click behavior
				document.addEventListener('click', (e) => {
					if (e.ctrlKey || e.metaKey) {
						const link = (e.target as Element).closest('a');
						if (link) {
							e.preventDefault();
							e.stopPropagation();
							const href = link.getAttribute('href');
							if (href) {
								window.location.href = href;
							}
						}
					}
				}, true);

				// Generic link handler for all sites
				document.addEventListener('click', (e) => {
					const link = (e.target as Element).closest('a');
					if (link && !link.getAttribute('href')?.startsWith('javascript:')) {
						e.preventDefault();
						e.stopPropagation();
						const href = link.getAttribute('href');
						if (href) {
							window.location.href = href;
						}
					}
				}, true);
			}

			// Run immediately and after any navigation
			modifyLinks();
			document.addEventListener('DOMContentLoaded', modifyLinks);
		`);

		info("Starting navigation", { url, options });
		await page.goto(url, { waitUntil: "domcontentloaded", timeout: DEFAULT_TIMEOUT });
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
			const { plannedActionResults: results, actionStatuses } = await executePlan(page, options.plan, {
				...options,
				// Pass the infinite wait timeout only to the action execution
				timeout: options.timeout
			});
			plannedActionResults = results;
			actionSucceeded = actionStatuses.every(status => status.result?.success);
			info("Action plan execution complete", { results });
		}

		// Re-inject utility functions after navigation
		await page.addInitScript(`
			window.getFullPath = ${getFullPath.toString()};
			
			// Re-run link modification after navigation
			if (typeof modifyLinks === 'function') {
				modifyLinks();
			}
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
		// Still return partial analysis if available
		let partialInputs: Input[] = [];
		try {
			const inputElements = await page.$$(INPUT_SELECTORS);
			partialInputs = await Promise.all(inputElements.map((element) => getElementInfo(page, element)));
		} catch (e) {
			error("Failed to get inputs in error handler", { error: e instanceof Error ? e.message : String(e) });
		}
		return {
			title: await page.title().catch(() => "Unknown Title"),
			inputs: partialInputs,
			buttons: [],
			links: [],
			plannedActions: plannedActionResults.length > 0 ? plannedActionResults : undefined,
			error: err instanceof Error ? err.message : String(err)
		};
	} finally {
		// Always show analysis summary before closing
		try {
			const finalUrl = page.url();
			info("Final URL before closing", { url: finalUrl });
			
			// Log final state summary
			info("Final execution state", {
				url: finalUrl,
				actionSucceeded,
				plannedActionsCount: plannedActionResults.length,
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
					const processedOrigin: StorageState['origins'][0] = {
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
			} catch (err) {
				error("Error in cleanup", { error: err instanceof Error ? err.message : String(err) });
			}
		}
	}
}
