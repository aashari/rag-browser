import type { Page } from "playwright";
import { debug, info } from "../../utils/logging";

/**
 * Represents a discovered selector with metadata
 */
export interface DiscoveredSelector {
  selector: string;
  confidence: number; // 0-1 score indicating confidence in the selector
  elementCount: number; // Number of elements matched by this selector
  isUnique: boolean; // Whether this selector uniquely identifies an element
  path: string; // Full DOM path
  type: 'content' | 'navigation' | 'form' | 'button' | 'unknown'; // Element type classification
  text?: string; // Text content if available
  attributes?: Record<string, string>; // Key attributes
}

/**
 * Options for selector discovery
 */
export interface SelectorDiscoveryOptions {
  maxSelectors?: number; // Maximum number of selectors to return
  minConfidence?: number; // Minimum confidence score (0-1)
  preferUnique?: boolean; // Prefer unique selectors
  includeText?: boolean; // Include text content in selector generation
  selectorTypes?: ('id' | 'class' | 'tag' | 'attribute' | 'text' | 'aria' | 'data')[];
}

/**
 * Default options for selector discovery
 */
const DEFAULT_DISCOVERY_OPTIONS: SelectorDiscoveryOptions = {
  maxSelectors: 10,
  minConfidence: 0.5,
  preferUnique: true,
  includeText: true,
  selectorTypes: ['id', 'class', 'tag', 'attribute', 'aria', 'data']
};

/**
 * Analyzes the page and discovers relevant selectors for content elements
 */
