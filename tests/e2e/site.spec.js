import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockExternal, WEATHER } from './mocks.js';

const PAGES = ['/', '/ausflugsziele', '/panorama', '/galerie', '/videos', '/blog', '/dorfleben', '/blog/saisonstart', '/blog/weihnachtssingen', '/info', '/impressum'];

// Externe Dienste (Fotos, Karte, YouTube, Wetter) im Test durch lokale Daten ersetzen
test.beforeEach(async ({ page }) => {
  await mockExternal(page);
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
    const fallbacks = await page.locator('img[data-fallback="done"]').count();
    expect(fallbacks, 'Ersatzbilder verwendet').toBe(0);
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

  await expect(page.locator('[data-pano-choice]')).toHaveCount(4);
  const other = page.locator('[data-pano-choice][aria-pressed="false"]').first();
  const season = (await other.textContent()).trim();
  const text = await other.getAttribute('data-text');
  await other.click();
  await expect(page.getByRole('button', { name: season })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-pano-caption]')).toHaveText(text);
  await expect(viewer).toHaveAttribute('data-state', 'ready', { timeout: 15_000 });
  await expect(viewer).toHaveAttribute('aria-label', new RegExp(season));
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
  await expect(page.locator('[data-gallery-item]').first()).toHaveAttribute('href', /(\.webp|images\.unsplash\.com\/photo-[\w-]+\?.*w=2000.*)$/);
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

/* ---------- Neue Funktionen ---------- */

test('Hero-Karussell: 5 Bilder, Punkte, Pause und automatischer Wechsel', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  const slides = page.locator('[data-slide]');
  await expect(slides).toHaveCount(5);
  await expect(slides.nth(0)).toHaveClass(/is-active/);
  await expect(slides.nth(1)).toHaveAttribute('inert', '');

  // Automatischer Wechsel nach 6 Sekunden
  await page.mouse.move(0, 0);
  await page.clock.runFor(6500);
  await expect(slides.nth(1)).toHaveClass(/is-active/);
  await expect(slides.nth(0)).not.toHaveClass(/is-active/);

  // Punkt anklicken
  await page.getByRole('button', { name: 'Bild 4 anzeigen' }).click();
  await expect(slides.nth(3)).toHaveClass(/is-active/);
  await expect(page.getByRole('button', { name: 'Bild 4 anzeigen' })).toHaveAttribute('aria-current', 'true');

  // Pause: kein Wechsel mehr
  await page.getByRole('button', { name: 'Diashow anhalten' }).click();
  await expect(page.getByRole('button', { name: 'Diashow starten' })).toBeVisible();
  await page.locator('h2').first().click(); // Fokus aus dem Karussell nehmen
  await page.clock.runFor(20000);
  await expect(slides.nth(3)).toHaveClass(/is-active/);
});

test('Karussell: Wischen auf dem Handy', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'nur Handy');
  await page.goto('/');
  const box = await page.locator('[data-carousel]').boundingBox();
  const y = box.y + box.height / 3;
  await page.locator('[data-carousel]').dispatchEvent('touchstart', { touches: [{ identifier: 1, clientX: box.x + 300, clientY: y }] });
  await page.locator('[data-carousel]').dispatchEvent('touchend', { changedTouches: [{ identifier: 1, clientX: box.x + 60, clientY: y }] });
  await expect(page.locator('[data-slide]').nth(1)).toHaveClass(/is-active/);
});

