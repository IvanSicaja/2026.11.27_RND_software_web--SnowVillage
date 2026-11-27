// Interaktive Karte mit Kategorien (Wandern, Laufen, Velo, Aussicht).
// Daten kommen aus data/karte.geojson (vom Server als JSON in die Seite eingebettet).
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let leafletPromise;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  leafletPromise ??= new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = '/vendor/leaflet/leaflet.css';
    document.head.append(css);
    const s = document.createElement('script');
    s.src = '/vendor/leaflet/leaflet.js';
    s.onload = () => (window.L ? resolve(window.L) : reject(new Error('Leaflet fehlt')));
    s.onerror = () => {
      leafletPromise = undefined;
      reject(new Error('Leaflet konnte nicht geladen werden'));
    };
    document.head.append(s);
  });
  return leafletPromise;
}

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const fmtKm = (km) => `${String(km).replace('.', ',')} km`;

function popupContent(item, category) {
  const box = el('div', 'map-popup');
  box.append(el('p', 'map-popup-cat', category.label));
  box.append(el('h3', '', item.name));
  const meta = [item.lengthKm ? fmtKm(item.lengthKm) : '', item.duration, item.difficulty].filter(Boolean).join(' · ');
  if (meta) box.append(el('p', 'map-popup-meta', meta));
  if (item.description) box.append(el('p', '', item.description));
  const a = el('a', 'map-popup-link', item.type === 'line' ? 'Zum Start in Google Maps' : 'In Google Maps öffnen');
  a.href = item.google;
  a.target = '_blank';
  a.rel = 'noopener';
  box.append(a);
  return box;
}

