import type { Page, ElementHandle } from 'playwright';
import type { Input } from '../types';
import { getFullPath } from '../core/scripts';

export async function getElementInfo(page: Page, element: ElementHandle<Element>): Promise<Input> {
  const info = await element.evaluate((el: Element) => {
    const htmlElement = el as HTMLElement;
    
    let label = '';
    
    if (htmlElement.id) {
      const explicitLabel = document.querySelector(`label[for="${htmlElement.id}"]`)?.textContent?.trim();
      if (explicitLabel) label = explicitLabel;
    }
    if (!label) {
      label = htmlElement.getAttribute('aria-label') || 
              htmlElement.getAttribute('aria-labelledby')?.split(' ')
                .map((id: string) => document.getElementById(id)?.textContent?.trim())
                .filter(Boolean)
                .join(' ') ||
              '';
    }
    if (!label) {
      const parentWithLabel = htmlElement.closest('[aria-label]');
      if (parentWithLabel) {
        label = parentWithLabel.getAttribute('aria-label') || '';
      }
    }
    if (!label) {
      label = htmlElement.getAttribute('placeholder') || 
              htmlElement.getAttribute('data-placeholder') ||
              htmlElement.getAttribute('aria-placeholder') ||
              '';
    }
    if (!label && htmlElement.getAttribute('contenteditable') === 'true') {
      label = htmlElement.textContent?.trim() || '';
    }
    if (!label) {
      const previousText = htmlElement.previousElementSibling?.textContent?.trim();
      const parentStartText = htmlElement.parentElement?.firstChild?.textContent?.trim();
      label = previousText || parentStartText || '';
    }
    if (!label) {
      label = htmlElement.getAttribute('name') ||
              htmlElement.id ||
              htmlElement.getAttribute('role') ||
              'No label';
    }
    const isVisible = (element: Element): boolean => {
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return false;
      }
      if (element.parentElement) {
        return isVisible(element.parentElement);
      }
      return true;
    };
    return {
      type: htmlElement.tagName.toLowerCase(),
      name: htmlElement.getAttribute('name') || '',
      id: htmlElement.id || '',
      value: (htmlElement as HTMLInputElement).value || '',
      placeholder: htmlElement.getAttribute('placeholder') || '',
      selector: window.getFullPath(htmlElement),
      label,
      isVisible: isVisible(htmlElement)
    };
  });
  return info;
} 