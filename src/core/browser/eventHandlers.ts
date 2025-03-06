import type { Page } from "playwright";
import { info, error } from "../../utils/logging";
import { getFullPath, checkPageStability, checkLayoutStability } from "../scripts";

export function setupEventHandlers(page: Page) {
	// Handle window.open calls
	page.addInitScript(() => {
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
	page.addInitScript(() => {
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
		await frame.waitForLoadState('domcontentloaded').catch(() => {});
	});
} 