// Kleines, abhängigkeitsfreies Script. Alles funktioniert auch ohne JavaScript
// (Links führen dann direkt zu Bild bzw. YouTube) – JS verbessert nur.
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Navigation ---------- */
function initNav() {
  const header = $('[data-header]');
  const toggle = $('[data-nav-toggle]');
  const nav = $('[data-nav]');
  if (!header || !toggle || !nav) return;

  const setOpen = (open) => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) {
      setOpen(false);
      toggle.focus();
    }
  });
  document.addEventListener('click', (e) => {
    if (nav.classList.contains('is-open') && !header.contains(e.target)) setOpen(false);
  });

  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

/* ---------- 360° Panorama (Pannellum, erst bei Bedarf geladen) ---------- */
let pannellumPromise;
function loadPannellum() {
  if (window.pannellum) return Promise.resolve(window.pannellum);
  pannellumPromise ??= new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = '/vendor/pannellum/pannellum.css';
    document.head.append(css);
    const s = document.createElement('script');
    s.src = '/vendor/pannellum/pannellum.js';
    s.async = true;
    s.onload = () => (window.pannellum ? resolve(window.pannellum) : reject(new Error('Pannellum fehlt')));
    s.onerror = () => {
      pannellumPromise = undefined;
      reject(new Error('Pannellum konnte nicht geladen werden'));
    };
    document.head.append(s);
  });
  return pannellumPromise;
}

function initPanoramas() {
  for (const root of $$('[data-pano]')) {
    const viewerEl = $('[data-pano-viewer]', root);
    const start = $('[data-pano-start]', root);
    const preview = $('[data-pano-preview]', root);
    const caption = $('[data-pano-caption]', root);
    const choices = $$('[data-pano-choice]', root);
    let viewer = null;
    let current = { image: root.dataset.image, title: root.dataset.title || '' };

    const create = async () => {
      start.hidden = true;
      viewerEl.dataset.state = 'loading';
      try {
        const pannellum = await loadPannellum();
        viewer?.destroy();
        viewer = pannellum.viewer(viewerEl, {
          type: 'equirectangular',
          panorama: current.image,
          autoLoad: true,
          autoRotate: reducedMotion ? 0 : -2,
          autoRotateInactivityDelay: 5000,
          hfov: 105,
          minHfov: 50,
          maxHfov: 120,
          compass: false,
          showZoomCtrl: true,
          showFullscreenCtrl: true,
          mouseZoom: 'fullscreenonly', // Seite scrollt normal weiter
          strings: {
            loadButtonLabel: 'Panorama laden',
            loadingLabel: 'Wird geladen …',
            bylineLabel: '',
            noPanoramaError: 'Kein Panorama angegeben.',
            fileAccessError: 'Die Datei konnte nicht geladen werden.',
            malformedURLError: 'Fehlerhafte Adresse.',
            iOS8WebGLError: 'WebGL wird nicht unterstützt.',
            genericWebGLError: 'Ihr Browser unterstützt kein WebGL.',
            textureSizeError: 'Das Bild ist zu gross für dieses Gerät.',
            unknownError: 'Unbekannter Fehler.',
          },
        });
        viewer.on('load', () => (viewerEl.dataset.state = 'ready'));
        viewer.on('error', () => (viewerEl.dataset.state = 'error'));
        viewerEl.setAttribute('aria-label', `360°-Panorama: ${current.title}`);
      } catch (err) {
        viewerEl.dataset.state = 'error';
        viewerEl.innerHTML = '<p class="pano-error">Das Panorama konnte nicht geladen werden. Bitte Seite neu laden.</p>';
        console.warn(err);
      }
    };

    start?.addEventListener('click', create);

    // Wischbare Reihe beginnt bei der ausgewählten Ansicht (z. B. aktuelle Jahreszeit)
    const pressed = choices.find((b) => b.getAttribute('aria-pressed') === 'true');
    const row = pressed?.closest('[data-scroll-row]');
    if (row && row.scrollWidth > row.clientWidth) row.scrollLeft = Math.max(0, pressed.offsetLeft - row.offsetLeft - 16);

    for (const btn of choices) {
      btn.addEventListener('click', () => {
        if (btn.getAttribute('aria-pressed') === 'true') return;
        choices.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        current = { image: btn.dataset.image, title: btn.dataset.title };
        if (caption) caption.textContent = btn.dataset.text || '';
        if (preview) preview.src = btn.dataset.preview;
        if (viewer) create();
      });
    }
  }
}

