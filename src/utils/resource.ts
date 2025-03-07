import { createHash } from "crypto";
import type { PageAnalysis, StoredAnalysis } from "../types";

export const DEFAULT_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export function createStoredAnalysis(analysis: PageAnalysis, url: string): StoredAnalysis {
    const currentTime = Date.now();
    
    // Use a simpler hashing approach for better performance
    // Only compute hash if not already present
    const cacheKey = analysis.cacheKey || 
        createHash("md5")
            .update(`${url}-${currentTime}`)
            .digest("hex")
            .substring(0, 16); // Use only first 16 chars for efficiency
    
    return {
        analysis: {
            ...analysis,
            cacheKey,
            timestamp: currentTime,
            expiresAt: currentTime + DEFAULT_EXPIRATION_MS,
        },
        timestamp: new Date(currentTime),
        url,
    };
}

export function filterExpiredAnalyses(analyses: StoredAnalysis[]): StoredAnalysis[] {
    const currentTime = Date.now();
    return analyses.filter((a) => {
        const expiresAt = a.analysis.expiresAt || Infinity;
        return expiresAt > currentTime;
    });
}

export function trimAnalysesList(analyses: StoredAnalysis[], maxSize: number): StoredAnalysis[] {
    return analyses.slice(0, maxSize);
}

export function formatReadableTimestamp(date: Date): string {
    return date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
}

export function createResourceUri(stored: StoredAnalysis): string {
    // Use the existing cacheKey if available to avoid recomputing the hash
    const hash = stored.analysis.cacheKey || 
        createHash("md5").update(stored.url).digest("hex").substring(0, 16);
    
    const timestamp = stored.analysis.timestamp || Date.now();
    const version = "1"; // Simple versioning for now
    return `page://${hash}-${timestamp}?v=${version}`;
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