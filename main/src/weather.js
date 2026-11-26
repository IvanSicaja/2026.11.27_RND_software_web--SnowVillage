// Aktuelles Wetter für die Koordinaten des Dorfes (Open-Meteo, ohne API-Schlüssel).
// Der Server fragt höchstens alle 10 Minuten ab und speichert das Ergebnis zwischen.
// Besucher verbinden sich nie direkt mit dem Wetterdienst.

const TTL = 10 * 60 * 1000; // 10 Minuten frisch
const STALE = 3 * 60 * 60 * 1000; // bei Ausfall bis 3 Stunden alte Werte zeigen
const TIMEOUT = 5000;

// WMO-Wettercodes → deutscher Text + Symbol-Name
const CODES = {
  0: ['Klar', 'sun'],
  1: ['Überwiegend klar', 'sun'],
  2: ['Teilweise bewölkt', 'cloud-sun'],
  3: ['Bewölkt', 'cloud'],
  45: ['Nebel', 'fog'],
  48: ['Raureifnebel', 'fog'],
  51: ['Leichter Nieselregen', 'rain'],
  53: ['Nieselregen', 'rain'],
  55: ['Starker Nieselregen', 'rain'],
  56: ['Gefrierender Nieselregen', 'rain'],
  57: ['Gefrierender Nieselregen', 'rain'],
  61: ['Leichter Regen', 'rain'],
  63: ['Regen', 'rain'],
  65: ['Starker Regen', 'rain'],
  66: ['Gefrierender Regen', 'rain'],
  67: ['Gefrierender Regen', 'rain'],
  71: ['Leichter Schneefall', 'snow'],
  73: ['Schneefall', 'snow'],
  75: ['Starker Schneefall', 'snow'],
  77: ['Schneegriesel', 'snow'],
  80: ['Regenschauer', 'rain'],
  81: ['Regenschauer', 'rain'],
  82: ['Heftige Regenschauer', 'rain'],
  85: ['Schneeschauer', 'snow'],
  86: ['Starke Schneeschauer', 'snow'],
  95: ['Gewitter', 'storm'],
  96: ['Gewitter mit Hagel', 'storm'],
  99: ['Gewitter mit Hagel', 'storm'],
};

export function describeWeather(code) {
  const [text, icon] = CODES[code] || ['Wetter', 'cloud'];
  return { text, icon };
}

export function buildWeatherUrl({ lat, lon }) {
  const q = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,snowfall_sum',
    timezone: 'auto',
    forecast_days: '8', // heute + 7 Tage
  });
  return `https://api.open-meteo.com/v1/forecast?${q}`;
}

/** Macht aus der Open-Meteo-Antwort ein kleines, stabiles Objekt (heute + bis zu 7 Folgetage). */
export function parseWeather(json) {
  const c = json?.current;
  if (!c || !Number.isFinite(c.temperature_2m) || !Number.isFinite(c.weather_code)) throw new Error('Unerwartete Wetterdaten');
  const { text, icon } = describeWeather(c.weather_code);
  const num = (v) => (Number.isFinite(v) ? Math.round(v) : null);
  const d = json.daily || {};
  const days = (Array.isArray(d.time) ? d.time : [])
    .map((date, i) => {
      const code = d.weather_code?.[i];
      const info = describeWeather(code);
      return {
        date,
        code: Number.isFinite(code) ? code : null,
        text: info.text,
        icon: info.icon,
        max: num(d.temperature_2m_max?.[i]),
        min: num(d.temperature_2m_min?.[i]),
        precip: num(d.precipitation_probability_max?.[i]),
        snow: Number.isFinite(d.snowfall_sum?.[i]) ? Math.round(d.snowfall_sum[i] * 10) / 10 : null,
      };
    });
  const valid = (day) => /^\d{4}-\d{2}-\d{2}$/.test(day.date) && day.max != null && day.min != null;
  return {
    temperature: num(c.temperature_2m),
    feelsLike: num(c.apparent_temperature),
    wind: num(c.wind_speed_10m),
    max: num(d.temperature_2m_max?.[0]),
    min: num(d.temperature_2m_min?.[0]),
    isDay: c.is_day !== 0,
    code: c.weather_code,
    text,
    icon,
    time: c.time || null,
    today: days[0] && valid(days[0]) ? days[0] : null, // Tageswerte für heute
    forecast: days.slice(1, 8).filter(valid), // die nächsten 7 Tage
  };
}

export function createWeatherService({ getLocation, fetchImpl = globalThis.fetch, now = () => Date.now(), log = console } = {}) {
  let cache = null; // { data, at, key }
  let pending = null;

  async function refresh(key, location) {
    const res = await fetchImpl(buildWeatherUrl(location), {
      signal: AbortSignal.timeout(TIMEOUT),
      headers: { accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Wetterdienst antwortet mit ${res.status}`);
    const data = parseWeather(await res.json());
    cache = { data, at: now(), key };
    return data;
  }

  return {
    /** Liefert { data, fresh } oder null, wenn nichts verfügbar ist. */
    async get() {
      const location = getLocation();
      if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lon)) return null;
      const key = `${location.lat},${location.lon}`;
      const age = cache && cache.key === key ? now() - cache.at : Infinity;
      if (age < TTL) return { data: cache.data, fresh: true };
      pending ??= refresh(key, location).finally(() => (pending = null));
      try {
        return { data: await pending, fresh: true };
      } catch (err) {
        log.warn?.(`[wetter] ${err.message}`);
        if (age < STALE) return { data: cache.data, fresh: false };
        return null;
      }
    },
  };
}