/* ---------- Galerie mit Lightbox ---------- */
function initGallery() {
  const dialog = $('[data-lightbox]');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  const img = $('[data-lightbox-img]', dialog);
  const cap = $('[data-lightbox-caption]', dialog);
  const count = $('[data-lightbox-count]', dialog);
  let items = [];
  let index = 0;

  const show = (i) => {
    index = (i + items.length) % items.length;
    const a = items[index];
    img.src = a.href;
    img.alt = a.dataset.alt || '';
    cap.textContent = [a.dataset.caption, a.dataset.credit].filter(Boolean).join(' · ');
    count.textContent = items.length > 1 ? `${index + 1} / ${items.length}` : '';
    // Nachbarn vorladen
    for (const n of [index + 1, index - 1]) {
      const next = items[(n + items.length) % items.length];
      if (next) new Image().src = next.href;
    }
  };

  for (const gallery of $$('[data-gallery]')) {
    const links = $$('[data-gallery-item]', gallery);
    links.forEach((a, i) =>
      a.addEventListener('click', (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        items = links;
        show(i);
        dialog.showModal();
      }),
    );
  }

  $('[data-lightbox-close]', dialog).addEventListener('click', () => dialog.close());
  $('[data-lightbox-prev]', dialog).addEventListener('click', () => show(index - 1));
  $('[data-lightbox-next]', dialog).addEventListener('click', () => show(index + 1));
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') show(index + 1);
    if (e.key === 'ArrowLeft') show(index - 1);
  });
  // Klick neben das Bild schliesst
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || e.target.classList.contains('lightbox-figure')) dialog.close();
  });
  dialog.addEventListener('close', () => {
    img.removeAttribute('src');
  });
  // Wischen auf Touch-Geräten
  let startX = null;
  dialog.addEventListener('touchstart', (e) => (startX = e.touches[0].clientX), { passive: true });
  dialog.addEventListener('touchend', (e) => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
    startX = null;
  });
}

