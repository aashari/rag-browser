import type { PlannedActionResult } from '../types';
import TurndownService from 'turndown';

// Initialize turndown service with common options
export const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    emDelimiter: '_',
    strongDelimiter: '**',
    bulletListMarker: '-',
    hr: '---',
    linkStyle: 'inlined',
    br: '  \n'
});

// Clean up HTML before conversion
function cleanHtml(html: string): string {
    // Remove style attributes and empty divs
    html = html.replace(/ style="[^"]*"/g, '')
        .replace(/<div[^>]*>\s*<\/div>/g, '')
        .replace(/class="[^"]*"/g, '');
    
    return html;
}

// Add rules for generic content handling
turndownService.addRule('contentBlock', {
    filter: (node) => {
        return node instanceof HTMLElement && 
            (node.hasAttribute('data-testid') || 
             node.hasAttribute('role') ||
             node.classList.length > 0);
    },
    replacement: (content) => {
        return content.trim() + '\n\n';
    }
});

// Handle images with proper alt text
turndownService.addRule('enhancedImage', {
    filter: ['img'],
    replacement: (content, node) => {
        if (node instanceof HTMLImageElement) {
            const alt = node.alt || node.getAttribute('aria-label') || 'Image';
            const src = node.src || '';
            const title = node.title ? ` "${node.title}"` : '';
            return src ? `![${alt}](${src}${title})` : '';
        }
        return content;
    }
});

// Convert HTML to markdown with structure preservation
export const convertToMarkdown = (html: string, selector: string): PlannedActionResult => {
    try {
        const cleanedHtml = cleanHtml(html);
        const markdown = turndownService.turndown(cleanedHtml)
            .replace(/\n{3,}/g, '\n\n') // Remove excessive newlines
            .trim();
        
        return {
            selector,
            html: markdown,
            type: 'markdown',
            metadata: {
                tagName: 'div',
                className: '',
                id: '',
                attributes: ''
            }
        };
    } catch (error) {
        return {
            selector,
            html,
            type: 'markdown',
            error: error instanceof Error ? error.message : 'Unknown error during markdown conversion'
        };
    }
}; 