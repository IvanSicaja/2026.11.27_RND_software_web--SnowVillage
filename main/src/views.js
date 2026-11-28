// Alle Seiten-Vorlagen. Reines JavaScript – kein Build-Schritt, sehr schnell.
import { html, raw } from './html.js';
import { CATEGORIES, googleMapsLink, startPoint } from './map.js';

const NAV = [
  { href: '/ausflugsziele', label: 'Entdecken' },
  { href: '/panorama', label: '360°' },
  { href: '/galerie', label: 'Galerie' },
  { href: '/videos', label: 'Videos' },
  { href: '/blog', label: 'Aktuelles' },
  { href: '/info', label: 'Anreise & Kontakt' },
];

const dateFmt = new Intl.DateTimeFormat('de-CH', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
export const formatDate = (d) => dateFmt.format(d);
const isoDate = (d) => d.toISOString().slice(0, 10);

/* ---------- Icons (inline SVG, keine externen Dateien) ---------- */
const svg = (path, size = 20) =>
  raw(`<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${path}</svg>`);
export const icons = {
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  play: raw('<svg class="icon" width="28" height="28" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>', 22),
  prev: svg('<path d="M15 5l-7 7 7 7"/>', 22),
  next: svg('<path d="M9 5l7 7-7 7"/>', 22),
  menu: svg('<path d="M4 8h16M4 16h16"/>', 22),
  soundOff: svg('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/>', 20),
  soundOn: svg('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9a4.5 4.5 0 0 1 0 6M18.6 6.4a8.2 8.2 0 0 1 0 11.2"/>', 20),
  pause: svg('<path d="M9 6v12M15 6v12"/>', 18),
  playSmall: raw('<svg class="icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>'),
  rotate: svg('<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>', 22),
  pin: svg('<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>', 18),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', 18),
  mail: svg('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3.5 7l8.5 6 8.5-6"/>', 18),
  phone: svg('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>', 18),
  mountain: raw('<svg class="logo-mark" width="28" height="28" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><rect width="32" height="32" rx="9" fill="currentColor"/><path d="M5 23l7.5-11 4.5 6.5 3-4 7 8.5z" fill="var(--paper)"/></svg>'),
};

/* ---------- Bilder ---------- */
// Fotos können lokal liegen (/images/x → x-600.webp, x-1200.webp …) oder von Unsplash kommen.
// Unsplash liefert jede Grösse und das beste Format (AVIF/WebP) automatisch über sein CDN.
const UNSPLASH = /^https:\/\/images\.unsplash\.com\/[\w-]+$/;
export const isRemote = (src) => /^https?:\/\//.test(src || '');
export function unsplash(src, width, ratio, { smart = false } = {}) {
  const q = new URLSearchParams({ auto: 'format', fit: 'crop', w: String(width), q: '72' });
  if (ratio) q.set('h', String(Math.round(width / ratio)));
  if (smart) q.set('crop', 'entropy'); // Zuschnitt auf den interessantesten Bildteil
  return `${src}?${q}`;
}

/* Karussellbild: Hochformat 9:16 fürs Handy, Querformat 16:9 ab Tablet/PC.
   Unsplash schneidet automatisch passend zu. Für eigene Fotos optional "srcHochformat"
   (eigenes Hochformatbild) und "fokus" (z. B. "40% 50%" = wichtigster Bildpunkt). */
const BREAKPOINT_WIDE = '(min-width: 768px), (orientation: landscape)';
function slidePicture(imageVariants, sl, eager) {
  const fokus = typeof sl.fokus === 'string' && /^[\d.]+% [\d.]+%$/.test(sl.fokus) ? sl.fokus : '';
  const style = fokus ? raw(` style="object-position: ${fokus}"`) : '';
  const load = eager ? raw('fetchpriority="high"') : raw('loading="lazy"');
  if (UNSPLASH.test(sl.src)) {
    const wide = [960, 1280, 1600, 2000].map((w) => `${unsplash(sl.src, w, 16 / 9, { smart: true })} ${w}w`).join(', ');
    const tallSrc = UNSPLASH.test(sl.srcHochformat || '') ? sl.srcHochformat : sl.src;
    const tall = [480, 720, 1080, 1440].map((w) => `${unsplash(tallSrc, w, 9 / 16, { smart: true })} ${w}w`).join(', ');
    return html`<picture>
        <source media="${BREAKPOINT_WIDE}" srcset="${wide}" sizes="100vw">
        <img src="${unsplash(tallSrc, 720, 9 / 16, { smart: true })}" srcset="${tall}" sizes="100vw" alt="${sl.alt || ''}" width="1080" height="1920"${style} ${load} decoding="async">
      </picture>`;
  }
  const wideVars = variantsFor(imageVariants, sl.src, {});
  const tallVars = sl.srcHochformat ? variantsFor(imageVariants, sl.srcHochformat, {}) : wideVars;
  const set = (v) => v.map((x) => `${x.url} ${x.width}w`).join(', ');
  const fallback = (v, src) => (v.length ? v[Math.min(1, v.length - 1)].url : src);
  return html`<picture>
      ${wideVars.length ? html`<source media="${BREAKPOINT_WIDE}" srcset="${set(wideVars)}" sizes="100vw">` : html`<source media="${BREAKPOINT_WIDE}" srcset="${sl.src}">`}
      <img src="${fallback(tallVars, sl.srcHochformat || sl.src)}"${tallVars.length ? html` srcset="${set(tallVars)}" sizes="100vw"` : ''} alt="${sl.alt || ''}"${style} ${load} decoding="async">
    </picture>`;
}
const REMOTE_WIDTHS = [480, 800, 1200, 1600, 2000];
export function variantsFor(imageVariants, base, { ratio, maxWidth = 2000 } = {}) {
  if (UNSPLASH.test(base)) return REMOTE_WIDTHS.filter((w) => w <= maxWidth).map((w) => ({ width: w, url: unsplash(base, w, ratio) }));
  return imageVariants(base);
}
/** Grösste verfügbare Version (für Lightbox, Teilen-Vorschau). */
export function largest(imageVariants, base, ratio) {
  if (UNSPLASH.test(base)) return unsplash(base, 2000, ratio);
  return imageVariants(base).at(-1)?.url || base;
}

// Erzeugt <img> mit srcset
export function picture(imageVariants, base, { alt = '', sizes = '100vw', eager = false, cls = '', width, height, ratio, maxWidth } = {}) {
  if (!base) return '';
  const variants = variantsFor(imageVariants, base, { ratio: ratio ?? (width && height ? width / height : undefined), maxWidth });
  let src = base;
  let srcset = '';
  if (variants.length) {
    srcset = variants.map((v) => `${v.url} ${v.width}w`).join(', ');
    src = variants[Math.min(1, variants.length - 1)].url;
  }
  const dims = width && height ? html` width="${width}" height="${height}"` : '';
  return html`<img src="${src}"${srcset ? html` srcset="${srcset}" sizes="${sizes}"` : ''}${dims} alt="${alt}"${cls ? html` class="${cls}"` : ''} ${eager ? raw('fetchpriority="high"') : raw('loading="lazy"')} decoding="async">`;
}

/* ---------- Grundgerüst ---------- */
export function layout(ctx, { title, description, path, body, image, type = 'website', jsonLd }) {
  const { site, asset, siteUrl } = ctx;
  const fullTitle = title ? `${title} · ${site.name}` : `${site.name} – ${site.tagline}`;
  const desc = description || site.description;
  const canonical = siteUrl + path;
  const ogImage = isRemote(image) ? image : siteUrl + (image || '/images/og-image.jpg');
  const isActive = (href) => path === href || (href !== '/' && path.startsWith(href + '/'));

  return `<!doctype html>${html`<html lang="${site.language || 'de'}" data-karte="${asset('/js/karte.js')}" data-klang="${asset('/js/klang.js')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${fullTitle}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${canonical}">
<meta name="theme-color" content="#f7f6f3" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#121212" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${fullTitle}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${ogImage}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${asset('/favicon.svg')}" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="${site.name} – Aktuelles" href="/blog/feed.xml">
<link rel="preload" href="/fonts/inter-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${asset('/css/style.css')}">
<script src="${asset('/js/main.js')}" type="module"></script>
${jsonLd ? raw(`<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`) : ''}
</head>
<body>
<a class="skip-link" href="#inhalt">Zum Inhalt springen</a>
<header class="site-header" data-header>
  <div class="container header-inner">
    <a class="logo" href="/" aria-label="${site.name} – Startseite">${icons.mountain}<span>${site.name}</span></a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="hauptnavigation" data-nav-toggle>
      ${icons.menu}<span class="visually-hidden">Menü</span>
    </button>
    <nav id="hauptnavigation" class="nav" aria-label="Hauptnavigation" data-nav>
      <ul>
        ${NAV.map((n) => html`<li><a href="${n.href}"${isActive(n.href) ? raw(' aria-current="page"') : ''}>${n.label}</a></li>`)}
      </ul>
    </nav>
  </div>
</header>
<main id="inhalt" tabindex="-1">
${raw(body)}
</main>
<footer class="site-footer">
  <div class="container footer-grid">
    <div>
      <a class="logo" href="/">${icons.mountain}<span>${site.name}</span></a>
      <p class="muted">${site.tagline}</p>
    </div>
    <div>
      <h2 class="footer-title">Kontakt</h2>
      <address>
        ${site.contact.organisation}<br>${site.contact.street}<br>${site.contact.city}<br>
        <a href="tel:${site.contact.phone.replace(/\s/g, '')}">${site.contact.phone}</a><br>
        <a href="mailto:${site.contact.email}">${site.contact.email}</a>
      </address>
    </div>
    <div>
      <h2 class="footer-title">Seiten</h2>
      <ul class="footer-links">
        ${NAV.map((n) => html`<li><a href="${n.href}">${n.label}</a></li>`)}
        <li><a href="/dorfleben">Dorfleben</a></li>
      </ul>
    </div>
    <div>
      <h2 class="footer-title">Folgen</h2>
      <ul class="footer-links">
        ${site.social.map((s) => html`<li><a href="${s.url}" target="_blank" rel="noopener">${s.label}</a></li>`)}
        <li><a href="/blog/feed.xml">RSS-Feed</a></li>
      </ul>
    </div>
  </div>
  <div class="container footer-bottom">
    <span>© ${new Date().getFullYear()} ${site.contact.organisation}</span>
    <span><a href="/impressum">Impressum & Datenschutz</a></span>
  </div>
</footer>
<dialog class="lightbox" data-lightbox aria-label="Bildansicht">
  <figure class="lightbox-figure">
    <img alt="" data-lightbox-img>
    <figcaption><span data-lightbox-caption></span> <span class="muted" data-lightbox-count></span></figcaption>
  </figure>
  <button class="icon-btn lightbox-close" type="button" data-lightbox-close aria-label="Schliessen">${icons.close}</button>
  <button class="icon-btn lightbox-prev" type="button" data-lightbox-prev aria-label="Vorheriges Bild">${icons.prev}</button>
  <button class="icon-btn lightbox-next" type="button" data-lightbox-next aria-label="Nächstes Bild">${icons.next}</button>
</dialog>
</body>
</html>`.value}`;
}

/* ---------- Bausteine ---------- */
const pageHead = (eyebrow, title, text) => html`
<header class="page-head container">
  ${eyebrow ? html`<p class="eyebrow">${eyebrow}</p>` : ''}
  <h1>${title}</h1>
  ${text ? html`<p class="lead">${text}</p>` : ''}
</header>`;

const sectionHead = (title, link, linkLabel, text) => html`
<div class="section-head">
  <div>
    <h2>${title}</h2>
    ${text ? html`<p class="muted">${text}</p>` : ''}
  </div>
  ${link ? html`<a class="link-arrow" href="${link}">${linkLabel} ${icons.arrow}</a>` : ''}
</div>`;

const SEASON_BY_MONTH = ['winter', 'winter', 'fruehling', 'fruehling', 'fruehling', 'sommer', 'sommer', 'sommer', 'herbst', 'herbst', 'herbst', 'winter'];
export const currentSeason = (date = new Date()) => SEASON_BY_MONTH[date.getMonth()];

function panoramaBlock(panoramas, { now = new Date(), limit, selected } = {}) {
  if (!panoramas.length) return '';
  const season = currentSeason(now);
  let start = panoramas.findIndex((p) => p.id === selected);
  if (start < 0) start = Math.max(0, panoramas.findIndex((p) => p.season === season));
  const first = panoramas[start];
  // Ausgewähltes Panorama ist immer sichtbar, auch wenn die Liste gekürzt wird
  let shown = limit ? panoramas.slice(0, limit) : panoramas;
  if (!shown.includes(first)) shown = [...shown.slice(0, -1), first];
  return html`
<div class="pano" data-pano data-image="${first.image}" data-title="${first.title}">
  <div class="pano-stage">
    <div class="pano-viewer" data-pano-viewer role="region" aria-label="360°-Panorama: ${first.title}"></div>
    <button class="pano-start" type="button" data-pano-start>
      <img src="${first.preview || first.image}" alt="" data-pano-preview width="1200" height="600" loading="lazy" decoding="async">
      <span class="pano-start-label">${icons.rotate}<span>360° Rundblick starten</span></span>
    </button>
  </div>
  <p class="muted pano-caption" data-pano-caption aria-live="polite">${first.text || ''}</p>
  ${panoramas.length > 1 ? html`
  ${scrollRow(
    shown.map((p) => html`<button type="button" class="pano-card" aria-pressed="${p === first ? 'true' : 'false'}" aria-label="${p.title}"
      data-pano-choice data-image="${p.image}" data-preview="${p.preview || p.image}" data-title="${p.title}" data-text="${p.text || ''}">
      <img src="${p.preview || p.image}" alt="" width="1200" height="600" loading="lazy" decoding="async">
      <span class="pano-card-title">${p.title}</span>
    </button>`),
    { label: '360°-Ansicht wählen', cols: 4, more: limit && panoramas.length > 0 ? { href: '/panorama', label: 'Alle 360°-Ansichten', count: panoramas.length, image: (panoramas.find((p) => p !== first) || first).preview } : null, cls: 'pano-cards' },
  )}` : ''}
</div>`;
}

/* ---------- Wischbare Reihe (Handy) mit "Alle ansehen" am Ende ---------- */
function moreCard({ href, label, count, image, imageVariants }) {
  return html`<a class="more-card${image ? ' more-card--image' : ''}" href="${href}">
    ${image ? (isRemote(image) || !imageVariants ? html`<img class="more-card-bg" src="${isRemote(image) ? unsplash(image, 640, 4 / 5) : image}" alt="" loading="lazy" decoding="async">` : picture(imageVariants, image, { alt: '', cls: 'more-card-bg', sizes: '80vw', maxWidth: 800 })) : ''}
    <span class="more-card-icon">${icons.arrow}</span>
    <span class="more-card-label">${label}</span>
    ${count ? html`<span class="more-card-count">${count} insgesamt</span>` : ''}
  </a>`;
}

function scrollRow(items, { label, cols = 3, more, cls = '' }) {
  return html`<div class="row-wrap" data-row-wrap>
  <button type="button" class="row-nav row-nav--prev" data-row-prev aria-label="${label}: nach links blättern" disabled>${icons.prev}</button>
  <div class="grid grid--${cols} grid--scroll${cls ? ` ${cls}` : ''}" tabindex="0" role="region" aria-label="${label}" data-scroll-row>
    ${items}
    ${more ? moreCard(more) : ''}
  </div>
  <button type="button" class="row-nav row-nav--next" data-row-next aria-label="${label}: nach rechts blättern">${icons.next}</button>
</div>`;
}

// Galeriebild als Karte in einer Reihe (einheitliches 4:5-Format)
function galleryCard(ctx, g, i) {
  return html`<a class="gallery-item gallery-card" href="${largest(ctx.imageVariants, g.src)}" data-gallery-item data-index="${i}" data-caption="${g.caption || ''}" data-alt="${g.alt}" data-credit="${g.credit ? `Foto: ${g.credit} / Unsplash` : ''}">
    ${picture(ctx.imageVariants, g.src, { alt: g.alt, sizes: '(min-width: 1080px) 280px, (min-width: 640px) 42vw, 80vw', ratio: 4 / 5, maxWidth: 1200 })}
    ${g.caption ? html`<span class="gallery-card-caption">${g.caption}</span>` : ''}
  </a>`;
}

function galleryGrid(ctx, items, { limit } = {}) {
  const list = limit ? items.slice(0, limit) : items;
  return html`
<ul class="gallery" data-gallery>
  ${list.map((g, i) => html`<li>
      <a class="gallery-item" href="${largest(ctx.imageVariants, g.src)}" data-gallery-item data-index="${i}" data-caption="${g.caption || ''}" data-alt="${g.alt}" data-credit="${g.credit ? `Foto: ${g.credit} / Unsplash` : ''}">
        ${picture(ctx.imageVariants, g.src, { alt: g.alt, sizes: '(min-width: 1100px) 380px, (min-width: 640px) 46vw, 92vw', width: g.w, height: g.h, maxWidth: 1200 })}
      </a>
    </li>`)}
</ul>`;
}

function videoCard(ctx, v, { large = false } = {}) {
  const poster = v.poster
    ? (isRemote(v.poster) ? unsplash(v.poster, large ? 1600 : 960, 16 / 9) : v.poster)
    : `https://i.ytimg.com/vi/${encodeURIComponent(v.youtubeId)}/hqdefault.jpg`;
  return html`
<article class="video-card${large ? ' video-card--large' : ''}">
  <div class="video" data-video="${v.youtubeId}" data-title="${v.title}">
    <a class="video-play" href="https://www.youtube.com/watch?v=${encodeURIComponent(v.youtubeId)}" target="_blank" rel="noopener" aria-label="Video abspielen: ${v.title}">
      <img src="${poster}" alt="" loading="lazy" decoding="async" width="1280" height="720">
      <span class="video-play-btn">${icons.play}</span>
    </a>
  </div>
  <div class="card-body">
    <h3>${v.title}</h3>
    ${v.text ? html`<p class="muted">${v.text}</p>` : ''}
  </div>
</article>`;
}

function placeCard(ctx, p) {
  return html`
<article class="card place-card" id="${p.id}">
  <div class="card-media">${picture(ctx.imageVariants, p.image, { alt: p.title, sizes: '(min-width: 1100px) 290px, (min-width: 640px) 46vw, 92vw', width: 1200, height: 900, maxWidth: 1200 })}</div>
  <div class="card-body">
    <p class="meta"><span class="tag tag--${p.kind.toLowerCase()}">${p.kind}</span><span>${p.distance}</span></p>
    <h3>${p.title}</h3>
    <p class="muted">${p.text}</p>
    ${Number.isFinite(p.lat) && Number.isFinite(p.lon)
      ? html`<a class="link-arrow link-small" href="${googleMapsLink([p.lon, p.lat])}" target="_blank" rel="noopener">Route in Google Maps ${icons.arrow}<span class="visually-hidden"> zu ${p.title}</span></a>`
      : ''}
  </div>
</article>`;
}

function articleCard(ctx, a) {
  return html`
<article class="card article-card">
  ${a.image ? html`<div class="card-media">${picture(ctx.imageVariants, a.image, { alt: '', sizes: '(min-width: 1100px) 380px, (min-width: 640px) 46vw, 92vw', ratio: 4 / 3, maxWidth: 1200 })}</div>` : ''}
  <div class="card-body">
    <p class="meta">${a.category ? html`<span class="tag">${a.category}</span>` : ''}<time datetime="${isoDate(a.date)}">${formatDate(a.date)}</time></p>
    <h3><a class="stretched" href="/blog/${a.slug}">${a.title}</a></h3>
    ${a.excerpt ? html`<p class="muted">${a.excerpt}</p>` : ''}
  </div>
</article>`;
}

/* ---------- Hero-Karussell ---------- */
function heroCarousel(ctx) {
  const { site } = ctx;
  const slides = site.hero.slides?.length ? site.hero.slides : [{ src: site.hero.image, alt: `Landschaft bei ${site.name}` }];
  return html`
<section class="hero container" aria-label="Willkommen in ${site.name}">
  <div class="hero-media carousel" data-carousel aria-roledescription="Karussell" aria-label="Bilder aus ${site.name}">
    ${slides.map((sl, i) => html`
    <div class="carousel-slide${i === 0 ? ' is-active' : ''}" role="group" aria-roledescription="Bild" aria-label="${i + 1} von ${slides.length}" data-slide${sl.sound ? html` data-sound="${sl.sound}" data-sound-label="${sl.soundLabel || ''}"` : ''}${i === 0 ? '' : raw(' inert')}>
      ${slidePicture(ctx.imageVariants, sl, i === 0)}
      ${sl.credit ? html`<a class="slide-credit" href="${sl.creditUrl || 'https://unsplash.com'}" target="_blank" rel="noopener">Foto: ${sl.credit} / Unsplash</a>` : ''}
    </div>`)}
    <p class="weather-chip" data-weather-chip hidden></p>
  </div>
  <div class="hero-content">
    <h1>${site.intro.title}</h1>
    <div class="hero-bar">
    <div class="actions">
      <a class="btn btn--light" href="/ausflugsziele">Entdecken</a>
      <a class="btn btn--ghost-light" href="/panorama">360° ansehen</a>
    </div>
    ${slides.length > 1 ? html`
    <div class="carousel-controls" data-carousel-controls>
      <button class="carousel-btn carousel-toggle" type="button" data-carousel-toggle aria-label="Diashow anhalten">
        <span class="i-pause">${icons.pause}</span><span class="i-play">${icons.playSmall}</span>
      </button>
      <div class="carousel-dots" role="group" aria-label="Bild auswählen">
        ${slides.map((_, i) => html`<button type="button" class="carousel-dot" data-carousel-dot="${i}" aria-label="Bild ${i + 1} anzeigen"${i === 0 ? raw(' aria-current="true"') : ''}><span class="dot-bar"><span class="dot-fill"></span></span></button>`)}
      </div>
      ${slides.some((sl) => sl.sound) ? html`<button class="carousel-btn carousel-sound" type="button" data-carousel-sound aria-pressed="true" aria-label="Naturklang ausschalten">
        <span class="i-sound-off">${icons.soundOff}</span><span class="i-sound-on">${icons.soundOn}</span>
      </button>` : ''}
    </div>
    <p class="sound-caption" data-sound-caption aria-live="polite" hidden></p>` : ''}
    </div>
  </div>
</section>`;
}

/* ---------- Wetter ---------- */
function weatherCard(ctx) {
  const label = ctx.site.location?.label || ctx.site.name;
  return html`
<aside class="weather panel" data-weather hidden aria-label="Wetter in ${label}: heute und die nächsten 7 Tage">
  <p class="eyebrow">${ctx.site.intro.weatherTitle || `Wetter in ${label}`}</p>
  <div class="weather-main">
    <span class="weather-icon" data-w-icon></span>
    <div>
      <span class="weather-temp" data-w-temp></span>
      <p class="weather-text" data-w-text></p>
    </div>
  </div>
  <dl class="weather-meta">
    <div><dt>Heute</dt><dd data-w-range></dd></div>
    <div><dt>Gefühlt</dt><dd data-w-feels></dd></div>
    <div><dt>Wind</dt><dd data-w-wind></dd></div>
  </dl>
  <h3 class="weather-sub" id="forecast-title">Heute und die nächsten 7 Tage</h3>
  <table class="forecast" data-w-forecast aria-labelledby="forecast-title">
    <thead><tr><th scope="col">Tag</th><th scope="col">Wetter</th><th scope="col" class="num">Min.</th><th scope="col" class="num">Max.</th></tr></thead>
    <tbody></tbody>
  </table>
  <p class="weather-source">Live-Daten: <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a></p>
</aside>`;
}

/* ---------- Karte ---------- */
function mapBlock(ctx, { list = false } = {}) {
  const { site, mapItems } = ctx;
  const cfg = site.map || {};
  const loc = site.location;
  if (!loc || (!mapItems.length && !cfg.googleMyMapsId)) return '';
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c.id, mapItems.filter((m) => m.category === c.id).length]));
  const cats = CATEGORIES.filter((c) => counts[c.id] > 0);
  const data = {
    center: [loc.lat, loc.lon],
    zoom: cfg.zoom || 13,
    tiles: (cfg.tiles || []).map((t) => ({
      name: t.name, url: t.url, attribution: t.attribution, subdomains: t.subdomains, maxZoom: t.maxZoom, maxNativeZoom: t.maxNativeZoom, monochrome: !!t.monochrome,
      overlays: (t.overlays || []).map((o) => ({ url: o.url, subdomains: o.subdomains, maxNativeZoom: o.maxNativeZoom })),
    })),
    categories: cats,
    items: mapItems.map((m) => ({ ...m, google: googleMapsLink(startPoint(m)) })),
  };
  // Google Maps: eigene "My Maps"-Karte (mit Routen), sonst Google Maps vom Dorf in Satellitenansicht (ohne Schlüssel)
  const googleSrc = cfg.googleMyMapsId
    ? `https://www.google.com/maps/d/embed?mid=${encodeURIComponent(cfg.googleMyMapsId)}`
    : `https://www.google.com/maps?q=${loc.lat},${loc.lon}&t=k&z=${cfg.zoom || 13}&hl=de&output=embed`;
  const startGoogle = cfg.defaultView === 'google';
  const meta = (m) => [m.lengthKm ? `${String(m.lengthKm).replace('.', ',')} km` : '', m.duration, m.difficulty].filter(Boolean).join(' · ');
  return html`
<div class="map-block" data-map${startGoogle ? raw(' data-start-view="google"') : ''}>
  <div class="map-toolbar">
    <div class="chips" role="group" aria-label="Auf der Karte anzeigen">
      ${cats.map((c) => html`<button type="button" class="chip chip--cat" aria-pressed="true" data-map-filter="${c.id}">
        <span class="swatch swatch--${c.id}" aria-hidden="true"></span>${c.label} <span class="chip-count">${counts[c.id]}</span></button>`)}
    </div>
    <div class="seg" role="group" aria-label="Kartenansicht">
      <button type="button" class="seg-btn" aria-pressed="${startGoogle ? 'false' : 'true'}" data-map-view="own">Unsere Karte</button>
      <button type="button" class="seg-btn" aria-pressed="${startGoogle ? 'true' : 'false'}" data-map-view="google">Google Maps</button>
    </div>
  </div>
  <div class="map-stage">
    <div class="map-canvas" data-map-canvas role="region" aria-label="Interaktive Karte mit Wander-, Lauf- und Velorouten sowie Aussichtspunkten">
      <p class="map-placeholder">Karte wird geladen …<noscript> Für die Karte bitte JavaScript aktivieren.</noscript></p>
    </div>
    <div class="map-google" data-map-google data-src="${googleSrc}" hidden></div>
  </div>
  ${list ? html`
  <ul class="route-list" data-route-list>
    ${mapItems.map((m) => html`<li class="route-item" data-route-item data-category="${m.category}">
      <span class="swatch swatch--${m.category}" aria-hidden="true"></span>
      <div class="route-body">
        <h3>${m.name}</h3>
        <p class="meta">${CATEGORIES.find((c) => c.id === m.category).label}${meta(m) ? html`<span>${meta(m)}</span>` : ''}</p>
        ${m.description ? html`<p class="muted">${m.description}</p>` : ''}
        <div class="route-actions">
          <button type="button" class="btn btn--ghost btn--small" data-map-focus="${m.id}">Auf der Karte zeigen</button>
          <a class="btn btn--ghost btn--small" href="${googleMapsLink(startPoint(m))}" target="_blank" rel="noopener">In Google Maps öffnen<span class="visually-hidden">: ${m.name}</span></a>
        </div>
      </div>
    </li>`)}
  </ul>` : ''}
  ${raw(`<script type="application/json" data-map-data>${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`)}
</div>`;
}

