import { MAX_CLASS_LENGTH, UTILITY_CLASS_PATTERNS } from '../config/constants';

export function getMeaningfulClasses(classList: DOMTokenList): string[] {
  const classes = Array.from(classList);
  console.log('Initial classes:', classes);
  
  return classes.filter(cls => {
    // Skip empty or whitespace-only classes
    if (!cls || !cls.trim()) {
      console.log(`Skipping empty class: "${cls}"`);
      return false;
    }

    // Skip classes with special characters
    if (cls.includes(':') || 
        cls.includes('/') || 
        cls.includes('[') || 
        cls.includes('@')) {
      console.log(`Skipping special char class: "${cls}"`);
      return false;
    }

    // Skip utility classes (check each pattern independently)
    for (const pattern of UTILITY_CLASS_PATTERNS) {
      if (pattern.test(cls)) {
        console.log(`Skipping utility class: "${cls}" (matches ${pattern})`);
        return false;
      }
    }

    // Skip long class names
    if (cls.length >= MAX_CLASS_LENGTH) {
      console.log(`Skipping long class: "${cls}" (length: ${cls.length})`);
      return false;
    }

    console.log(`Keeping class: "${cls}"`);
    return true;
  });
}

export function getUniqueSelector(el: Element, includePosition = false): string {
  let selector = el.tagName.toLowerCase();
  
  // Add meaningful classes
  const classes = getMeaningfulClasses(el.classList);
  if (classes.length) {
    selector += `.${classes.join('.')}`;
  }
  
  // Add type for inputs
  if (el.tagName.toLowerCase() === 'input') {
    const type = el.getAttribute('type');
    if (type) {
      selector += `[type="${type}"]`;
    }
  }

  // Add role if present and meaningful
  const role = el.getAttribute('role');
  if (role && role !== 'button') {
    selector += `[role="${role}"]`;
  }

  // Add name if present
  const name = el.getAttribute('name');
  if (name) {
    selector += `[name="${name}"]`;
  }

  // Add aria-label if it's short and meaningful
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.length < MAX_CLASS_LENGTH) {
    selector += `[aria-label="${ariaLabel}"]`;
  }

  // Add position if needed
  if (includePosition) {
    const parent = el.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(child => 
        child.tagName === el.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(el) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }
  }

  return selector;
} 