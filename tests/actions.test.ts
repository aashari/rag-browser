import { test, expect } from 'bun:test';
import { chromium } from 'playwright';
import { executeAction } from '../src/core/actions';
import type { Action } from '../src/types';

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
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent('<input id="testInput">');
  
  // Test typing action
  const typingAction: Action = { type: 'typing', element: '#testInput', value: 'test' };
  const typingResult = await executeAction(page, typingAction, { headless: true });
  expect(typingResult.success).toBe(true);
  expect(typingResult.message).toBe('Text entered');
  
  // Test keyPress action
  const keyPressAction: Action = { type: 'keyPress', key: 'Enter', element: '#testInput' };
  const keyPressResult = await executeAction(page, keyPressAction, { headless: true });
  expect(keyPressResult.success).toBe(true);
  expect(keyPressResult.message).toBe('Key pressed');
  
  const value = await page.$eval('#testInput', el => (el as HTMLInputElement).value);
  expect(value).toBe('test');
  await browser.close();
}, 10000);

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