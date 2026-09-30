export type WeatherIconName = "sunny" | "partly-cloudy" | "cloudy" | "rain" | "storm" | "fog" | "snow";

export type WeatherPlace = {
  label: string;
  district?: string;
  lat: number;
  lng: number;
};

export type WeatherDay = {
  date: string;
  weekday: string;
  day: string;
  tempC: number;
  rainChance: number;
  condition: string;
  summary: string;
  icon: WeatherIconName;
  hint: string;
};

export type WeatherReport = {
  location: WeatherPlace;
  updatedAt: string;
  updatedLabel: string;
  source: string;
  disclaimer: string;
  current: {
    tempC: number;
    rainChance: number;
    condition: string;
    icon: WeatherIconName;
  };
  days: WeatherDay[];
  alert: { title: string; body: string } | null;
};

export function isUsableLatLng(lat?: number | null, lng?: number | null): boolean {
  if (lat == null || lng == null) return false;
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return false;
  if (Math.abs(la) < 0.05 && Math.abs(ln) < 0.05) return false;
  return la >= -90 && la <= 90 && ln >= -180 && ln <= 180;
}

function wmoMeta(code: unknown): { condition: string; icon: WeatherIconName; summary: string } {
  const n = Number(code);
  if (n === 0) return { condition: "Clear", icon: "sunny", summary: "Clear" };
  if (n === 1) return { condition: "Mostly clear", icon: "partly-cloudy", summary: "Mostly clear" };
  if (n === 2) return { condition: "Partly cloudy", icon: "partly-cloudy", summary: "Partly cloudy" };
  if (n === 3) return { condition: "Overcast", icon: "cloudy", summary: "Overcast" };
  if (n <= 48) return { condition: "Fog", icon: "fog", summary: "Fog" };
  if (n <= 57) return { condition: "Drizzle", icon: "rain", summary: "Drizzle" };
  if (n <= 67) return { condition: "Rain", icon: "rain", summary: "Showers" };
  if (n <= 77) return { condition: "Snow", icon: "snow", summary: "Snow" };
  if (n <= 82) return { condition: "Showers", icon: "rain", summary: "Showers" };
  if (n <= 86) return { condition: "Snow showers", icon: "snow", summary: "Snow" };
  return { condition: "Thunderstorm", icon: "storm", summary: "Storm" };
}

function weekdayLabel(isoDate: string, timeZone: string) {
  try {
    return new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone }).format(new Date(`${isoDate}T12:00:00`));
  } catch {
    return isoDate;
  }
}

function dayMonthLabel(isoDate: string, timeZone: string) {
  try {
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", timeZone }).format(new Date(`${isoDate}T12:00:00`));
  } catch {
    return isoDate;
  }
}

function relativeUpdated(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.max(1, Math.round(ms / 60000));
  if (mins < 60) return `updated ${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  return `updated ${hours} hour${hours === 1 ? "" : "s"} ago`;
}

function fieldWorkHint(rainChance: number, icon: WeatherIconName) {
  if (icon === "storm") return "Storm risk — pause outdoor work";
  if (rainChance >= 60) return "Rain — delay field work";
  if (rainChance >= 35) return "Possible showers";
  if (icon === "sunny") return "Good for field work";
  if (icon === "cloudy" || icon === "partly-cloudy") return "Overcast";
  return "Fair";
}

function buildAlert(days: WeatherDay[]) {
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

function placeFromHit(hit: {
  name?: string;
  admin1?: string;
  admin2?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}): WeatherPlace {
  const parts = [hit.name, hit.admin1, hit.country].filter(Boolean);
  const district = hit.admin2 || hit.admin1 || hit.name || "Selected location";
  return {
    label: parts.join(", ") || district,
    district: /district$/i.test(String(district)) ? String(district) : `${district} district`,
    lat: Number(hit.latitude),
    lng: Number(hit.longitude)
  };
}

async function fetchJson(url: string) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Weather lookup failed (${res.status})`);
  return res.json();
}

