import type { Page } from "playwright";
import { debug, info } from "../../utils/logging";
import { discoverContentSelectors, findBestSelectorForContent } from "../selectors/discovery";

/**
 * Represents a component in the page structure
 */
export interface PageComponent {
  type: 'header' | 'footer' | 'navigation' | 'main' | 'sidebar' | 'article' | 'form' | 'unknown';
  selector: string;
  confidence: number; // 0-1 score indicating confidence
  children: PageComponent[];
  attributes?: Record<string, string>;
  metrics?: {
    area?: number;
    visibleArea?: number;
    position?: { x: number; y: number; width: number; height: number };
    zIndex?: number;
  };
}

/**
 * Represents the overall structure of a page
 */
export interface PageStructure {
  url: string;
  title: string;
  description?: string;
  components: PageComponent[];
  mainContent?: PageComponent;
  navigation?: PageComponent;
  header?: PageComponent;
  footer?: PageComponent;
  forms?: PageComponent[];
  timestamp: number;
}

/**
 * Options for page structure analysis
 */
export interface PageStructureOptions {
  includeMetrics?: boolean; // Include size and position metrics
  includeAttributes?: boolean; // Include element attributes
  maxDepth?: number; // Maximum depth for component hierarchy
  minConfidence?: number; // Minimum confidence score (0-1)
}

/**
 * Default options for page structure analysis
 */
const DEFAULT_STRUCTURE_OPTIONS: PageStructureOptions = {
  includeMetrics: true,
  includeAttributes: true,
  maxDepth: 3,
  minConfidence: 0.5
};

/**
 * Analyzes the page structure to identify key components
 */
