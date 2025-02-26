import type { PlannedActionResult } from '../types';
import TurndownService from 'turndown';
import { error, info } from './logging';

// Define extended options type to include custom properties
interface ExtendedTurndownOptions extends TurndownService.Options {
    br?: string;
    listItem?: (content: string, node: HTMLElement, options?: TurndownService.Options) => string;
}

// Initialize turndown service with enhanced options
export const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    // Enhanced block element handling
    blankReplacement: function (content: string, node: HTMLElement) {
        const blockElements = new Set([
            'DIV', 'P', 'BLOCKQUOTE', 'LI', 'TR', 'TH', 'TD',
            'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR',
            'UL', 'OL', 'DL', 'PRE', 'ARTICLE', 'SECTION'
        ]);
        return blockElements.has(node.nodeName) ? '\n\n' : ' ';
    },
    // Preserve line breaks but normalize spacing
    br: '\n',
    // Ensure proper list handling
    listItem: function(content: string, node: HTMLElement) {
        const listType = node.parentNode?.nodeName.toLowerCase();
        const bullet = listType === 'ol' ? '1. ' : '- ';
        return bullet + content.trim() + '\n';
    }
} as ExtendedTurndownOptions);

// Improve image handling to preserve alt text
turndownService.addRule('images', {
    filter: 'img',
    replacement: function (content, node) {
        const element = node as HTMLElement;
        const alt = element.getAttribute('alt')?.trim() || '';
        const src = element.getAttribute('src')?.trim();
        
        // If inside a link, just return the alt text
        if (element.closest('a')) {
            return alt ? `${alt} ` : '';
        }
        
        // Otherwise return full image markdown if we have a source
        return src ? `![${alt}](${src})` : (alt ? `${alt} ` : '');
    }
});

/**
 * Extract a reasonable title/text from a complex anchor element
 */
function extractBetterLinkText(element: HTMLElement): string {
    // Look for heading elements first
    const heading = element.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading && heading.textContent?.trim()) {
        return heading.textContent.trim();
    }
    
    // Look for strong/emphasized text
    const strong = element.querySelector('strong, b, em');
    if (strong && strong.textContent?.trim()) {
        return strong.textContent.trim();
    }
    
    // Look for the first paragraph
    const paragraph = element.querySelector('p');
    if (paragraph && paragraph.textContent?.trim()) {
        return paragraph.textContent.trim();
    }
    
    // Try to get the first line of text content
    const textContent = element.textContent || '';
    const firstLine = textContent.split('\n').filter(line => line.trim().length > 0)[0];
    if (firstLine && firstLine.trim()) {
        return firstLine.trim();
    }
    
    // Fallback to a limited version of the full text content
    const limitedText = textContent.trim().substring(0, 60);
    return limitedText + (limitedText.length < textContent.trim().length ? '...' : '');
}

/**
 * Custom rule to handle very complex links by replacing them with just the link title
 */
turndownService.addRule('complexNestedLinks', {
    filter: function (node): boolean {
        if (node.nodeName !== 'A') return false;
        
        // Check if this is a complex link with multiple block elements or images
        const element = node as HTMLElement;
        const hasImages = element.querySelectorAll('img').length > 0;
        const hasBlocks = element.querySelectorAll('div, p, h1, h2, h3, h4, h5, h6').length > 0;
        const hasManyNewlines = (element.textContent?.split('\n').filter(l => l.trim()).length || 0) > 3;
        
        return hasImages || hasBlocks || hasManyNewlines;
    },
    replacement: function(content, node) {
        const element = node as HTMLElement;
        const href = element.getAttribute('href');
        
        // If there's no href, just return the first line of content
        if (!href) {
            const firstLine = (content || '').split('\n')[0].trim();
            return firstLine || content;
        }
        
        // Get a title from the complex content
        const title = extractBetterLinkText(element);
        
        // Return a clean link with just the title
        return `[${title || 'Link'}](${href})`;
    }
});

/**
 * Handle simple links normally
 */
turndownService.addRule('simpleLinks', {
    filter: function (node): boolean {
        // Only process simple <a> tags that aren't handled by the complex rule
        if (node.nodeName !== 'A') return false;
        
        const element = node as HTMLElement;
        const hasImages = element.querySelectorAll('img').length > 0;
        const hasBlocks = element.querySelectorAll('div, p, h1, h2, h3, h4, h5, h6').length > 0;
        const hasManyNewlines = (element.textContent?.split('\n').filter(l => l.trim()).length || 0) > 3;
        
        return !(hasImages || hasBlocks || hasManyNewlines);
    },
    replacement: function(content, node) {
        const element = node as HTMLElement;
        const href = element.getAttribute('href');
        if (!href) return content;
        
        // Clean the content by removing excessive whitespace
        const cleanContent = content.replace(/\s+/g, ' ').trim();
        return `[${cleanContent}](${href})`;
    }
});

/**
 * Separate complex links from their content for better readability
 * This extracts the link and creates a cleaner structure
 */