export async function discoverContentSelectors(
  page: Page,
  options: SelectorDiscoveryOptions = {}
): Promise<DiscoveredSelector[]> {
  const mergedOptions = { ...DEFAULT_DISCOVERY_OPTIONS, ...options };
  
  debug("Starting content selector discovery");
  
  // Execute selector discovery in the browser context
  const selectors = await page.evaluate((opts) => {
    // Helper function to calculate selector specificity (higher is more specific)
    function calculateSpecificity(selector: string): number {
      let score = 0;
      // ID selectors are most specific
      if (selector.includes('#')) score += 100;
      // Count class selectors
      score += (selector.match(/\./g) || []).length * 10;
      // Count attribute selectors
      score += (selector.match(/\[.*?\]/g) || []).length * 10;
      // Count tag selectors
      score += (selector.match(/^[a-zA-Z]/g) || []).length;
      return score;
    }
    
    // Helper function to check if an element is likely to be content
    function isContentElement(element: Element): boolean {
      const tagName = element.tagName.toLowerCase();
      
      // Common content containers
      if (['article', 'main', 'section', 'div'].includes(tagName)) {
        // Check if it has substantial content
        const textLength = element.textContent?.trim().length || 0;
        if (textLength > 100) return true;
        
        // Check for content-related classes
        const classNames = Array.from(element.classList);
        const contentClasses = ['content', 'article', 'post', 'main', 'body', 'text'];
        if (contentClasses.some(cls => classNames.some(c => c.toLowerCase().includes(cls)))) {
          return true;
        }
      }
      
      // Check for semantic elements that typically contain content
      if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'blockquote'].includes(tagName)) {
        return true;
      }
      
      return false;
    }
    
    // Helper function to check if an element is likely to be navigation
    function isNavigationElement(element: Element): boolean {
      const tagName = element.tagName.toLowerCase();
      
      // Check for nav element
      if (tagName === 'nav') return true;
      
      // Check for navigation-related attributes
      if (element.getAttribute('role') === 'navigation') return true;
      
      // Check for navigation-related classes
      const classNames = Array.from(element.classList);
      const navClasses = ['nav', 'navigation', 'menu', 'sidebar', 'header', 'footer'];
      if (navClasses.some(cls => classNames.some(c => c.toLowerCase().includes(cls)))) {
        return true;
      }
      
      // Check if it contains multiple links
      const links = element.querySelectorAll('a');
      if (links.length > 3) return true;
      
      return false;
    }
    
    // Helper function to check if an element is likely to be a form
    function isFormElement(element: Element): boolean {
      const tagName = element.tagName.toLowerCase();
      
      // Check for form element
      if (tagName === 'form') return true;
      
      // Check for form-related attributes
      if (element.getAttribute('role') === 'form') return true;
      
      // Check for form-related classes
      const classNames = Array.from(element.classList);
      const formClasses = ['form', 'login', 'signup', 'register', 'contact'];
      if (formClasses.some(cls => classNames.some(c => c.toLowerCase().includes(cls)))) {
        return true;
      }
      
      // Check if it contains form elements
      const formElements = element.querySelectorAll('input, textarea, select, button');
      if (formElements.length > 2) return true;
      
      return false;
    }
    
    // Helper function to generate a selector for an element
    function generateSelector(element: Element, opts: SelectorDiscoveryOptions): string {
      const selectors: string[] = [];
      
      // ID selector (most specific)
      if (opts.selectorTypes?.includes('id') && element.id) {
        selectors.push(`#${element.id}`);
      }
      
      // Class selectors
      if (opts.selectorTypes?.includes('class') && element.classList.length > 0) {
        const classSelector = Array.from(element.classList)
          .filter(cls => !cls.startsWith('_')) // Filter out utility classes
          .map(cls => `.${cls}`)
          .join('');
        if (classSelector) selectors.push(classSelector);
      }
      
      // Tag selector (least specific)
      if (opts.selectorTypes?.includes('tag')) {
        selectors.push(element.tagName.toLowerCase());
      }
      
      // Attribute selectors
      if (opts.selectorTypes?.includes('attribute')) {
        const attrs = ['name', 'type', 'role'];
        for (const attr of attrs) {
          const value = element.getAttribute(attr);
          if (value) selectors.push(`[${attr}="${value}"]`);
        }
      }
      
      // ARIA selectors
      if (opts.selectorTypes?.includes('aria')) {
        const ariaAttrs = Array.from(element.attributes)
          .filter(attr => attr.name.startsWith('aria-'))
          .map(attr => `[${attr.name}="${attr.value}"]`);
        if (ariaAttrs.length > 0) selectors.push(ariaAttrs.join(''));
      }
      
      // Data attribute selectors
      if (opts.selectorTypes?.includes('data')) {
        const dataAttrs = Array.from(element.attributes)
          .filter(attr => attr.name.startsWith('data-'))
          .map(attr => `[${attr.name}="${attr.value}"]`);
        if (dataAttrs.length > 0) selectors.push(dataAttrs.join(''));
      }
      
      // Text content selector
      if (opts.includeText && opts.selectorTypes?.includes('text')) {
        const text = element.textContent?.trim();
        if (text && text.length < 50) {
          selectors.push(`:contains("${text}")`);
        }
      }
      
      // Combine selectors based on specificity
      return selectors.join('');
    }
    
    // Helper function to get the full DOM path
    function getDomPath(element: Element): string {
      const path: string[] = [];
      let currentElement: Element | null = element;
      
      while (currentElement && currentElement !== document.body) {
        let selector = currentElement.tagName.toLowerCase();
        
        if (currentElement.id) {
          selector += `#${currentElement.id}`;
        } else if (currentElement.classList.length > 0) {
          selector += `.${Array.from(currentElement.classList).join('.')}`;
        }
        
        path.unshift(selector);
        currentElement = currentElement.parentElement;
      }
      
      return path.join(' > ');
    }
    
    // Start the discovery process
    const discoveredSelectors: Array<{
      selector: string;
      confidence: number;
      elementCount: number;
      isUnique: boolean;
      path: string;
      type: 'content' | 'navigation' | 'form' | 'button' | 'unknown';
      text?: string;
      attributes?: Record<string, string>;
    }> = [];
    
    // Find all potential content elements
    const allElements = document.querySelectorAll('*');
    const processedElements = new Set<Element>();
    
    // First pass: identify main content containers
    for (const element of Array.from(allElements)) {
      // Skip tiny elements or already processed elements
      if (processedElements.has(element) || 
          element.getBoundingClientRect().width < 50 || 
          element.getBoundingClientRect().height < 50) {
        continue;
      }
      
      let type: 'content' | 'navigation' | 'form' | 'button' | 'unknown' = 'unknown';
      
      // Determine element type
      if (isContentElement(element)) {
        type = 'content';
      } else if (isNavigationElement(element)) {
        type = 'navigation';
      } else if (isFormElement(element)) {
        type = 'form';
      } else if (element.tagName.toLowerCase() === 'button' || 
                element.getAttribute('role') === 'button') {
        type = 'button';
      }
      
      // Skip unknown elements
      if (type === 'unknown') continue;
      
      // Generate selector
      const selector = generateSelector(element, opts);
      if (!selector) continue;
      
      // Check uniqueness
      const matchingElements = document.querySelectorAll(selector);
      const isUnique = matchingElements.length === 1;
      
      // Calculate confidence based on selector specificity and element type
      let confidence = calculateSpecificity(selector) / 100;
      if (confidence > 1) confidence = 1;
      
      // Adjust confidence based on element type and uniqueness
      if (isUnique) confidence += 0.2;
      if (type === 'content') confidence += 0.1;
      if (confidence > 1) confidence = 1;
      
      // Get text content
      const text = element.textContent?.trim().substring(0, 100);
      
      // Get key attributes
      const attributes: Record<string, string> = {};
      for (const attr of ['id', 'class', 'role', 'name', 'type']) {
        const value = element.getAttribute(attr);
        if (value) attributes[attr] = value;
      }
      
      // Add to discovered selectors
      discoveredSelectors.push({
        selector,
        confidence,
        elementCount: matchingElements.length,
        isUnique,
        path: getDomPath(element),
        type,
        text,
        attributes
      });
      
      // Mark this element and its children as processed
      processedElements.add(element);
      for (const child of Array.from(element.querySelectorAll('*'))) {
        processedElements.add(child);
      }
    }
    
    // Sort by confidence and limit results
    return discoveredSelectors
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, opts.maxSelectors || 10);
  }, mergedOptions);
  
  debug(`Discovered ${selectors.length} content selectors`);
  return selectors;
}