export async function analyzePageStructure(
  page: Page,
  options: PageStructureOptions = {}
): Promise<PageStructure> {
  const mergedOptions = { ...DEFAULT_STRUCTURE_OPTIONS, ...options };
  
  debug("Starting page structure analysis");
  
  // Get basic page information
  const url = page.url();
  const title = await page.title();
  let description: string | undefined;
  
  try {
    description = await page.$eval('meta[name="description"]', el => el.getAttribute('content') || '');
  } catch (err) {
    // No description meta tag, that's okay
  }
  
  // Discover content selectors to help identify components
  const contentSelectors = await discoverContentSelectors(page);
  
  // Find key components using specialized selectors
  const [headerSelector, footerSelector, navSelector, mainSelector] = await Promise.all([
    findBestSelectorForContent(page, 'header'),
    findBestSelectorForContent(page, 'footer'),
    findBestSelectorForContent(page, 'navigation'),
    findBestSelectorForContent(page, 'main')
  ]);
  
  // Execute structure analysis in the browser context
  const components = await page.evaluate(
    function(params) {
      const { headerSel, footerSel, navSel, mainSel, opts, contentSels } = params;
      
      // Helper function to get element metrics
      function getElementMetrics(element: Element) {
        const rect = element.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(element);
        
        // Calculate visible area (accounting for overflow and visibility)
        let visibleArea = rect.width * rect.height;
        if (
          computedStyle.overflow === 'hidden' || 
          computedStyle.display === 'none' || 
          computedStyle.visibility === 'hidden'
        ) {
          visibleArea = 0;
        }
        
        return {
          area: rect.width * rect.height,
          visibleArea,
          position: {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height
          },
          zIndex: parseInt(computedStyle.zIndex) || 0
        };
      }
      
      // Helper function to get element attributes
      function getElementAttributes(element: Element) {
        const attributes: Record<string, string> = {};
        
        // Get important attributes
        for (const attr of ['id', 'class', 'role', 'aria-label', 'title']) {
          const value = element.getAttribute(attr);
          if (value) attributes[attr] = value;
        }
        
        // Get data attributes
        for (const attrName of Array.from(element.attributes)
          .map(attr => attr.name)
          .filter(name => name.startsWith('data-'))
        ) {
          attributes[attrName] = element.getAttribute(attrName) || '';
        }
        
        return attributes;
      }
      
      // Helper function to determine component type
      function determineComponentType(element: Element): 'header' | 'footer' | 'navigation' | 'main' | 'sidebar' | 'article' | 'form' | 'unknown' {
        const tagName = element.tagName.toLowerCase();
        const classList = Array.from(element.classList).map(c => c.toLowerCase());
        const id = element.id.toLowerCase();
        const role = element.getAttribute('role');
        
        // Check tag name first
        if (tagName === 'header' || tagName === 'head') return 'header';
        if (tagName === 'footer') return 'footer';
        if (tagName === 'nav') return 'navigation';
        if (tagName === 'main') return 'main';
        if (tagName === 'aside') return 'sidebar';
        if (tagName === 'article') return 'article';
        if (tagName === 'form') return 'form';
        
        // Check role
        if (role === 'banner') return 'header';
        if (role === 'contentinfo') return 'footer';
        if (role === 'navigation') return 'navigation';
        if (role === 'main') return 'main';
        if (role === 'complementary') return 'sidebar';
        if (role === 'article') return 'article';
        if (role === 'form') return 'form';
        
        // Check class and id
        const classAndId = [...classList, id].join(' ');
        if (classAndId.includes('header') || classAndId.includes('banner')) return 'header';
        if (classAndId.includes('footer')) return 'footer';
        if (classAndId.includes('nav') || classAndId.includes('menu')) return 'navigation';
        if (classAndId.includes('main') || classAndId.includes('content')) return 'main';
        if (classAndId.includes('sidebar') || classAndId.includes('aside')) return 'sidebar';
        if (classAndId.includes('article') || classAndId.includes('post')) return 'article';
        if (classAndId.includes('form')) return 'form';
        
        // Check content
        if (element.querySelectorAll('a').length > 3) return 'navigation';
        if (element.querySelectorAll('input, textarea, select, button').length > 2) return 'form';
        
        // Default
        return 'unknown';
      }
      
      // Helper function to calculate confidence score
      function calculateConfidence(element: Element, type: string): number {
        let score = 0.5; // Start with neutral score
        
        // Boost score based on tag name match
        if (element.tagName.toLowerCase() === type) score += 0.3;
        
        // Boost score based on role match
        const role = element.getAttribute('role');
        if (role === type || 
            (role === 'banner' && type === 'header') ||
            (role === 'contentinfo' && type === 'footer') ||
            (role === 'complementary' && type === 'sidebar')) {
          score += 0.3;
        }
        
        // Boost score based on class/id match
        const classAndId = [...Array.from(element.classList), element.id].join(' ').toLowerCase();
        if (classAndId.includes(type)) score += 0.2;
        
        // Boost score based on position
        const rect = element.getBoundingClientRect();
        if (type === 'header' && rect.top < 100) score += 0.1;
        if (type === 'footer' && rect.bottom > window.innerHeight - 100) score += 0.1;
        if (type === 'sidebar' && (rect.left < 300 || rect.right > window.innerWidth - 300)) score += 0.1;
        
        // Cap at 1.0
        return Math.min(score, 1.0);
      }
      
      // Helper function to analyze a component and its children
      function analyzeComponent(
        element: Element, 
        depth: number = 0
      ): {
        type: 'header' | 'footer' | 'navigation' | 'main' | 'sidebar' | 'article' | 'form' | 'unknown';
        selector: string;
        confidence: number;
        children: any[];
        attributes?: Record<string, string>;
        metrics?: {
          area?: number;
          visibleArea?: number;
          position?: { x: number; y: number; width: number; height: number };
          zIndex?: number;
        };
      } {
        // Determine component type
        const type = determineComponentType(element);
        
        // Calculate confidence
        const confidence = calculateConfidence(element, type);
        
        // Generate selector
        let selector = '';
        if (element.id) {
          selector = `#${element.id}`;
        } else if (element.classList.length > 0) {
          selector = `.${Array.from(element.classList).join('.')}`;
        } else {
          selector = element.tagName.toLowerCase();
        }
        
        // Get metrics if requested
        const metrics = opts.includeMetrics ? getElementMetrics(element) : undefined;
        
        // Get attributes if requested
        const attributes = opts.includeAttributes ? getElementAttributes(element) : undefined;
        
        // Process children if not at max depth
        const children: any[] = [];
        if (depth < (opts.maxDepth || 3)) {
          // Only process significant children to avoid overwhelming with too many components
          const childElements = Array.from(element.children)
            .filter(child => {
              const rect = child.getBoundingClientRect();
              return rect.width > 50 && rect.height > 50;
            })
            .slice(0, 10); // Limit to 10 children per component
          
          for (const child of childElements) {
            const childType = determineComponentType(child);
            // Only include children that have a meaningful type or are large
            if (childType !== 'unknown' || child.getBoundingClientRect().width > 200) {
              children.push(analyzeComponent(child, depth + 1));
            }
          }
        }
        
        return {
          type,
          selector,
          confidence,
          children,
          attributes,
          metrics
        };
      }
      
      // Start the analysis with key components
      const components: any[] = [];
      
      // Process header
      if (headerSel) {
        const headerElement = document.querySelector(headerSel);
        if (headerElement) {
          components.push(analyzeComponent(headerElement));
        }
      }
      
      // Process footer
      if (footerSel) {
        const footerElement = document.querySelector(footerSel);
        if (footerElement) {
          components.push(analyzeComponent(footerElement));
        }
      }
      
      // Process navigation
      if (navSel) {
        const navElement = document.querySelector(navSel);
        if (navElement) {
          components.push(analyzeComponent(navElement));
        }
      }
      
      // Process main content
      if (mainSel) {
        const mainElement = document.querySelector(mainSel);
        if (mainElement) {
          components.push(analyzeComponent(mainElement));
        }
      }
      
      // Process additional components from content selectors
      for (const contentSel of contentSels) {
        // Skip if already processed or confidence is too low
        if (
          contentSel.confidence < (opts.minConfidence || 0.5) ||
          [headerSel, footerSel, navSel, mainSel].includes(contentSel.selector)
        ) {
          continue;
        }
        
        try {
          const element = document.querySelector(contentSel.selector);
          if (element) {
            components.push(analyzeComponent(element));
          }
        } catch (e) {
          // Invalid selector, skip
        }
      }
      
      return components;
    },
    {
      headerSel: headerSelector,
      footerSel: footerSelector,
      navSel: navSelector,
      mainSel: mainSelector,
      opts: mergedOptions,
      contentSels: contentSelectors
    }
  );
  
  // Create the page structure
  const pageStructure: PageStructure = {
    url,
    title,
    description,
    components: components as PageComponent[],
    timestamp: Date.now()
  };
  
  // Identify key components
  const typedComponents = components as PageComponent[];
  pageStructure.header = typedComponents.find(c => c.type === 'header');
  pageStructure.footer = typedComponents.find(c => c.type === 'footer');
  pageStructure.navigation = typedComponents.find(c => c.type === 'navigation');
  pageStructure.mainContent = typedComponents.find(c => c.type === 'main' || c.type === 'article');
  pageStructure.forms = typedComponents.filter(c => c.type === 'form');
  
  debug(`Analyzed page structure with ${typedComponents.length} top-level components`);
  return pageStructure;
}