/* ---------- YouTube erst beim Klick laden (schnell & datenschutzfreundlich) ---------- */
function initVideos() {
  for (const box of $$('[data-video]')) {
    const link = $('.video-play', box);
    link?.addEventListener('click', (e) => {
      e.preventDefault();
      const id = encodeURIComponent(box.dataset.video);
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`;
      iframe.title = box.dataset.title || 'YouTube-Video';
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      link.replaceWith(iframe);
      iframe.focus();
    });
  }
}

/* ---------- Hero-Karussell ---------- */
function initCarousel() {
  const root = $('[data-carousel]');
  const hero = root?.closest('.hero');
  const slides = root ? $$('[data-slide]', root) : [];
  if (slides.length < 2) return;
  const dots = $$('[data-carousel-dot]', hero);
  const toggle = $('[data-carousel-toggle]', hero);
  const controls = $('[data-carousel-controls]', hero);
  const soundBtn = $('[data-carousel-sound]', hero);
  const caption = $('[data-sound-caption]', hero);
  const DELAY = 6000;
  controls.style.setProperty('--slide-delay', `${DELAY}ms`);
  let index = 0;
  let timer = null;
  let userPaused = reducedMotion; // Bei "Bewegung reduzieren" startet die Diashow nicht von selbst
  let holds = 0; // Maus darüber / Fokus darin
  let ambience = null; // Naturklang (wird erst beim Einschalten geladen)
  let offscreen = false; // Startbild aus dem Blick gescrollt
  const isHidden = () => document.hidden || offscreen;

  const restartProgress = () => {
    dots.forEach((d) => d.classList.remove('is-running'));
    const cur = dots[index];
    if (!cur || !timer) return;
    void cur.offsetWidth; // Animation neu starten
    cur.classList.add('is-running');
  };
  const renderCaption = () => {
    if (!caption) return;
    const on = soundBtn?.getAttribute('aria-pressed') === 'true';
    const label = slides[index].dataset.soundLabel || '';
    const waiting = caption.classList.contains('is-waiting');
    caption.textContent = on ? (waiting ? `${label} – zum Anhören einmal tippen` : label) : '';
    caption.hidden = !on || !caption.textContent;
  };

  const go = (i) => {
    const prev = slides[index];
    index = (i + slides.length) % slides.length;
    slides.forEach((sl, n) => {
      const active = n === index;
      if (!active && sl === prev && sl.classList.contains('is-active')) {
        // Ausblendendes Bild bleibt beim aktuellen Zoom stehen (kein Zurückspringen)
        const img = $('img', sl);
        if (img) {
          img.style.transform = getComputedStyle(img).transform;
          setTimeout(() => img.style.removeProperty('transform'), 1400);
        }
      }
      sl.classList.toggle('is-active', active);
      sl.inert = !active;
    });
    dots.forEach((d, n) => {
      d.classList.toggle('is-done', n < index);
      if (n === index) d.setAttribute('aria-current', 'true');
      else d.removeAttribute('aria-current');
    });
    root.dataset.index = String(index);
    restartProgress(); // Ladebalken fürs neue Bild neu starten (auch beim automatischen Wechsel)
    renderCaption();
    ambience?.play(slides[index].dataset.sound);
  };
  const stop = () => {
    clearInterval(timer);
    timer = null;
    controls.classList.toggle('is-holding', holds > 0);
    restartProgress();
  };
  const start = () => {
    clearInterval(timer);
    timer = null;
    controls.classList.toggle('is-holding', holds > 0);
    if (!userPaused && holds === 0 && !isHidden()) timer = setInterval(() => go(index + 1), DELAY);
    restartProgress();
  };
  const renderToggle = () => {
    controls.classList.toggle('is-paused', userPaused);
    toggle.setAttribute('aria-label', userPaused ? 'Diashow starten' : 'Diashow anhalten');
  };

  toggle.addEventListener('click', () => {
    userPaused = !userPaused;
    renderToggle();
    start();
  });
  dots.forEach((d) =>
    d.addEventListener('click', () => {
      go(Number(d.dataset.carouselDot));
      start();
    }),
  );

  // Naturklang: standardmässig AN. Wer ihn ausschaltet, bei dem bleibt er aus (im Browser gemerkt).
  const SOUND_KEY = 'naturklang';
  const readPref = () => {
    try {
      return localStorage.getItem(SOUND_KEY) !== 'aus';
    } catch {
      return true;
    }
  };
  const writePref = (on) => {
    try {
      if (on) localStorage.removeItem(SOUND_KEY);
      else localStorage.setItem(SOUND_KEY, 'aus');
    } catch { /* privat / blockiert */ }
  };
  const setPressed = (on) => {
    soundBtn.setAttribute('aria-pressed', String(on));
    soundBtn.setAttribute('aria-label', on ? 'Naturklang ausschalten' : 'Naturklang einschalten');
    renderCaption();
  };
  const onSoundState = (state) => {
    if (!caption) return;
    caption.classList.toggle('is-waiting', state === 'waiting');
    renderCaption();
  };
  const startSound = async ({ auto }) => {
    soundBtn.setAttribute('aria-busy', 'true');
    try {
      const { createAmbience } = await import(document.documentElement.dataset.klang || '/js/klang.js');
      ambience ??= createAmbience(root, { onState: onSoundState });
      ambience.setHidden(isHidden());
      await ambience.enable(slides[index].dataset.sound, { auto });
    } catch (err) {
      console.warn(err);
      await ambience?.disable().catch(() => {});
      setPressed(false);
      if (!auto && caption) {
        caption.textContent = 'Der Klang konnte nicht abgespielt werden.';
        caption.hidden = false;
      }
    } finally {
      soundBtn.removeAttribute('aria-busy');
    }
  };

  soundBtn?.addEventListener('click', async () => {
    // Genau dieser Klick auf den Ton-Knopf hat den Ton gerade erst freigegeben → nicht gleich wieder ausschalten
    if (ambience && ambience.unlockedBy && soundBtn.contains(ambience.unlockedBy) && performance.now() - ambience.unlockedAt < 600) return;
    // Klang ist an, wartet aber noch auf Freigabe → jetzt starten
    if (soundBtn.getAttribute('aria-pressed') === 'true' && ambience?.waiting) {
      await startSound({ auto: false });
      return;
    }
    const on = soundBtn.getAttribute('aria-pressed') !== 'true';
    setPressed(on);
    writePref(on);
    if (on) await startSound({ auto: false });
    else await ambience?.disable();
  });

  if (soundBtn) {
    const on = readPref();
    setPressed(on);
    if (on) {
      const go = () => startSound({ auto: true });
      if (document.readyState === 'complete') go();
      else window.addEventListener('load', go, { once: true });
    }
  }

  // Die Diashow läuft immer weiter (mit Ladebalken) – auch wenn die Maus über dem Bild ist
  // oder ein Knopf angetippt wurde. Anhalten: Pause-Knopf, Runterscrollen, anderer Tab.
  // Nur bei Bedienung mit der Tastatur (sichtbarer Fokus) wird kurz angehalten (Barrierefreiheit).
  let keyboardHold = false;
  hero.addEventListener('focusin', (e) => {
    const kb = e.target.matches?.(':focus-visible') && !e.target.matches('[data-carousel-dot], [data-carousel-toggle], [data-carousel-sound]');
    if (kb && !keyboardHold) {
      keyboardHold = true;
      holds++;
      stop();
    }
  });
  hero.addEventListener('focusout', (e) => {
    if (keyboardHold && !hero.contains(e.relatedTarget)) {
      keyboardHold = false;
      holds = Math.max(0, holds - 1);
      start();
    }
  });
  // Pausieren, wenn der Tab im Hintergrund ist ODER man nach unten gescrollt hat –
  // beim Zurückkommen geht Diashow und Klang genau dort weiter, wo sie angehalten haben.
  const updateVisibility = () => {
    root.dataset.inView = String(!offscreen);
    if (isHidden()) stop();
    else start();
    ambience?.setHidden(isHidden());
  };
  document.addEventListener('visibilitychange', updateVisibility);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      ([entry]) => {
        const next = !entry.isIntersecting;
        if (next === offscreen) return;
        offscreen = next;
        updateVisibility();
      },
      { threshold: 0.35 }, // weniger als ~1/3 des Startbilds sichtbar → Pause
    ).observe(root);
  }

  // Wischen
  let x0 = null;
  root.addEventListener('touchstart', (e) => (x0 = e.touches[0].clientX), { passive: true });
  root.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 40) {
      go(index + (dx < 0 ? 1 : -1));
      start();
    }
    x0 = null;
  });

  go(0);
  root.dataset.inView = 'true';
  renderToggle();
  start();
}

/* ---------- Wetter ---------- */
const WEATHER_ICONS = {
  sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
  'cloud-sun': '<path d="M8 3.5v1.5M3.5 8H5M4.8 4.8l1 1M12.2 4.8l-1 1"/><path d="M5.6 10.4A3.5 3.5 0 0 1 11.6 7"/><path d="M7 20h10a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 20z"/>',
  cloud: '<path d="M6.5 19h11a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.6 1.6A3.7 3.7 0 0 0 6.5 19z"/>',
  fog: '<path d="M4 9h16M3 13h18M5 17h14"/>',
  rain: '<path d="M6.5 15h11a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.6 1.6A3.7 3.7 0 0 0 6.5 15z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
  snow: '<path d="M6.5 14h11a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.6 1.6A3.7 3.7 0 0 0 6.5 14z"/><path d="M8 18h.01M12 20h.01M16 18h.01M10 22h.01M14 22h.01"/>',
  storm: '<path d="M6.5 14h11a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.6 1.6A3.7 3.7 0 0 0 6.5 14z"/><path d="M12.5 15l-2 4h3l-2 4"/>',
};
const deg = (n) => (n == null ? '–' : `${n < 0 ? '−' : ''}${Math.abs(n)}°`);

const dayFmt = new Intl.DateTimeFormat('de-CH', { weekday: 'short', timeZone: 'UTC' });
const dateFmt = new Intl.DateTimeFormat('de-CH', { day: 'numeric', month: 'numeric', timeZone: 'UTC' });
const smallIcon = (name) =>
  `<svg class="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${WEATHER_ICONS[name] || WEATHER_ICONS.cloud}</svg>`;

/** Wettertabelle: heute + 7 Tage – Tag, Wetter (Symbol, Text, Niederschlag), Tiefst- und Höchsttemperatur */
function renderForecast(table, today, days) {
  if (!table) return;
  const body = $('tbody', table);
  body.textContent = '';
  const rows = [...(today ? [{ ...today, label: 'Heute' }] : []), ...days];
  const title = table.previousElementSibling;
  table.hidden = !rows.length;
  if (title) title.hidden = !rows.length;
  const cell = (tag, cls, text) => {
    const c = document.createElement(tag);
    if (cls) c.className = cls;
    if (text != null) c.textContent = text;
    return c;
  };
  for (const d of rows) {
    const date = new Date(`${d.date}T00:00:00Z`);
    const tr = document.createElement('tr');
    if (d.label) tr.className = 'is-today';
    const day = cell('th', 'forecast-day', d.label || dayFmt.format(date).replace('.', ''));
    day.scope = 'row';
    day.append(cell('span', 'forecast-date', dateFmt.format(date)));
    const wx = cell('td', 'forecast-wx');
    const inner = cell('div', 'forecast-wx-inner');
    const icon = cell('span', 'forecast-icon');
    icon.innerHTML = smallIcon(d.icon);
    const txt = cell('span', 'forecast-text');
    txt.append(cell('span', 'forecast-desc', d.text));
    const extra = d.snow > 0 ? `Neuschnee ${String(d.snow).replace('.', ',')} cm` : d.precip != null && d.precip >= 20 ? `Niederschlag ${d.precip} %` : '';
    if (extra) txt.append(cell('span', 'forecast-precip', extra));
    inner.append(icon, txt);
    wx.append(inner);
    tr.append(day, wx, cell('td', 'num forecast-min', deg(d.min)), cell('td', 'num forecast-max', deg(d.max)));
    body.append(tr);
  }
}

async function initWeather() {
  const card = $('[data-weather]');
  const chip = $('[data-weather-chip]');
  if (!card && !chip) return;
  try {
    const res = await fetch('/api/wetter', { headers: { accept: 'application/json' } });
    if (!res.ok) return;
    const w = await res.json();
    if (!w.ok || typeof w.temperature !== 'number') return;
    const icon = `<svg class="icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${WEATHER_ICONS[w.icon] || WEATHER_ICONS.cloud}</svg>`;
    if (card) {
      $('[data-w-icon]', card).innerHTML = icon;
      $('[data-w-temp]', card).textContent = deg(w.temperature);
      $('[data-w-text]', card).textContent = w.text;
      $('[data-w-range]', card).textContent = `${deg(w.min)} / ${deg(w.max)}`;
      $('[data-w-feels]', card).textContent = deg(w.feelsLike);
      $('[data-w-wind]', card).textContent = w.wind == null ? '–' : `${w.wind} km/h`;
      renderForecast($('[data-w-forecast]', card), w.today, w.forecast || []);
      card.hidden = false;
    }
    if (chip) {
      chip.innerHTML = icon.replace(/width="40" height="40"/, 'width="20" height="20"');
      const temp = document.createElement('span');
      temp.textContent = deg(w.temperature);
      const extra = document.createElement('span');
      extra.className = 'chip-extra';
      extra.textContent = ` · ${w.text} · ${w.place}`;
      const label = document.createElement('span');
      label.append(temp, extra);
      chip.append(label);
      chip.setAttribute('aria-label', `Aktuell ${deg(w.temperature)}, ${w.text} in ${w.place}`);
      chip.hidden = false;
    }
  } catch {
    /* Ohne Wetter geht es auch – Bereich bleibt einfach verborgen */
  }
}

/* ---------- Karte (Leaflet wird erst geladen, wenn die Karte in Sicht kommt) ---------- */
function initMaps() {
  const blocks = $$('[data-map]');
  if (!blocks.length) return;
  const load = (block) => import(document.documentElement.dataset.karte || '/js/karte.js').then((m) => m.createMap(block)).catch((err) => {
    console.warn(err);
    const ph = $('.map-placeholder', block);
    if (ph) ph.textContent = 'Die Karte konnte nicht geladen werden.';
  });
  if (!('IntersectionObserver' in window)) return blocks.forEach(load);
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      load(e.target);
    }
  }, { rootMargin: '400px 0px' });
  blocks.forEach((b) => io.observe(b));
}

/* ---------- Ersatzbild, falls ein externes Foto nicht lädt ---------- */
function initImageFallback() {
  const swap = (img) => {
    if (img.dataset.fallback === 'done' || !/^https?:/.test(img.getAttribute('src') || '')) return;
    img.dataset.fallback = 'done';
    img.removeAttribute('srcset');
    if (img.parentElement instanceof HTMLPictureElement) img.parentElement.querySelectorAll('source').forEach((el) => el.remove());
    img.src = '/images/fallback.webp';
  };
  document.addEventListener('error', (e) => e.target instanceof HTMLImageElement && swap(e.target), true);
  // Fehler, die vor dem Laden dieses Scripts passiert sind
  for (const img of document.images) if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) swap(img);
}

/* ---------- Wischbare Reihen: Blätter-Knöpfe (Maus) und sauberes seitliches Scrollen ---------- */
function initRows() {
  for (const wrap of $$('[data-row-wrap]')) {
    const row = $('[data-scroll-row]', wrap);
    const prev = $('[data-row-prev]', wrap);
    const next = $('[data-row-next]', wrap);
    if (!row) continue;
    const update = () => {
      const max = row.scrollWidth - row.clientWidth;
      prev.disabled = row.scrollLeft <= 2;
      next.disabled = row.scrollLeft >= max - 2;
    };
    const step = (dir) => {
      const smooth = !reducedMotion;
      row.scrollBy({ left: dir * row.clientWidth * 0.8, behavior: smooth ? 'smooth' : 'auto' });
    };
    prev.addEventListener('click', () => step(-1));
    next.addEventListener('click', () => step(1));
    row.addEventListener('scroll', update, { passive: true });
    row.addEventListener('keydown', (e) => {
      if (e.target !== row) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    });
    new ResizeObserver(update).observe(row);
    update();
  }
}

initImageFallback();
initRows();
initNav();
initCarousel();
initWeather();
initMaps();
initPanoramas();
initGallery();
initVideos();
