import { test, expect } from 'bun:test';
import { analyzePage } from '../src/core/browser';
import type { PageAnalysis, PlannedActionResult, Input } from '../src/types';
import { DEFAULT_TIMEOUT } from '../src/config/constants';

test('Wikipedia search functionality', async () => {
  const url = 'https://www.wikipedia.org';
  const searchTerm = 'AI Tools Browser';
  
  try {
    const analysis: PageAnalysis = await analyzePage(url, {
      headless: true,
      timeout: DEFAULT_TIMEOUT,
      plan: {
        actions: [
          // Wait for search input
          {
            type: 'wait',
            elements: ['#searchInput']
          },
          // Type search term
          {
            type: 'typing',
            element: '#searchInput',
            value: searchTerm
          },
          // Press Enter to submit
          {
            type: 'keyPress',
            key: 'Enter',
            element: '#searchInput'
          },
          // Wait for search results
          {
            type: 'wait',
            elements: ['.mw-search-results', '.searchresults']
          },
          // Print search results
          {
            type: 'print',
            elements: ['.mw-search-results', '.searchresults']
          }
        ]
      }
    });

    // Verify the analysis object
    expect(analysis).toBeDefined();
    expect(analysis.title).toContain('Search');
    
    // Verify search results were captured
    const searchResults: PlannedActionResult | undefined = analysis.plannedActions?.find((action: PlannedActionResult) => 
      action.selector === '.mw-search-results' || action.selector === '.searchresults'
    );
    expect(searchResults).toBeDefined();
    expect(searchResults?.html).toBeDefined();
    
    // Verify input field was found
    const searchInput: Input | undefined = analysis.inputs?.find((input: Input) => 
      input.id === 'searchInput' || input.selector.includes('#searchInput')
    );
    expect(searchInput).toBeDefined();
    expect(searchInput?.type.toLowerCase()).toBe('input');
    
  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  }
}, 60000); // Set test timeout to 60 seconds