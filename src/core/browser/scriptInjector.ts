import type { Page } from "playwright";
import { getFullPath, checkPageStability, checkLayoutStability } from "../scripts";

// Inject utility functions for page analysis
export async function injectUtilityScripts(page: Page) {
	await page.addInitScript(`
		window.getFullPath = ${getFullPath.toString()};
		window.checkPageStability = ${checkPageStability.toString()};
		window.checkLayoutStability = ${checkLayoutStability.toString()};
		window.stabilityScriptsInjected = true;
	`);
}

// Inject link modification scripts to prevent new tabs/windows
export async function injectLinkModifiers(page: Page) {
	await page.addInitScript(`
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
				});
			});

			// Start observing document
			observer.observe(document.body, {
				childList: true,
				subtree: true
			});
		}

		// Execute modifyLinks immediately 
		modifyLinks();
	`);
} 