/**
 * Classifies the page based on its structure and content
 */
export async function classifyPage(page: Page): Promise<{
  type: 'article' | 'product' | 'search' | 'login' | 'signup' | 'profile' | 'listing' | 'homepage' | 'unknown';
  confidence: number;
  features: string[];
}> {
  debug("Classifying page type");
  
  // Execute classification in browser context
  const classification = await page.evaluate(() => {
    // Helper function to check for features
    function hasFeature(selectors: string[], threshold: number = 1): boolean {
      for (const selector of selectors) {
        try {
          const elements = document.querySelectorAll(selector);
          if (elements.length >= threshold) {
            return true;
          }
        } catch (e) {
          // Invalid selector, skip
        }
      }
      return false;
    }
    
    // Check for various page features
    const features: string[] = [];
    
    // Article features
    if (
      hasFeature(['article', '.article', '.post', '.blog-post']) ||
      hasFeature(['h1, h2, h3, h4, h5, h6'], 3) ||
      hasFeature(['p'], 5)
    ) {
      features.push('article');
    }
    
    // Product features
    if (
      hasFeature(['.product', '.product-details', '.product-info']) ||
      hasFeature(['button[type="add-to-cart"], .add-to-cart, .buy-now']) ||
      (hasFeature(['.price, .product-price']) && hasFeature(['.product-title, .product-name']))
    ) {
      features.push('product');
    }
    
    // Search features
    if (
      hasFeature(['input[type="search"], .search-input, .search-box']) ||
      hasFeature(['.search-results, .results']) ||
      hasFeature(['.search-form, form[role="search"]'])
    ) {
      features.push('search');
    }
    
    // Login features
    if (
      hasFeature(['form[action*="login"], .login-form, #login-form']) ||
      (hasFeature(['input[type="password"]']) && hasFeature(['input[type="email"], input[type="text"]']))
    ) {
      features.push('login');
    }
    
    // Signup features
    if (
      hasFeature(['form[action*="register"], .signup-form, .register-form']) ||
      hasFeature(['input[name="confirm-password"], input[name="password_confirmation"]'])
    ) {
      features.push('signup');
    }
    
    // Profile features
    if (
      hasFeature(['.profile, .user-profile, .account']) ||
      hasFeature(['.avatar, .profile-picture, .user-avatar']) ||
      hasFeature(['.profile-info, .user-info'])
    ) {
      features.push('profile');
    }
    
    // Listing features
    if (
      hasFeature(['.list, .listing, .results']) ||
      hasFeature(['.item, .card, .product-card'], 3) ||
      hasFeature(['.pagination'])
    ) {
      features.push('listing');
    }
    
    // Homepage features
    if (
      window.location.pathname === '/' || 
      window.location.pathname === '/index.html' ||
      hasFeature(['.hero, .banner, .carousel, .slider']) ||
      hasFeature(['.featured, .highlights, .showcase'])
    ) {
      features.push('homepage');
    }
    
    // Determine the most likely page type
    let type: 'article' | 'product' | 'search' | 'login' | 'signup' | 'profile' | 'listing' | 'homepage' | 'unknown' = 'unknown';
    let confidence = 0.3; // Start with low confidence
    
    if (features.includes('article')) {
      type = 'article';
      confidence = 0.6;
    }
    
    if (features.includes('product')) {
      type = 'product';
      confidence = 0.7;
    }
    
    if (features.includes('search')) {
      type = 'search';
      confidence = 0.8;
    }
    
    if (features.includes('login')) {
      type = 'login';
      confidence = 0.9;
    }
    
    if (features.includes('signup')) {
      type = 'signup';
      confidence = 0.9;
    }
    
    if (features.includes('profile')) {
      type = 'profile';
      confidence = 0.7;
    }
    
    if (features.includes('listing')) {
      type = 'listing';
      confidence = 0.6;
    }
    
    if (features.includes('homepage')) {
      type = 'homepage';
      confidence = 0.5;
    }
    
    // Boost confidence if multiple features align
    if (features.length > 1 && features.includes(type)) {
      confidence += 0.1;
    }
    
    // Cap confidence at 1.0
    confidence = Math.min(confidence, 1.0);
    
    return { type, confidence, features };
  });
  
  debug(`Classified page as ${classification.type} with confidence ${classification.confidence}`);
  return classification;
}

