import type { PageAnalysis } from "../types";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { createHash } from "crypto";

// Store up to 10 most recent analyses
const MAX_STORED_ANALYSES = 10;
const DEFAULT_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours

interface StoredAnalysis {
    analysis: PageAnalysis;
    timestamp: Date;
    url: string;
}

const analyses: StoredAnalysis[] = [];

let mcpServer: Server | null = null;

export function initializeResources(server: Server): void {
    mcpServer = server;
}

function log(level: "info" | "error" | "debug", message: string): void {
    mcpServer?.sendLoggingMessage({ level, data: message });
}

function formatReadableTimestamp(date: Date): string {
    return date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
}

export function storeAnalysis(analysis: PageAnalysis, url: string): void {
    log("debug", `Storing analysis for page: ${analysis.title}`);
    
    const currentTime = Date.now();
    const storedAnalysis: StoredAnalysis = {
        analysis: {
            ...analysis,
            cacheKey: createHash("md5").update(`${url}-${currentTime}`).digest("hex"),
            timestamp: currentTime,
            expiresAt: currentTime + DEFAULT_EXPIRATION_MS,
        },
        timestamp: new Date(currentTime),
        url,
    };
    
    // Filter out expired analyses
    const validAnalyses = analyses.filter((a) => {
        const expiresAt = a.analysis.expiresAt || Infinity;
        return expiresAt > currentTime;
    });
    
    // Clear and repopulate the array
    analyses.length = 0;
    analyses.push(...validAnalyses);
    
    // Add new analysis at the beginning
    analyses.unshift(storedAnalysis);
    
    // Trim to max size
    if (analyses.length > MAX_STORED_ANALYSES) {
        analyses.length = MAX_STORED_ANALYSES;
    }
    log("debug", `Total stored analyses: ${analyses.length}`);
}

export function getAnalyses(): StoredAnalysis[] {
    const currentTime = Date.now();
    const validAnalyses = analyses.filter((a) => {
        const expiresAt = a.analysis.expiresAt || Infinity;
        return expiresAt > currentTime;
    });
    log("debug", `Getting all valid analyses. Count: ${validAnalyses.length}`);
    return validAnalyses;
}

export function getAnalysisByUri(uri: string): StoredAnalysis | undefined {
    log("debug", `Looking for analysis with URI: ${uri}`);
    const currentTime = Date.now();
    const analysis = analyses.find(
        (a) => createResourceUri(a) === uri && (a.analysis.expiresAt || Infinity) > currentTime
    );
    log("debug", `Analysis ${analysis ? "found" : "not found"} for URI: ${uri}`);
    return analysis;
}

export function clearAnalyses(): void {
    log("debug", "Clearing all analyses");
    analyses.length = 0;
}

export function createResourceUri(stored: StoredAnalysis): string {
    const hash = createHash("md5").update(stored.url).digest("hex");
    const timestamp = stored.analysis.timestamp || Date.now();
    const version = "1"; // Simple versioning for now
    const uri = `page://${hash}-${timestamp}?v=${version}`;
    log("debug", `Created URI for page: ${stored.analysis.title} -> ${uri}`);
    return uri;
}

export function createResourceName(stored: StoredAnalysis): string {
    const timestamp = formatReadableTimestamp(stored.timestamp);
    return `Page for [${stored.analysis.title}][${stored.url}] at ${timestamp}`;
}

export function createResourceDescription(stored: StoredAnalysis): string {
    const timestamp = formatReadableTimestamp(stored.timestamp);
    const expiresAt = stored.analysis.expiresAt
        ? formatReadableTimestamp(new Date(stored.analysis.expiresAt))
        : "Never";
    const summary = [
        `Page analysis scraped at ${timestamp}`,
        `Expires at: ${expiresAt}`,
        `Title: ${stored.analysis.title}`,
        `URL: ${stored.url}`,
        `Links found: ${stored.analysis.links.length}`,
        `Buttons found: ${stored.analysis.buttons.length}`,
        `Inputs found: ${stored.analysis.inputs.length}`,
        stored.analysis.plannedActions ? `Actions executed: ${stored.analysis.plannedActions.length}` : undefined,
    ].filter(Boolean).join("\n");
    
    return summary;
} 