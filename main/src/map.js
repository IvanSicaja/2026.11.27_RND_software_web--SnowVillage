// Karten-Daten: liest data/karte.geojson, prüft sie und berechnet Längen.
// Kategorien sind fest, damit Filter, Farben und Linienstile immer passen.

export const CATEGORIES = [
  { id: 'wandern', label: 'Wandern', color: '#2f6b4f', dash: '8 6' },
  { id: 'laufen', label: 'Laufen', color: '#b5562c', dash: '2 6' },
  { id: 'velo', label: 'Velo', color: '#2b5c8a', dash: '' },
  { id: 'aussicht', label: 'Aussicht & Sehenswertes', color: '#141414', dash: '' },
];
const IDS = new Set(CATEGORIES.map((c) => c.id));

/** Ordnet freie Bezeichnungen (z. B. Ebenen-Namen aus Google My Maps) einer Kategorie zu. */
export function normalizeCategory(value = '') {
  const v = String(value).toLowerCase();
  if (IDS.has(v)) return v;
  if (/wander|hik|trek|spazier|walk/.test(v)) return 'wandern';
  if (/lauf|jog|run|trail ?run/.test(v)) return 'laufen';
  if (/velo|rad|bike|bicy|cycl|mtb/.test(v)) return 'velo';
  if (/aussicht|sehens|view|sight|poi|\borte?\b|place|punkt|interest|highlight/.test(v)) return 'aussicht';
  return null;
}

const toRad = (d) => (d * Math.PI) / 180;
export function distanceKm([lon1, lat1], [lon2, lat2]) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function lineLengthKm(coords) {
  let sum = 0;
  for (let i = 1; i < coords.length; i++) sum += distanceKm(coords[i - 1], coords[i]);
  return Math.round(sum * 10) / 10;
}

const isCoord = (c) => Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]) && Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90;
const clean = (s, max = 400) => (typeof s === 'string' ? s.trim().slice(0, max) : '');

/** Wandelt eine FeatureCollection in eine saubere, kompakte Liste um. Ungültiges wird übersprungen. */
export function prepareMapData(geojson) {
  const items = [];
  const features = Array.isArray(geojson?.features) ? geojson.features : [];
  features.forEach((f, i) => {
    const p = f?.properties || {};
    const g = f?.geometry || {};
    const category = normalizeCategory(p.kategorie ?? p.category);
    if (!category) return;
    const base = {
      id: `f${i}`,
      name: clean(p.name, 120) || 'Ohne Namen',
      category,
      description: clean(p.beschreibung ?? p.description),
      difficulty: clean(p.schwierigkeit, 40),
      duration: clean(p.dauer, 40),
    };
    if (g.type === 'Point' && isCoord(g.coordinates)) {
      items.push({ ...base, type: 'point', coords: g.coordinates.slice(0, 2) });
    } else if (g.type === 'LineString' && Array.isArray(g.coordinates) && g.coordinates.filter(isCoord).length >= 2) {
      const coords = g.coordinates.filter(isCoord).map((c) => c.slice(0, 2));
      items.push({ ...base, type: 'line', coords, lengthKm: lineLengthKm(coords) });
    } else if (g.type === 'MultiLineString' && Array.isArray(g.coordinates)) {
      const coords = g.coordinates.flat().filter(isCoord).map((c) => c.slice(0, 2));
      if (coords.length >= 2) items.push({ ...base, type: 'line', coords, lengthKm: lineLengthKm(coords) });
    }
  });
  return items;
}

/** Startpunkt einer Route bzw. Koordinate eines Ortes. */
export const startPoint = (item) => (item.type === 'line' ? item.coords[0] : item.coords);

/** Link, der den Startpunkt direkt in Google Maps (App oder Web) als Ziel öffnet. */
export function googleMapsLink([lon, lat]) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(5)},${lon.toFixed(5)}`;
}
