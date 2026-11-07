import { test, expect } from '@playwright/test';

test.describe('Video Skill website', () => {
  test('landing page loads with headline and install command', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Turn video tutorials/);
    await expect(page.getByRole('heading', { name: /Turn video tutorials into skills your AI agent can execute/ })).toBeVisible();
    await expect(page.getByText('npx video-skill install')).toBeVisible();
  });

  test('navigates to docs, examples, playground, and github', async ({ page }) => {
    await page.goto('/');
    // On mobile the nav is inside a collapsed menu; open it first.
    const menuBtn = page.getByRole('button', { name: /Open menu/ });
    if (await menuBtn.isVisible()) await menuBtn.click();
    await expect(page.getByRole('link', { name: /Documentation/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Examples/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Playground/ })).toBeVisible();
    await expect(page.locator('footer a[href*="github.com"]').first()).toBeVisible();
  });

  test('docs pages are accessible', async ({ page }) => {
    for (const pageName of ['index', 'installation', 'commands', 'platforms', 'security', 'troubleshooting', 'architecture']) {
      await page.goto(`/docs/${pageName}.html`);
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('footer a[href*="github.com"]').first()).toBeVisible();
    }
  });

  test('playground has URL input and three actions', async ({ page }) => {
    await page.goto('/playground.html');
    await expect(page.getByLabel(/Public video URL/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Explain/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Create Skill/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Build/ })).toBeVisible();
  });

  test('playground warns that Build is not execution', async ({ page }) => {
    await page.goto('/playground.html');
    await expect(page.getByText(/Build ≠ Execute/)).toBeVisible();
  });

  test('examples gallery shows tutorial categories', async ({ page }) => {
    await page.goto('/examples.html');
    await expect(page.getByRole('heading', { name: /Real tutorials, real artifacts/ })).toBeVisible();
    await expect(page.getByText(/Web app/).first()).toBeVisible();
    await expect(page.getByText(/Frontend/).first()).toBeVisible();
    await expect(page.getByText(/Environment/).first()).toBeVisible();
    await expect(page.getByText(/Browser/).first()).toBeVisible();
    await expect(page.getByText(/API/).first()).toBeVisible();
    await expect(page.getByText(/SWE tutorial/).first()).toBeVisible();
  });

  test('renders on mobile without breaking layout', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Turn video tutorials/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Open menu/ })).toBeVisible();
  });
});
