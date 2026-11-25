import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGES = ['/', '/ausflugsziele', '/panorama', '/galerie', '/videos', '/blog', '/blog/saisonstart', '/info', '/impressum'];

// Externe Dienste (YouTube) im Test nicht wirklich laden
test.beforeEach(async ({ page }) => {
  await page.route(/youtube-nocookie\.com|i\.ytimg\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }));
});

function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('response', (r) => r.status() >= 400 && r.url().startsWith('http://localhost') && errors.push(`${r.status()} ${r.url()}`));
  return errors;
}

for (const path of PAGES) {
  test(`${path}: lädt ohne Fehler, ohne horizontales Scrollen, barrierefrei`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(path);
    await expect(page.locator('h1')).toHaveCount(1);
    // Alle Bilder laden (lazy Bilder durch Scrollen auslösen)
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 30));
      }
    });
    await page.waitForLoadState('networkidle');
    const broken = await page.evaluate(() =>
      [...document.images].filter((i) => i.currentSrc && i.complete && i.naturalWidth === 0).map((i) => i.currentSrc),
    );
    expect(broken, 'kaputte Bilder').toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, 'horizontaler Überlauf').toBeLessThanOrEqual(0);

    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const serious = axe.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('Navigation funktioniert (Desktop & Handy-Menü)', async ({ page, isMobile }) => {
  await page.goto('/');
  if (isMobile) {
    const toggle = page.getByRole('button', { name: 'Menü' });
    await expect(page.locator('[data-nav] a').first()).toBeHidden();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
  }
  await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name: 'Galerie' }).click();
  await expect(page).toHaveURL(/\/galerie$/);
  await expect(page.locator('[data-nav] a[href="/galerie"]')).toHaveAttribute('aria-current', 'page');
});

test('Skip-Link springt zum Inhalt', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Tastatur nur Desktop');
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Zum Inhalt springen' });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#inhalt$/);
});

test('360°-Panorama startet, dreht und wechselt den Standort', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/panorama');
  const viewer = page.locator('[data-pano-viewer]');
  await page.getByRole('button', { name: /360° Rundblick starten/ }).click();
  await expect(viewer).toHaveAttribute('data-state', 'ready', { timeout: 15_000 });
  await expect(viewer.locator('canvas')).toBeVisible();
  await expect(page.locator('.pnlm-fullscreen-toggle-button')).toBeVisible();

  // Ziehen dreht die Ansicht
  const box = await viewer.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 200, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();

  await page.getByRole('button', { name: 'Gipfelstation' }).click();
  await expect(page.getByRole('button', { name: 'Gipfelstation' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-pano-caption]')).toContainText('2600');
  await expect(viewer).toHaveAttribute('data-state', 'ready', { timeout: 15_000 });
  await expect(viewer).toHaveAttribute('aria-label', /Gipfelstation/);
  expect(errors).toEqual([]);
});

test('Galerie: Lightbox mit Blättern, Tastatur und Schliessen', async ({ page, isMobile }) => {
  await page.goto('/galerie');
  const items = page.locator('[data-gallery-item]');
  const total = await items.count();
  expect(total).toBeGreaterThan(3);
  await items.first().click();
  const dialog = page.locator('[data-lightbox]');
  await expect(dialog).toBeVisible();
  const img = dialog.locator('[data-lightbox-img]');
  await expect.poll(() => img.evaluate((i) => i.complete && i.naturalWidth)).toBeGreaterThan(0);
  await expect(dialog.locator('[data-lightbox-count]')).toHaveText(`1 / ${total}`);

  await dialog.getByRole('button', { name: 'Nächstes Bild' }).click();
  await expect(dialog.locator('[data-lightbox-count]')).toHaveText(`2 / ${total}`);
  await dialog.getByRole('button', { name: 'Vorheriges Bild' }).click();
  await dialog.getByRole('button', { name: 'Vorheriges Bild' }).click();
  await expect(dialog.locator('[data-lightbox-count]')).toHaveText(`${total} / ${total}`);

  if (!isMobile) {
    await page.keyboard.press('ArrowRight');
    await expect(dialog.locator('[data-lightbox-count]')).toHaveText(`1 / ${total}`);
    await page.keyboard.press('Escape');
  } else {
    await dialog.getByRole('button', { name: 'Schliessen' }).click();
  }
  await expect(dialog).toBeHidden();
});

test('YouTube-Video wird erst beim Klick geladen', async ({ page }) => {
  await page.goto('/videos');
  await expect(page.locator('iframe')).toHaveCount(0);
  await page.getByRole('link', { name: /Video abspielen: Ein Wintertag/ }).click();
  const iframe = page.locator('iframe').first();
  await expect(iframe).toHaveAttribute('src', /^https:\/\/www\.youtube-nocookie\.com\/embed\/[\w-]{11}\?autoplay=1/);
  await expect(iframe).toHaveAttribute('title', 'Ein Wintertag in Steinbach');
  await expect(iframe).toHaveAttribute('allowfullscreen', '');
});

test('Blog: von der Liste zum Artikel und zurück', async ({ page }) => {
  await page.goto('/blog');
  const first = page.locator('.article-card h3 a').first();
  const title = await first.textContent();
  await first.click();
  await expect(page.locator('h1')).toHaveText(title.trim());
  await expect(page.locator('.prose')).not.toBeEmpty();
  await page.getByRole('link', { name: 'Alle Beiträge' }).first().click();
  await expect(page).toHaveURL(/\/blog$/);
});

test('Ganze Karte ist klickbar (Blog-Karte)', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('.article-card').first();
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  await page.mouse.click(box.x + 20, box.y + 20); // Bildbereich, nicht der Titel
  await expect(page).toHaveURL(/\/blog\/[a-z0-9-]+$/);
});

test('404-Seite mit Weg zurück', async ({ page }) => {
  const res = await page.goto('/irgendwas');
  expect(res.status()).toBe(404);
  await page.getByRole('link', { name: 'Zur Startseite' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('Funktioniert auch ohne JavaScript', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('/videos');
  await expect(page.getByRole('link', { name: /Video abspielen/ }).first()).toHaveAttribute('href', /youtube\.com\/watch/);
  await page.goto('/galerie');
  await expect(page.locator('[data-gallery-item]').first()).toHaveAttribute('href', /\.webp$/);
  await ctx.close();
});

test('Ladezeit: Startseite schnell und leichtgewichtig', async ({ page }) => {
  await page.goto('/');
  const t = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const res = performance.getEntriesByType('resource');
    return {
      dcl: nav.domContentLoadedEventEnd,
      bytes: res.reduce((s, r) => s + (r.transferSize || 0), 0) + nav.transferSize,
    };
  });
  expect(t.dcl).toBeLessThan(1500);
  expect(t.bytes).toBeLessThan(1_000_000); // erste Ansicht unter 1 MB
  const lcp = await page.evaluate(
    () => new Promise((resolve) => new PerformanceObserver((l) => resolve(l.getEntries().at(-1).startTime)).observe({ type: 'largest-contentful-paint', buffered: true })),
  );
  expect(lcp).toBeLessThan(2500);
});
