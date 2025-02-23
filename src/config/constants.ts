export const DEBUG = true; // Toggle debug logging (set to true for verbose output)

export const DEFAULT_TIMEOUT = 30000;
export const STABILITY_DELAY = 500;
export const NETWORK_QUIET_PERIOD = 500;
export const NETWORK_IDLE_TIMEOUT = 500; // ms for network idle wait
export const LAYOUT_CHECK_INTERVAL = 50; // ms between layout stability checks
export const MUTATION_CHECK_INTERVAL = 50; // ms between mutation checks (renamed from STABILITY_CHECK_INTERVAL)
export const VISIBLE_MODE_SLOW_MO = 50;

// Stability timeouts
export const MUTATION_STABILITY_TIMEOUT = 300; // ms to wait for no mutations
export const LAYOUT_STABILITY_TIMEOUT = 200; // ms to wait for no layout shifts
export const ACTION_STABILITY_TIMEOUT = 2000; // ms timeout for action stability
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
export const LOADING_INDICATORS = '[aria-busy="true"], [class*="loading"], [id*="loading"]';
export const INPUT_SELECTORS =
	'input, textarea, select, [role="textbox"], [role="searchbox"], [role="combobox"], [contenteditable="true"], .QueryBuilder-Input';
export const BUTTON_SELECTORS = 'button, [role="button"]';
export const LINK_SELECTORS = "a[href]";
