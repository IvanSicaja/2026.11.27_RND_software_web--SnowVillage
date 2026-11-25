// Alle Seiten-Vorlagen. Reines JavaScript – kein Build-Schritt, sehr schnell.
import { html, raw } from './html.js';

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
  rotate: svg('<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>', 22),
  pin: svg('<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>', 18),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', 18),
  mail: svg('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3.5 7l8.5 6 8.5-6"/>', 18),
  phone: svg('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>', 18),
  mountain: raw('<svg class="logo-mark" width="28" height="28" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><rect width="32" height="32" rx="9" fill="currentColor"/><path d="M5 23l7.5-11 4.5 6.5 3-4 7 8.5z" fill="var(--paper)"/></svg>'),
};

/* ---------- Bilder ---------- */
// Erzeugt <img> mit srcset aus Varianten wie /images/x-600.webp, /images/x-1200.webp
export function picture(imageVariants, base, { alt = '', sizes = '100vw', eager = false, cls = '', width, height } = {}) {
  if (!base) return '';
  const variants = imageVariants(base);
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
  const ogImage = siteUrl + (image || '/images/og-image.jpg');
  const isActive = (href) => path === href || (href !== '/' && path.startsWith(href + '/'));

  return `<!doctype html>${html`<html lang="${site.language || 'de'}">
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

function panoramaBlock(panoramas) {
  if (!panoramas.length) return '';
  const first = panoramas[0];
  return html`
<div class="pano" data-pano data-image="${first.image}" data-title="${first.title}">
  <div class="pano-stage">
    <div class="pano-viewer" data-pano-viewer role="region" aria-label="360°-Panorama: ${first.title}"></div>
    <button class="pano-start" type="button" data-pano-start>
      <img src="${first.preview || first.image}" alt="" data-pano-preview width="800" height="400" loading="lazy" decoding="async">
      <span class="pano-start-label">${icons.rotate}<span>360° Rundblick starten</span></span>
    </button>
  </div>
  <div class="pano-bar">
    ${panoramas.length > 1
      ? html`<div class="chips" role="group" aria-label="Standort wählen">
          ${panoramas.map((p, i) => html`<button type="button" class="chip" aria-pressed="${i === 0 ? 'true' : 'false'}"
            data-pano-choice data-image="${p.image}" data-preview="${p.preview || p.image}" data-title="${p.title}" data-text="${p.text || ''}">${p.title}</button>`)}
        </div>`
      : ''}
    <p class="muted pano-caption" data-pano-caption aria-live="polite">${first.text || ''}</p>
  </div>
</div>`;
}

function galleryGrid(ctx, items, { limit } = {}) {
  const list = limit ? items.slice(0, limit) : items;
  return html`
<ul class="gallery" data-gallery>
  ${list.map((g, i) => {
    const variants = ctx.imageVariants(g.src);
    const full = variants.length ? variants[variants.length - 1].url : g.src;
    return html`<li>
      <a class="gallery-item" href="${full}" data-gallery-item data-index="${i}" data-caption="${g.caption || ''}" data-alt="${g.alt}">
        ${picture(ctx.imageVariants, g.src, { alt: g.alt, sizes: '(min-width: 1100px) 360px, (min-width: 700px) 45vw, 92vw', width: g.w, height: g.h })}
      </a>
    </li>`;
  })}
</ul>`;
}

function videoCard(v, { large = false } = {}) {
  const poster = v.poster || `https://i.ytimg.com/vi/${encodeURIComponent(v.youtubeId)}/hqdefault.jpg`;
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
  <div class="card-media">${picture(ctx.imageVariants, p.image, { alt: p.title, sizes: '(min-width: 1100px) 280px, (min-width: 700px) 45vw, 92vw', width: 1200, height: 900 })}</div>
  <div class="card-body">
    <p class="meta"><span class="tag tag--${p.kind.toLowerCase()}">${p.kind}</span><span>${p.distance}</span></p>
    <h3>${p.title}</h3>
    <p class="muted">${p.text}</p>
  </div>
</article>`;
}

function articleCard(ctx, a) {
  return html`
<article class="card article-card">
  ${a.image ? html`<div class="card-media">${picture(ctx.imageVariants, a.image, { alt: '', sizes: '(min-width: 1100px) 360px, (min-width: 700px) 45vw, 92vw' })}</div>` : ''}
  <div class="card-body">
    <p class="meta">${a.category ? html`<span class="tag">${a.category}</span>` : ''}<time datetime="${isoDate(a.date)}">${formatDate(a.date)}</time></p>
    <h3><a class="stretched" href="/blog/${a.slug}">${a.title}</a></h3>
    ${a.excerpt ? html`<p class="muted">${a.excerpt}</p>` : ''}
  </div>
</article>`;
}

/* ---------- Seiten ---------- */
export function homePage(ctx) {
  const { site, media, articles } = ctx;
  const latest = articles.slice(0, 3);
  const body = html`
<section class="hero container">
  <div class="hero-media">
    ${picture(ctx.imageVariants, site.hero.image, { alt: `Berge und Bergsee bei ${site.name}`, eager: true, width: 2400, height: 1400 })}
  </div>
  <div class="hero-content">
    <p class="eyebrow eyebrow--light">${site.hero.eyebrow}</p>
    <h1>${site.hero.title}</h1>
    <p class="hero-text">${site.hero.text}</p>
    <div class="actions">
      <a class="btn btn--light" href="/ausflugsziele">Entdecken</a>
      <a class="btn btn--ghost-light" href="/panorama">360° ansehen</a>
    </div>
  </div>
</section>

<section class="container facts" aria-label="Das Dorf in Zahlen">
  <dl class="facts-grid">
    ${site.facts.map((f) => html`<div class="fact"><dt>${f.label}</dt><dd>${f.value}</dd></div>`)}
  </dl>
</section>

<section class="container section intro">
  <h2>${site.intro.title}</h2>
  <p class="lead">${site.intro.text}</p>
</section>

<section class="container section">
  ${sectionHead('In der Nähe', '/ausflugsziele', 'Alle Ausflugsziele')}
  <div class="grid grid--4">${media.places.map((p) => placeCard(ctx, p))}</div>
</section>

<section class="container section">
  ${sectionHead('360° Rundblick', '/panorama', 'Alle Panoramen', 'Mit Maus oder Finger in alle Richtungen drehen.')}
  ${panoramaBlock(media.panoramas)}
</section>

<section class="container section">
  ${sectionHead('Galerie', '/galerie', 'Alle Bilder')}
  ${galleryGrid(ctx, media.gallery, { limit: 6 })}
</section>

${media.videos.length ? html`
<section class="container section">
  ${sectionHead('Videos', '/videos', 'Alle Videos')}
  <div class="grid grid--2">${media.videos.slice(0, 2).map((v) => videoCard(v))}</div>
</section>` : ''}

${latest.length ? html`
<section class="container section">
  ${sectionHead('Aktuelles', '/blog', 'Alle Beiträge')}
  <div class="grid grid--3">${latest.map((a) => articleCard(ctx, a))}</div>
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

  return layout(ctx, {
    path: '/',
    body: body.value,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'TouristDestination',
      name: site.name,
      description: site.description,
      url: ctx.siteUrl + '/',
      image: ctx.siteUrl + '/images/og-image.jpg',
      address: { '@type': 'PostalAddress', streetAddress: site.contact.street, addressLocality: site.contact.city, addressCountry: site.contact.country },
    },
  });
}

export function placesPage(ctx) {
  const body = html`
${pageHead('Entdecken', 'Ausflugsziele in der Nähe', 'Stein, Wasser, Holz und Metall – vier Orte, die man gesehen haben muss. Alle sind vom Dorf aus ohne Auto erreichbar.')}
<section class="container section section--tight">
  <div class="grid grid--2">${ctx.media.places.map((p) => placeCard(ctx, p))}</div>
</section>`;
  return layout(ctx, { title: 'Ausflugsziele', path: '/ausflugsziele', body: body.value });
}

export function panoramaPage(ctx) {
  const body = html`
${pageHead('360°', 'Rundblick', 'Drehen Sie das Bild mit Maus, Finger oder Pfeiltasten. Mit dem Vollbild-Symbol oben links wird es noch eindrücklicher.')}
<section class="container section section--tight">${panoramaBlock(ctx.media.panoramas)}</section>`;
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
  ${first ? videoCard(first, { large: true }) : html`<p class="muted">Bald gibt es hier Videos.</p>`}
  ${rest.length ? html`<div class="grid grid--2 mt">${rest.map((v) => videoCard(v))}</div>` : ''}
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
  ${a.image ? html`<div class="container article-cover">${picture(ctx.imageVariants, a.image, { alt: '', eager: true, sizes: '(min-width: 1100px) 1040px, 100vw' })}</div>` : ''}
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
    image: a.image ? (ctx.imageVariants(a.image).at(-1)?.url || a.image) : undefined,
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

export function impressumPage(ctx) {
  const c = ctx.site.contact;
  const body = html`
${pageHead('', 'Impressum & Datenschutz')}
<div class="container prose section--tight">
  <h2>Verantwortlich</h2>
  <p>${c.organisation}<br>${c.street}<br>${c.city}<br>${c.country}<br><a href="mailto:${c.email}">${c.email}</a></p>
  <h2>Datenschutz</h2>
  <p>Diese Website setzt keine Cookies und verwendet keine Analyse- oder Tracking-Dienste. Schriften und Bilder werden von unserem eigenen Server geladen.</p>
  <p>Videos sind von YouTube eingebunden (erweiterter Datenschutzmodus, youtube-nocookie.com). Eine Verbindung zu YouTube wird erst hergestellt, wenn Sie ein Video aktiv abspielen. Es gelten dann die Datenschutzbestimmungen von Google.</p>
  <p>Beim Aufruf der Website speichert der Server technisch notwendige Protokolldaten (z.&nbsp;B. IP-Adresse, Zeitpunkt), die nach kurzer Zeit gelöscht werden.</p>
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
  const paths = ['/', ...NAV.map((n) => n.href), '/impressum', ...ctx.articles.map((a) => `/blog/${a.slug}`)];
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
