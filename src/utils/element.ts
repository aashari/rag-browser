import type { Page, ElementHandle } from "playwright";
import type { Input } from "../types";

export interface ElementInfo {
	tagName: string;
	id?: string;
	className?: string;
	selector: string;
	attributes: Record<string, string>;
	isVisible: boolean;
}

export function isElementVisible(element: HTMLElement): boolean {
	const style = window.getComputedStyle(element);
	if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
		return false;
	}
	if (element.parentElement) {
		return isElementVisible(element.parentElement);
	}
	return true;
}

export async function getElementInfo(page: Page, element: ElementHandle<Element>): Promise<Input> {
	const info = await element.evaluate((el: Element) => {
		const htmlElement = el as HTMLElement;

		// Get the full path using a local function
		function getElementPath(element: Element): string {
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

		// Check if element is visible
		const isVisible = (element: Element): boolean => {
			const style = window.getComputedStyle(element);
			if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
				return false;
			}
			if (element.parentElement) {
				return isVisible(element.parentElement);
			}
			return true;
		};

		let label = "";

		if (htmlElement.id) {
			const explicitLabel = document.querySelector(`label[for="${htmlElement.id}"]`)?.textContent?.trim();
			if (explicitLabel) label = explicitLabel;
		}
		if (!label) {
			label =
				htmlElement.getAttribute("aria-label") ||
				htmlElement
					.getAttribute("aria-labelledby")
					?.split(" ")
					.map((id: string) => document.getElementById(id)?.textContent?.trim())
					.filter(Boolean)
					.join(" ") ||
				"";
		}
		if (!label) {
			const parentWithLabel = htmlElement.closest("[aria-label]");
			if (parentWithLabel) {
				label = parentWithLabel.getAttribute("aria-label") || "";
			}
		}
		if (!label) {
			label =
				htmlElement.getAttribute("placeholder") ||
				htmlElement.getAttribute("data-placeholder") ||
				htmlElement.getAttribute("aria-placeholder") ||
				"";
		}
		if (!label && htmlElement.getAttribute("contenteditable") === "true") {
			label = htmlElement.textContent?.trim() || "";
		}
		if (!label) {
			const previousText = htmlElement.previousElementSibling?.textContent?.trim();
			const parentStartText = htmlElement.parentElement?.firstChild?.textContent?.trim();
			label = previousText || parentStartText || "";
		}
		if (!label) {
			label =
				htmlElement.getAttribute("name") || htmlElement.id || htmlElement.getAttribute("role") || "No label";
		}
		
		return {
			type: htmlElement.tagName.toLowerCase(),
			name: htmlElement.getAttribute("name") || "",
			id: htmlElement.id || "",
			value: (htmlElement as HTMLInputElement).value || "",
			placeholder: htmlElement.getAttribute("placeholder") || "",
			selector: getElementPath(htmlElement),
			label,
			isVisible: isVisible(htmlElement),
		};
	});
	return info;
}

/**
 * Get a full CSS selector path for an element
 */
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

/**
 * Extract basic information from an HTML element
 */
export function extractElementInfo(htmlElement: HTMLElement): ElementInfo {
	// Get all attributes
	const attributes: Record<string, string> = {};
	for (let i = 0; i < htmlElement.attributes.length; i++) {
		const attr = htmlElement.attributes[i];
		attributes[attr.name] = attr.value;
	}

	return {
		tagName: htmlElement.tagName.toLowerCase(),
		id: htmlElement.id || undefined,
		className: htmlElement.className || undefined,
		selector: getFullPath(htmlElement),
		attributes,
		isVisible: isElementVisible(htmlElement)
	};
}
