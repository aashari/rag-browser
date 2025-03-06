import type { Page } from "playwright";
import type { StorageState } from "../../types";

export async function applyStorageState(page: Page, storageState: StorageState) {
	if (storageState.cookies && storageState.cookies.length > 0) {
		await page.context().addCookies(storageState.cookies);
	}

	if (storageState.origins && storageState.origins.length > 0) {
		for (const origin of storageState.origins) {
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