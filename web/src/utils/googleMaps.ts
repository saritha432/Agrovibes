export type PickedMapLocation = {
  label: string;
  lat: number;
  lng: number;
};

type GoogleLatLng = {
  lat: () => number;
  lng: () => number;
};

type GoogleMapsApi = {
  Map: new (
    el: HTMLElement,
    opts: { center: { lat: number; lng: number }; zoom: number; mapTypeControl?: boolean; streetViewControl?: boolean; fullscreenControl?: boolean }
  ) => {
    addListener: (event: string, handler: (e: { latLng?: GoogleLatLng | null }) => void) => void;
    setCenter: (p: { lat: number; lng: number }) => void;
    setZoom: (z: number) => void;
  };
  Marker: new (opts: {
    map: unknown;
    position: { lat: number; lng: number };
    draggable?: boolean;
    title?: string;
  }) => {
    setPosition: (p: { lat: number; lng: number } | GoogleLatLng) => void;
    addListener: (event: string, handler: () => void) => void;
    getPosition: () => GoogleLatLng | null | undefined;
  };
  Geocoder: new () => {
    geocode: (
      req: { location: { lat: number; lng: number } },
      cb: (results: Array<{ formatted_address?: string }> | null, status: string) => void
    ) => void;
  };
  places: {
    Autocomplete: new (
      input: HTMLInputElement,
      opts?: { fields?: string[]; types?: string[] }
    ) => {
      addListener: (event: string, handler: () => void) => void;
      getPlace: () => {
        formatted_address?: string;
        name?: string;
        geometry?: { location?: GoogleLatLng };
      };
    };
  };
};

type LeafletApi = {
  map: (el: HTMLElement) => {
    setView: (ll: [number, number], zoom: number) => void;
    getZoom: () => number;
    on: (event: string, handler: (e: { latlng: { lat: number; lng: number } }) => void) => void;
    remove: () => void;
    invalidateSize: () => void;
  };
  tileLayer: (
    url: string,
    opts: { maxZoom: number; attribution: string }
  ) => { addTo: (map: unknown) => void };
  marker: (
    ll: [number, number],
    opts: { draggable: boolean }
  ) => {
    addTo: (map: unknown) => unknown;
    setLatLng: (ll: [number, number]) => void;
    on: (event: string, handler: () => void) => void;
    getLatLng: () => { lat: number; lng: number };
  };
};

const CALLBACK = "__cropvibeGoogleMapsReady";

declare global {
  interface Window {
    google?: { maps?: GoogleMapsApi };
    __cropvibeGoogleMapsReady?: () => void;
    L?: LeafletApi;
  }
}

let mapsPromise: Promise<GoogleMapsApi> | null = null;

export const DEFAULT_MAP_CENTER = { lat: 20.5937, lng: 78.9629 };

export function loadGoogleMaps(apiKey: string): Promise<GoogleMapsApi> {
  const existing = window.google?.maps;
  if (existing?.places && existing.Geocoder && existing.Map) {
    return Promise.resolve(existing);
  }
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise((resolve, reject) => {
    const ready = () => {
      const maps = window.google?.maps;
      if (maps?.places && maps.Geocoder && maps.Map) {
        resolve(maps);
        return;
      }
      mapsPromise = null;
      reject(new Error("Google Maps failed to initialize."));
    };

    window.__cropvibeGoogleMapsReady = ready;
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&callback=${CALLBACK}`;
    script.onerror = () => {
      mapsPromise = null;
      reject(new Error("Could not load Google Maps."));
    };
    document.head.appendChild(script);
  });

  return mapsPromise;
}

export function formatCoordLabel(lat: number, lng: number) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

let leafletPromise: Promise<LeafletApi> | null = null;

export function loadOpenStreetMap(): Promise<LeafletApi> {
  if (window.L?.map) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => {
      if (window.L?.map) resolve(window.L);
      else {
        leafletPromise = null;
        reject(new Error("Map library failed to initialize."));
      }
    };
    script.onerror = () => {
      leafletPromise = null;
      reject(new Error("Could not load map."));
    };
    document.head.appendChild(script);
  });
  return leafletPromise;
}

export async function reverseOsmLabel(lat: number, lng: number) {
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

export async function searchOsmPlace(query: string) {
  const q = query.trim();
  if (!q) return null;
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`
  );
  const rows = (await response.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>;
  const row = rows[0];
  const lat = Number(row?.lat);
  const lng = Number(row?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, label: row?.display_name?.trim() || q };
}
