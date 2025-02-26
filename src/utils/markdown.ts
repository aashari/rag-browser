import type { PlannedActionResult } from '../types';
import TurndownService from 'turndown';
import { error, info } from './logging';

// Initialize turndown service with minimal options
export const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-'
});

// Convert HTML to markdown with minimal processing
export const convertToMarkdown = (html: string, selector: string): PlannedActionResult => {
    try {
        const markdown = turndownService.turndown(html).trim();
        info('Converting HTML to Markdown:', { selector, length: markdown.length });
        
        return {
            selector,
            html: markdown,
            type: 'print' as const,
            format: 'markdown' as const
        };
    } catch (err) {
        error('Error converting to markdown', { error: err instanceof Error ? err.message : String(err) });
        return {    
            selector,
            html,
            type: 'print' as const,
            format: 'html' as const,
            error: err instanceof Error ? err.message : 'Unknown error during markdown conversion'
        };
    }
}; 