function nearestHourIndex(times: string[] | undefined, iso: string | undefined) {
  if (!Array.isArray(times) || !times.length) return -1;
  const target = Date.parse(iso || "") || Date.now();
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    const diff = Math.abs(Date.parse(times[i] || "") - target);
    if (Number.isFinite(diff) && diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}

export async function searchOpenMeteoPlaces(query: string, limit = 6): Promise<WeatherPlace[]> {
  const q = String(query || "").trim();
  if (q.length < 2) return [];
  const data = (await fetchJson(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=${limit}&language=en&format=json`
  )) as { results?: Array<Parameters<typeof placeFromHit>[0]> };
  const rows = Array.isArray(data?.results) ? data.results : [];
  return rows.map(placeFromHit).filter((row) => isUsableLatLng(row.lat, row.lng));
}

async function resolvePlace(params?: { q?: string; lat?: number; lng?: number }): Promise<WeatherPlace> {
  if (isUsableLatLng(params?.lat, params?.lng)) {
    const reverse = (await fetchJson(
      `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${params!.lat}&longitude=${params!.lng}&language=en&format=json`
    ).catch(() => null)) as { results?: Array<Parameters<typeof placeFromHit>[0]> } | null;
    const hit = reverse?.results?.[0];
    if (hit) return placeFromHit(hit);
    return {
      label: `${Number(params!.lat).toFixed(3)}, ${Number(params!.lng).toFixed(3)}`,
      district: "Selected location",
      lat: Number(params!.lat),
      lng: Number(params!.lng)
    };
  }
  const query = String(params?.q || "").trim();
  if (query) {
    const hits = await searchOpenMeteoPlaces(query, 1);
    if (hits[0]) return hits[0];
  }
  throw new Error("LOCATION_REQUIRED");
}

export async function loadOpenMeteoWeather(params?: { q?: string; lat?: number; lng?: number }): Promise<WeatherReport> {
  const place = await resolvePlace(params);
  const search = new URLSearchParams({
    latitude: String(place.lat),
    longitude: String(place.lng),
    current: "temperature_2m,weather_code,precipitation,cloud_cover,is_day",
    hourly: "precipitation_probability,weather_code,temperature_2m",
    daily: "weather_code,temperature_2m_max,precipitation_probability_max",
    forecast_days: "5",
    timezone: "auto"
  });
  const data = (await fetchJson(`https://api.open-meteo.com/v1/forecast?${search.toString()}`)) as {
    timezone?: string;
    current?: {
      time?: string;
      temperature_2m?: number;
      weather_code?: number;
      precipitation?: number;
      cloud_cover?: number;
      is_day?: number;
    };
    hourly?: {
      time?: string[];
      precipitation_probability?: number[];
      weather_code?: number[];
      temperature_2m?: number[];
    };
    daily?: {
      time?: string[];
      weather_code?: number[];
      temperature_2m_max?: number[];
      precipitation_probability_max?: number[];
    };
  };
  const timeZone = String(data?.timezone || "Asia/Kolkata");
  const daily = data?.daily || {};
  const dates = Array.isArray(daily.time) ? daily.time : [];
  const days: WeatherDay[] = dates.map((date, index) => {
    const meta = wmoMeta(daily.weather_code?.[index]);
    const rainChance = Math.max(0, Math.min(100, Number(daily.precipitation_probability_max?.[index] || 0)));
    return {
      date,
      weekday: weekdayLabel(date, timeZone).toUpperCase(),
      day: dayMonthLabel(date, timeZone),
      tempC: Math.round(Number(daily.temperature_2m_max?.[index] || 0)),
      rainChance,
      condition: meta.condition,
      summary: meta.summary,
      icon: meta.icon,
      hint: fieldWorkHint(rainChance, meta.icon)
    };
  });
  const currentMeta = wmoMeta(data?.current?.weather_code);
  const generated = data?.current?.time || new Date().toISOString();
  const hourIndex = nearestHourIndex(data?.hourly?.time, generated);
  const hourlyRain = hourIndex >= 0 ? Number(data?.hourly?.precipitation_probability?.[hourIndex]) : NaN;
  const currentRain = Number.isFinite(hourlyRain)
    ? hourlyRain
    : Number(days[0]?.rainChance || 0);
  return {
    location: place,
    updatedAt: generated,
    updatedLabel: relativeUpdated(generated),
    source: "Open-Meteo",
    disclaimer: "CropVibe is not a government service.",
    current: {
      tempC: Math.round(Number(data?.current?.temperature_2m || days[0]?.tempC || 0)),
      rainChance: Math.max(0, Math.min(100, currentRain)),
      condition: currentMeta.condition,
      icon: currentMeta.icon
    },
    days,
    alert: buildAlert(days)
  };
}