/**
 * Identifies the main content area of a page
 */
export async function identifyMainContent(page: Page): Promise<{
  selector: string;
  confidence: number;
  text?: string;
  html?: string;
}> {
  debug("Identifying main content area");
  
  // Try to find the main content using specialized selectors
  const mainSelector = await findBestSelectorForContent(page, 'main');
  
  if (mainSelector) {
    // Get content details
    const contentDetails = await page.evaluate((selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      
      return {
        selector,
        confidence: 0.9,
        text: element.textContent?.trim().substring(0, 500),
        html: element.innerHTML.substring(0, 1000)
      };
    }, mainSelector);
    
    if (contentDetails) {
      debug(`Identified main content with selector: ${mainSelector}`);
      return contentDetails;
    }
  }
  
  // If specialized selector failed, use heuristics
  const contentResult = await page.evaluate(() => {
    // Common content selectors to try
    const selectors = [
      'main',
      'article',
      '#content',
      '.content',
      '.main-content',
      '.article-content',
      '.post-content',
      '.page-content',
      'section.content',
      '.entry-content'
    ];
    
    // Helper function to score content areas
    function scoreElement(element: Element): number {
      if (!element) return 0;
      
      let score = 0;
      
      // Score based on tag name
      const tagName = element.tagName.toLowerCase();
      if (tagName === 'main') score += 30;
      if (tagName === 'article') score += 25;
      if (tagName === 'section') score += 15;
      if (tagName === 'div') score += 5;
      
      // Score based on ID and class
      const id = element.id.toLowerCase();
      const classNames = Array.from(element.classList).map(c => c.toLowerCase());
      
      if (id.includes('content') || id.includes('main')) score += 20;
      if (classNames.some(c => c.includes('content') || c.includes('main'))) score += 15;
      if (classNames.some(c => c.includes('article') || c.includes('post'))) score += 15;
      
      // Score based on content
      const textLength = element.textContent?.trim().length || 0;
      score += Math.min(textLength / 100, 20); // Up to 20 points for text length
      
      // Score based on child elements
      const paragraphs = element.querySelectorAll('p').length;
      score += Math.min(paragraphs * 2, 20); // Up to 20 points for paragraphs
      
      const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6').length;
      score += Math.min(headings * 3, 15); // Up to 15 points for headings
      
      // Score based on position and size
      const rect = element.getBoundingClientRect();
      const area = rect.width * rect.height;
      const viewportArea = window.innerWidth * window.innerHeight;
      
      score += Math.min((area / viewportArea) * 100, 20); // Up to 20 points for size
      
      // Penalize if it's likely navigation or footer
      if (element.querySelectorAll('nav, footer').length > 0) score -= 30;
      if (element.querySelectorAll('a').length > 10 && paragraphs < 3) score -= 20;
      
      return score;
    }
    
    // Try each selector and score the results
    const candidates: Array<{
      selector: string;
      element: Element;
      score: number;
    }> = [];
    
    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const element of Array.from(elements)) {
          const score = scoreElement(element);
          if (score > 0) {
            candidates.push({ selector, element, score });
          }
        }
      } catch (e) {
        // Invalid selector, skip
      }
    }
    
    // If no candidates found with selectors, try scoring all large elements
    if (candidates.length === 0) {
      const allElements = document.querySelectorAll('div, section, article, main');
      for (const element of Array.from(allElements)) {
        const rect = element.getBoundingClientRect();
        // Only consider reasonably sized elements
        if (rect.width > 200 && rect.height > 200) {
          const score = scoreElement(element);
          if (score > 30) { // Higher threshold for generic elements
            // Generate a selector
            let selector = element.tagName.toLowerCase();
            if (element.id) {
              selector = `#${element.id}`;
            } else if (element.classList.length > 0) {
              selector = `.${Array.from(element.classList).join('.')}`;
            }
            candidates.push({ selector, element, score });
          }
        }
      }
    }
    
    // Sort by score and get the best candidate
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    
    if (best) {
      // Calculate confidence based on score
      // Scores typically range from 30-150, so normalize to 0-1
      const normalizedScore = Math.min(best.score / 150, 1);
      
      return {
        selector: best.selector,
        confidence: normalizedScore,
        text: best.element.textContent?.trim().substring(0, 500),
        html: best.element.innerHTML.substring(0, 1000)
      };
    }
    
    // Fallback to body if nothing better found
    return {
      selector: 'body',
      confidence: 0.3,
      text: document.body.textContent?.trim().substring(0, 500),
      html: document.body.innerHTML.substring(0, 1000)
    };
  });
  
  debug(`Identified main content with selector: ${contentResult.selector} (confidence: ${contentResult.confidence})`);
  return contentResult;
}

