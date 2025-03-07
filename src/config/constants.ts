export const DEBUG = false; // Toggle debug logging (set to false by default, use --debug flag to enable)

export const DEFAULT_TIMEOUT = 30000;
export const STABILITY_DELAY = 500;
export const NETWORK_QUIET_PERIOD = 500;
export const NETWORK_IDLE_TIMEOUT = 1000; // Increased to 1s to allow for more network activity
export const LAYOUT_CHECK_INTERVAL = 50; // ms between layout stability checks
export const MUTATION_CHECK_INTERVAL = 100; // Increased to reduce check frequency
export const VISIBLE_MODE_SLOW_MO = 100; // Increased from 50 to 100 for better visibility

// Stability timeouts
export const MUTATION_STABILITY_TIMEOUT = 500; // Increased to allow for more mutations
export const LAYOUT_STABILITY_TIMEOUT = 300; // Increased to allow for more layout shifts
export const ACTION_STABILITY_TIMEOUT = 3000; // Increased for dynamic apps
export const CONTENT_STABILITY_TIMEOUT = 5000; // Timeout for content stability checks
export const DEFAULT_TYPING_DELAY = 50; // ms delay between keystrokes

// Selector generation
export const MAX_CLASS_LENGTH = 30;
export const UTILITY_CLASS_PATTERNS = [
	/^flex-/,
	/^items-/,
	/^justify-/,
	/^gap-/,
	/^text-/,
	/^bg-/,
	/^hover:/,
	/^focus:/,
	/^w-/,
	/^h-/,
	/^p-\d/,
	/^m-\d/,
	/^border-/,
	/^rounded-/,
];

// Element queries
export const LOADING_INDICATORS = '[aria-busy="true"]:not([role="progressbar"]), [class*="loading-spinner"], [id*="loading-spinner"]';
export const INPUT_SELECTORS =
	'input, textarea, select, [role="textbox"], [role="searchbox"], [role="combobox"], [contenteditable="true"], .QueryBuilder-Input';
export const BUTTON_SELECTORS = 'button, [role="button"]';
export const LINK_SELECTORS = "a[href]";
