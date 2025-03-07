export function getFullPath(element: Element): string {
	if (!element || element.nodeType !== Node.ELEMENT_NODE) {
		return "";
	}

	let current = element;
	const path = [];

	while (current) {
		let selector = current.tagName.toLowerCase();

		if (current instanceof HTMLElement && current.id) {
			selector += `#${current.id}`;
			path.unshift(selector);
			break;
		}

		let nth = 1;
		let sibling = current.previousElementSibling;

		while (sibling) {
			if (sibling.tagName === current.tagName) {
				nth++;
			}
			sibling = sibling.previousElementSibling;
		}

		if (nth > 1) {
			selector += `:nth-of-type(${nth})`;
		}

		path.unshift(selector);
		current = current.parentElement as Element;
	}

	return path.join(" > ");
}

export function checkPageStability(): boolean {
	try {
		console.warn("[Stability] Starting page stability check...");
		let significantMutations = 0;

		// Check for mutations over a short period
		console.warn("[Stability] Setting up mutation observer");
		const observer = new MutationObserver((mutations) => {
			console.warn(`[Stability] Observed ${mutations.length} mutations`);
			for (const mutation of mutations) {
				// Ignore style and class changes
				if (
					mutation.type === "attributes" &&
					(mutation.attributeName === "style" || mutation.attributeName === "class")
				) {
					console.warn(`[Stability] Ignoring style/class change on ${mutation.target.nodeName}`);
					continue;
				}

				// Ignore changes to hidden elements
				const target = mutation.target as HTMLElement;
				if (target.offsetParent === null) {
					console.warn(`[Stability] Ignoring change to hidden element ${target.nodeName}`);
					continue;
				}

				significantMutations++;
				console.warn(`[Stability] Significant mutation: ${mutation.type} on ${mutation.target.nodeName}`);
			}
		});

		console.warn("[Stability] Starting observation of DOM");
		observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			characterData: true,
		});

		// Wait 100ms to collect mutations
		console.warn("[Stability] Waiting 100ms to collect mutations");
		setTimeout(() => {
			observer.disconnect();
			console.warn(`[Stability] Observation complete, found ${significantMutations} significant mutations`);
		}, 100);

		// Return result based on mutations
		if (significantMutations > 0) {
			console.warn(`[Stability] Page has ${significantMutations} significant mutations`);
			return false;
		}

		console.warn("[Stability] Page appears stable");
		return true;
	} catch (error) {
		console.error("[Stability] Error in stability check:", error);
		return true; // Return true on error to allow the process to continue
	}
}

// Type definition for LayoutShift entries
interface LayoutShift extends PerformanceEntry {
	hadRecentInput: boolean;
	value: number;
}

export function checkLayoutStability(): boolean {
	try {
		console.warn("[Stability] Starting layout stability check...");
		let significantShifts = 0;
		const SHIFT_THRESHOLD = 0.05; // Only count larger shifts

		// Check for layout shifts
		console.warn("[Stability] Setting up PerformanceObserver for layout shifts");
		const observer = new PerformanceObserver((list) => {
			console.warn(`[Stability] Observed ${list.getEntries().length} performance entries`);
			for (const entry of list.getEntries()) {
				const layoutShift = entry as LayoutShift;
				if (
					entry.entryType === "layout-shift" &&
					!layoutShift.hadRecentInput &&
					layoutShift.value > SHIFT_THRESHOLD
				) {
					significantShifts++;
					console.warn(`[Stability] Significant layout shift: ${layoutShift.value}`);
				}
			}
		});

		// Start observing layout shifts
		console.warn("[Stability] Checking if layout-shift observation is supported");
		if (PerformanceObserver.supportedEntryTypes?.includes('layout-shift')) {
			console.warn("[Stability] layout-shift observation is supported, starting observation");
			observer.observe({ entryTypes: ["layout-shift"] });
			
			// Disconnect after a short period
			console.warn("[Stability] Will disconnect observer after 100ms");
			setTimeout(() => {
				observer.disconnect();
				console.warn("[Stability] PerformanceObserver disconnected");
			}, 100);
		} else {
			console.warn("[Stability] layout-shift observation is NOT supported");
		}

		// Check critical images
		console.warn("[Stability] Checking for critical images");
		const criticalImages = Array.from(document.querySelectorAll("img")).filter((img) => {
			const rect = img.getBoundingClientRect();
			return rect.top < window.innerHeight && rect.left < window.innerWidth;
		});
		console.warn(`[Stability] Found ${criticalImages.length} critical images`);

		for (const img of criticalImages) {
			if (!img.complete) {
				significantShifts++;
				console.warn(`[Stability] Critical image loading: ${img.src}`);
			}
		}

		// Return result based on shifts
		if (significantShifts > 0) {
			console.warn(`[Stability] Layout has ${significantShifts} significant shifts`);
			return false;
		}

		console.warn("[Stability] Layout appears stable");
		return true;
	} catch (error) {
		console.error("[Stability] Error in layout stability check:", error);
		return true; // Return true on error to allow the process to continue
	}
}
