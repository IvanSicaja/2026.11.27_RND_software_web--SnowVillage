import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { createApp } from '../../main/src/app.js';
import { createContentStore } from '../../main/src/content.js';

let server;
let base;
const store = createContentStore(new URL('../../data', import.meta.url).pathname);

before(async () => {
  const weatherFetch = async () => ({
    ok: true,
    json: async () => ({ current: { temperature_2m: -2.4, apparent_temperature: -6, weather_code: 3, wind_speed_10m: 8, is_day: 1 }, daily: { temperature_2m_max: [1], temperature_2m_min: [-5] } }),
  });
  server = createApp({ siteUrl: 'https://steinbach.example', weatherFetch }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const get = (path, init) => fetch(base + path, { redirect: 'manual', ...init });

const pages = ['/', '/ausflugsziele', '/panorama', '/galerie', '/videos', '/blog', '/info', '/impressum'];

for (const path of pages) {
  test(`Seite ${path} liefert gültiges HTML`, async () => {
    const res = await get(path);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html; charset=utf-8/);
    const body = await res.text();
    assert.match(body, /^<!doctype html><html lang="de"[ >]/);
    assert.match(body, /<title>[^<]+<\/title>/);
    assert.match(body, /<meta name="description" content="[^"]+">/);
    assert.match(body, /<link rel="canonical" href="https:\/\/steinbach\.example/);
    assert.equal((body.match(/<h1[\s>]/g) || []).length, 1, 'genau eine H1');
    assert.match(body, /<main id="inhalt"/);
    assert.ok(!/undefined|\[object Object\]|NaN/.test(body), 'keine Platzhalterfehler im HTML');
    // Alle <img> haben ein alt-Attribut
    for (const img of body.match(/<img\b[^>]*>/g) || []) assert.match(img, /\salt="/, img);
  });
}

test('Alle Artikel sind erreichbar', async () => {
  for (const a of store.articles) {
    const res = await get(`/blog/${a.slug}`);
    assert.equal(res.status, 200, a.slug);
    assert.ok((await res.text()).includes(a.title.replace(/&/g, '&amp;')));
  }
});

test('Unbekannte Seiten und Artikel => 404-Seite', async () => {
  for (const p of ['/gibt-es-nicht', '/blog/gibt-es-nicht', '/blog/..%2f..%2fpackage.json', '/blog/%00']) {
    const res = await get(p, { headers: { accept: 'text/html' } });
    assert.equal(res.status, 404, p);
    assert.match(await res.text(), /Diese Seite gibt es nicht/);
  }
});

test('Keine Quelldateien über statische Pfade erreichbar', async () => {
  for (const p of ['/../package.json', '/src/app.js', '/content/site.json', '/server.js', '/.env']) {
    const res = await get(p);
    assert.notEqual(res.status, 200, p);
  }
});

test('Sicherheits-Header gesetzt', async () => {
  const res = await get('/');
  const csp = res.headers.get('content-security-policy');
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /frame-src https:\/\/www\.youtube-nocookie\.com/);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.equal(res.headers.get('x-powered-by'), null);
});

test('Antworten werden komprimiert', async () => {
  const res = await get('/', { headers: { 'accept-encoding': 'gzip' } });
  assert.equal(res.headers.get('content-encoding'), 'gzip');
});

test('Versionierte Assets sind lange cachebar', async () => {
  const html = await (await get('/')).text();
  const css = html.match(/href="(\/css\/style\.css\?v=[a-f0-9]+)"/)[1];
  const js = html.match(/src="(\/js\/main\.js\?v=[a-f0-9]+)"/)[1];
  for (const url of [css, js]) {
    const res = await get(url);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('cache-control'), /immutable/);
  }
});

test('Bilder, Panoramen, Schrift und Pannellum werden ausgeliefert', async () => {
  const urls = [
    '/images/hero-1600.webp',
    ...store.media.panoramas.flatMap((p) => [p.image, p.preview]),
    '/fonts/inter-latin-wght-normal.woff2',
    '/vendor/pannellum/pannellum.js',
    '/vendor/pannellum/pannellum.css',
    '/favicon.svg',
  ];
  for (const u of urls) assert.equal((await get(u)).status, 200, u);
});

test('Alle im HTML referenzierten lokalen Dateien existieren', async () => {
  const seen = new Set();
  for (const path of [...pages, ...store.articles.map((a) => `/blog/${a.slug}`)]) {
    const body = await (await get(path)).text();
    const refs = [...body.matchAll(/(?:src|href|data-image|data-preview)="(\/[^"#]*)"/g)].map((m) => m[1]);
    const srcsets = [...body.matchAll(/srcset="([^"]+)"/g)].flatMap((m) => m[1].split(',').map((s) => s.trim().split(' ')[0]));
    for (const r of [...refs, ...srcsets]) if (r.startsWith('/') && !r.startsWith('//')) seen.add(r.replace(/&amp;/g, '&'));
  }
  for (const u of seen) {
    const res = await get(u, { headers: { accept: '*/*' } });
    assert.ok(res.status === 200 || res.status === 301, `${u} => ${res.status}`);
  }
});

test('sitemap.xml, robots.txt und RSS-Feed', async () => {
  const sm = await (await get('/sitemap.xml')).text();
  assert.match(sm, /<urlset/);
  for (const a of store.articles) assert.ok(sm.includes(`/blog/${a.slug}<`));
  assert.match(await (await get('/robots.txt')).text(), /Sitemap: https:\/\/steinbach\.example\/sitemap\.xml/);
  const feed = await get('/blog/feed.xml');
  assert.match(feed.headers.get('content-type'), /rss\+xml/);
  assert.equal(((await feed.text()).match(/<item>/g) || []).length, store.articles.length);
});

test('Wetter-API liefert aufbereitete Daten', async () => {
  const res = await get('/api/wetter');
  assert.equal(res.status, 200);
  const w = await res.json();
  assert.equal(w.ok, true);
  assert.equal(w.temperature, -2);
  assert.equal(w.text, 'Bewölkt');
  assert.equal(w.place, store.site.location.label);
  assert.match(res.headers.get('cache-control'), /max-age=300/);
});

test('Wetter-API bei Ausfall: 503 statt Absturz', async () => {
  const s2 = createApp({ weatherFetch: async () => { throw new Error('offline'); } }).listen(0);
  await new Promise((r) => s2.once('listening', r));
  const orig = console.warn;
  console.warn = () => {};
  try {
    const res = await fetch(`http://127.0.0.1:${s2.address().port}/api/wetter`);
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { ok: false });
  } finally {
    console.warn = orig;
    s2.close();
  }
});

test('CSP erlaubt nur die nötigen externen Quellen', async () => {
  const csp = (await get('/')).headers.get('content-security-policy');
  assert.match(csp, /img-src [^;]*https:\/\/images\.unsplash\.com/);
  assert.match(csp, /img-src [^;]*https:\/\/tile\.openstreetmap\.org/);
  assert.match(csp, /img-src [^;]*https:\/\/\*\.tile\.opentopomap\.org/);
  assert.match(csp, /frame-src [^;]*https:\/\/www\.google\.com/);
  assert.doesNotMatch(csp, /script-src [^;]*https:/, 'keine externen Scripts');
});

test('Startseite: Karussell, Karte und Dorfleben sind enthalten', async () => {
  const body = await (await get('/')).text();
  assert.equal((body.match(/data-slide[\s>]/g) || []).length, store.site.hero.slides.length);
  assert.match(body, /<script type="application\/json" data-map-data>/);
  const json = JSON.parse(body.match(/data-map-data>([\s\S]*?)<\/script>/)[1]);
  assert.equal(json.items.length, store.mapItems.length);
  assert.ok(json.items.every((i) => i.google.startsWith('https://www.google.com/maps/')));
  assert.match(body, /Dorfleben/);
  // Unsplash-Bilder mit responsiven Grössen
  assert.match(body, /images\.unsplash\.com\/photo-[\w-]+\?auto=format&amp;fit=crop&amp;w=480/);
});

test('Alle Fotos sind gültige Unsplash- oder lokale Pfade mit Bildnachweis', () => {
  const remote = [
    ...store.site.hero.slides.map((x) => x.src),
    ...store.site.village.items.map((x) => x.src),
    ...store.media.gallery.map((x) => x.src),
    ...store.media.places.map((x) => x.image),
  ];
  for (const src of remote) assert.match(src, /^(https:\/\/images\.unsplash\.com\/photo-\d+-[0-9a-f]+|\/images\/[\w/-]+)$/, src);
  for (const g of store.media.gallery) if (g.src.startsWith('https')) assert.ok(g.credit && g.creditUrl.startsWith('https://unsplash.com/photos/'), g.src);
});

test('Health-Check', async () => {
  assert.deepEqual(await (await get('/healthz')).json(), { ok: true });
});

test('Startseite ist klein (unter 30 KB gzip)', async () => {
  const body = await (await get('/')).text();
  assert.ok(gzipSync(body).length < 30_000);
});
