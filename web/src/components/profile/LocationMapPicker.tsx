import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fetchMapsConfig } from "../../api/places";
import { useAuth } from "../../auth/AuthContext";
import { DEFAULT_MAP_CENTER, formatCoordLabel, hasSavedMapCoords, loadGoogleMaps } from "../../utils/googleMaps";
import "./LocationMapPicker.css";

export type PickedMapLocation = {
  label: string;
  lat: number;
  lng: number;
};

type Props = {
  open: boolean;
  apiKey?: string | null;
  label: string;
  lat?: number | null;
  lng?: number | null;
  onClose: () => void;
  onSelect: (value: PickedMapLocation) => void;
};

type ApplyPoint = (nextLat: number, nextLng: number, nextLabel?: string) => void;

function googleEmbedSrc(lat: number, lng: number, zoom: number) {
  return `https://maps.google.com/maps?q=${lat},${lng}&z=${zoom}&output=embed`;
}

async function nominatimSearch(query: string) {
  const q = query.trim();
  if (!q) return null;
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`
  );
  const rows = (await response.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>;
  const lat = Number(rows[0]?.lat);
  const lng = Number(rows[0]?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, label: rows[0]?.display_name?.trim() || q };
}

async function nominatimReverse(lat: number, lng: number) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}`
    );
    const data = (await response.json()) as { display_name?: string };
    return data.display_name?.trim() || formatCoordLabel(lat, lng);
  } catch {
    return formatCoordLabel(lat, lng);
  }
}