export async function createMap(root) {
  if (root.dataset.state) return;
  root.dataset.state = 'loading';
  const data = JSON.parse($('[data-map-data]', root).textContent);
  const canvas = $('[data-map-canvas]', root);
  const L = await loadLeaflet();
  canvas.textContent = '';

  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const map = L.map(canvas, {
    scrollWheelZoom: false, // Seite scrollt normal weiter
    dragging: !coarse, // Auf dem Handy erst nach Antippen verschiebbar (sonst bleibt man beim Scrollen hängen)
    tap: false,
    zoomSnap: 0.5,
  }).setView(data.center, data.zoom);

  // Hintergrundkarten: die erste (Satellit) ist Standard, Auswahl über das Ebenen-Symbol oben rechts
  const STORE_KEY = 'karte-ansicht';
  const bases = {};
  const tileOpts = (t) => ({
    attribution: t.attribution,
    subdomains: t.subdomains || 'abc',
    maxZoom: t.maxZoom || 18,
    maxNativeZoom: t.maxNativeZoom || t.maxZoom || 18,
    className: t.monochrome ? 'tiles-mono' : '',
  });
  for (const t of data.tiles) {
    const base = L.tileLayer(t.url, tileOpts(t));
    const extra = (t.overlays || []).map((o) => L.tileLayer(o.url, { ...tileOpts(t), ...o, attribution: '', className: 'tiles-overlay' }));
    bases[t.name] = extra.length ? L.layerGroup([base, ...extra]) : base;
  }
  let saved = null;
  try {
    saved = localStorage.getItem(STORE_KEY);
  } catch { /* privat / blockiert */ }
  const startName = saved && bases[saved] ? saved : data.tiles[0]?.name;
  if (startName) bases[startName].addTo(map);
  root.dataset.baseLayer = startName || '';
  map.on('baselayerchange', (e) => {
    root.dataset.baseLayer = e.name;
    try {
      localStorage.setItem(STORE_KEY, e.name);
    } catch { /* egal */ }
  });
  if (data.tiles.length > 1) {
    const ctl = L.control.layers(bases, null, { position: 'topright', collapsed: true }).addTo(map);
    const toggle = ctl.getContainer().querySelector('.leaflet-control-layers-toggle');
    if (toggle) {
      toggle.title = 'Kartenansicht wählen';
      toggle.setAttribute('aria-label', 'Kartenansicht wählen: Satellit, Karte oder Gelände');
      toggle.setAttribute('role', 'button');
    }
  }

  // Routen & Orte
  const catById = Object.fromEntries(data.categories.map((c) => [c.id, c]));
  const groups = {};
  const layersById = {};
  const allBounds = [];
  for (const c of data.categories) groups[c.id] = L.featureGroup().addTo(map);

  for (const item of data.items) {
    const cat = catById[item.category];
    if (!cat) continue;
    let layer;
    if (item.type === 'line') {
      const latlngs = item.coords.map(([lon, lat]) => [lat, lon]);
      const casing = L.polyline(latlngs, { color: '#fff', weight: 7, opacity: 0.85, interactive: false });
      const line = L.polyline(latlngs, { color: cat.color, weight: 4, opacity: 0.95, dashArray: cat.dash || null, lineCap: 'round' });
      const start = L.circleMarker(latlngs[0], { radius: 5, color: '#fff', weight: 2, fillColor: cat.color, fillOpacity: 1 });
      layer = L.featureGroup([casing, line, start]);
      allBounds.push(...latlngs);
    } else {
      const [lon, lat] = item.coords;
      layer = L.circleMarker([lat, lon], { radius: 8, color: '#fff', weight: 2.5, fillColor: cat.color, fillOpacity: 1 });
      allBounds.push([lat, lon]);
    }
    layer.bindPopup(() => popupContent(item, cat), { maxWidth: 280, autoPanPadding: [24, 24] });
    layer.bindTooltip(item.name, { direction: 'top', offset: [0, -6], opacity: 0.95 });
    layer.addTo(groups[item.category]);
    layersById[item.id] = layer;
  }
  if (allBounds.length) map.fitBounds(allBounds, { padding: [24, 24], maxZoom: 15 });

  // Handy: Hinweis zum Aktivieren
  if (coarse) {
    const hint = el('button', 'map-activate', 'Antippen, um die Karte zu bewegen');
    hint.type = 'button';
    hint.addEventListener('click', () => {
      map.dragging.enable();
      hint.remove();
    });
    canvas.append(hint);
  }

  // Filter
  const list = $('[data-route-list]', root);
  for (const btn of $$('[data-map-filter]', root)) {
    btn.addEventListener('click', () => {
      const on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(on));
      const g = groups[btn.dataset.mapFilter];
      if (on) g.addTo(map);
      else map.removeLayer(g);
      if (list) for (const li of $$(`[data-category="${btn.dataset.mapFilter}"]`, list)) li.hidden = !on;
    });
  }

  // "Auf der Karte zeigen"
  for (const btn of $$('[data-map-focus]', root)) {
    btn.addEventListener('click', () => {
      const layer = layersById[btn.dataset.mapFocus];
      if (!layer) return;
      const item = data.items.find((i) => i.id === btn.dataset.mapFocus);
      const filter = $(`[data-map-filter="${item.category}"]`, root);
      if (filter?.getAttribute('aria-pressed') === 'false') filter.click();
      canvas.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
      if (layer.getBounds) map.fitBounds(layer.getBounds(), { padding: [40, 40], maxZoom: 16 });
      else map.setView(layer.getLatLng(), 15);
      layer.openPopup();
    });
  }

  // Optional: Google My Maps
  const google = $('[data-map-google]', root);
  const viewBtns = $$('[data-map-view]', root);
  for (const btn of viewBtns) {
    btn.addEventListener('click', () => {
      const showGoogle = btn.dataset.mapView === 'google';
      viewBtns.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      if (showGoogle && !google.firstChild) {
        const iframe = document.createElement('iframe');
        iframe.src = google.dataset.src;
        iframe.title = 'Google-Karte mit Routen';
        iframe.loading = 'lazy';
        iframe.referrerPolicy = 'strict-origin-when-cross-origin';
        google.append(iframe);
      }
      google.hidden = !showGoogle;
      canvas.hidden = showGoogle;
      $$('[data-map-filter]', root).forEach((b) => (b.disabled = showGoogle));
      if (!showGoogle) map.invalidateSize();
    });
  }

  // Grösse neu berechnen, wenn sich das Layout ändert
  new ResizeObserver(() => map.invalidateSize()).observe(canvas);
  root.dataset.state = 'ready';
  return map;
}