/* ---------- Dorfleben ---------- */
function villageCard(ctx, it) {
  return html`
    <figure class="village-card">
      ${picture(ctx.imageVariants, it.src, { alt: it.alt || '', sizes: '(min-width: 1100px) 380px, (min-width: 640px) 46vw, 80vw', width: 800, height: 1000, maxWidth: 1200 })}
      <figcaption>
        <h3>${it.title}</h3>
        <p>${it.text}</p>
      </figcaption>
    </figure>`;
}

// Jede Reihe auf der Startseite: höchstens 4 Karten, danach "Alle ansehen"
const HOME_LIMIT = 4;

function villageSection(ctx) {
  const v = ctx.site.village;
  if (!v?.items?.length) return '';
  return html`
<section class="container section">
  ${sectionHead(v.title, '/dorfleben', 'Alles zum Dorfleben', v.text)}
  ${scrollRow(v.items.slice(0, HOME_LIMIT).map((it) => villageCard(ctx, it)), {
    label: v.title,
    more: { href: '/dorfleben', label: 'Alles zum Dorfleben', count: v.items.length, image: (v.items[HOME_LIMIT] || v.items[0]).src },
  })}
</section>`;
}

export function villagePage(ctx) {
  const v = ctx.site.village;
  const body = html`
${pageHead('Dorfleben', v.title, v.text)}
<section class="container section section--tight">
  <div class="grid grid--3">${v.items.map((it) => villageCard(ctx, it))}</div>
</section>`;
  return layout(ctx, { title: v.title, path: '/dorfleben', body: body.value });
}