export function LocationMapPicker({ open, apiKey, label, lat, lng, onClose, onSelect }: Props) {
  const { token } = useAuth();
  const mapEl = useRef<HTMLDivElement>(null);
  const searchEl = useRef<HTMLInputElement>(null);
  const applyPointRef = useRef<ApplyPoint | null>(null);
  const searchPlaceRef = useRef<() => void>(() => undefined);
  const [picked, setPicked] = useState<PickedMapLocation | null>(null);
  const [status, setStatus] = useState("Loading Google Maps…");
  const [hint, setHint] = useState("");
  const [locating, setLocating] = useState(false);
  const saved = hasSavedMapCoords(lat, lng);

  useEffect(() => {
    if (!open) return;
    if (searchEl.current) searchEl.current.value = label;
    setPicked(
      saved
        ? { label: label.trim() || formatCoordLabel(Number(lat), Number(lng)), lat: Number(lat), lng: Number(lng) }
        : null
    );
  }, [open, label, lat, lng, saved]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const start = saved
      ? { lat: Number(lat), lng: Number(lng) }
      : { ...DEFAULT_MAP_CENTER };
    const startZoom = saved ? 16 : 5;

    (async () => {
      try {
        const config = await fetchMapsConfig(token);
        if (cancelled) return;
        const key = String(config.key || apiKey || "").trim();

        const attachEmbed = () => {
          if (!mapEl.current) return;
          setStatus("");
          mapEl.current.innerHTML = `<iframe title="Google Map" src="${googleEmbedSrc(start.lat, start.lng, startZoom)}" style="width:100%;height:100%;border:0"></iframe>`;
          const applyPoint: ApplyPoint = (nextLat, nextLng, nextLabel) => {
            const frame = mapEl.current?.querySelector("iframe");
            if (frame) frame.src = googleEmbedSrc(nextLat, nextLng, 16);
            void (async () => {
              const formatted = nextLabel || (await nominatimReverse(nextLat, nextLng));
              if (cancelled) return;
              setPicked({ label: formatted, lat: nextLat, lng: nextLng });
              if (searchEl.current) searchEl.current.value = formatted;
            })();
          };
          applyPointRef.current = applyPoint;
          searchPlaceRef.current = () => {
            const q = String(searchEl.current?.value || "").trim();
            if (!q) return;
            void nominatimSearch(q).then((hit) => {
              if (!hit) {
                setStatus("No matching place found.");
                return;
              }
              setStatus("");
              setHint("");
              applyPoint(hit.lat, hit.lng, hit.label);
            });
          };
          if (saved) {
            applyPoint(start.lat, start.lng, label.trim() || undefined);
            return;
          }
          if (!navigator.geolocation) {
            setHint("Search for your location to place the pin.");
            searchEl.current?.focus();
            return;
          }
          setLocating(true);
          setHint("Finding your current location…");
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (cancelled) return;
              setLocating(false);
              setHint("");
              applyPoint(pos.coords.latitude, pos.coords.longitude);
            },
            () => {
              if (cancelled) return;
              setLocating(false);
              setHint("Location permission denied. Search for your place.");
              searchEl.current?.focus();
            },
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
          );
        };

        if (!key) {
          attachEmbed();
          return;
        }

        let maps;
        try {
          maps = await loadGoogleMaps(key);
        } catch {
          if (!cancelled) attachEmbed();
          return;
        }
        if (cancelled || !mapEl.current || !searchEl.current) return;
        setStatus("");
        const map = new maps.Map(mapEl.current, {
          center: start,
          zoom: startZoom,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false
        });
        const marker = new maps.Marker({
          map,
          position: start,
          draggable: true,
          visible: saved,
          title: "Selected location"
        });
        const geocoder = new maps.Geocoder();
        const applyPoint: ApplyPoint = (nextLat, nextLng, nextLabel) => {
          marker.setVisible(true);
          marker.setPosition({ lat: nextLat, lng: nextLng });
          map.setCenter({ lat: nextLat, lng: nextLng });
          map.setZoom(16);
          const finish = (formatted: string) => {
            setPicked({ label: formatted, lat: nextLat, lng: nextLng });
            if (searchEl.current) searchEl.current.value = formatted;
          };
          if (nextLabel) {
            finish(nextLabel);
            return;
          }
          geocoder.geocode({ location: { lat: nextLat, lng: nextLng } }, (results, geocodeStatus) => {
            finish(
              geocodeStatus === "OK" && results?.[0]?.formatted_address
                ? results[0].formatted_address
                : formatCoordLabel(nextLat, nextLng)
            );
          });
        };
        applyPointRef.current = applyPoint;
        const searchPlace = () => {
          const q = String(searchEl.current?.value || "").trim();
          if (!q) return;
          geocoder.geocode({ address: q }, (results, geocodeStatus) => {
            const loc = results?.[0]?.geometry?.location;
            if (geocodeStatus !== "OK" || !loc) {
              setStatus("No matching place found.");
              return;
            }
            setStatus("");
            setHint("");
            applyPoint(loc.lat(), loc.lng(), results?.[0]?.formatted_address);
          });
        };
        searchPlaceRef.current = searchPlace;
        map.addListener("click", (e) => {
          const point = e.latLng;
          if (!point) return;
          setHint("");
          applyPoint(point.lat(), point.lng());
        });
        marker.addListener("dragend", () => {
          const point = marker.getPosition();
          if (!point) return;
          applyPoint(point.lat(), point.lng());
        });
        try {
          const autocomplete = new maps.places.Autocomplete(searchEl.current, {
            fields: ["formatted_address", "geometry", "name"]
          });
          autocomplete.addListener("place_changed", () => {
            const place = autocomplete.getPlace();
            const loc = place.geometry?.location;
            if (!loc) {
              setStatus("Choose a place from the suggestions.");
              return;
            }
            setStatus("");
            setHint("");
            applyPoint(loc.lat(), loc.lng(), place.formatted_address || place.name || formatCoordLabel(loc.lat(), loc.lng()));
          });
        } catch {
          // Places can fail independently; Search still uses Geocoder.
        }

        if (saved) {
          setHint("");
          applyPoint(start.lat, start.lng, label.trim() || undefined);
          return;
        }

        if (!navigator.geolocation) {
          setHint("Search for your location to place the pin.");
          searchEl.current.focus();
          return;
        }
        setLocating(true);
        setHint("Finding your current location…");
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (cancelled) return;
            setLocating(false);
            setHint("");
            applyPoint(pos.coords.latitude, pos.coords.longitude);
          },
          () => {
            if (cancelled) return;
            setLocating(false);
            setHint("Location permission denied. Search for your place.");
            searchEl.current?.focus();
          },
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
        );
      } catch {
        if (!cancelled) {
          setStatus("");
          setHint("Search for your location to place the pin.");
        }
      }
    })();

    return () => {
      cancelled = true;
      applyPointRef.current = null;
      searchPlaceRef.current = () => undefined;
      if (mapEl.current) mapEl.current.innerHTML = "";
    };
  }, [apiKey, lat, lng, label, open, saved, token]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setHint("Location is not available in this browser. Search for your place.");
      return;
    }
    setLocating(true);
    setHint("Finding your current location…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setHint("");
        setStatus("");
        applyPointRef.current?.(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setLocating(false);
        setHint("Location permission denied. Search for your place.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  if (!open) return null;

  const content = (
    <div className="location-map-picker" role="dialog" aria-modal="true" aria-label="Choose location">
      <button type="button" className="location-map-picker__backdrop" onClick={onClose} aria-label="Close" />
      <div className="location-map-picker__sheet">
        <header className="location-map-picker__head">
          <strong>Select location</strong>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="location-map-picker__search">
          <input
            ref={searchEl}
            defaultValue={label}
            placeholder="Search Google Maps"
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              searchPlaceRef.current();
            }}
          />
          <button type="button" onClick={() => searchPlaceRef.current()}>
            Search
          </button>
          <button type="button" onClick={useMyLocation} disabled={locating}>
            {locating ? "Locating…" : "My location"}
          </button>
        </div>
        <div ref={mapEl} className="location-map-picker__map" />
        {status ? <p className="location-map-picker__status">{status}</p> : null}
        <p className="location-map-picker__hint">
          {hint || "Search, tap the map, or drag the pin to the exact place."}
        </p>
        <div className="location-map-picker__actions">
          <button type="button" className="location-map-picker__cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="location-map-picker__confirm"
            disabled={!picked}
            onClick={() => {
              if (!picked) return;
              onSelect(picked);
            }}
          >
            Use this location
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return content;
  return createPortal(content, document.body);
}