/**
 * Generates a fallback selector chain for an element
 * This creates progressively broader selectors to try if the specific one fails
 */
export async function generateFallbackSelectorChain(
  page: Page,
  originalSelector: string
): Promise<string[]> {
  debug(`Generating fallback selector chain for: ${originalSelector}`);
  
  // Execute in browser context
  const selectorChain = await page.evaluate((selector) => {
    const fallbackChain: string[] = [selector];
    
    // Try to find the element with the original selector
    const element = document.querySelector(selector);
    if (!element) return fallbackChain;
    
    // Generate broader selectors based on the element's attributes
    if (element.id) {
      fallbackChain.push(`#${element.id}`);
    }
    
    // Add class-based selectors (from most specific to least)
    if (element.classList.length > 0) {
      // Add selector with all classes
      fallbackChain.push(`.${Array.from(element.classList).join('.')}`);
      
      // Add selectors with individual classes
      for (const cls of Array.from(element.classList)) {
        fallbackChain.push(`.${cls}`);
      }
    }
    
    // Add tag-based selectors
    const tagName = element.tagName.toLowerCase();
    fallbackChain.push(tagName);
    
    // Add parent-based selectors
    let parent = element.parentElement;
    while (parent && parent !== document.body) {
      const parentTag = parent.tagName.toLowerCase();
      
      // Add parent > element selector
      if (parent.id) {
        fallbackChain.push(`#${parent.id} ${tagName}`);
      } else if (parent.classList.length > 0) {
        fallbackChain.push(`.${Array.from(parent.classList)[0]} ${tagName}`);
      } else {
        fallbackChain.push(`${parentTag} ${tagName}`);
      }
      
      parent = parent.parentElement;
    }
    
    // Add common content container selectors
    fallbackChain.push(...[
      'main', 'article', 'section', '.content', '.main-content', 
      '.article', '.post', '.page-content', '#content', '#main'
    ]);
    
    // Remove duplicates
    return [...new Set(fallbackChain)];
  }, originalSelector);
  
  debug(`Generated ${selectorChain.length} fallback selectors`);
  return selectorChain;
}

/**
 * Attempts to find the best selector for a specific content type
 */
export async function findBestSelectorForContent(
  page: Page,
  contentType: 'main' | 'article' | 'navigation' | 'form' | 'header' | 'footer'
): Promise<string | null> {
  debug(`Finding best selector for content type: ${contentType}`);
  
  // Execute in browser context
  const bestSelector = await page.evaluate((type) => {
    // Define selector patterns for each content type
    const selectorPatterns: Record<string, string[]> = {
      main: [
        'main', '#main', '.main', '.main-content', '.content', 
        'article', '.article', '.post', '.page-content', '#content'
      ],
      article: [
        'article', '.article', '.post', '.entry', '.content', 
        '.post-content', '.entry-content', '.article-content'
      ],
      navigation: [
        'nav', '.nav', '.navigation', '.menu', '.navbar', 
        'header .nav', 'header .menu', '#navigation', '#nav'
      ],
      form: [
        'form', '.form', '.login-form', '.signup-form', '.contact-form',
        '#login-form', '#signup-form', '#contact-form'
      ],
      header: [
        'header', '.header', '#header', '.page-header', '.site-header'
      ],
      footer: [
        'footer', '.footer', '#footer', '.page-footer', '.site-footer'
      ]
    };
    
    // Try each selector pattern
    const patterns = selectorPatterns[type] || [];
    for (const pattern of patterns) {
      const elements = document.querySelectorAll(pattern);
      if (elements.length > 0) {
        // For multiple matches, find the most prominent one
        if (elements.length > 1) {
          // Sort by size (area) and visibility
          const sortedElements = Array.from(elements)
            .map(el => {
              const rect = el.getBoundingClientRect();
              const area = rect.width * rect.height;
              const isVisible = rect.width > 0 && rect.height > 0 && 
                window.getComputedStyle(el).display !== 'none' && 
                window.getComputedStyle(el).visibility !== 'hidden';
              return { element: el, area, isVisible };
            })
            .filter(item => item.isVisible)
            .sort((a, b) => b.area - a.area);
          
          if (sortedElements.length > 0) {
            return pattern;
          }
        } else {
          return pattern;
        }
      }
    }
    
    return null;
  }, contentType);
  
  debug(`Best selector for ${contentType}: ${bestSelector || 'None found'}`);
  return bestSelector;
}

