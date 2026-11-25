import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseFrontMatter, slugFromFile, readingTime, isValidSlug, createContentStore } from '../../main/src/content.js';
import { html, raw, toString } from '../../main/src/html.js';

test('Front-Matter wird gelesen', () => {
  const { data, body } = parseFrontMatter('---\ntitle: "Hallo: Welt"\ndate: 2026-01-02\n---\nText');
  assert.equal(data.title, 'Hallo: Welt');
  assert.equal(data.date, '2026-01-02');
  assert.equal(body, 'Text');
});

test('Datei ohne Front-Matter bleibt Text', () => {
  assert.deepEqual(parseFrontMatter('Nur Text'), { data: {}, body: 'Nur Text' });
});

test('Windows-Zeilenumbrüche und BOM funktionieren', () => {
  const { data } = parseFrontMatter('﻿---\r\ntitle: X\r\n---\r\nA');
  assert.equal(data.title, 'X');
});

test('Slugs aus Dateinamen (inkl. Umlaute)', () => {
  assert.equal(slugFromFile('2026-11-01-saisonstart.md'), 'saisonstart');
  assert.equal(slugFromFile('Grüsse aus dem Tal.md'), 'grusse-aus-dem-tal');
  assert.equal(slugFromFile('Straße_Nord.md'), 'strasse-nord');
});

test('Slug-Prüfung blockiert Pfad-Tricks', () => {
  assert.equal(isValidSlug('saisonstart'), true);
  for (const bad of ['../etc/passwd', 'a/b', '', 'A', 'a--b', '-a', 'a b', 'x'.repeat(200)]) assert.equal(isValidSlug(bad), false, bad);
});

test('Lesezeit mindestens 1 Minute', () => {
  assert.equal(readingTime(''), 1);
  assert.equal(readingTime('wort '.repeat(1000)), 5);
});

test('HTML-Vorlagen escapen Eingaben', () => {
  const evil = '<script>alert("x")</script>';
  assert.equal(toString(html`<p>${evil}</p>`), '<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</p>');
  assert.equal(toString(html`<p>${raw('<b>ok</b>')}</p>`), '<p><b>ok</b></p>');
  assert.equal(toString(html`<ul>${[1, 2].map((n) => html`<li>${n}</li>`)}</ul>`), '<ul><li>1</li><li>2</li></ul>');
  assert.equal(toString(html`${null}${undefined}${false}`), '');
});

function makeContentDir() {
  const dir = mkdtempSync(join(tmpdir(), 'dorf-'));
  cpSync(new URL('../../data/site.json', import.meta.url), join(dir, 'site.json'));
  cpSync(new URL('../../data/media.json', import.meta.url), join(dir, 'media.json'));
  mkdirSync(join(dir, 'articles'));
  return dir;
}

test('Artikel: Sortierung, Entwürfe, rohes HTML wird entfernt, Duplikate', () => {
  const dir = makeContentDir();
  const a = join(dir, 'articles');
  writeFileSync(join(a, '2026-01-01-alt.md'), '---\ntitle: Alt\n---\nalt');
  writeFileSync(join(a, '2026-03-01-neu.md'), '---\ntitle: Neu\n---\n# H\n\n<script>alert(1)</script>\n\n[ext](https://example.com)');
  writeFileSync(join(a, '2026-02-01-entwurf.md'), '---\ntitle: E\ndraft: true\n---\nx');
  writeFileSync(join(a, '2026-02-02-neu.md'), '---\ntitle: Doppelt\n---\nx');
  writeFileSync(join(a, 'kaputt.md'), '---\ntitle: K\ndate: kein-datum\n---\nx');
  const store = createContentStore(dir);
  const titles = store.articles.map((x) => x.title);
  assert.deepEqual(titles, ['Neu', 'Alt']);
  const neu = store.article('neu');
  assert.ok(!neu.html.includes('<script'));
  assert.ok(neu.html.includes('target="_blank" rel="noopener"'));
  assert.equal(store.article('../site'), null);
  assert.equal(store.article('gibtsnicht'), null);
});

test('Neue Artikel erscheinen ohne Neustart', async () => {
  const dir = makeContentDir();
  const store = createContentStore(dir);
  assert.equal(store.articles.length, 0);
  await new Promise((r) => setTimeout(r, 20));
  writeFileSync(join(dir, 'articles', '2026-05-05-frisch.md'), '---\ntitle: Frisch\n---\nHallo');
  assert.equal(store.articles.length, 1);
  assert.equal(store.article('frisch').title, 'Frisch');
});

test('Echte Inhalte sind gültig', () => {
  const store = createContentStore(new URL('../../data', import.meta.url).pathname);
  assert.ok(store.site.name);
  assert.ok(store.articles.length >= 1);
  for (const g of store.media.gallery) assert.ok(g.alt && g.alt.length > 3, 'Jedes Galeriebild braucht einen Alt-Text');
  for (const v of store.media.videos) assert.match(v.youtubeId, /^[\w-]{11}$/, 'YouTube-ID muss 11 Zeichen haben');
});
