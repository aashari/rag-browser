import type { PageAnalysis } from "../types";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { createResourceId, formatReadableTimestamp } from "../utils/hash.js";

// Store up to 10 most recent analyses
const MAX_STORED_ANALYSES = 10;

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

export function storeAnalysis(analysis: PageAnalysis, url: string): void {
    log("debug", `Storing analysis for page: ${analysis.title}`);
    
    // Create stored analysis with metadata
    const storedAnalysis: StoredAnalysis = {
        analysis,
        timestamp: new Date(),
        url
    };
    
    // Add new analysis at the beginning
    analyses.unshift(storedAnalysis);
    
    // Keep only the most recent analyses
    if (analyses.length > MAX_STORED_ANALYSES) {
        analyses.length = MAX_STORED_ANALYSES;
    }
    log("debug", `Total stored analyses: ${analyses.length}`);
}

export function getAnalyses(): StoredAnalysis[] {
    log("debug", `Getting all analyses. Count: ${analyses.length}`);
    return analyses;
}

export function getAnalysisByUri(uri: string): StoredAnalysis | undefined {
    log("debug", `Looking for analysis with URI: ${uri}`);
    const analysis = analyses.find(a => createResourceUri(a) === uri);
    log("debug", `Analysis ${analysis ? 'found' : 'not found'} for URI: ${uri}`);
    return analysis;
}

export function clearAnalyses(): void {
    log("debug", 'Clearing all analyses');
    analyses.length = 0;
}

export function createResourceUri(stored: StoredAnalysis): string {
    const resourceId = createResourceId(stored.url, stored.timestamp);
    const uri = `page://${resourceId}`;
    log("debug", `Created URI for page: ${stored.analysis.title} -> ${uri}`);
    return uri;
}

export function createResourceName(stored: StoredAnalysis): string {
    const timestamp = formatReadableTimestamp(stored.timestamp);
    return `Page for [${stored.analysis.title}][${stored.url}] at ${timestamp}`;
}

export function createResourceDescription(stored: StoredAnalysis): string {
    const timestamp = formatReadableTimestamp(stored.timestamp);
    const summary = [
        `Page analysis scraped at ${timestamp}`,
        `Title: ${stored.analysis.title}`,
        `URL: ${stored.url}`,
        `Links found: ${stored.analysis.links.length}`,
        `Buttons found: ${stored.analysis.buttons.length}`,
        `Input fields found: ${stored.analysis.inputs.length}`,
        stored.analysis.plannedActions ? `Actions executed: ${stored.analysis.plannedActions.length}` : undefined
    ].filter(Boolean).join('\n');
    
    return summary;
} 