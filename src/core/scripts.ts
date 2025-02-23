import { log } from '../utils/logging';

export function getFullPath(element: Element): string {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  let current = element;
  const path = [];

  while (current) {
    let selector = current.tagName.toLowerCase();
    
    if (current instanceof HTMLElement && current.id) {
      selector += `#${current.id}`;
      path.unshift(selector);
      break;
    }
    
    let nth = 1;
    let sibling = current.previousElementSibling;
    
    while (sibling) {
      if (sibling.tagName === current.tagName) {
        nth++;
      }
      sibling = sibling.previousElementSibling;
    }
    
    if (nth > 1) {
      selector += `:nth-of-type(${nth})`;
    }
    
    path.unshift(selector);
    current = current.parentElement as Element;
  }

  return path.join(' > ');
}

export function checkPageStability(): boolean {
  try {
    console.debug('[Stability] Starting page stability check...');
    let significantMutations = 0;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        // Ignore style and class changes
        if (mutation.type === 'attributes' && 
            (mutation.attributeName === 'style' || 
             mutation.attributeName === 'class')) {
          return;
        }
        
        // Ignore changes to hidden elements
        const target = mutation.target as HTMLElement;
        if (target.offsetParent === null) {
          return;
        }

        significantMutations++;
        console.debug(`[Stability] Significant mutation: ${mutation.type} on ${mutation.target.nodeName}`);
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    });

    // Brief timeout to collect mutations
    const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    wait(100);
    
    observer.disconnect();
    
    if (significantMutations > 0) {
      console.debug(`[Stability] Page has ${significantMutations} significant mutations`);
      return false;
    }

    console.debug('[Stability] Page appears stable');
    return true;
  } catch (error) {
    console.error('[Stability] Error in stability check:', error);
    return true; // Return true on error to allow the process to continue
  }
}

// Type definition for LayoutShift entries
interface LayoutShift extends PerformanceEntry {
  hadRecentInput: boolean;
  value: number;
}

export function checkLayoutStability(): boolean {
  try {
    console.debug('[Stability] Starting layout stability check...');
    let significantShifts = 0;
    const SHIFT_THRESHOLD = 0.05; // Only count larger shifts

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const layoutShift = entry as LayoutShift;
        if (entry.entryType === 'layout-shift' && 
            !layoutShift.hadRecentInput && 
            layoutShift.value > SHIFT_THRESHOLD) {
          significantShifts++;
          console.debug(`[Stability] Significant layout shift: ${layoutShift.value}`);
        }
      }
    });

    observer.observe({ entryTypes: ['layout-shift'] });

    // Only check critical resources
    const criticalImages = Array.from(document.querySelectorAll('img')).filter(img => {
      const rect = img.getBoundingClientRect();
      return rect.top < window.innerHeight && rect.left < window.innerWidth;
    });
    
    criticalImages.forEach((img) => {
      if (!img.complete) {
        significantShifts++;
        console.debug(`[Stability] Critical image loading: ${img.src}`);
      }
    });

    observer.disconnect();

    if (significantShifts > 0) {
      console.debug(`[Stability] Layout has ${significantShifts} significant shifts`);
      return false;
    }

    console.debug('[Stability] Layout appears stable');
    return true;
  } catch (error) {
    console.error('[Stability] Error in layout stability check:', error);
    return true; // Return true on error to allow the process to continue
  }
} 