function separateComplexLinks(html: string): string {
    try {
        // Skip in non-browser environment
        if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
            return html;
        }
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Find links with complex content (with images or multiple block elements)
        const complexLinks = Array.from(doc.querySelectorAll('a')).filter(a => {
            return a.querySelectorAll('img').length > 0 || 
                   a.querySelectorAll('div, p, h1, h2, h3, h4, h5, h6').length > 0;
        });
        
        // Process each complex link
        complexLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (!href || !link.parentNode) return;
            
            // Extract a title for the link
            const title = extractBetterLinkText(link as HTMLElement);
            
            // Create a wrapper div to replace the complex link
            const wrapper = doc.createElement('div');
            
            // Add the content first (without the link)
            const contentClone = link.cloneNode(true) as HTMLElement;
            wrapper.appendChild(contentClone);
            
            // Add a clean link at the end
            const linkElement = doc.createElement('div');
            linkElement.innerHTML = `<a href="${href}">${title || 'Link to content'}</a>`;
            wrapper.appendChild(linkElement);
            
            // Replace the original link with our new structure
            link.parentNode.replaceChild(wrapper, link);
        });
        
        return doc.body.innerHTML;
    } catch (e) {
        error('Error separating complex links:', { error: e instanceof Error ? e.message : String(e) });
        return html;
    }
}

/**
 * Normalize anchor elements by removing newlines and cleaning up the structure
 */
function normalizeAnchorElements(doc: Document): void {
    // First, ensure horizontal rules are properly spaced
    const hrs = doc.querySelectorAll('hr');
    hrs.forEach(hr => {
        const wrapper = doc.createElement('div');
        wrapper.className = 'hr-wrapper';
        wrapper.style.margin = '1em 0';
        hr.parentNode?.replaceChild(wrapper, hr);
        wrapper.appendChild(hr);
    });

    // Then normalize all anchor elements
    const anchors = doc.querySelectorAll('a');
    anchors.forEach(anchor => {
        // Get the href and clean it
        const href = anchor.getAttribute('href')?.trim();
        if (!href) {
            // Remove anchors without href
            anchor.parentNode?.removeChild(anchor);
            return;
        }

        // Remove any horizontal rules inside the anchor
        const hrs = anchor.querySelectorAll('hr');
        hrs.forEach(hr => hr.parentNode?.removeChild(hr));

        // Create a new text node with cleaned content
        const textContent = anchor.textContent
            ?.replace(/\n+/g, ' ') // Replace newlines with spaces
            ?.replace(/\s+/g, ' ') // Normalize spaces
            ?.trim() || href;
        
        // Clear the anchor's content and set the cleaned text
        anchor.innerHTML = '';
        anchor.textContent = textContent;
        
        // Ensure href is properly formatted
        anchor.setAttribute('href', href.replace(/\s+/g, '%20').replace(/\n/g, ''));

        // Wrap the anchor in a div to ensure proper spacing
        if (anchor.parentNode && anchor.parentNode.nodeName !== 'DIV') {
            const wrapper = doc.createElement('div');
            wrapper.className = 'link-wrapper';
            anchor.parentNode.replaceChild(wrapper, anchor);
            wrapper.appendChild(anchor);
        }
    });
}

/**
 * Clean HTML to improve conversion quality
 */
function cleanHtmlForMarkdown(html: string): string {
    try {
        // Skip in non-browser environment
        if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
            return cleanHtmlWithRegex(html);
        }
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // First, normalize all anchor elements
        normalizeAnchorElements(doc);
        
        // Then handle complex links by separating content
        const processed = separateComplexLinks(doc.body.innerHTML);
        
        return processed;
    } catch (e) {
        error('Error cleaning HTML:', { error: e instanceof Error ? e.message : String(e) });
        return html;
    }
}

// Improve link handling with unified rule
turndownService.addRule('links', {
    filter: 'a',
    replacement: function (content, node) {
        const element = node as HTMLElement;
        const href = element.getAttribute('href')?.trim();
        if (!href) return content;

        // Clean content and extract meaningful text
        let linkText = content
            .replace(/\n+/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/!\[([^\]]+)\]\([^)]+\)/g, '$1')
            .trim();

        // If content is empty or just whitespace, try to get a better title
        if (!linkText) {
            linkText = extractBetterLinkText(element);
        }

        // Use href as fallback if no meaningful content
        const finalText = linkText || href;

        // Return properly formatted link with consistent spacing
        return ` [${finalText}](${href}) `;
    }
});

// Enhance horizontal rule handling
turndownService.addRule('horizontalRule', {
    filter: 'hr',
    replacement: function() {
        return '\n\n---\n\n';
    }
});

/**
 * Clean and normalize HTML content for markdown conversion
 */
