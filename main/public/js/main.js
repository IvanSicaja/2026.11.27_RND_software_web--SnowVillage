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
    cap.textContent = a.dataset.caption || '';
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

initNav();
initPanoramas();
initGallery();
initVideos();
