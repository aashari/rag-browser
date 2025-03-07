import type { PageAnalysis, BrowserOptions } from "../types";
import { analyzeBrowserPage } from "./browser/index";
import { setDebugMode } from "../utils/logging";

export async function analyzePage(url: string, options: BrowserOptions): Promise<PageAnalysis> {
	// Set debug mode based on options
	setDebugMode(options.debug || false);
	
	return analyzeBrowserPage(url, options);
}