function cleanHtmlWithRegex(html: string): string {
    // Remove scripts, styles, and iframes
    html = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');

    // First pass: Extract and clean links
    const links = new Map<string, { href: string, text: string }>();
    let linkCounter = 0;

    // Extract and clean links with better content handling
    html = html.replace(/<a\s+([^>]*)>([\s\S]*?)<\/a>/gi, (match, attrs, content) => {
        const hrefMatch = attrs.match(/href="([^"]*)"/i);
        if (!hrefMatch) return content.trim();
        
        // Clean and normalize the href
        const href = hrefMatch[1]
            .trim()
            .replace(/\s+/g, '%20')
            .replace(/\n/g, '')
            .replace(/\\/g, '/')
            .replace(/\s*---\s*/g, '--')  // Replace horizontal rules in URLs with double dash
            .replace(/\s+/g, '-');        // Replace any remaining spaces with dashes
        
        // Clean the content more thoroughly
        let cleanContent = content
            .replace(/<hr[^>]*>/gi, '') // Remove HR tags
            .replace(/\n+/g, ' ') // Replace newlines with spaces
            .replace(/\s+/g, ' ') // Normalize spaces
            .replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, '$1 ') // Extract image alt text
            .replace(/<[^>]+>/g, ' ') // Remove any remaining HTML tags
            .replace(/\s+/g, ' ') // Normalize spaces again after tag removal
            .trim();

        // If content is empty after cleaning, use the href
        if (!cleanContent) {
            cleanContent = href;
        }
            
        const placeholder = `__LINK_${linkCounter}__`;
        links.set(placeholder, { href, text: cleanContent });
        linkCounter++;
        
        return placeholder;
    });
    
    // Clean up horizontal rules and spacing
    html = html
        .replace(/<hr[^>]*>/gi, '\n---\n') // Initial HR replacement
        .replace(/\n{3,}/g, '\n\n') // Normalize multiple newlines
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim();
    
    // Second pass: Restore links with proper formatting
    links.forEach((link, placeholder) => {
        const linkText = link.text.replace(/\s+/g, ' ').trim();
        const linkHref = link.href.trim();
        html = html.replace(
            placeholder,
            `[${linkText}](${linkHref})`
        );
    });
    
    // Final cleanup for consistent formatting
    html = html
        // Fix split links
        .replace(/\]\s*\n+\s*\(/g, '](')
        .replace(/\[([^\]]+?)\s*\n+\s*([^\]]*?)\]/g, '[$1 $2]')
        .replace(/\(([^)]+?)\s*\n+\s*([^)]*?)\)/g, '($1$2)')
        
        // Ensure proper spacing around horizontal rules
        .replace(/([^\n])\n?---\n?([^\n])/g, '$1\n\n---\n\n$2')
        .replace(/^---\n?([^\n])/gm, '---\n\n$1')
        .replace(/([^\n])\n?---$/g, '$1\n\n---')
        
        // Remove duplicate horizontal rules and normalize spacing
        .replace(/\n---\n+---\n/g, '\n---\n')
        .replace(/(\n---\n)\n+/g, '\n---\n')
        .replace(/\n+(\n---\n)/g, '\n---\n')
        
        // Clean up any remaining newlines and escaping
        .replace(/\n{3,}/g, '\n\n')
        .replace(/\\\[/g, '[')
        .replace(/\\\]/g, ']')
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')')
        .trim();
    
    return html;
}

/**
 * Convert HTML to markdown with proper formatting
 */
export const convertToMarkdown = (html: string, selector: string): PlannedActionResult => {
    try {
        // Clean HTML before conversion
        const cleanedHtml = cleanHtmlWithRegex(html);
        
        // Convert to markdown
        let markdown = turndownService.turndown(cleanedHtml);
        
        // Post-process markdown for consistent formatting
        markdown = markdown
            // Ensure proper spacing around headers
            .replace(/([^\n])(#{1,6}\s)/g, '$1\n\n$2')
            .replace(/(#{1,6}[^\n]+)\n(?!$)/g, '$1\n\n')
            
            // Fix any remaining split links
            .replace(/\[([^\]]+?)\s*\n+\s*([^\]]*?)\]/g, '[$1 $2]')
            .replace(/\(([^)]+?)\s*\n+\s*([^)]*?)\)/g, '($1$2)')
            .replace(/\]\s*\n+\s*\(/g, '](')
            
            // Ensure consistent horizontal rule formatting
            .replace(/\n?---\n?/g, '\n\n---\n\n')
            .replace(/(\n---\n)\n+/g, '\n---\n')
            .replace(/\n+(\n---\n)/g, '\n---\n')
            .replace(/(\]\([^)]+\))\s*\n*---/g, '$1\n\n---')
            .replace(/---\n*\s*(\[[^\]]+\])/g, '---\n\n$1')
            
            // Fix any remaining URL issues
            .replace(/\]\(([^)]+?)\s+([^)]+?)\)/g, ']($1$2)')
            .replace(/\]\(([^)]+?)---([^)]+?)\)/g, ']($1--$2)')
            
            // Remove excessive blank lines
            .replace(/\n{3,}/g, '\n\n')
            .trim();
            
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
            format: 'html' as const,
            error: err instanceof Error ? err.message : 'Unknown error during markdown conversion'
        };
    }
}; 