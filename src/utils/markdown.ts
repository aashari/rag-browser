import type { PlannedActionResult } from '../types';
import TurndownService from 'turndown';
import imageWithStyle from 'turndown-plugin-image-with-style';
import { error, info } from './logging';
import { JSDOM } from 'jsdom';

// Initialize turndown service with basic options
export const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    hr: '---'
});

// Use the image handling plugin
turndownService.use(imageWithStyle);

/**
 * Basic link handling
 */
turndownService.addRule('links', {
    filter: 'a',
    replacement: function (content, node) {
        const element = node as HTMLElement;
        const href = element.getAttribute('href')?.trim();
        if (!href) return content;
        
        // Simple content cleaning
        const linkText = content.replace(/\s+/g, ' ').trim() || href;
        return `[${linkText}](${href})`;
    }
});

/**
 * Clean HTML by removing scripts and styles
 */
function cleanHtml(html: string): string {
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Remove script and style elements
    document.querySelectorAll('script, style').forEach((el: Element) => el.remove());

    return document.body.innerHTML;
}

/**
 * Convert HTML to markdown with simplified processing
 */
export const convertToMarkdown = (html: string, selector: string, format: 'markdown' | 'html' = 'markdown'): PlannedActionResult => {
    try {
        // Clean HTML
        const cleanedHtml = cleanHtml(html);
        
        // If HTML format is requested, return the cleaned HTML directly
        if (format === 'html') {
            info('Returning cleaned HTML:', { selector, length: cleanedHtml.length });
            
            return {
                selector,
                html: cleanedHtml,
                type: 'print' as const,
                format: 'html' as const
            };
        }
        
        // Convert to markdown
        const markdown = turndownService.turndown(cleanedHtml);
        
        info('Successfully converted HTML to Markdown:', { selector, length: markdown.length });
        
        return {
            selector,
            html: markdown,
            type: 'print' as const,
            format: 'markdown' as const
        };
    } catch (err) {
        error('Error converting to markdown:', { error: err instanceof Error ? err.message : String(err) });
        return {    
            selector,
            html,
            type: 'print' as const,
            format: format,
            error: err instanceof Error ? err.message : 'Unknown error during markdown conversion'
        };
    }
} 