test('Wetter: aktuelle Temperatur wird angezeigt', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('[data-weather]');
  await expect(card).toBeVisible();
  await expect(card.locator('[data-w-temp]')).toHaveText('−4°');
  await expect(card.locator('[data-w-text]')).toHaveText(WEATHER.text);
  await expect(card.locator('[data-w-range]')).toHaveText('−8° / −1°');
  await expect(card.locator('[data-w-wind]')).toHaveText('14 km/h');
  // Tabelle: heute + 7 Tage
  const table = card.locator('table[data-w-forecast]');
  await expect(table.locator('thead th')).toHaveText(['Tag', 'Wetter', 'Min.', 'Max.']);
  const rows = table.locator('tbody tr');
  await expect(rows).toHaveCount(8);
  await expect(rows.nth(0).locator('th')).toContainText('Heute');
  await expect(rows.nth(0).locator('.forecast-desc')).toHaveText('Schneefall');
  await expect(rows.nth(0).locator('.forecast-precip')).toHaveText('Neuschnee 8,2 cm');
  await expect(rows.nth(1).locator('th')).toContainText('Do');
  await expect(rows.nth(1).locator('th')).toContainText('26.11.');
  await expect(rows.nth(1).locator('.forecast-desc')).toHaveText('Bewölkt');
  await expect(rows.nth(1).locator('.forecast-precip')).toHaveText('Niederschlag 20 %');
  await expect(rows.nth(2).locator('.forecast-precip')).toHaveCount(0); // trocken → kein Hinweis
  await expect(rows.nth(4).locator('.forecast-min')).toHaveText('−11°');
  await expect(rows.nth(4).locator('.forecast-max')).toHaveText('−4°');
  await expect(rows.nth(7).locator('.forecast-max')).toHaveText('4°');
  await expect(card.locator('.forecast-bar')).toHaveCount(0); // keine unklaren Farbbalken mehr
});

test('Wetter: ohne Daten bleibt der Bereich unsichtbar, Seite funktioniert', async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await mockExternal(page, { weather: null });
  const jsErrors = [];
  page.on('pageerror', (e) => jsErrors.push(e.message));
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[data-weather]')).toBeHidden();
  await expect(page.locator('[data-weather-chip]')).toBeHidden();
  expect(jsErrors).toEqual([]);
});

test('Karte: lädt, Kategorien filtern, Popup mit Google-Maps-Link', async ({ page }) => {
  await page.goto('/ausflugsziele');
  const map = page.locator('[data-map]');
  await expect(map).toHaveAttribute('data-state', 'ready', { timeout: 15_000 });
  await expect(map.locator('.leaflet-tile-loaded').first()).toBeAttached();
  const paths = map.locator('.leaflet-overlay-pane path');
  const before = await paths.count();
  expect(before).toBeGreaterThan(10);

  const items = page.locator('[data-route-item][data-category="wandern"]');
  await expect(items.first()).toBeVisible();
  const wandern = page.locator('[data-map-filter="wandern"]');
  await wandern.click();
  await expect(wandern).toHaveAttribute('aria-pressed', 'false');
  await expect(items.first()).toBeHidden();
  expect(await paths.count()).toBeLessThan(before);
  await wandern.click();
  await expect(items.first()).toBeVisible();
  expect(await paths.count()).toBe(before);

  // "Auf der Karte zeigen" öffnet das Popup
  await page.locator('[data-route-item]').first().getByRole('button', { name: 'Auf der Karte zeigen' }).click();
  const popup = map.locator('.leaflet-popup');
  await expect(popup).toBeVisible();
  await expect(popup.locator('a.map-popup-link')).toHaveAttribute('href', /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=\d+\.\d+,\d+\.\d+$/);

  // Alle Google-Links in der Liste sind gültig
  for (const href of await page.locator('[data-route-item] a[href*="google.com/maps"]').evaluateAll((as) => as.map((a) => a.href))) {
    expect(href).toMatch(/destination=-?\d+\.\d{5},-?\d+\.\d{5}$/);
  }
});

test('Karte auf der Startseite lädt erst beim Hinscrollen', async ({ page }) => {
  await page.goto('/');
  const map = page.locator('[data-map]');
  await expect(map).not.toHaveAttribute('data-state', /.+/);
  await map.scrollIntoViewIfNeeded();
  await expect(map).toHaveAttribute('data-state', 'ready', { timeout: 15_000 });
});

test('Karte auf dem Handy: erst nach Antippen verschiebbar', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'nur Handy');
  await page.goto('/ausflugsziele');
  await expect(page.locator('[data-map]')).toHaveAttribute('data-state', 'ready', { timeout: 15_000 });
  const hint = page.getByRole('button', { name: 'Antippen, um die Karte zu bewegen' });
  await hint.click();
  await expect(hint).toHaveCount(0);
});

