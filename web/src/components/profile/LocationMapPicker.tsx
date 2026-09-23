import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DEFAULT_MAP_CENTER, formatCoordLabel, loadGoogleMaps } from "../../utils/googleMaps";
import "./LocationMapPicker.css";

export type PickedMapLocation = {
  label: string;
  lat: number;
  lng: number;
};

type Props = {
  open: boolean;
  apiKey: string;
  label: string;
  lat?: number | null;
  lng?: number | null;
  onClose: () => void;
  onSelect: (value: PickedMapLocation) => void;
};

type ApplyPoint = (nextLat: number, nextLng: number, nextLabel?: string) => void;

export function LocationMapPicker({ open, apiKey, label, lat, lng, onClose, onSelect }: Props) {
  const mapEl = useRef<HTMLDivElement>(null);
  const searchEl = useRef<HTMLInputElement>(null);
  const applyPointRef = useRef<ApplyPoint | null>(null);
  const [picked, setPicked] = useState<PickedMapLocation | null>(null);
  const [status, setStatus] = useState("Loading Google Maps…");
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (searchEl.current) searchEl.current.value = label;
    setPicked(
      Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
        ? { label: label.trim() || formatCoordLabel(Number(lat), Number(lng)), lat: Number(lat), lng: Number(lng) }
        : null
    );
  }, [open, label, lat, lng]);

  useEffect(() => {
    if (!open || !apiKey) return;
    let cancelled = false;
    const start = { ...DEFAULT_MAP_CENTER };
    const hasPoint = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
    const startZoom = hasPoint ? 16 : 5;
    if (hasPoint) {
      start.lat = Number(lat);
      start.lng = Number(lng);
    }

    (async () => {
      try {
        const maps = await loadGoogleMaps(apiKey);
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
          title: "Selected location"
        });
        const geocoder = new maps.Geocoder();

        const applyPoint: ApplyPoint = (nextLat, nextLng, nextLabel) => {
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

        map.addListener("click", (e) => {
          const point = e.latLng;
          if (!point) return;
          applyPoint(point.lat(), point.lng());
        });
        marker.addListener("dragend", () => {
          const point = marker.getPosition();
          if (!point) return;
          applyPoint(point.lat(), point.lng());
        });

        const autocomplete = new maps.places.Autocomplete(searchEl.current, {
          fields: ["formatted_address", "geometry", "name"]
        });
        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          const loc = place.geometry?.location;
          if (!loc) {
            setStatus("Choose a place from the Google suggestions.");
            return;
          }
          setStatus("");
          applyPoint(loc.lat(), loc.lng(), place.formatted_address || place.name || formatCoordLabel(loc.lat(), loc.lng()));
        });
      } catch (error) {
        if (!cancelled) {
          setStatus(error instanceof Error ? error.message : "Could not load Google Maps.");
        }
      }
    })();

    return () => {
      cancelled = true;
      applyPointRef.current = null;
    };
  }, [apiKey, lat, lng, open]);

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
      setStatus("Location is not available in this browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setStatus("");
        applyPointRef.current?.(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setLocating(false);
        setStatus("Could not read your current location.");
      },
      { enableHighAccuracy: true, timeout: 12000 }
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
          />
          <button type="button" onClick={useMyLocation} disabled={locating}>
            {locating ? "Locating…" : "Use my location"}
          </button>
        </div>
        <div ref={mapEl} className="location-map-picker__map" />
        {status ? <p className="location-map-picker__status">{status}</p> : null}
        <p className="location-map-picker__hint">Search, tap the map, or drag the pin to the exact place.</p>
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
