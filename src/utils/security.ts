export function validateUrl(url: string): { valid: boolean; error?: string } {
	try {
		const parsed = new URL(url);
		if (!["http:", "https:"].includes(parsed.protocol)) {
			return { valid: false, error: "URL must use http or https protocol" };
		}
		return { valid: true };
	} catch (e) {
		return { valid: false, error: `Invalid URL: ${e instanceof Error ? e.message : String(e)}` };
	}
} 