/* ---------- Seiten ---------- */
export function homePage(ctx) {
  const { site, media, articles } = ctx;
  const latest = articles.slice(0, HOME_LIMIT);
  const body = html`
${heroCarousel(ctx)}

<section class="container facts" aria-label="Das Dorf in Zahlen">
  <dl class="facts-grid">
    ${site.facts.map((f) => html`<div class="fact"><dt>${f.label}</dt><dd>${f.value}</dd></div>`)}
  </dl>
</section>

<section class="container section intro">
  <div class="intro-grid">
    <div>
      <p class="eyebrow">${site.hero.eyebrow}</p>
      <h2>${site.hero.title}</h2>
      <p class="lead">${site.hero.text}</p>
      <p class="intro-text">${site.intro.text}</p>
    </div>
    ${weatherCard(ctx)}
  </div>
</section>

<section class="container section" id="in-der-naehe">
  ${sectionHead('In der Nähe', '/ausflugsziele', 'Alle Routen & Ziele', 'Wandern, laufen, Velo fahren – und die schönsten Aussichtspunkte. Kategorien antippen zum Ein- und Ausblenden.')}
  ${mapBlock(ctx)}
  <div class="mt">${scrollRow(media.places.slice(0, HOME_LIMIT).map((p) => placeCard(ctx, p)), { label: 'Ausflugsziele', cols: 4, more: { href: '/ausflugsziele', label: 'Alle Routen & Ziele', count: media.places.length + ctx.mapItems.length, image: media.gallery.find((g) => /Wander/i.test(g.caption))?.src || media.places[0]?.image } })}</div>
</section>

${villageSection(ctx)}

<section class="container section">
  ${sectionHead('360° Rundblick', '/panorama', 'Alle 360°-Ansichten', 'Ein Ort, vier Jahreszeiten. Ansicht wählen und mit Maus oder Finger drehen.')}
  ${panoramaBlock(media.panoramas, { limit: 4 })}
</section>

<section class="container section">
  ${sectionHead('Galerie', '/galerie', 'Alle Bilder')}
  ${galleryGrid(ctx, media.gallery, { limit: 9 })}
</section>

${media.videos.length ? html`
<section class="container section">
  ${sectionHead('Videos', '/videos', 'Alle Videos')}
  <div class="grid grid--videos">
    ${media.videos.slice(0, 2).map((v) => videoCard(ctx, v))}
    ${moreCard({ href: '/videos', label: 'Alle Videos', count: media.videos.length, image: media.videos[2]?.poster || media.videos[0].poster })}
  </div>
</section>` : ''}

${latest.length ? html`
<section class="container section">
  ${sectionHead('Aktuelles', '/blog', 'Alle Beiträge')}
  ${scrollRow(latest.map((a) => articleCard(ctx, a)), { label: 'Aktuelle Beiträge', more: { href: '/blog', label: 'Alle Beiträge', count: articles.length, image: (articles[3] || articles[0]).image || media.gallery[0]?.src } })}
</section>` : ''}

<section class="container section">
  <div class="panel cta">
    <div>
      <h2>Anreise & Kontakt</h2>
      <p class="muted">${site.arrival[0]?.text || ''}</p>
    </div>
    <a class="btn" href="/info">So kommen Sie zu uns ${icons.arrow}</a>
  </div>
</section>`;

  const loc = site.location;
  return layout(ctx, {
    path: '/',
    body: body.value,
    image: site.hero.slides?.[0] ? unsplash(site.hero.slides[0].src, 1200, 1200 / 630) : undefined,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'TouristDestination',
      name: site.name,
      description: site.description,
      url: ctx.siteUrl + '/',
      image: ctx.siteUrl + '/images/og-image.jpg',
      address: { '@type': 'PostalAddress', streetAddress: site.contact.street, addressLocality: site.contact.city, addressCountry: site.contact.country },
      ...(loc ? { geo: { '@type': 'GeoCoordinates', latitude: loc.lat, longitude: loc.lon } } : {}),
    },
  });
}

