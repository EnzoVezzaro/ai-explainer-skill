// Capture real screenshots of key pages as e2e evidence.
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:5173';
const PAGES = [
  ['landing', '/'],
  ['docs-installation', '/docs/installation.html'],
  ['docs-commands', '/docs/commands.html'],
  ['docs-security', '/docs/security.html'],
  ['docs-platforms', '/docs/platforms.html'],
  ['playground', '/playground.html'],
  ['examples', '/examples.html'],
];

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  for (const [name, url] of PAGES) {
    const page = await context.newPage();
    await page.goto(BASE + url, { waitUntil: 'networkidle' });
    await page.screenshot({ path: `test-results/evidence-${name}.png`, fullPage: true });
    await page.close();
  }
  // mobile evidence
  const mpage = await context.newPage();
  await mpage.setViewportSize({ width: 375, height: 812 });
  await mpage.goto(BASE + '/', { waitUntil: 'networkidle' });
  await mpage.screenshot({ path: 'test-results/evidence-landing-mobile.png', fullPage: true });
  await mpage.close();
  await browser.close();
  console.log('screenshots captured in test-results/');
})();
