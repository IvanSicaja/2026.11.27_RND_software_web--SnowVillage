// Naturklänge für das Karussell (Web Audio API).
// Jede Datei ist ein periodischer Klang mit 0,25 s Vorlauf: gespielt wird genau eine Periode
// in Schleife – lückenlos. Beim Bildwechsel wird weich übergeblendet.
const PAD = 0.25; // Sekunden Vorlauf in der Datei
const PERIOD = 24; // Länge einer Periode in Sekunden
const FADE_IN = 1.6;
const FADE_OUT = 1.2;
const VOLUME = 0.8;

export function createAmbience(root, { onState } = {}) {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) throw new Error('Web Audio wird nicht unterstützt');
  const ctx = new AC();
  const master = ctx.createGain();
  master.gain.value = VOLUME;
  master.connect(ctx.destination);
  const buffers = new Map();
  let current = null; // { src, gain, url }
  let enabled = false;
  let hidden = false; // Startbild nicht sichtbar oder Tab im Hintergrund
  let seq = 0;
  let suspendTimer = null;
  let unlockedAt = -Infinity; // Zeitpunkt der Ton-Freigabe durch das erste Tippen
  let unlockedBy = null; // Element, das dabei angetippt wurde

  // Zustand für Anzeige und Tests: off | waiting (wartet auf erstes Tippen) | loading | playing | paused
  const setState = (state) => {
    if (root.dataset.soundState === state) return;
    root.dataset.soundState = state;
    onState?.(state);
  };
  const refreshState = () => {
    if (!enabled) return setState('off');
    if (hidden) return setState('paused');
    if (ctx.state !== 'running') return setState('waiting');
    setState(current ? 'playing' : 'loading'); // "playing" erst, wenn der Klang wirklich läuft
  };
  ctx.addEventListener?.('statechange', refreshState);

  // Browser erlauben Ton erst nach der ersten Berührung/Taste auf der Seite.
  // Der Klang ist trotzdem "an" und startet beim ersten Tippen irgendwo auf der Seite.
  const UNLOCK_EVENTS = ['pointerdown', 'keydown', 'touchend'];
  const unlock = (e) => {
    if (!enabled || ctx.state === 'running') return removeUnlock();
    unlockedAt = performance.now();
    unlockedBy = e?.target || null;
    if (hidden) return removeUnlock(); // läuft weiter, sobald das Startbild wieder sichtbar ist
    resumeSoftly().finally(refreshState);
    removeUnlock();
  };
  const addUnlock = () => UNLOCK_EVENTS.forEach((e) => document.addEventListener(e, unlock, { capture: true, passive: true }));
  const removeUnlock = () => UNLOCK_EVENTS.forEach((e) => document.removeEventListener(e, unlock, { capture: true }));

  // Weich leiser werden und anhalten – die Wiedergabe bleibt genau an dieser Stelle stehen
  const pauseSoftly = () => {
    clearTimeout(suspendTimer);
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0, now + 0.5);
    suspendTimer = setTimeout(() => hidden && ctx.state === 'running' && ctx.suspend(), 550);
    refreshState();
  };
  // Dort weitermachen, wo angehalten wurde, und weich lauter werden
  const resumeSoftly = async () => {
    clearTimeout(suspendTimer);
    if (ctx.state !== 'running') await ctx.resume();
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(VOLUME, now + 0.8);
    refreshState();
  };

  const load = (url) => {
    if (!buffers.has(url)) {
      const p = fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(`Klang ${url}: ${r.status}`);
          return r.arrayBuffer();
        })
        .then((b) => new Promise((res, rej) => ctx.decodeAudioData(b, res, rej)));
      p.catch(() => buffers.delete(url)); // später erneut versuchen
      buffers.set(url, p);
    }
    return buffers.get(url);
  };

  const fadeOut = (node) => {
    if (!node) return;
    const now = ctx.currentTime;
    node.gain.gain.cancelScheduledValues(now);
    node.gain.gain.setValueAtTime(node.gain.gain.value, now);
    node.gain.gain.linearRampToValueAtTime(0, now + FADE_OUT);
    try {
      node.src.stop(now + FADE_OUT + 0.05);
    } catch { /* schon gestoppt */ }
  };

  async function play(url) {
    if (!enabled) return;
    if (!url) {
      fadeOut(current);
      current = null;
      delete root.dataset.soundSrc;
      return;
    }
    if (current?.url === url) return;
    const token = ++seq;
    const buffer = await load(url);
    if (token !== seq || !enabled) return; // inzwischen anderes Bild oder ausgeschaltet
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    if (buffer.duration >= PAD + PERIOD) {
      src.loopStart = PAD;
      src.loopEnd = PAD + PERIOD;
    }
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(1, ctx.currentTime + FADE_IN);
    src.connect(gain).connect(master);
    src.start(0, buffer.duration >= PAD + PERIOD ? PAD : 0);
    fadeOut(current);
    current = { src, gain, url };
    root.dataset.soundSrc = url;
    refreshState();
  }

  return {
    /** auto = ohne Klick gestartet (Standard beim Seitenaufruf) */
    async enable(url, { auto = false } = {}) {
      enabled = true;
      master.gain.value = VOLUME;
      if (ctx.state !== 'running') {
        if (auto) {
          ctx.resume().catch(() => {}); // klappt nur, wenn der Browser es erlaubt – sonst beim ersten Tippen
          addUnlock();
        } else {
          await ctx.resume();
        }
      }
      await play(url);
      if (hidden) pauseSoftly();
      refreshState();
    },
    get waiting() {
      return enabled && !hidden && ctx.state !== 'running';
    },
    get unlockedAt() {
      return unlockedAt;
    },
    get unlockedBy() {
      return unlockedBy;
    },
    async disable() {
      enabled = false;
      seq++;
      fadeOut(current);
      current = null;
      removeUnlock();
      refreshState();
      delete root.dataset.soundSrc;
      setTimeout(() => !enabled && ctx.state === 'running' && ctx.suspend(), (FADE_OUT + 0.2) * 1000);
    },
    play,
    setHidden(value) {
      if (hidden === value) return;
      hidden = value;
      if (!enabled) return;
      if (hidden) pauseSoftly();
      else resumeSoftly();
    },
    get position() {
      return ctx.currentTime; // für Tests: bleibt beim Pausieren stehen
    },
  };
}