export function placesPage(ctx) {
  const body = html`
${pageHead('Entdecken', 'Routen & Ausflugsziele', 'Wanderwege, Laufrunden, Velotouren und Aussichtspunkte rund ums Dorf. Jede Route lässt sich direkt in Google Maps öffnen.')}
<section class="container section section--tight">
  ${mapBlock(ctx, { list: true })}
</section>
<section class="container section">
  ${sectionHead('Vier Orte, die man gesehen haben muss', '', '', 'Stein, Wasser, Holz und Metall – alle ohne Auto erreichbar.')}
  <div class="grid grid--2">${ctx.media.places.map((p) => placeCard(ctx, p))}</div>
</section>`;
  return layout(ctx, { title: 'Routen & Ausflugsziele', path: '/ausflugsziele', body: body.value });
}

export function panoramaPage(ctx) {
  const body = html`
${pageHead('360°', 'Rundblick durch das Jahr', 'Derselbe Ort in Winter, Frühling, Sommer und Herbst. Drehen Sie das Bild mit Maus, Finger oder Pfeiltasten – mit dem Vollbild-Symbol oben links wird es noch eindrücklicher.')}
<section class="container section section--tight">${panoramaBlock(ctx.media.panoramas, { selected: ctx.query?.ansicht })}</section>`;
  return layout(ctx, { title: '360° Rundblick', path: '/panorama', body: body.value });
}

