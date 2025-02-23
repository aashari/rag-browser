import { test, expect } from 'bun:test';
import { chromium } from 'playwright';
import { executeAction } from '../src/core/actions';
import type { Action } from '../src/types';
import { debug } from '../src/utils/logging';

test('executeAction - wait action', async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent('<input id="testInput">');
  const action: Action = { type: 'wait', elements: ['#testInput'] };
  const result = await executeAction(page, action, { headless: true });
  expect(result.success).toBe(true);
  expect(result.message).toBe('Elements found and stable');
  await browser.close();
});

test('executeAction - typing action', async () => {
  debug('Starting typing action test');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Use a complete HTML document with proper load events
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Test Page</title>
      </head>
      <body>
        <div id="app">
          <input id="testInput" type="text">
        </div>
      </body>
    </html>
  `);
  
  // Wait for the page to be fully loaded
  await page.waitForLoadState('domcontentloaded');
  debug('Page content set and loaded');
  
  // Test typing action
  const typingAction: Action = { type: 'typing', element: '#testInput', value: 'test' };
  debug('Executing typing action');
  const typingResult = await executeAction(page, typingAction, { headless: true });
  debug('Typing action complete', { result: typingResult });
  expect(typingResult.success).toBe(true);
  expect(typingResult.message).toBe('Text entered');
  
  // Verify the value was entered before proceeding
  const inputValue = await page.$eval('#testInput', el => (el as HTMLInputElement).value);
  expect(inputValue).toBe('test');
  
  // Test keyPress action
  const keyPressAction: Action = { type: 'keyPress', key: 'Enter', element: '#testInput' };
  debug('Executing keyPress action');
  const keyPressResult = await executeAction(page, keyPressAction, { headless: true });
  debug('KeyPress action complete', { result: keyPressResult });
  expect(keyPressResult.success).toBe(true);
  expect(keyPressResult.message).toBe('Key pressed');
  
  await browser.close();
}, 30000);

test('executeAction - print action', async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent('<div id="testDiv">Hello</div>');
  const action: Action = { type: 'print', elements: ['#testDiv'] };
  const result = await executeAction(page, action, { headless: true });
  expect(result.success).toBe(true);
  expect(result.message).toBe('HTML captured for #testDiv');
  await browser.close();
}); 