/**
 * Learns from successful selectors to improve future selector suggestions
 */
export class SelectorLearner {
  private successfulSelectors: Map<string, number> = new Map();
  private failedSelectors: Map<string, number> = new Map();
  private selectorPatterns: Map<string, number> = new Map();
  
  /**
   * Records a successful selector
   */
  recordSuccess(selector: string): void {
    this.successfulSelectors.set(
      selector, 
      (this.successfulSelectors.get(selector) || 0) + 1
    );
    
    // Extract patterns from the selector
    this.extractAndRecordPatterns(selector, true);
  }
  
  /**
   * Records a failed selector
   */
  recordFailure(selector: string): void {
    this.failedSelectors.set(
      selector, 
      (this.failedSelectors.get(selector) || 0) + 1
    );
    
    // Extract patterns from the selector
    this.extractAndRecordPatterns(selector, false);
  }
  
  /**
   * Extracts patterns from a selector and records them
   */
  private extractAndRecordPatterns(selector: string, isSuccess: boolean): void {
    // Extract class patterns
    const classMatches = selector.match(/\.[a-zA-Z0-9_-]+/g);
    if (classMatches) {
      for (const match of classMatches) {
        this.updatePatternScore(match, isSuccess);
      }
    }
    
    // Extract ID patterns
    const idMatches = selector.match(/#[a-zA-Z0-9_-]+/g);
    if (idMatches) {
      for (const match of idMatches) {
        this.updatePatternScore(match, isSuccess);
      }
    }
    
    // Extract attribute patterns
    const attrMatches = selector.match(/\[[a-zA-Z0-9_-]+[=~|^$*]?=?[^\]]*\]/g);
    if (attrMatches) {
      for (const match of attrMatches) {
        this.updatePatternScore(match, isSuccess);
      }
    }
    
    // Extract tag patterns
    const tagMatches = selector.match(/^[a-zA-Z0-9]+/g);
    if (tagMatches) {
      for (const match of tagMatches) {
        this.updatePatternScore(match, isSuccess);
      }
    }
  }
  
  /**
   * Updates the score for a pattern
   */
  private updatePatternScore(pattern: string, isSuccess: boolean): void {
    const currentScore = this.selectorPatterns.get(pattern) || 0;
    this.selectorPatterns.set(
      pattern, 
      isSuccess ? currentScore + 1 : currentScore - 0.5
    );
  }
  
  /**
   * Gets the most successful patterns
   */
  getTopPatterns(limit: number = 10): Array<{ pattern: string; score: number }> {
    return Array.from(this.selectorPatterns.entries())
      .filter(([_, score]) => score > 0)
      .sort(([_, scoreA], [__, scoreB]) => scoreB - scoreA)
      .slice(0, limit)
      .map(([pattern, score]) => ({ pattern, score }));
  }
  
  /**
   * Suggests selectors based on learned patterns
   */
  suggestSelectors(page: Page, contentType: string): Promise<string[]> {
    // Get top patterns
    const topPatterns = this.getTopPatterns(5);
    
    // Use patterns to generate selectors
    return page.evaluate(patterns => {
      const selectors: string[] = [];
      
      for (const { pattern } of patterns) {
        // Try to find elements matching the pattern
        try {
          const elements = document.querySelectorAll(pattern);
          if (elements.length > 0) {
            selectors.push(pattern);
          }
        } catch (e) {
          // Invalid selector, skip
        }
      }
      
      // Add content type specific selectors
      if (contentType === 'content') {
        selectors.push(...[
          'main', 'article', '.content', '.main-content', 
          '.article', '.post', '.page-content', '#content'
        ]);
      } else if (contentType === 'navigation') {
        selectors.push(...[
          'nav', '.nav', '.navigation', '.menu', '.navbar'
        ]);
      } else if (contentType === 'form') {
        selectors.push(...[
          'form', '.form', '.login-form', '.signup-form', '.contact-form'
        ]);
      }
      
      return [...new Set(selectors)];
    }, topPatterns);
  }
}

// Create a singleton instance
export const selectorLearner = new SelectorLearner(); 