export function galleryPage(ctx) {
  const body = html`
${pageHead('Galerie', 'Bilder aus Steinbach', 'Ein Bild antippen, um es gross zu sehen. Mit den Pfeiltasten blättern.')}
<section class="container section section--tight">${galleryGrid(ctx, ctx.media.gallery)}</section>`;
  return layout(ctx, { title: 'Galerie', path: '/galerie', body: body.value });
}

export function videosPage(ctx) {
  const [first, ...rest] = ctx.media.videos;
  const body = html`
${pageHead('Videos', 'Steinbach in Bewegung', 'Die Videos werden erst beim Abspielen von YouTube geladen – im erweiterten Datenschutzmodus.')}
<section class="container section section--tight">
  ${first ? videoCard(ctx, first, { large: true }) : html`<p class="muted">Bald gibt es hier Videos.</p>`}
  ${rest.length ? html`<div class="grid grid--2 mt">${rest.map((v) => videoCard(ctx, v))}</div>` : ''}
</section>`;
  return layout(ctx, { title: 'Videos', path: '/videos', body: body.value });
}

export function blogPage(ctx) {
  const { articles } = ctx;
  const body = html`
${pageHead('Aktuelles', 'Neuigkeiten aus dem Dorf', 'Berichte, Tipps und Termine rund um Steinbach.')}
<section class="container section section--tight">
  ${articles.length
    ? html`<div class="grid grid--3">${articles.map((a) => articleCard(ctx, a))}</div>`
    : html`<p class="muted">Noch keine Beiträge.</p>`}
</section>`;
  return layout(ctx, { title: 'Aktuelles', path: '/blog', body: body.value });
}

