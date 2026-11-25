// Übernimmt Routen und Orte aus Google My Maps (KML) oder GPS-Dateien (GPX) in data/karte.geojson.
//
//   Google My Maps:  Karte öffnen → ⋮ → "In KML/KMZ exportieren" → Häkchen bei
//                    "Als KML-Datei exportieren (statt KMZ)" → Datei speichern.
//                    Die EBENEN heissen am besten: Wandern, Laufen, Velo, Aussicht.
//
//   npm run karte -- C:\Pfad\meine-karte.kml                 (ersetzt die Karte, alte Datei wird gesichert)
//   npm run karte -- tour.gpx --kategorie wandern --hinzufuegen
//
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { convertMapFile } from '../src/map-import.js';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data');
const target = join(DATA, 'karte.geojson');

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--kategorie');
const kategorie = args.includes('--kategorie') ? args[args.indexOf('--kategorie') + 1] : undefined;
const append = args.includes('--hinzufuegen');

if (!file) {
  console.log('Aufruf: npm run karte -- <datei.kml|datei.gpx> [--kategorie wandern|laufen|velo|aussicht] [--hinzufuegen]');
  process.exit(1);
}
const path = resolve(process.env.INIT_CWD || process.cwd(), file);
if (!existsSync(path)) {
  console.error(`Datei nicht gefunden: ${path}`);
  process.exit(1);
}
const ext = extname(path).toLowerCase();
if (ext === '.kmz') {
  console.error('KMZ wird nicht unterstützt. In Google My Maps beim Export "Als KML-Datei exportieren" anhaken.');
  process.exit(1);
}

try {
  const { features, skipped } = convertMapFile(readFileSync(path, 'utf8'), { type: ext === '.gpx' ? 'gpx' : 'kml', kategorie });
  if (!features.length) throw new Error('Keine passenden Routen oder Orte gefunden. Ebenen "Wandern", "Laufen", "Velo" oder "Aussicht" nennen oder --kategorie angeben.');
  let existing = [];
  if (existsSync(target)) {
    copyFileSync(target, join(DATA, 'karte.backup.geojson'));
    if (append) existing = JSON.parse(readFileSync(target, 'utf8')).features || [];
  }
  writeFileSync(target, JSON.stringify({ type: 'FeatureCollection', features: [...existing, ...features] }, null, 1));
  const count = (k) => features.filter((f) => f.properties.kategorie === k).length;
  console.log(`✓ ${features.length} Einträge übernommen: Wandern ${count('wandern')}, Laufen ${count('laufen')}, Velo ${count('velo')}, Aussicht ${count('aussicht')}`);
  if (skipped.length) console.log(`  Übersprungen (keine Kategorie erkannt): ${skipped.join(', ')}`);
  console.log('  Die Website zeigt die neue Karte sofort an (Seite neu laden).');
} catch (err) {
  console.error('Fehler:', err.message);
  process.exit(1);
}
