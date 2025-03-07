import type { Page, ElementHandle } from "playwright";
import type { Input } from "../types";
import { debug } from "../utils/logging";

export interface ElementInfo {
	tagName: string;
	id?: string;
	className?: string;
	selector: string;
	attributes: Record<string, string>;
	isVisible: boolean;
}

// Cache for element information to avoid recalculating for the same elements
const elementInfoCache = new Map<string, any>();

/**
 * Generates a cache key for an element based on its properties
 */
export function generateCacheKey(element: any): string {
	try {
		return `${element.tagName || ''}_${element.id || ''}_${element.className || ''}_${element.name || ''}_${element.type || ''}`;
	} catch (error) {
		return Math.random().toString(36).substring(7); // Fallback to random key if properties can't be accessed
	}
}

/**
 * Extracts basic information from an HTML element
 */
export function extractElementInfo(element: any): any {
	if (!element) return null;
	
	const tagName = element.tagName?.toLowerCase();
	const id = element.id || '';
	const className = element.className || '';
	const attributes: Record<string, string> = {};
	
	// Extract attributes
	if (element.attributes) {
		for (let i = 0; i < element.attributes.length; i++) {
			const attr = element.attributes[i];
			attributes[attr.name] = attr.value;
		}
	}
	
	// Check visibility
	const isVisible = (() => {
		const style = window.getComputedStyle(element);
		return style.display !== 'none' && 
			   style.visibility !== 'hidden' && 
			   style.opacity !== '0' &&
			   element.offsetWidth > 0 &&
			   element.offsetHeight > 0;
	})();
	
	// Get position
	const rect = element.getBoundingClientRect();
	const position = {
		x: rect.left,
		y: rect.top,
		width: rect.width,
		height: rect.height
	};
	
	return {
		tagName,
		id,
		className,
		attributes,
		isVisible,
		position
	};
}

/**
 * Gets information about an element
 */
export async function getElementInfo(page: any, element: any): Promise<any> {
	const startTime = new Date().getTime();
	debug('Starting getElementInfo', { timestamp: new Date().toISOString() });
	
	try {
		// Generate cache key
		const cacheKey = await page.evaluate((el: any) => {
			return `${el.tagName || ''}_${el.id || ''}_${el.className || ''}_${el.name || ''}_${el.type || ''}`;
		}, element);
		
		// Check cache
		if (elementInfoCache.has(cacheKey)) {
			const cachedInfo = elementInfoCache.get(cacheKey);
			debug('Completed getElementInfo (cached)', { 
				timestamp: new Date().toISOString(),
				duration: new Date().getTime() - startTime,
				elementType: cachedInfo.tagName
			});
			return cachedInfo;
		}
		
		// Extract all information in a single evaluate call to reduce overhead
		const info = await page.evaluate((el: HTMLElement) => {
			// Check if element is valid
			if (!el || !el.tagName) {
				return { error: 'Invalid element' };
			}
			
			try {
				const tagName = el.tagName.toLowerCase();
				const id = el.id || '';
				const className = el.className || '';
				const name = (el as any).name || '';
				const type = (el as any).type || '';
				const value = (el as any).value || '';
				const text = el.textContent?.trim() || '';
				const placeholder = (el as any).placeholder || '';
				const href = (el as any).href || '';
				
				// Check visibility
				const style = window.getComputedStyle(el);
				const isVisible = style.display !== 'none' && 
								 style.visibility !== 'hidden' && 
								 style.opacity !== '0' &&
								 el.offsetWidth > 0 &&
								 el.offsetHeight > 0;
				
				// Get position
				const rect = el.getBoundingClientRect();
				const position = {
					x: rect.left,
					y: rect.top,
					width: rect.width,
					height: rect.height
				};
				
				// Extract attributes
				const attributes: Record<string, string> = {};
				if (el.attributes) {
					for (let i = 0; i < el.attributes.length; i++) {
						const attr = el.attributes[i];
						attributes[attr.name] = attr.value;
					}
				}
				
				return {
					tagName,
					id,
					className,
					name,
					type,
					value,
					text,
					placeholder,
					href,
					isVisible,
					position,
					attributes
				};
			} catch (error) {
				return { error: String(error) };
			}
		}, element);
		
		// Add selector only if element is visible to save processing time
		if (info.isVisible) {
			try {
				// We'll add the selector separately if needed
			} catch (error) {
				// Ignore selector errors
			}
		}
		
		// Cache the result
		elementInfoCache.set(cacheKey, info);
		
		debug('Completed getElementInfo', { 
			timestamp: new Date().toISOString(),
			duration: new Date().getTime() - startTime,
			elementType: info.tagName
		});
		
		return info;
	} catch (error) {
		debug('Error in getElementInfo', { 
			timestamp: new Date().toISOString(),
			duration: new Date().getTime() - startTime,
			error: String(error)
		});
		
		// Return minimal info in case of error
		return {
			error: String(error),
			isVisible: false
		};
	}
}

/**
 * Gets the full path to an element
 */
export function getFullPath(element: Element): string {
	if (!element || !(element instanceof Element)) {
		return '';
	}
	
	const path = [];
	let current = element;
	
	while (current && current.nodeType === Node.ELEMENT_NODE) {
		let selector = current.nodeName.toLowerCase();
		
		if (current.id) {
			selector += `#${current.id}`;
			path.unshift(selector);
			break;
		} else {
			let sibling = current;
			let nth = 1;
			
			while (sibling = sibling.previousElementSibling as Element) {
				if (sibling.nodeName.toLowerCase() === selector) {
					nth++;
				}
			}
			
			if (nth !== 1) {
				selector += `:nth-of-type(${nth})`;
			}
		}
		
		path.unshift(selector);
		current = current.parentNode as Element;
	}
	
	return path.join(' > ');
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
