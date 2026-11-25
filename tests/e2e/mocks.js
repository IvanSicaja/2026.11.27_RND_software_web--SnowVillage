// Externe Dienste im Test ersetzen: Fotos (Unsplash), Kartenkacheln, YouTube, Wetter.
// So laufen die Tests stabil und ohne Internet.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pub = (p) => fileURLToPath(new URL(`../../main/public/${p}`, import.meta.url));
const photos = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => readFileSync(pub(`images/gallery/bild-0${n}-600.webp`)));
// 1×1 Pixel PNG (grau) als Kartenkachel
const tile = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN89+7dfwAI2gPqJmvuwQAAAABJRU5ErkJggg==', 'base64');

export const WEATHER = {
  ok: true, fresh: true, place: 'Steinbach', temperature: -4, feelsLike: -9, wind: 14, max: -1, min: -8,
  isDay: true, code: 73, text: 'Schneefall', icon: 'snow', time: '2026-11-25T10:00',
};

export async function mockExternal(page, { weather = WEATHER } = {}) {
  let i = 0;
  await page.route(/images\.unsplash\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/webp', body: photos[i++ % photos.length] }));
  await page.route(/tile\.openstreetmap\.org|tile\.opentopomap\.org/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: tile }));
  await page.route(/youtube-nocookie\.com|i\.ytimg\.com|www\.google\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }));
  await page.route('**/api/wetter', (r) =>
    weather ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(weather) }) : r.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false}' }),
  );
}
