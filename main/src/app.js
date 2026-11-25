// Express-App (ohne listen) – so lässt sie sich auch in Tests starten.
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createContentStore } from './content.js';
import * as views from './views.js';
import { createWeatherService } from './weather.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

export function createApp({ contentDir = join(ROOT, '..', 'data'), publicDir = join(ROOT, 'public'), siteUrl, weatherFetch } = {}) {
  const app = express();
  const content = createContentStore(contentDir);
  const isProd = process.env.NODE_ENV === 'production';
  const weather = createWeatherService({ getLocation: () => content.site.location, fetchImpl: weatherFetch });

  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.set('strict routing', false);

  /* --- Asset-Versionierung: /css/style.css?v=<hash> => lange cachebar --- */
  const assetHashes = new Map();
  const asset = (urlPath) => {
    if (!isProd || !assetHashes.has(urlPath)) {
      try {
        const h = createHash('sha1').update(readFileSync(join(publicDir, urlPath))).digest('hex').slice(0, 10);
        assetHashes.set(urlPath, h);
      } catch {
        return urlPath;
      }
    }
    return `${urlPath}?v=${assetHashes.get(urlPath)}`;
  };

  /* --- Bildvarianten finden (z. B. bild-01-600.webp, bild-01-1800.webp) --- */
  const variantCache = new Map();
  const imageVariants = (base) => {
    if (!base || /\.[a-z0-9]{3,4}$/i.test(base)) return [];
    if (isProd && variantCache.has(base)) return variantCache.get(base);
    const dir = join(publicDir, posix.dirname(base));
    const name = posix.basename(base);
    let found = [];
    if (existsSync(dir)) {
      const re = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)\\.(webp|avif|jpe?g|png)$`, 'i');
      found = readdirSync(dir)
        .map((f) => f.match(re))
        .filter(Boolean)
        .map((m) => ({ width: Number(m[1]), url: `${posix.dirname(base)}/${m[0]}` }))
        .sort((a, b) => a.width - b.width);
    }
    variantCache.set(base, found);
    return found;
  };

  const ctx = (req) => ({
    site: content.site,
    media: content.media,
    articles: content.articles,
    mapItems: content.mapItems,
    asset,
    imageVariants,
    siteUrl: (siteUrl || process.env.SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, ''),
  });

  /* --- Sicherheit --- */
  // Erlaubte Kartenserver werden aus data/site.json abgeleitet (map.tiles)
  const tileHosts = () => {
    const hosts = new Set();
    for (const t of content.site.map?.tiles || []) {
      try {
        const u = new URL(t.url.replace('{s}', 'a').replace(/\{[a-z]\}/g, '0'));
        hosts.add(t.url.includes('{s}') ? `${u.protocol}//*.${u.host.split('.').slice(1).join('.')}` : u.origin);
      } catch { /* ungültige URL ignorieren */ }
    }
    return [...hosts];
  };
  const securityHeaders = (tiles) =>
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // Pannellum & Leaflet setzen Inline-Styles
          imgSrc: ["'self'", 'data:', 'blob:', 'https://i.ytimg.com', 'https://images.unsplash.com', ...tiles],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          frameSrc: ['https://www.youtube-nocookie.com', 'https://www.google.com'],
          workerSrc: ["'self'", 'blob:'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'self'"],
          ...(isProd ? { upgradeInsecureRequests: [] } : {}),
        },
      },
      // YouTube braucht einen Referrer, sonst verweigert der Player die Wiedergabe
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      hsts: isProd,
    });
  let helmetCache = { key: '', mw: null };
  app.use((req, res, next) => {
    const tiles = tileHosts();
    const key = tiles.join(' ');
    if (helmetCache.key !== key || !helmetCache.mw) helmetCache = { key, mw: securityHeaders(tiles) };
    helmetCache.mw(req, res, next);
  });
  app.use(compression());

  /* --- Statische Dateien --- */
  const staticOpts = (maxAge) => ({
    maxAge,
    index: false,
    setHeaders(res, path) {
      if (res.req.query?.v) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      if (path.endsWith('.woff2')) res.setHeader('Access-Control-Allow-Origin', '*');
    },
  });
  const pannellumDir = join(dirname(require.resolve('pannellum/package.json')), 'build');
  const fontDir = join(dirname(require.resolve('@fontsource-variable/inter/package.json')), 'files');
  const leafletDir = join(dirname(require.resolve('leaflet/package.json')), 'dist');
  app.use('/vendor/leaflet', express.static(leafletDir, staticOpts('30d')));
  app.use('/vendor/pannellum', express.static(pannellumDir, staticOpts('30d')));
  app.use('/fonts', express.static(fontDir, staticOpts('365d')));
  app.use(express.static(publicDir, staticOpts(isProd ? '7d' : 0)));

  /* --- Seiten --- */
  const send = (res, htmlString, status = 200) => {
    res.status(status).type('html').set('Cache-Control', 'public, max-age=0, must-revalidate').send(htmlString);
  };

  app.get('/', (req, res) => send(res, views.homePage(ctx(req))));
  app.get('/ausflugsziele', (req, res) => send(res, views.placesPage(ctx(req))));
  app.get('/panorama', (req, res) => send(res, views.panoramaPage(ctx(req))));
  app.get('/galerie', (req, res) => send(res, views.galleryPage(ctx(req))));
  app.get('/videos', (req, res) => send(res, views.videosPage(ctx(req))));
  app.get('/blog', (req, res) => send(res, views.blogPage(ctx(req))));
  app.get('/blog/feed.xml', (req, res) => res.type('application/rss+xml').send(views.feedXml(ctx(req))));
  app.get('/blog/:slug', (req, res, next) => {
    const article = content.article(req.params.slug);
    if (!article) return next();
    send(res, views.articlePage(ctx(req), article));
  });
  app.get('/info', (req, res) => send(res, views.infoPage(ctx(req))));
  app.get('/impressum', (req, res) => send(res, views.impressumPage(ctx(req))));

  app.get('/sitemap.xml', (req, res) => res.type('application/xml').send(views.sitemapXml(ctx(req))));
  app.get('/robots.txt', (req, res) => res.type('text/plain').send(`User-agent: *\nAllow: /\nSitemap: ${ctx(req).siteUrl}/sitemap.xml\n`));
  app.get('/healthz', (req, res) => res.json({ ok: true }));

  // Aktuelles Wetter (vom Server zwischengespeichert)
  app.get('/api/wetter', async (req, res, next) => {
    try {
      const result = await weather.get();
      if (!result) return res.status(503).set('Cache-Control', 'no-store').json({ ok: false });
      res.set('Cache-Control', 'public, max-age=300').json({ ok: true, fresh: result.fresh, place: content.site.location?.label || content.site.name, ...result.data });
    } catch (err) {
      next(err);
    }
  });

  // Abschliessende Schrägstriche entfernen (/galerie/ -> /galerie)
  app.use((req, res, next) => {
    if (req.method === 'GET' && req.path.length > 1 && req.path.endsWith('/')) {
      const q = req.originalUrl.slice(req.path.length);
      return res.redirect(301, req.path.replace(/\/+$/, '') + q);
    }
    next();
  });

  /* --- Fehler --- */
  app.use((req, res) => {
    if (req.accepts('html')) return send(res, views.errorPage(ctx(req), 404), 404);
    res.status(404).type('text').send('Nicht gefunden');
  });
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    if (res.headersSent) return;
    try {
      send(res, views.errorPage(ctx(req), 500), 500);
    } catch {
      res.status(500).type('text').send('Interner Fehler');
    }
  });

  app.locals.weather = weather;
  return app;
}

