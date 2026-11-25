// Wandelt eigene Fotos in schnelle WebP-Varianten um.
//   1. Fotos (JPG/PNG/HEIC/WebP) in  data/fotos/galerie,  data/fotos/orte  oder  data/fotos/blog  legen
//   2. npm run bilder
//   3. Ergebnis landet in main/public/images/galerie-eigene, .../orte-eigene bzw. .../blog
// 360°-Panoramen (2:1) bitte NICHT hier umwandeln – einfach als JPG nach
// main/public/images/panorama/ kopieren (max. 8000 × 4000 Pixel empfohlen).
import sharp from 'sharp';
import { readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join, parse, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAIN = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(MAIN, '..', 'data');

const jobs = [
  { from: join(DATA, 'fotos/galerie'), to: join(MAIN, 'public/images/galerie-eigene'), widths: [600, 1800] },
  { from: join(DATA, 'fotos/orte'), to: join(MAIN, 'public/images/orte-eigene'), widths: [600, 1200] },
  { from: join(DATA, 'fotos/blog'), to: join(MAIN, 'public/images/blog'), widths: [600, 1200, 2000] },
];

let count = 0;
for (const job of jobs) {
  if (!existsSync(job.from)) continue;
  mkdirSync(job.to, { recursive: true });
  for (const file of readdirSync(job.from).filter((f) => /\.(jpe?g|png|webp|heic|tiff?)$/i.test(f))) {
    const name = parse(file).name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const img = sharp(join(job.from, file)).rotate();
    const { width, height } = await img.metadata();
    for (const w of job.widths) {
      await img.clone().resize({ width: Math.min(w, width), withoutEnlargement: true }).webp({ quality: 80 }).toFile(join(job.to, `${name}-${w}.webp`));
    }
    console.log(`✓ ${file}  →  ${job.to.slice(job.to.indexOf('/public/') + 7)}/${name}   (${width}×${height})`);
    count++;
  }
}
console.log(count ? `\n${count} Bild(er) fertig. Pfade (ohne -600.webp) in data/media.json eintragen.` : 'Keine Fotos gefunden. Lege sie in data/fotos/galerie, data/fotos/orte oder data/fotos/blog.');
