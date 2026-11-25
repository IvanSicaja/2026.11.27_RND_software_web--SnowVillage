// Läuft automatisch nach "npm install": verknüpft tests/node_modules mit main/node_modules,
// damit die Tests im Ordner /tests dieselben Pakete (Playwright, axe) finden.
// "junction" funktioniert auch unter Windows ohne Administratorrechte.
import { symlinkSync, existsSync, lstatSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const main = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(main, 'node_modules');
const link = join(main, '..', 'tests', 'node_modules');
try {
  if (!existsSync(join(main, '..', 'tests'))) process.exit(0);
  try { lstatSync(link); process.exit(0); } catch {}
  symlinkSync(target, link, 'junction');
  console.log('tests/node_modules → main/node_modules verknüpft');
} catch (err) {
  console.warn('Hinweis: tests/node_modules konnte nicht verknüpft werden:', err.message);
}