test('Externes Foto fällt aus → Ersatzbild statt kaputtem Bild', async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await mockExternal(page);
  await page.route(/images\.unsplash\.com/, (r) => r.fulfill({ status: 404, body: '' }));
  await page.goto('/');
  const first = page.locator('[data-slide] img').first();
  await expect(first).toHaveAttribute('data-fallback', 'done');
  await expect.poll(() => first.evaluate((i) => i.naturalWidth)).toBeGreaterThan(0);
});

test('Bildnachweis im Impressum', async ({ page }) => {
  await page.goto('/impressum');
  await expect(page.getByRole('heading', { name: 'Bildnachweis' })).toBeVisible();
  expect(await page.locator('.credits li').count()).toBeGreaterThan(15);
});

test('Startbild: Willkommen, Knöpfe, darunter die Bild-Steuerung; Slogan unter den Zahlen', async ({ page }) => {
  await page.goto('/');
  const hero = page.locator('.hero');
  await expect(hero.locator('h1')).toHaveText('Willkommen in Steinbach');
  const buttons = hero.locator('.actions');
  const controls = hero.locator('[data-carousel-controls]');
  await expect(controls).toBeVisible();
  const b = await buttons.boundingBox();
  const c = await controls.boundingBox();
  expect(c.y).toBeGreaterThanOrEqual(b.y + b.height - 1); // Steuerung unter den Knöpfen
  await expect(hero.locator('[data-weather-chip]')).toBeVisible();
  await expect(hero.locator('.slide-credit').first()).toBeVisible();
  // Slogan steht jetzt unter den Zahlen
  const facts = await page.locator('.facts').boundingBox();
  const slogan = page.getByRole('heading', { name: 'Stein, Wasser, Holz. Und viel Schnee.' });
  await expect(slogan).toBeVisible();
  expect((await slogan.boundingBox()).y).toBeGreaterThan(facts.y + facts.height);
  await expect(hero).not.toContainText('Stein, Wasser, Holz');
});

/* ---------- Ganzes Menü: jeder Eintrag auf Handy und Desktop ---------- */
const MENU = [
  ['Entdecken', '/ausflugsziele', 'Routen & Ausflugsziele'],
  ['360°', '/panorama', 'Rundblick durch das Jahr'],
  ['Galerie', '/galerie', 'Bilder aus Steinbach'],
  ['Videos', '/videos', 'Steinbach in Bewegung'],
  ['Aktuelles', '/blog', 'Neuigkeiten aus dem Dorf'],
  ['Anreise & Kontakt', '/info', 'Anreise & Kontakt'],
];