export function articlePage(ctx, a) {
  const others = ctx.articles.filter((x) => x.slug !== a.slug).slice(0, 2);
  const body = html`
<article class="article">
  <header class="container article-head">
    <a class="link-back" href="/blog">${icons.prev} Alle Beiträge</a>
    <p class="meta">${a.category ? html`<span class="tag">${a.category}</span>` : ''}<time datetime="${isoDate(a.date)}">${formatDate(a.date)}</time><span>${a.readingTime} Min. Lesezeit</span></p>
    <h1>${a.title}</h1>
    ${a.excerpt ? html`<p class="lead">${a.excerpt}</p>` : ''}
  </header>
  ${a.image ? html`<div class="container article-cover">${picture(ctx.imageVariants, a.image, { alt: '', eager: true, sizes: '(min-width: 1240px) 1200px, 100vw', ratio: 2 })}</div>` : ''}
  <div class="container prose">${raw(a.html)}</div>
</article>
${others.length ? html`
<section class="container section">
  ${sectionHead('Weitere Beiträge', '/blog', 'Alle Beiträge')}
  <div class="grid grid--2">${others.map((o) => articleCard(ctx, o))}</div>
</section>` : ''}`;
  return layout(ctx, {
    title: a.title,
    description: a.excerpt,
    path: `/blog/${a.slug}`,
    type: 'article',
    image: a.image ? (isRemote(a.image) ? unsplash(a.image, 1200, 1200 / 630) : largest(ctx.imageVariants, a.image)) : undefined,
    body: body.value,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: a.title,
      description: a.excerpt,
      datePublished: a.date.toISOString(),
      url: `${ctx.siteUrl}/blog/${a.slug}`,
      publisher: { '@type': 'Organization', name: ctx.site.contact.organisation },
    },
  });
}

