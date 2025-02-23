import { test, expect } from 'bun:test';
import { chromium } from 'playwright';
import { waitForPageStability, waitForActionStability } from '../src/core/stability';
import { MUTATION_STABILITY_TIMEOUT } from '../src/config/constants';

test('waitForPageStability - stable page', async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent('<body><h1>Test</h1></body>');
  const result = await waitForPageStability(page, { timeout: 5000 });
  expect(result).toBe(true);
  await browser.close();
});

test('waitForPageStability - with mutations', async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent('<body><div id="container"></div></body>');
  
  // Start stability check
  const stabilityPromise = waitForPageStability(page, { timeout: 5000 });
  
  // Add mutations
  await page.evaluate(() => {
    const container = document.getElementById('container');
    if (container) {
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          const div = document.createElement('div');
          div.textContent = `Item ${i}`;
          container.appendChild(div);
        }, i * 100);
      }
    }
  });
  
  const result = await stabilityPromise;
  expect(result).toBe(true);
  
  // Verify final state
  const items = await page.$$eval('#container div', divs => divs.length);
  expect(items).toBe(3);
  
  await browser.close();
});

test('waitForActionStability - after click', async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(`
    <button id="btn">Click me</button>
    <div id="content"></div>
    <script>
      document.getElementById('btn').addEventListener('click', () => {
        const content = document.getElementById('content');
        setTimeout(() => { content.textContent = 'Loading...'; }, 100);
        setTimeout(() => { content.textContent = 'Done!'; }, 300);
      });
    </script>
  `);
  
  await page.click('#btn');
  const result = await waitForActionStability(page, { timeout: 5000 });
  expect(result).toBe(true);
  
  const content = await page.$eval('#content', el => el.textContent);
  expect(content).toBe('Done!');
  
  await browser.close();
}); 