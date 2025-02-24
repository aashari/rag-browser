import TurndownService from 'turndown';

// Initialize turndown service with common options
export const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    bulletListMarker: '-',
    hr: '---',
    // Add options for better link handling
    linkStyle: 'referenced',
    linkReferenceStyle: 'full'
});

// Add custom rules for Wikipedia search results
turndownService.addRule('searchResult', {
    filter: ['li'],
    replacement: function (content: string, node) {
        const element = node as Element;
        if (element.classList?.contains('mw-search-result')) {
            // Extract components
            const headingEl = element.querySelector('.mw-search-result-heading');
            const heading = turndownService.turndown(headingEl?.innerHTML || '');
            const snippet = element.querySelector('.searchresult')?.textContent?.trim() || '';
            const metadata = element.querySelector('.mw-search-result-data')?.textContent?.trim() || '';

            // Format as markdown
            return `## ${heading}\n\n${snippet}\n\n*${metadata}*\n\n---\n`;
        }
        return content;
    }
}); 