export function infoPage(ctx) {
  const { site } = ctx;
  const c = site.contact;
  const mapQuery = encodeURIComponent(`${c.street}, ${c.city}, ${c.country}`);
  const body = html`
${pageHead('Info', 'Anreise & Kontakt', 'Wir helfen gerne weiter – persönlich am Dorfplatz, per Telefon oder E-Mail.')}
<section class="container section section--tight">
  <div class="grid grid--3">
    ${site.arrival.map((a) => html`<div class="panel"><h2 class="h3">${a.title}</h2><p class="muted">${a.text}</p></div>`)}
  </div>
</section>
<section class="container section">
  <div class="grid grid--2">
    <div class="panel">
      <h2 class="h3">${c.organisation}</h2>
      <ul class="contact-list">
        <li>${icons.pin}<span>${c.street}, ${c.city}<br><a href="https://www.openstreetmap.org/search?query=${mapQuery}" target="_blank" rel="noopener">Auf der Karte öffnen</a></span></li>
        <li>${icons.phone}<a href="tel:${c.phone.replace(/\s/g, '')}">${c.phone}</a></li>
        <li>${icons.mail}<a href="mailto:${c.email}">${c.email}</a></li>
      </ul>
    </div>
    <div class="panel">
      <h2 class="h3">Öffnungszeiten</h2>
      <ul class="contact-list">${c.hours.map((h) => html`<li>${icons.clock}<span>${h}</span></li>`)}</ul>
    </div>
  </div>
</section>`;
  return layout(ctx, { title: 'Anreise & Kontakt', path: '/info', body: body.value });
}

