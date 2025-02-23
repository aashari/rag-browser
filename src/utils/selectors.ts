import { MAX_CLASS_LENGTH, UTILITY_CLASS_PATTERNS } from "../config/constants";
import { debug } from "../utils/logging";

export function getMeaningfulClasses(classList: DOMTokenList): string[] {
	const classes = Array.from(classList);
	debug("Processing element classes", { classes });

	return classes.filter((cls) => {
		// Skip empty or whitespace-only classes
		if (!cls || !cls.trim()) {
			debug("Skipping empty class", { class: cls });
			return false;
		}

		// Skip classes with special characters
		if (cls.includes(":") || cls.includes("/") || cls.includes("[") || cls.includes("@")) {
			debug("Skipping special char class", { class: cls });
			return false;
		}

		// Skip utility classes (check each pattern independently)
		for (const pattern of UTILITY_CLASS_PATTERNS) {
			if (pattern.test(cls)) {
				debug("Skipping utility class", { class: cls, pattern: pattern.toString() });
				return false;
			}
		}

		// Skip long class names
		if (cls.length >= MAX_CLASS_LENGTH) {
			debug("Skipping long class", { class: cls, length: cls.length });
			return false;
		}

		debug("Keeping meaningful class", { class: cls });
		return true;
	});
}

export function getUniqueSelector(el: Element, includePosition = false): string {
	let selector = el.tagName.toLowerCase();
	debug("Building selector", { element: selector });

	// Add meaningful classes
	const classes = getMeaningfulClasses(el.classList);
	if (classes.length) {
		selector += `.${classes.join(".")}`;
		debug("Added classes to selector", { selector });
	}

	// Add type for inputs
	if (el.tagName.toLowerCase() === "input") {
		const type = el.getAttribute("type");
		if (type) {
			selector += `[type="${type}"]`;
			debug("Added input type to selector", { selector });
		}
	}

	// Add role if present and meaningful
	const role = el.getAttribute("role");
	if (role && role !== "button") {
		selector += `[role="${role}"]`;
		debug("Added role to selector", { selector });
	}

	// Add name if present
	const name = el.getAttribute("name");
	if (name) {
		selector += `[name="${name}"]`;
		debug("Added name to selector", { selector });
	}

	// Add aria-label if it's short and meaningful
	const ariaLabel = el.getAttribute("aria-label");
	if (ariaLabel && ariaLabel.length < MAX_CLASS_LENGTH) {
		selector += `[aria-label="${ariaLabel}"]`;
		debug("Added aria-label to selector", { selector });
	}

	// Add position if needed
	if (includePosition) {
		const parent = el.parentElement;
		if (parent) {
			const siblings = Array.from(parent.children).filter((child) => child.tagName === el.tagName);
			if (siblings.length > 1) {
				const index = siblings.indexOf(el) + 1;
				selector += `:nth-of-type(${index})`;
				debug("Added position to selector", { selector, position: index });
			}
		}
	}

	debug("Final selector generated", { selector });
	return selector;
}
