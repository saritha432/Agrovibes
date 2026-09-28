const DEFAULT_LOCATION = {
  label: "India",
  lat: 20.5937,
  lng: 78.9629
};

const forecastCache = new Map();
const CACHE_MS = 10 * 60 * 1000;

function parseLatLng(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  if (Math.abs(la) < 0.05 && Math.abs(ln) < 0.05) return null;
  if (la < -90 || la > 90 || ln < -180 || ln > 180) return null;
  return { lat: la, lng: ln };
}

function wmoMeta(code) {
  const n = Number(code);
  if (n === 0) return { condition: "Clear", icon: "sunny", summary: "Clear" };
  if (n <= 3) return { condition: n === 1 ? "Mostly clear" : "Partly cloudy", icon: "partly-cloudy", summary: "Haze" };
  if (n <= 48) return { condition: "Fog", icon: "fog", summary: "Fog" };
  if (n <= 57) return { condition: "Drizzle", icon: "rain", summary: "Drizzle" };
  if (n <= 67) return { condition: "Rain", icon: "rain", summary: "Showers" };
  if (n <= 77) return { condition: "Snow", icon: "snow", summary: "Snow" };
  if (n <= 82) return { condition: "Showers", icon: "rain", summary: "Showers" };
  if (n <= 86) return { condition: "Snow showers", icon: "snow", summary: "Snow" };
  return { condition: "Thunderstorm", icon: "storm", summary: "Storm" };
}

function weekdayLabel(isoDate, timeZone) {
  try {
    return new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone }).format(new Date(`${isoDate}T12:00:00`));
  } catch {
    return isoDate;
  }
}

function dayMonthLabel(isoDate, timeZone) {
  try {
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", timeZone }).format(new Date(`${isoDate}T12:00:00`));
  } catch {
    return isoDate;
  }
}

function relativeUpdated(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.max(1, Math.round(ms / 60000));
  if (mins < 60) return `updated ${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  return `updated ${hours} hour${hours === 1 ? "" : "s"} ago`;
}

function fieldWorkHint(rainChance, icon) {
  if (icon === "storm") return "Storm risk — pause outdoor work";
  if (rainChance >= 60) return "Rain — delay field work";
  if (rainChance >= 35) return "Possible showers";
  if (icon === "sunny") return "Hot afternoon";
  return "Clear";
}

function buildAlert(days) {
  const wet = days
    .slice(0, 3)
    .filter((day) => day.rainChance >= 55)
    .map((day) => day.weekday);
  if (wet.length < 2) return null;
  return {
    title: `Rain likely ${wet[0]}–${wet[wet.length - 1]}`,
    body: "Heavy showers can delay field work and outdoor bookings. Reschedule via Messages if needed."
  };
}

function placeLabel(hit) {
  const parts = [hit.name, hit.admin1, hit.country].filter(Boolean);
  const district = hit.admin2 || hit.admin1 || hit.name;
  return {
    label: parts.join(", "),
    district: `${district} district`,
    lat: Number(hit.latitude),
    lng: Number(hit.longitude)
  };
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Weather lookup failed (${res.status})`);
  return res.json();
}

async function searchPlaces(query, limit = 6) {
  const q = String(query || "").trim();
  if (q.length < 2) return [];
  const data = await fetchJson(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=${limit}&language=en&format=json`
  );
  const rows = Array.isArray(data?.results) ? data.results : [];
  return rows.map(placeLabel).filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lng));
}

async function resolvePlace({ q, lat, lng, fallbackLabel }) {
  const parsed = parseLatLng(lat, lng);
  if (parsed) {
    const reverse = await fetchJson(
      `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${parsed.lat}&longitude=${parsed.lng}&language=en&format=json`
    ).catch(() => null);
    const hit = reverse?.results?.[0];
    if (hit) return placeLabel(hit);
    return {
      label: String(fallbackLabel || "").trim() || `${parsed.lat.toFixed(3)}, ${parsed.lng.toFixed(3)}`,
      district: String(fallbackLabel || "Selected location").trim(),
      lat: parsed.lat,
      lng: parsed.lng
    };
  }
  const query = String(q || fallbackLabel || "").trim();
  if (query) {
    const hits = await searchPlaces(query, 1);
    if (hits[0]) return hits[0];
  }
  return { ...DEFAULT_LOCATION, district: "India" };
}

async function loadForecast(place) {
  const key = `${place.lat.toFixed(3)},${place.lng.toFixed(3)}`;
  const cached = forecastCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.payload;

  const params = new URLSearchParams({
    latitude: String(place.lat),
    longitude: String(place.lng),
    current: "temperature_2m,weather_code,precipitation_probability",
    daily: "weather_code,temperature_2m_max,precipitation_probability_max",
    forecast_days: "5",
    timezone: "auto"
  });
  const data = await fetchJson(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  const timeZone = String(data?.timezone || "Asia/Kolkata");
  const daily = data?.daily || {};
  const dates = Array.isArray(daily.time) ? daily.time : [];
  const days = dates.map((date, index) => {
    const code = daily.weather_code?.[index];
    const meta = wmoMeta(code);
    const rainChance = Math.max(0, Math.min(100, Number(daily.precipitation_probability_max?.[index] || 0)));
    const tempC = Math.round(Number(daily.temperature_2m_max?.[index] || 0));
    return {
      date,
      weekday: weekdayLabel(date, timeZone).toUpperCase(),
      day: dayMonthLabel(date, timeZone),
      tempC,
      rainChance,
      condition: meta.condition,
      summary: meta.summary,
      icon: meta.icon,
      hint: fieldWorkHint(rainChance, meta.icon)
    };
  });
  const currentMeta = wmoMeta(data?.current?.weather_code);
  const generated = data?.current?.time || new Date().toISOString();
  const payload = {
    location: place,
    updatedAt: generated,
    updatedLabel: relativeUpdated(generated),
    source: "Open-Meteo",
    disclaimer: "CropVibe is not a government service.",
    current: {
      tempC: Math.round(Number(data?.current?.temperature_2m || days[0]?.tempC || 0)),
      rainChance: Math.max(0, Math.min(100, Number(data?.current?.precipitation_probability || days[0]?.rainChance || 0))),
      condition: currentMeta.condition,
      icon: currentMeta.icon
    },
    days,
    alert: buildAlert(days)
  };
  forecastCache.set(key, { at: Date.now(), payload });
  return payload;
}

module.exports = {
  searchPlaces,
  resolvePlace,
  loadForecast
};