export function photoCredits(ctx) {
  const { site, media } = ctx;
  const all = [
    ...(site.hero.slides || []).map((x) => ({ ...x, label: x.alt })),
    ...(site.village?.items || []).map((x) => ({ ...x, label: x.title })),
    ...media.places.map((x) => ({ src: x.image, credit: x.credit, creditUrl: x.creditUrl, label: x.title })),
    ...media.gallery.map((x) => ({ ...x, label: x.caption || x.alt })),
  ];
  const seen = new Set();
  return all
    .filter((x) => x.credit && x.creditUrl && !seen.has(x.src) && seen.add(x.src))
    .map((x) => ({ label: x.label, credit: x.credit, url: x.creditUrl }));
}

export function impressumPage(ctx) {
  const c = ctx.site.contact;
  const credits = photoCredits(ctx);
  const body = html`
${pageHead('', 'Impressum & Datenschutz')}
<div class="container prose section--tight">
  <h2>Verantwortlich</h2>
  <p>${c.organisation}<br>${c.street}<br>${c.city}<br>${c.country}<br><a href="mailto:${c.email}">${c.email}</a></p>
  <h2>Datenschutz</h2>
  <p>Diese Website setzt keine Cookies und verwendet keine Analyse- oder Tracking-Dienste. Schriften werden von unserem eigenen Server geladen.</p>
  <p>Fotos werden über das Bildnetzwerk von Unsplash (images.unsplash.com) geladen, die Kartenbilder von OpenStreetMap bzw. OpenTopoMap. Dabei wird Ihre IP-Adresse an diese Dienste übertragen, damit die Bilder angezeigt werden können.</p>
  <p>Die Wetterdaten fragt unser Server bei Open-Meteo ab. Ihr Browser verbindet sich dafür nicht mit dem Wetterdienst.</p>
  <p>Videos sind von YouTube eingebunden (erweiterter Datenschutzmodus, youtube-nocookie.com). Eine Verbindung zu YouTube wird erst hergestellt, wenn Sie ein Video aktiv abspielen. Es gelten dann die Datenschutzbestimmungen von Google.</p>
  <p>Beim Aufruf der Website speichert der Server technisch notwendige Protokolldaten (z.&nbsp;B. IP-Adresse, Zeitpunkt), die nach kurzer Zeit gelöscht werden.</p>
  ${credits.length ? html`<h2>Bildnachweis</h2>
  <p>Fotos von <a href="https://unsplash.com" target="_blank" rel="noopener">Unsplash</a> (Unsplash-Lizenz):</p>
  <ul class="credits">${credits.map((c) => html`<li>${c.label} – <a href="${c.url}" target="_blank" rel="noopener">${c.credit}</a></li>`)}</ul>` : ''}
</div>`;
  return layout(ctx, { title: 'Impressum & Datenschutz', path: '/impressum', body: body.value });
}

export function errorPage(ctx, status) {
  const notFound = status === 404;
  const body = html`
<section class="container error-page">
  <p class="eyebrow">Fehler ${status}</p>
  <h1>${notFound ? 'Diese Seite gibt es nicht.' : 'Etwas ist schiefgelaufen.'}</h1>
  <p class="lead">${notFound ? 'Vielleicht wurde sie verschoben. Hier geht es weiter:' : 'Bitte versuchen Sie es in einem Moment erneut.'}</p>
  <div class="actions"><a class="btn" href="/">Zur Startseite</a><a class="btn btn--ghost" href="/blog">Aktuelles</a></div>
</section>`;
  return layout(ctx, { title: notFound ? 'Seite nicht gefunden' : 'Fehler', path: '/' + status, body: body.value });
}

/* ---------- XML ---------- */
const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function sitemapXml(ctx) {
  const paths = ['/', ...NAV.map((n) => n.href), '/dorfleben', '/impressum', ...ctx.articles.map((a) => `/blog/${a.slug}`)];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths
    .map((p) => `  <url><loc>${xmlEsc(ctx.siteUrl + p)}</loc></url>`)
    .join('\n')}\n</urlset>\n`;
}

export function feedXml(ctx) {
  const items = ctx.articles.slice(0, 20).map((a) => `  <item>
    <title>${xmlEsc(a.title)}</title>
    <link>${xmlEsc(`${ctx.siteUrl}/blog/${a.slug}`)}</link>
    <guid>${xmlEsc(`${ctx.siteUrl}/blog/${a.slug}`)}</guid>
    <pubDate>${a.date.toUTCString()}</pubDate>
    <description>${xmlEsc(a.excerpt)}</description>
  </item>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n<channel>\n  <title>${xmlEsc(ctx.site.name)} – Aktuelles</title>\n  <link>${xmlEsc(ctx.siteUrl + '/blog')}</link>\n  <description>${xmlEsc(ctx.site.description)}</description>\n  <language>de</language>\n${items}\n</channel>\n</rss>\n`;
}
