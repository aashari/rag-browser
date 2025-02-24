import type { PageAnalysis, StoredAnalysis } from "../types";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
    createStoredAnalysis,
    filterExpiredAnalyses,
    trimAnalysesList,
    createResourceUri,
    createResourceName,
    createResourceDescription,
} from "../utils/resource";

// Store up to 10 most recent analyses
const MAX_STORED_ANALYSES = 10;

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
    
    const storedAnalysis = createStoredAnalysis(analysis, url);
    const validAnalyses = filterExpiredAnalyses(analyses);
    
    // Clear and repopulate the array
    analyses.length = 0;
    analyses.push(...trimAnalysesList([storedAnalysis, ...validAnalyses], MAX_STORED_ANALYSES));
    
    log("debug", `Total stored analyses: ${analyses.length}`);
}

export function getAnalyses(): StoredAnalysis[] {
    const validAnalyses = filterExpiredAnalyses(analyses);
    log("debug", `Getting all valid analyses. Count: ${validAnalyses.length}`);
    return validAnalyses;
}

export function getAnalysisByUri(uri: string): StoredAnalysis | undefined {
    log("debug", `Looking for analysis with URI: ${uri}`);
    const validAnalyses = filterExpiredAnalyses(analyses);
    const analysis = validAnalyses.find((a) => createResourceUri(a) === uri);
    log("debug", `Analysis ${analysis ? "found" : "not found"} for URI: ${uri}`);
    return analysis;
}

export function clearAnalyses(): void {
    log("debug", "Clearing all analyses");
    analyses.length = 0;
}

export { createResourceUri, createResourceName, createResourceDescription }; 