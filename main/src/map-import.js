// Wandelt KML (Google My Maps) bzw. GPX in GeoJSON-Features mit Kategorie um.
import { DOMParser } from '@xmldom/xmldom';
import { kmlWithFolders, gpx } from '@tmcw/togeojson';
import { normalizeCategory } from './map.js';

const stripHtml = (s = '') =>
  String(s)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

// togeojson liefert HTML-Beschreibungen als { '@type': 'html', value: '…' }
const textOf = (v) => (v && typeof v === 'object' ? v.value ?? '' : v ?? '');

function toFeature(f, kategorie) {
  const g = f.geometry;
  if (!g) return null;
  let geometry = g;
  if (g.type === 'GeometryCollection') {
    const lines = g.geometries.filter((x) => x.type === 'LineString');
    const point = g.geometries.find((x) => x.type === 'Point');
    geometry = lines.length ? { type: 'MultiLineString', coordinates: lines.map((l) => l.coordinates) } : point;
  }
  if (!geometry || !['Point', 'LineString', 'MultiLineString'].includes(geometry.type)) return null;
  // Höhenangaben entfernen, Koordinaten runden (kleinere Datei)
  const round = (c) => [Math.round(c[0] * 1e5) / 1e5, Math.round(c[1] * 1e5) / 1e5];
  const coordinates =
    geometry.type === 'Point' ? round(geometry.coordinates)
      : geometry.type === 'LineString' ? geometry.coordinates.map(round)
        : geometry.coordinates.map((l) => l.map(round));
  return {
    type: 'Feature',
    properties: {
      name: stripHtml(f.properties?.name) || 'Ohne Namen',
      kategorie,
      beschreibung: stripHtml(textOf(f.properties?.description) || textOf(f.properties?.desc)),
    },
    geometry: { type: geometry.type, coordinates },
  };
}

export function convertMapFile(text, { type = 'kml', kategorie } = {}) {
  const doc = new DOMParser().parseFromString(text, 'text/xml');
  const forced = kategorie ? normalizeCategory(kategorie) : null;
  if (kategorie && !forced) throw new Error(`Unbekannte Kategorie "${kategorie}". Erlaubt: wandern, laufen, velo, aussicht`);
  const features = [];
  const skipped = [];

  const add = (f, folderCategory) => {
    const name = f.properties?.name || 'Ohne Namen';
    const cat = forced || folderCategory || normalizeCategory(f.properties?.kategorie) || normalizeCategory(name);
    if (!cat) return skipped.push(name);
    const feat = toFeature(f, cat);
    if (feat) features.push(feat);
    else skipped.push(name);
  };

  if (type === 'gpx') {
    for (const f of gpx(doc).features) add(f, null);
  } else {
    const walk = (node, cat) => {
      for (const child of node.children || []) {
        if (child.type === 'folder') walk(child, normalizeCategory(child.meta?.name) || cat);
        else if (child.type === 'Feature') add(child, cat);
      }
    };
    walk(kmlWithFolders(doc), null);
  }
  return { features, skipped };
}