/**
 * Generates a hierarchical representation of the page structure
 */
export async function generatePageHierarchy(page: Page): Promise<{
  hierarchy: any;
  depth: number;
}> {
  debug("Generating page hierarchy");
  
  // Execute in browser context
  const hierarchy = await page.evaluate(() => {
    // Helper function to create a simplified representation of an element
    function simplifyElement(element: Element, depth: number = 0, maxDepth: number = 3): any {
      if (depth > maxDepth) return { type: '...', children: [] };
      
      const tagName = element.tagName.toLowerCase();
      const id = element.id ? `#${element.id}` : '';
      const classList = Array.from(element.classList);
      const className = classList.length > 0 ? `.${classList.join('.')}` : '';
      
      // Get important attributes
      const attributes: Record<string, string> = {};
      for (const attr of ['role', 'aria-label', 'title', 'alt', 'name', 'type']) {
        const value = element.getAttribute(attr);
        if (value) attributes[attr] = value;
      }
      
      // Get text content (truncated)
      let text = '';
      if (element.childNodes.length === 1 && element.childNodes[0].nodeType === Node.TEXT_NODE) {
        text = element.textContent?.trim().substring(0, 50) || '';
        if (text.length === 50) text += '...';
      }
      
      // Process children
      const children: any[] = [];
      if (depth < maxDepth) {
        // Only include significant children
        const childElements = Array.from(element.children)
          .filter(child => {
            const rect = child.getBoundingClientRect();
            return rect.width > 20 && rect.height > 20;
          });
        
        // Limit children to avoid overwhelming output
        const maxChildren = 10;
        const processedChildren = childElements.slice(0, maxChildren);
        
        for (const child of processedChildren) {
          children.push(simplifyElement(child, depth + 1, maxDepth));
        }
        
        // Add indicator if children were truncated
        if (childElements.length > maxChildren) {
          children.push({
            type: `... (${childElements.length - maxChildren} more)`,
            children: []
          });
        }
      }
      
      return {
        type: tagName + id + className,
        attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
        text: text || undefined,
        children
      };
    }
    
    // Start with the body element
    const hierarchy = simplifyElement(document.body, 0, 3);
    
    return {
      hierarchy,
      depth: 3
    };
  });
  
  debug(`Generated page hierarchy with depth ${hierarchy.depth}`);
  return hierarchy;
} 