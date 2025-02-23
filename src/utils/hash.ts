import { createHash } from "crypto";

export function md5(input: string): string {
    return createHash('md5').update(input).digest('hex');
}

export function formatTimestamp(date: Date = new Date()): string {
    return date.toISOString().replace(/[:.]/g, '-');
}

export function formatReadableTimestamp(date: Date = new Date()): string {
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
}

export function createResourceId(url: string, timestamp: Date = new Date()): string {
    const hash = md5(url);
    const timeStr = formatTimestamp(timestamp);
    return `${hash}-${timeStr}`;
} 