test('Menü: jeder Eintrag öffnet die richtige Seite und ist markiert', async ({ page, isMobile }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  for (const [label, path, heading] of MENU) {
    if (isMobile) {
      const toggle = page.getByRole('button', { name: 'Menü' });
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    }
    const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });
    await nav.getByRole('link', { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path.replace('/', '\\/')}$`));
    await expect(page.locator('h1')).toHaveText(heading);
    await expect(page.locator(`[data-nav] a[href="${path}"]`)).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('[data-nav] a[aria-current="page"]')).toHaveCount(1);
    if (isMobile) await expect(page.locator('[data-nav]')).not.toHaveClass(/is-open/); // Menü nach Seitenwechsel zu
  }
  // Logo führt zurück zur Startseite
  await page.getByRole('link', { name: /Startseite/ }).first().click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('h1')).toHaveText('Willkommen in Steinbach');
  expect(errors).toEqual([]);
});

test('Menü auf dem Handy: öffnen, schliessen per Escape, Klick daneben und Tastatur', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'nur Handy');
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Menü' });
  const nav = page.locator('[data-nav]');
  await toggle.click();
  await expect(nav).toHaveClass(/is-open/);
  await page.keyboard.press('Escape');
  await expect(nav).not.toHaveClass(/is-open/);
  await expect(toggle).toBeFocused();
  await toggle.click();
  await page.locator('main').click({ position: { x: 10, y: 400 } });
  await expect(nav).not.toHaveClass(/is-open/);
  await toggle.click();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

test('Footer-Links funktionieren alle', async ({ page }) => {
  await page.goto('/');
  const hrefs = await page.locator('.site-footer a[href^="/"]').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute('href')))]);
  expect(hrefs.length).toBeGreaterThan(6);
  for (const href of hrefs) {
    const res = await page.request.get(href);
    expect(res.status(), href).toBe(200);
  }
});

/* ---------- Karussell: Zoom, Steuerleiste, Naturklang ---------- */
test('Karussell zoomt ins Bild hinein (nicht heraus)', async ({ page }) => {
  await page.goto('/');
  const img = page.locator('[data-slide].is-active img');
  await expect(img).toBeVisible();
  const scale = () => img.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
  const s1 = await scale();
  await page.waitForTimeout(1500);
  const s2 = await scale();
  expect(s1).toBeGreaterThanOrEqual(1);
  expect(s2).toBeGreaterThan(s1); // wird grösser = Zoom in
  expect(s2).toBeLessThanOrEqual(1.1);
});

test('Steuerleiste: gross, mindestens 50 % der Bildbreite, unten im Bild', async ({ page, isMobile }) => {
  await page.goto('/');
  const media = await page.locator('.hero-media').boundingBox();
  const bar = await page.locator('[data-carousel-controls]').boundingBox();
  expect(bar.width / media.width).toBeGreaterThanOrEqual(isMobile ? 0.85 : 0.5);
  expect(bar.y + bar.height).toBeLessThanOrEqual(media.y + media.height);
  expect(bar.y).toBeGreaterThan(media.y + media.height / 2); // untere Hälfte
  for (const el of await page.locator('[data-carousel-dot], [data-carousel-toggle], [data-carousel-sound]').all()) {
    const b = await el.boundingBox();
    expect(b.height, 'Tippfläche mindestens 44 px').toBeGreaterThanOrEqual(44);
    expect(b.width).toBeGreaterThanOrEqual(44);
  }
  // Fortschritt: frühere Bilder gefüllt, aktuelles läuft
  await page.getByRole('button', { name: 'Bild 3 anzeigen' }).click();
  await expect(page.locator('[data-carousel-dot]').nth(0)).toHaveClass(/is-done/);
  await expect(page.locator('[data-carousel-dot]').nth(1)).toHaveClass(/is-done/);
  await expect(page.locator('[data-carousel-dot]').nth(3)).not.toHaveClass(/is-done/);
});

test('Naturklang: einschalten, Klang wechselt mit dem Bild, ausschalten', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  const carousel = page.locator('[data-carousel]');
  const btn = page.getByRole('button', { name: 'Naturklang einschalten' });
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
  await btn.click();
  await expect(page.getByRole('button', { name: 'Naturklang ausschalten' })).toHaveAttribute('aria-pressed', 'true');
  await expect(carousel).toHaveAttribute('data-sound-state', 'playing', { timeout: 10_000 });
  await expect(carousel).toHaveAttribute('data-sound-src', '/audio/kirche-voegel.mp3');
  await expect(page.locator('[data-sound-caption]')).toContainText('Kirchenglocken');
  // Bildwechsel → anderer Klang
  await page.getByRole('button', { name: 'Bild 4 anzeigen' }).click();
  await expect(carousel).toHaveAttribute('data-sound-src', '/audio/kaminfeuer.mp3', { timeout: 10_000 });
  await expect(page.locator('[data-sound-caption]')).toContainText('Kaminfeuer');
  const state = await page.evaluate(() => (window.AudioContext ? 'ok' : 'none'));
  expect(state).toBe('ok');
  // Aus
  await page.getByRole('button', { name: 'Naturklang ausschalten' }).click();
  await expect(carousel).toHaveAttribute('data-sound-state', 'off');
  await expect(page.locator('[data-sound-caption]')).toBeHidden();
  expect(errors).toEqual([]);
});

test('Naturklang: Datei fehlt → verständlicher Hinweis, nichts stürzt ab', async ({ page }) => {
  await page.route('**/audio/*.mp3', (r) => r.fulfill({ status: 404, body: '' }));
  const jsErrors = [];
  page.on('pageerror', (e) => jsErrors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Naturklang einschalten' }).click();
  await expect(page.locator('[data-sound-caption]')).toHaveText('Der Klang konnte nicht abgespielt werden.');
  await expect(page.getByRole('button', { name: 'Naturklang einschalten' })).toHaveAttribute('aria-pressed', 'false');
  expect(jsErrors).toEqual([]);
});

/* ---------- Wischbare Reihen ---------- */
const ROWS = [
  ['Ausflugsziele', '/ausflugsziele'],
  ['Dorfleben & Tradition', '/dorfleben'],
  ['360°-Ansicht wählen', '/panorama'],
  ['Aktuelle Beiträge', '/blog'],
];

test('Handy: Reihen lassen sich wischen und enden mit "Alle ansehen"', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'nur Handy');
  await page.goto('/');
  for (const [label, href] of ROWS) {
    const row = page.getByRole('region', { name: label, exact: true });
    await row.scrollIntoViewIfNeeded();
    const info = await row.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth, flow: getComputedStyle(el).gridAutoFlow }));
    expect(info.flow).toBe('column'); // eine Reihe
    expect(info.sw).toBeGreaterThan(info.cw); // breiter als der Bildschirm → wischbar
    await row.evaluate((el) => el.scrollTo({ left: el.scrollWidth, behavior: 'instant' }));
    const more = row.locator('a.more-card');
    await expect(more).toBeVisible();
    await expect(more).toHaveAttribute('href', href);
  }
  // "Alle ansehen" öffnet die Übersicht
  const row = page.getByRole('region', { name: 'Dorfleben & Tradition', exact: true });
  await row.evaluate((el) => el.scrollTo({ left: el.scrollWidth, behavior: 'instant' }));
  await row.locator('a.more-card').click();
  await expect(page).toHaveURL(/\/dorfleben$/);
  await expect(page.locator('.village-card')).toHaveCount(6);
});

test('Desktop: Reihen als Raster, "Alle ansehen"-Karten ausgeblendet', async ({ page, isMobile }) => {
  test.skip(isMobile, 'nur Desktop');
  await page.goto('/');
  for (const [label] of ROWS) {
    const row = page.getByRole('region', { name: label, exact: true });
    expect(await row.evaluate((el) => getComputedStyle(el).gridAutoFlow)).toBe('row');
    await expect(row.locator('a.more-card')).toBeHidden();
  }
});

test('360° auf der Startseite: Karte antippen wählt die Jahreszeit', async ({ page }) => {
  await page.goto('/');
  const cards = page.locator('.pano-cards [data-pano-choice]');
  await expect(cards).toHaveCount(4);
  const other = page.locator('.pano-cards [data-pano-choice][aria-pressed="false"]').first();
  const name = await other.getAttribute('aria-label');
  await other.scrollIntoViewIfNeeded();
  await other.click();
  await expect(page.locator(`.pano-cards [data-pano-choice][aria-label="${name}"]`)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.pano-cards [aria-pressed="true"]')).toHaveCount(1);
  await expect(page.locator('[data-pano-preview]').first()).toHaveAttribute('src', new RegExp(name === 'Frühling' ? 'fruehling' : name.toLowerCase()));
});

test('Handy: 360°-Reihe startet bei der ausgewählten Jahreszeit', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'nur Handy');
  await page.goto('/');
  const row = page.locator('.pano-cards');
  await row.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const pressed = row.locator('[aria-pressed="true"]');
  const rb = await row.boundingBox();
  const pb = await pressed.boundingBox();
  expect(pb.x).toBeGreaterThanOrEqual(rb.x - 1);
  expect(pb.x + pb.width).toBeLessThanOrEqual(rb.x + rb.width + 1); // ganz sichtbar
});
