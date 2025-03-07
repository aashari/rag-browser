import type { Page } from "playwright";
import type { StorageState } from "../../types";
import { warn } from "../../utils/logging";

/**
 * Apply storage state to the browser context
 * This only applies cookies and doesn't modify the page
 */
export async function applyStorageState(page: Page, storageState: StorageState) {
	try {
		// Only apply cookies, which doesn't require page modification
		if (storageState.cookies && storageState.cookies.length > 0) {
			await page.context().addCookies(storageState.cookies);
		}
		
		// Note: localStorage and sessionStorage are not applied
		// as they would require page modification
	} catch (err) {
		warn("Error applying storage state", { error: err instanceof Error ? err.message : String(err) });
	}
} 