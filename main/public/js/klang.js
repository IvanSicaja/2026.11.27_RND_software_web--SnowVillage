// Naturklänge für das Karussell (Web Audio API).
// Jede Datei ist ein periodischer Klang mit 0,25 s Vorlauf: gespielt wird genau eine Periode
// in Schleife – lückenlos. Beim Bildwechsel wird weich übergeblendet.
const PAD = 0.25; // Sekunden Vorlauf in der Datei
const PERIOD = 24; // Länge einer Periode in Sekunden
const FADE_IN = 1.6;
const FADE_OUT = 1.2;
const VOLUME = 0.8;

export function createAmbience(root) {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) throw new Error('Web Audio wird nicht unterstützt');
  const ctx = new AC();
  const master = ctx.createGain();
  master.gain.value = VOLUME;
  master.connect(ctx.destination);
  const buffers = new Map();
  let current = null; // { src, gain, url }
  let enabled = false;
  let seq = 0;

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
    root.dataset.soundState = 'playing';
  }

  return {
    async enable(url) {
      enabled = true;
      if (ctx.state !== 'running') await ctx.resume();
      await play(url);
    },
    async disable() {
      enabled = false;
      seq++;
      fadeOut(current);
      current = null;
      root.dataset.soundState = 'off';
      delete root.dataset.soundSrc;
      setTimeout(() => !enabled && ctx.state === 'running' && ctx.suspend(), (FADE_OUT + 0.2) * 1000);
    },
    play,
    setHidden(hidden) {
      if (!enabled) return;
      if (hidden) ctx.suspend();
      else ctx.resume();
    },
  };
}
