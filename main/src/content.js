// Lädt alle Inhalte (JSON + Markdown-Artikel) aus dem Ordner /content.
// Änderungen werden automatisch erkannt – neue Artikel erscheinen ohne Neustart.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Marked } from 'marked';
import { prepareMapData } from './map.js';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const marked = new Marked({ gfm: true, breaks: false });
// Externe Links in neuem Tab öffnen, Bilder lazy laden
marked.use({
  renderer: {
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const ext = /^https?:\/\//i.test(href);
      const t = title ? ` title="${escapeAttr(title)}"` : '';
      return `<a href="${escapeAttr(href)}"${t}${ext ? ' target="_blank" rel="noopener"' : ''}>${text}</a>`;
    },
    image({ href, title, text }) {
      const t = title ? ` title="${escapeAttr(title)}"` : '';
      return `<img src="${escapeAttr(href)}" alt="${escapeAttr(text)}"${t} loading="lazy" decoding="async">`;
    },
    html() {
      return ''; // Kein rohes HTML in Artikeln (Sicherheit)
    },
  },
});

function escapeAttr(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Liest einfache Front-Matter (key: value) am Anfang einer Markdown-Datei. */
export function parseFrontMatter(raw) {
  const text = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: text };
  const data = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i < 1) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1);
    data[key] = value;
  }
  return { data, body: m[2] };
}

/** Macht aus einem Dateinamen wie "2026-11-01-saisonstart.md" den Slug "saisonstart". */
export function slugFromFile(file) {
  return file
    .replace(/\.md$/i, '')
    .replace(/^\d{4}-\d{2}-\d{2}-/, '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function readingTime(text) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function isValidSlug(slug) {
  return typeof slug === 'string' && slug.length <= 120 && SLUG_RE.test(slug);
}

function parseArticle(dir, file) {
  const raw = readFileSync(join(dir, file), 'utf8');
  const { data, body } = parseFrontMatter(raw);
  const dateStr = data.date || (file.match(/^(\d{4}-\d{2}-\d{2})/) || [])[1];
  const date = dateStr ? new Date(`${dateStr}T00:00:00Z`) : new Date(statSync(join(dir, file)).mtime);
  if (Number.isNaN(date.getTime())) throw new Error(`Ungültiges Datum in ${file}`);
  const slug = isValidSlug(data.slug) ? data.slug : slugFromFile(file);
  return {
    slug,
    title: data.title || slug,
    date,
    excerpt: data.excerpt || '',
    image: data.image || '',
    category: data.category || '',
    draft: data.draft === 'true',
    readingTime: readingTime(body),
    html: marked.parse(body),
  };
}

export function createContentStore(contentDir) {
  const articlesDir = join(contentDir, 'articles');
  let cache = { key: '', site: null, media: null, articles: [], mapItems: [] };

  function fingerprint() {
    const parts = [];
    for (const f of ['site.json', 'media.json']) parts.push(f + statSync(join(contentDir, f)).mtimeMs);
    try { parts.push('karte' + statSync(join(contentDir, 'karte.geojson')).mtimeMs); } catch { parts.push('karte-'); }
    parts.push(statSync(articlesDir).mtimeMs);
    for (const f of readdirSync(articlesDir)) if (f.endsWith('.md')) parts.push(f + statSync(join(articlesDir, f)).mtimeMs);
    return parts.join('|');
  }

  function load() {
    const key = fingerprint();
    if (key === cache.key) return cache;
    const site = JSON.parse(readFileSync(join(contentDir, 'site.json'), 'utf8'));
    const media = JSON.parse(readFileSync(join(contentDir, 'media.json'), 'utf8'));
    let mapItems = [];
    try {
      mapItems = prepareMapData(JSON.parse(readFileSync(join(contentDir, 'karte.geojson'), 'utf8')));
    } catch (err) {
      if (err.code !== 'ENOENT') console.error('[content] karte.geojson fehlerhaft:', err.message);
    }
    const parsed = [];
    for (const f of readdirSync(articlesDir).filter((f) => f.endsWith('.md'))) {
      try {
        const a = parseArticle(articlesDir, f);
        if (!a.draft && isValidSlug(a.slug)) parsed.push(a);
      } catch (err) {
        console.error(`[content] Artikel übersprungen (${f}):`, err.message);
      }
    }
    parsed.sort((a, b) => b.date - a.date);
    // Bei gleichem Slug gewinnt der neueste Artikel
    const seen = new Set();
    const articles = parsed.filter((a) => !seen.has(a.slug) && seen.add(a.slug));
    cache = { key, site, media, articles, mapItems };
    return cache;
  }

  return {
    get site() { return load().site; },
    get media() { return load().media; },
    get articles() { return load().articles; },
    get mapItems() { return load().mapItems; },
    article(slug) {
      if (!isValidSlug(slug)) return null;
      return load().articles.find((a) => a.slug === slug) || null;
    },
  };
}
