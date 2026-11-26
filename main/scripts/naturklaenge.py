"""
Erzeugt ruhige, künstliche Naturklänge für die 5 Bilder im Karussell (MP3, nahtlos in Schleife).

  1  kirche-voegel   Alpendorf mit Kirche:  ferne Kirchenglocken, Vogelgezwitscher, leiser Wind
  2  bergwind-piste  Skifahrer:             Bergwind in Böen, sanftes Schwingen der Ski im Schnee
  3  bergsee         Bergsee:               Wasser plätschert ans Ufer, einzelne Tropfen, ein ferner Vogel
  4  kaminfeuer      Häuser am Abend:       knisterndes Kaminfeuer, warmes Rauschen der Flammen
  5  meer-moewen     Fussballplatz am Meer: Wellen rollen an, ferne Möwen

Jeder Klang ist streng periodisch (PERIODE Sekunden) und wird mit 0,25 s Vorlauf und Nachlauf
gespeichert. Die Website spielt nur den Bereich [0,25 s, 0,25 s + PERIODE] in Schleife –
so gibt es keinen hörbaren Übergang.

Aufruf (im Ordner main/):   python scripts/naturklaenge.py public/audio
Benötigt: numpy, ffmpeg (für MP3).
"""
import os
import subprocess
import sys
import tempfile
import wave

import numpy as np

OUT = sys.argv[1] if len(sys.argv) > 1 else "public/audio"
SR = 44100
PERIODE = 24.0
PAD = 0.25
N = int(SR * PERIODE)
t = np.arange(N) / SR
rng = np.random.default_rng(2026)
FREQ = np.fft.rfftfreq(N, 1 / SR)


# ---------- Bausteine (alle periodisch über N Samples) ----------
def noise(shape=lambda f: 1.0, seed=None):
    r = np.random.default_rng(seed) if seed is not None else rng
    spec = (r.normal(size=FREQ.size) + 1j * r.normal(size=FREQ.size)) * shape(np.maximum(FREQ, 1.0))
    spec[0] = 0
    x = np.fft.irfft(spec, N)
    return x / (np.abs(x).max() + 1e-9)


def pink(f):
    return 1 / np.sqrt(f)


def brown(f):
    return 1 / f


def band(lo, hi, slope=2.0):
    return lambda f: 1 / (1 + (lo / f) ** slope) / (1 + (f / hi) ** slope)


def filt(x, shape):
    y = np.fft.irfft(np.fft.rfft(x) * shape(np.maximum(FREQ, 1.0)), N)
    return y


def lfo(cycles, phase=0.0):
    return np.sin(2 * np.pi * cycles * t / PERIODE + phase)


def smooth_env(cycles_list, seed):
    r = np.random.default_rng(seed)
    e = sum(r.uniform(0.3, 1) * lfo(c, r.uniform(0, 6.28)) for c in cycles_list)
    return (e - e.min()) / (e.max() - e.min())


def place(buf, ev, start):
    """Ereignis zyklisch einfügen (Ende läuft am Anfang weiter)."""
    i = int(start * SR) % N
    n = len(ev)
    end = i + n
    if end <= N:
        buf[i:end] += ev
    else:
        buf[i:] += ev[: N - i]
        buf[: end - N] += ev[N - i:]


def reverb(x, seconds=2.5, wet=0.3, seed=1, damp=4000):
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    ir = r.normal(size=n) * np.exp(-np.arange(n) / (SR * seconds / 6))
    ir = np.fft.irfft(np.fft.rfft(ir) / (1 + (np.fft.rfftfreq(n, 1 / SR) / damp) ** 2), n)
    full = np.zeros(N)
    full[:n] = ir
    y = np.fft.irfft(np.fft.rfft(x) * np.fft.rfft(full), N)
    y /= np.abs(y).max() + 1e-9
    return x * (1 - wet) + y * wet * np.abs(x).max()


def stereo(l, r):
    return np.stack([l, r], axis=1)


def pan(x, p):  # p: -1 links … +1 rechts (Skalar oder Array)
    p = np.asarray(p)
    return stereo(x * np.sqrt((1 - p) / 2), x * np.sqrt((1 + p) / 2))


