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
  const DELAY = 6000;
  let index = 0;
  let timer = null;
  let userPaused = reducedMotion; // Bei "Bewegung reduzieren" startet die Diashow nicht von selbst
  let holds = 0; // Maus darüber / Fokus darin

  const go = (i) => {
    index = (i + slides.length) % slides.length;
    slides.forEach((sl, n) => {
      const active = n === index;
      sl.classList.toggle('is-active', active);
      sl.inert = !active;
    });
    dots.forEach((d, n) => (n === index ? d.setAttribute('aria-current', 'true') : d.removeAttribute('aria-current')));
    root.dataset.index = String(index);
  };
  const stop = () => {
    clearInterval(timer);
    timer = null;
  };
  const start = () => {
    stop();
    if (!userPaused && holds === 0 && !document.hidden) timer = setInterval(() => go(index + 1), DELAY);
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
  hero.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && (holds++, stop()));
  hero.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && ((holds = Math.max(0, holds - 1)), start()));
  hero.addEventListener('focusin', () => (holds++, stop()));
  hero.addEventListener('focusout', () => ((holds = Math.max(0, holds - 1)), start()));
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

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
      card.hidden = false;
    }
    if (chip) {
      chip.innerHTML = icon.replace(/width="40" height="40"/, 'width="20" height="20"');
      const temp = document.createElement('span');
      temp.textContent = deg(w.temperature);
      const extra = document.createElement('span');
      extra.className = 'chip-extra';
      extra.textContent = ` · ${w.text} · ${w.place}`;
      chip.append(temp, extra);
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
    img.src = '/images/fallback.webp';
  };
  document.addEventListener('error', (e) => e.target instanceof HTMLImageElement && swap(e.target), true);
  // Fehler, die vor dem Laden dieses Scripts passiert sind
  for (const img of document.images) if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) swap(img);
}

initImageFallback();
initNav();
initCarousel();
initWeather();
initMaps();
initPanoramas();
initGallery();
initVideos();
