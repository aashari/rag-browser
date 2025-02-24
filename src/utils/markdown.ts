import type { PlannedActionResult } from '../types';
import TurndownService from 'turndown';

// Initialize turndown service with minimal options
export const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-'
});

// Clean up HTML before conversion
function cleanHtml(html: string): string {
    // Remove style attributes and empty divs
    return html.replace(/ style="[^"]*"/g, '')
        .replace(/<div[^>]*>\s*<\/div>/g, '')
        .replace(/class="[^"]*"/g, '');
}

// Convert HTML to markdown with minimal processing
export const convertToMarkdown = (html: string, selector: string): PlannedActionResult => {
    try {
        const cleanedHtml = cleanHtml(html);
        const markdown = turndownService.turndown(cleanedHtml).trim();
        
        return {
            selector,
            html: markdown,
            type: 'print' as const,
            format: 'markdown' as const
        };
    } catch (error) {
        return {
            selector,
            html,
            type: 'print' as const,
            format: 'html' as const,
            error: error instanceof Error ? error.message : 'Unknown error during markdown conversion'
        };
    }
}; 