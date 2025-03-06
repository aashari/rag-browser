import type { PageAnalysis, BrowserOptions } from "../types";
import { analyzeBrowserPage } from "./browser/index";

export async function analyzePage(url: string, options: BrowserOptions): Promise<PageAnalysis> {
	return analyzeBrowserPage(url, options);
}
