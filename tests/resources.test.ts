import { test, expect } from "bun:test";
import { storeAnalysis, getAnalyses, getAnalysisByUri, createResourceUri, clearAnalyses } from "../src/mcp/resources";
import type { PageAnalysis } from "../src/types";
import { createHash } from "crypto";

// Helper to create a mock PageAnalysis
function createMockAnalysis(title: string, url: string): PageAnalysis {
	return {
		title,
		description: "Test description",
		links: [],
		buttons: [],
		inputs: [],
	};
}

test("storeAnalysis sets caching metadata", () => {
	clearAnalyses();
	const url = "https://example.com";
	const analysis = createMockAnalysis("Test Page", url);
	
	storeAnalysis(analysis, url);
	const stored = getAnalyses()[0];
	
	expect(stored.analysis.cacheKey).toBeDefined();
	expect(stored.analysis.cacheKey).toBe(
		createHash("md5").update(`${url}-${stored.analysis.timestamp}`).digest("hex")
	);
	expect(stored.analysis.timestamp).toBeNumber();
	expect(stored.analysis.expiresAt).toBe(stored.analysis.timestamp! + 24 * 60 * 60 * 1000);
});

test("getAnalyses filters expired analyses", async () => {
	clearAnalyses();
	const url = "https://example.com";
	
	// Store an expired analysis
	const expiredAnalysis = createMockAnalysis("Expired Page", url);
	storeAnalysis(expiredAnalysis, url);
	
	// Manually update the stored analysis to be expired
	const stored = getAnalyses()[0];
	const currentTime = Date.now();
	const expiredTime = currentTime - (25 * 60 * 60 * 1000); // 25 hours ago
	stored.analysis.timestamp = expiredTime;
	stored.analysis.expiresAt = expiredTime + (24 * 60 * 60 * 1000);
	
	// Store a valid analysis
	const validAnalysis = createMockAnalysis("Valid Page", url);
	storeAnalysis(validAnalysis, url);
	
	const analyses = getAnalyses();
	expect(analyses.length).toBe(1);
	expect(analyses[0].analysis.title).toBe("Valid Page");
});

test("getAnalysisByUri returns null for expired analysis", () => {
	clearAnalyses();
	const url = "https://example.com";
	
	// Store an analysis and manually expire it
	const expiredAnalysis = createMockAnalysis("Expired Page", url);
	storeAnalysis(expiredAnalysis, url);
	
	const stored = getAnalyses()[0];
	const currentTime = Date.now();
	const expiredTime = currentTime - (25 * 60 * 60 * 1000);
	stored.analysis.timestamp = expiredTime;
	stored.analysis.expiresAt = expiredTime + (24 * 60 * 60 * 1000);
	
	const uri = createResourceUri(stored);
	const result = getAnalysisByUri(uri);
	expect(result).toBeUndefined();
});

test("createResourceUri includes version", () => {
	clearAnalyses();
	const url = "https://example.com";
	const analysis = createMockAnalysis("Test Page", url);
	
	storeAnalysis(analysis, url);
	const stored = getAnalyses()[0];
	const uri = createResourceUri(stored);
	
	const hash = createHash("md5").update(url).digest("hex");
	const timestamp = stored.analysis.timestamp;
	expect(uri).toBe(`page://${hash}-${timestamp}?v=1`);
});

test("analyses respect MAX_STORED_ANALYSES limit", () => {
	clearAnalyses();
	const url = "https://example.com";
	
	// Store 11 analyses
	for (let i = 0; i < 11; i++) {
		storeAnalysis(createMockAnalysis(`Page ${i}`, url), url);
	}
	
	const analyses = getAnalyses();
	expect(analyses.length).toBe(10);
	expect(analyses[0].analysis.title).toBe("Page 10"); // Most recent
	expect(analyses[9].analysis.title).toBe("Page 1");  // Oldest retained
}); 