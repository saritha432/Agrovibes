import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  fetchWeatherReport,
  isUsableLatLng,
  searchWeatherPlaces,
  type WeatherIconName,
  type WeatherPlace,
  type WeatherReport
} from "../api/weather";
import "./WeatherPage.css";

function WeatherGlyph({ icon }: { icon: WeatherIconName }) {
  const label =
    icon === "sunny"
      ? "☀️"
      : icon === "rain"
        ? "🌧️"
        : icon === "storm"
          ? "⛈️"
          : icon === "snow"
            ? "❄️"
            : icon === "fog"
              ? "🌫️"
              : icon === "cloudy"
                ? "☁️"
                : "⛅";
  return <span className="weather-page__glyph" aria-hidden>{label}</span>;
}

export function WeatherPage() {
  const { token, user } = useAuth();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [report, setReport] = useState<WeatherReport | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<WeatherPlace[]>([]);
  const searchTimer = useRef<number | null>(null);

  async function load(params?: { q?: string; lat?: number; lng?: number }) {
    setLoading(true);
    setError("");
    try {
      const next = await fetchWeatherReport(token, params);
      setReport(next);
      setSelectedDate(null);
      setQuery("");
      setSuggestions([]);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      setError(msg === "LOCATION_REQUIRED" ? "Set your location in profile or search a place to see live weather." : "Could not load weather. Try another location.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(
      isUsableLatLng(user?.locationLat, user?.locationLng)
        ? { lat: Number(user?.locationLat), lng: Number(user?.locationLng) }
        : user?.locationLabel
          ? { q: user.locationLabel }
          : undefined
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.locationLabel, user?.locationLat, user?.locationLng]);

  function onQueryChange(value: string) {
    setQuery(value);
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    if (value.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    searchTimer.current = window.setTimeout(() => {
      void searchWeatherPlaces(token, value)
        .then(setSuggestions)
        .catch(() => setSuggestions([]));
    }, 280);
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      void load();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => void load({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => void load(),
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }

  const selectedDay = report?.days.find((day) => day.date === selectedDate) ?? null;

  return (
    <div className="weather-page">
      <header className="weather-page__head">
        <h1>Weather</h1>
        <form
          className="weather-page__search"
          onSubmit={(e) => {
            e.preventDefault();
            if (query.trim()) void load({ q: query.trim() });
          }}
        >
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search locations..."
            aria-label="Search locations"
          />
          <button type="submit" aria-label="Search">
            ⌕
          </button>
        </form>
        <div className="weather-page__tools">
          <button type="button" onClick={useMyLocation} aria-label="My location">
            ☁️
          </button>
          {user?.fullName ? (
            <div className="weather-page__user">
              <span className="weather-page__avatar">{user.fullName.charAt(0)}</span>
              <span>
                <strong>{user.fullName.split(" ")[0]}</strong>
                <small>CropVibe</small>
              </span>
            </div>
          ) : null}
        </div>
      </header>

      {suggestions.length ? (
        <div className="weather-page__suggest">
          {suggestions.map((place) => (
            <button
              key={`${place.lat},${place.lng},${place.label}`}
              type="button"
              onClick={() => void load({ lat: place.lat, lng: place.lng })}
            >
              {place.label}
            </button>
          ))}
        </div>
      ) : null}

      {loading && !report ? <p className="weather-page__status">Loading weather…</p> : null}
      {error ? <p className="weather-page__status weather-page__status--error">{error}</p> : null}

      {report ? (
        <>
          <p className="weather-page__meta">
            {report.location.district || report.location.label} · {report.disclaimer} {report.source} ·{" "}
            {report.updatedLabel}.
          </p>
          {report.current ? (
            <section className="weather-page__now" aria-label="Current weather">
              <span className="weather-page__day-name">Now</span>
              <WeatherGlyph icon={report.current.icon} />
              <strong>{report.current.tempC}°</strong>
              <span>{report.current.condition}</span>
              <small>Rain {report.current.rainChance}%</small>
            </section>
          ) : null}
          {report.alert ? (
            <div className="weather-page__alert" role="status">
              <strong>{report.alert.title}</strong>
              <p>{report.alert.body}</p>
            </div>
          ) : null}
          <div className="weather-page__days">
            {report.days.map((day) => {
              const selected = selectedDate === day.date;
              return (
                <button
                  key={day.date}
                  type="button"
                  className={selected ? "weather-page__day weather-page__day--selected" : "weather-page__day"}
                  aria-pressed={selected}
                  onClick={() => setSelectedDate(day.date)}
                >
                  <span className="weather-page__day-name">
                    {day.weekday} {day.day}
                  </span>
                  <WeatherGlyph icon={day.icon} />
                  <strong>{day.tempC}°</strong>
                  <span>Rain {day.rainChance}%</span>
                  <small>{day.hint}</small>
                </button>
              );
            })}
          </div>
          {selectedDay ? (
            <section className="weather-page__detail" aria-live="polite">
              <div className="weather-page__detail-head">
                <WeatherGlyph icon={selectedDay.icon} />
                <div>
                  <strong>
                    {selectedDay.weekday} {selectedDay.day}
                  </strong>
                  <span>{selectedDay.condition}</span>
                </div>
              </div>
              <p className="weather-page__detail-stats">
                High {selectedDay.tempC}° · Low {selectedDay.tempMinC}° · Rain {selectedDay.rainChance}%
                {selectedDay.windKmh > 0 ? ` · Wind ${selectedDay.windKmh} km/h` : ""}
              </p>
              <p className="weather-page__detail-body">{selectedDay.description}</p>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
