import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeCategory, prepareMapData, lineLengthKm, googleMapsLink, startPoint } from '../../main/src/map.js';
import { convertMapFile } from '../../main/src/map-import.js';
import { createWeatherService, parseWeather, describeWeather, buildWeatherUrl } from '../../main/src/weather.js';

const fixture = (f) => readFileSync(new URL(`../fixtures/${f}`, import.meta.url), 'utf8');

/* ---------- Karte ---------- */
test('Kategorien werden aus freien Namen erkannt', () => {
  assert.equal(normalizeCategory('Wanderwege'), 'wandern');
  assert.equal(normalizeCategory('Hiking'), 'wandern');
  assert.equal(normalizeCategory('Laufstrecken'), 'laufen');
  assert.equal(normalizeCategory('Bike-Touren'), 'velo');
  assert.equal(normalizeCategory('Fahrrad'), 'velo');
  assert.equal(normalizeCategory('Aussichtspunkte'), 'aussicht');
  assert.equal(normalizeCategory('Sehenswürdigkeiten'), 'aussicht');
  assert.equal(normalizeCategory('Parkplatz'), null);
  assert.equal(normalizeCategory('Sport'), null);
});

test('Länge einer Strecke (1 Breitengrad ≈ 111 km)', () => {
  assert.equal(lineLengthKm([[8, 46], [8, 47]]), 111.2);
  assert.equal(lineLengthKm([[8, 46]]), 0);
});

test('Kartendaten: ungültige Einträge werden übersprungen', () => {
  const items = prepareMapData({
    features: [
      { properties: { name: 'A', kategorie: 'wandern' }, geometry: { type: 'LineString', coordinates: [[8.2, 46.6], [8.21, 46.61]] } },
      { properties: { name: 'B', kategorie: 'aussicht' }, geometry: { type: 'Point', coordinates: [8.2, 46.6] } },
      { properties: { name: 'C', kategorie: 'unbekannt' }, geometry: { type: 'Point', coordinates: [8.2, 46.6] } },
      { properties: { name: 'D', kategorie: 'velo' }, geometry: { type: 'Point', coordinates: [999, 46.6] } },
      { properties: { name: 'E', kategorie: 'laufen' }, geometry: { type: 'LineString', coordinates: [[8.2, 46.6]] } },
      null,
    ],
  });
  assert.deepEqual(items.map((i) => i.name), ['A', 'B']);
  assert.ok(items[0].lengthKm > 1);
  assert.deepEqual(startPoint(items[0]), [8.2, 46.6]);
  assert.deepEqual(startPoint(items[1]), [8.2, 46.6]);
  assert.equal(prepareMapData(null).length, 0);
});

test('Google-Maps-Link zeigt auf den Startpunkt', () => {
  assert.equal(googleMapsLink([8.2, 46.6]), 'https://www.google.com/maps/dir/?api=1&destination=46.60000,8.20000');
});

test('Echte Karte (data/karte.geojson) hat alle 4 Kategorien', () => {
  const items = prepareMapData(JSON.parse(readFileSync(new URL('../../data/karte.geojson', import.meta.url), 'utf8')));
  for (const c of ['wandern', 'laufen', 'velo', 'aussicht']) assert.ok(items.some((i) => i.category === c), c);
});

/* ---------- Import aus Google My Maps / GPX ---------- */
test('KML aus Google My Maps: Ebenen werden zu Kategorien', () => {
  const { features, skipped } = convertMapFile(fixture('my-maps.kml'));
  const byName = Object.fromEntries(features.map((f) => [f.properties.name, f]));
  assert.equal(byName['Höhenweg'].properties.kategorie, 'wandern');
  assert.equal(byName['Höhenweg'].properties.beschreibung, 'Schöner Weg mit Aussicht');
  assert.deepEqual(byName['Höhenweg'].geometry.coordinates[0], [8.2, 46.6]); // Höhe entfernt
  assert.equal(byName.Talrunde.properties.kategorie, 'velo');
  assert.equal(byName.Kirche.properties.kategorie, 'aussicht');
  assert.deepEqual(skipped, ['Parkplatz']);
  assert.equal(prepareMapData({ features }).length, 3);
});

test('GPX mit vorgegebener Kategorie', () => {
  const { features } = convertMapFile(fixture('lauf.gpx'), { type: 'gpx', kategorie: 'laufen' });
  assert.equal(features.length, 1);
  assert.equal(features[0].properties.name, 'Morgenrunde');
  assert.equal(features[0].properties.kategorie, 'laufen');
  assert.equal(features[0].geometry.type, 'LineString');
});

test('Unbekannte Kategorie wird abgelehnt', () => {
  assert.throws(() => convertMapFile(fixture('lauf.gpx'), { type: 'gpx', kategorie: 'schwimmen' }), /Unbekannte Kategorie/);
});

/* ---------- Wetter ---------- */
const sample = {
  current: { time: '2026-11-25T10:00', temperature_2m: -3.6, apparent_temperature: -8.2, weather_code: 73, wind_speed_10m: 12.4, is_day: 1 },
  daily: { temperature_2m_max: [-0.6], temperature_2m_min: [-7.9] },
};

test('Wetterdaten werden verständlich aufbereitet', () => {
  assert.deepEqual(parseWeather(sample), {
    temperature: -4, feelsLike: -8, wind: 12, max: -1, min: -8, isDay: true, code: 73, text: 'Schneefall', icon: 'snow', time: '2026-11-25T10:00',
  });
  assert.equal(describeWeather(999).text, 'Wetter');
  assert.throws(() => parseWeather({}), /Unerwartete/);
  assert.match(buildWeatherUrl({ lat: 46.6, lon: 8.2 }), /^https:\/\/api\.open-meteo\.com\/v1\/forecast\?latitude=46\.6&longitude=8\.2&current=/);
});

test('Wetter wird zwischengespeichert und bei Ausfall weiter angezeigt', async () => {
  let calls = 0;
  let fail = false;
  let time = 0;
  const fetchImpl = async () => {
    calls++;
    if (fail) throw new Error('offline');
    return { ok: true, json: async () => sample };
  };
  const svc = createWeatherService({ getLocation: () => ({ lat: 46.6, lon: 8.2 }), fetchImpl, now: () => time, log: { warn() {} } });
  const [a, b] = await Promise.all([svc.get(), svc.get()]); // gleichzeitige Anfragen → 1 Abruf
  assert.equal(calls, 1);
  assert.equal(a.data.temperature, -4);
  assert.deepEqual(a, b);
  time += 5 * 60 * 1000;
  await svc.get();
  assert.equal(calls, 1, 'innerhalb von 10 Minuten aus dem Speicher');
  time += 10 * 60 * 1000;
  fail = true;
  const stale = await svc.get();
  assert.equal(calls, 2);
  assert.equal(stale.fresh, false);
  assert.equal(stale.data.temperature, -4);
  time += 4 * 60 * 60 * 1000;
  assert.equal(await svc.get(), null, 'zu alte Daten werden nicht gezeigt');
});

test('Wetter ohne gültige Koordinaten → nichts', async () => {
  const svc = createWeatherService({ getLocation: () => ({}), fetchImpl: async () => { throw new Error('nie'); } });
  assert.equal(await svc.get(), null);
});