def chirp(f0, f1, dur, harm=(1, 0.25), amp=1.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = f0 + (f1 - f0) * (tt / dur) ** 0.7
    ph = 2 * np.pi * np.cumsum(f) / SR
    env = np.sin(np.pi * tt / dur) ** 2
    return amp * env * sum(a * np.sin(ph * (k + 1)) for k, a in enumerate(harm))


def bird_phrase(seed):
    r = np.random.default_rng(seed)
    base = r.uniform(2600, 4800)
    parts = []
    for _ in range(r.integers(3, 8)):
        d = r.uniform(0.04, 0.13)
        f0 = base * r.uniform(0.85, 1.15)
        parts.append(chirp(f0, f0 * r.uniform(0.7, 1.4), d, harm=(1, 0.15, 0.05)))
        parts.append(np.zeros(int(r.uniform(0.03, 0.09) * SR)))
    return np.concatenate(parts)


def bell(f0, dur=6.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    partials = [(0.5, 0.6, 1.0), (1.0, 1.0, 0.8), (1.19, 0.5, 0.6), (1.5, 0.45, 0.5), (2.0, 0.4, 0.4), (2.5, 0.2, 0.3), (3.0, 0.15, 0.25)]
    s = sum(a * np.sin(2 * np.pi * f0 * m * tt) * np.exp(-tt / (dur * d / 2.5)) for m, a, d in partials)
    return s * np.minimum(1, tt / 0.004)


def finish(x, rms_db=-25.0, peak_db=-4.0):
    x = x - x.mean(axis=0)
    rms = np.sqrt((x ** 2).mean())
    x = x * (10 ** (rms_db / 20) / (rms + 1e-12))
    peak = np.abs(x).max()
    lim = 10 ** (peak_db / 20)
    if peak > lim:
        x = np.tanh(x / lim) * lim  # sanfter Begrenzer
    return x


# ---------- Szenen ----------
def kirche_voegel():
    wind = filt(noise(pink, 11), band(120, 900)) * (0.35 + 0.65 * smooth_env([1, 2, 3], 1))
    windR = filt(noise(pink, 12), band(120, 900)) * (0.35 + 0.65 * smooth_env([1, 2, 3], 2))
    mix = stereo(wind * 0.5, windR * 0.5)
    birds = np.zeros((N, 2))
    r = np.random.default_rng(5)
    for k in range(16):
        b = np.zeros(N)
        place(b, bird_phrase(100 + k), r.uniform(0, PERIODE))
        birds += pan(reverb(b, 1.2, 0.25, seed=k), r.uniform(-0.8, 0.8)) * r.uniform(0.15, 0.4)
    bells = np.zeros(N)
    for i, (f, at) in enumerate([(392, 4.0), (330, 5.6), (262, 7.2), (392, 8.8), (330, 10.4), (262, 12.0)]):
        place(bells, bell(f) * 0.5, at)
    bells = filt(bells, band(80, 1800))
    bells = reverb(bells, 3.5, 0.55, seed=7, damp=2500)
    return finish(mix + birds + pan(bells, -0.2) * 0.55)


def bergwind_piste():
    gust = 0.25 + 0.75 * smooth_env([1, 2, 4, 5], 3) ** 1.5
    w1 = filt(noise(pink, 21), band(150, 1600)) * gust
    w2 = filt(noise(pink, 22), band(150, 1600)) * np.roll(gust, SR // 2)
    whistle = filt(noise(lambda f: 1, 23), band(600, 1100, 4)) * gust ** 2 * 0.12
    mix = stereo(w1 * 0.7 + whistle, w2 * 0.7 + whistle)
    r = np.random.default_rng(8)
    for k in range(5):  # Ski schwingen vorbei
        dur = r.uniform(1.2, 2.0)
        n = int(dur * SR)
        tt = np.arange(n) / SR
        sw = r.normal(size=n)
        sw = np.fft.irfft(np.fft.rfft(sw) / (1 + (2500 / np.maximum(np.fft.rfftfreq(n, 1 / SR), 1)) ** 2) / (1 + (np.fft.rfftfreq(n, 1 / SR) / 7000) ** 2), n)
        sw /= np.abs(sw).max()
        env = np.sin(np.pi * tt / dur) ** 3 * (0.6 + 0.4 * np.sin(2 * np.pi * tt * r.uniform(2, 3.5)) ** 2)
        b = np.zeros(N)
        place(b, sw * env, k * PERIODE / 5 + r.uniform(0, 2))
        p = np.zeros(N)
        place(p, np.linspace(-0.8, 0.8, n) * (1 if k % 2 else -1), k * PERIODE / 5)
        mix += pan(b, np.clip(p, -1, 1)) * 0.22
    return finish(mix, rms_db=-26)


def bergsee():
    lap = np.zeros(N)
    r = np.random.default_rng(31)
    base = filt(noise(lambda f: 1, 32), band(90, 650))
    env = np.zeros(N)
    for k in range(int(PERIODE / 0.8)):
        dur = r.uniform(0.5, 1.3)
        n = int(dur * SR)
        e = np.sin(np.pi * np.arange(n) / n) ** 2 * r.uniform(0.4, 1.0)
        place(env, e, k * 0.8 + r.uniform(-0.15, 0.15))
    lap = base * (0.15 + env)
    lapR = np.roll(base, SR // 3) * (0.15 + np.roll(env, SR // 5))
    mix = stereo(lap, lapR) * 0.8
    drops = np.zeros((N, 2))
    for k in range(18):
        n = int(0.09 * SR)
        tt = np.arange(n) / SR
        f = r.uniform(700, 1500) * (1 + 1.8 * tt / 0.09)
        d = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.018)
        b = np.zeros(N)
        place(b, d, r.uniform(0, PERIODE))
        drops += pan(b, r.uniform(-0.7, 0.7)) * r.uniform(0.05, 0.14)
    air = filt(noise(pink, 33), band(200, 1200)) * (0.3 + 0.7 * smooth_env([1, 2], 4)) * 0.18
    bird = np.zeros(N)
    place(bird, bird_phrase(321), 9.0)
    bird = reverb(bird, 2.5, 0.5, seed=9)
    return finish(mix + drops + stereo(air, air) + pan(bird * 0.12, 0.6), rms_db=-26)


def kaminfeuer():
    roar = filt(noise(brown, 41), band(30, 260)) * (0.55 + 0.45 * smooth_env([3, 5, 7, 11], 5))
    roarR = filt(noise(brown, 42), band(30, 260)) * (0.55 + 0.45 * smooth_env([3, 5, 7, 11], 6))
    hiss = filt(noise(lambda f: 1, 43), band(2000, 9000)) * 0.05 * (0.5 + 0.5 * smooth_env([4, 9], 7))
    mix = stereo(roar + hiss, roarR + hiss)
    r = np.random.default_rng(44)
    cr = np.zeros((N, 2))
    k = 0.0
    while k < PERIODE:
        k += r.exponential(0.16)
        burst = r.integers(1, 5)  # Gruppen von Knacksern
        for j in range(burst):
            n = int(r.uniform(0.0008, 0.006) * SR)
            c = r.normal(size=n) * np.exp(-np.arange(n) / (n / 3))
            c = np.diff(c, prepend=0)  # hell
            b = np.zeros(N)
            place(b, c * r.exponential(0.35), k + j * r.uniform(0.005, 0.04))
            cr += pan(b, r.uniform(-0.5, 0.5))
    cr = np.clip(cr, -1.5, 1.5)
    room = np.stack([reverb(cr[:, 0], 0.6, 0.25, seed=12, damp=6000), reverb(cr[:, 1], 0.6, 0.25, seed=13, damp=6000)], axis=1)
    return finish(mix * 0.9 + room * 0.5, rms_db=-25)


def meer_moewen():
    mix = np.zeros((N, 2))
    r = np.random.default_rng(51)
    roar = filt(noise(brown, 52), band(40, 900))
    roarR = filt(noise(brown, 53), band(40, 900))
    wash = filt(noise(pink, 54), band(900, 6000))
    washR = filt(noise(pink, 55), band(900, 6000))
    wave_len = PERIODE / 3  # 3 Wellen pro Durchlauf
    phase = (t % wave_len) / wave_len
    # Welle: langsam anschwellen, brechen, auslaufen – stetig, ohne harte Kanten
    swell = np.where(phase < 0.55, (phase / 0.55) ** 2, np.exp(-(phase - 0.55) / 0.16))
    attack = np.clip((phase - 0.55) / 0.04, 0, 1)
    tail = attack * np.exp(-np.clip(phase - 0.55, 0, None) / 0.12)
    base = 0.25
    mix += stereo(roar * (base + swell * 1.1), roarR * (base + np.roll(swell, SR // 4) * 1.1))
    mix += stereo(wash * tail * 0.35, washR * np.roll(tail, SR // 4) * 0.35)
    gulls = np.zeros(N)
    for at in (5.0, 5.6, 6.3, 16.5, 17.2):
        g = chirp(r.uniform(1100, 1300), r.uniform(1500, 1800), 0.22, harm=(1, 0.5, 0.3, 0.15)) * 0.5
        g = np.concatenate([g, chirp(1700, 1050, 0.3, harm=(1, 0.5, 0.3, 0.15)) * 0.5])
        place(gulls, g * (1 + 0.1 * np.sin(np.arange(len(g)) / SR * 2 * np.pi * 30)), at)
    gulls = reverb(filt(gulls, band(500, 4000)), 2.0, 0.5, seed=21)
    return finish(mix + pan(gulls * 0.18, 0.5), rms_db=-25)


SCENES = {
    "kirche-voegel": kirche_voegel,
    "bergwind-piste": bergwind_piste,
    "bergsee": bergsee,
    "kaminfeuer": kaminfeuer,
    "meer-moewen": meer_moewen,
}


def write_mp3(name, x):
    pad = int(PAD * SR)
    full = np.concatenate([x[-pad:], x, x[:pad]])  # periodisch erweitert
    pcm = (np.clip(full, -1, 1) * 32767).astype("<i2")
    os.makedirs(OUT, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        with wave.open(tmp.name, "wb") as w:
            w.setnchannels(2)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(pcm.tobytes())
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp.name, "-codec:a", "libmp3lame", "-b:a", "96k",
                        "-metadata", f"title={name}", f"{OUT}/{name}.mp3"], check=True)
    os.unlink(tmp.name)
    print(f"✓ {name}.mp3")


if __name__ == "__main__":
    for name, fn in SCENES.items():
        write_mp3(name, fn())
