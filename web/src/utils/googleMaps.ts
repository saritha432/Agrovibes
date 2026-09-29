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
    visible?: boolean;
    title?: string;
  }) => {
    setPosition: (p: { lat: number; lng: number } | GoogleLatLng) => void;
    setVisible: (visible: boolean) => void;
    addListener: (event: string, handler: () => void) => void;
    getPosition: () => GoogleLatLng | null | undefined;
  };
  Geocoder: new () => {
    geocode: (
      req: { location?: { lat: number; lng: number }; address?: string },
      cb: (
        results: Array<{ formatted_address?: string; geometry?: { location?: GoogleLatLng } }> | null,
        status: string
      ) => void
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

const CALLBACK = "__cropvibeGoogleMapsReady";

declare global {
  interface Window {
    google?: { maps?: GoogleMapsApi };
    __cropvibeGoogleMapsReady?: () => void;
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

export function hasSavedMapCoords(lat?: number | null, lng?: number | null) {
  if (lat == null || lng == null) return false;
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return false;
  if (Math.abs(la) < 0.05 && Math.abs(ln) < 0.05) return false;
  return la >= -90 && la <= 90 && ln >= -180 && ln <= 180;
}
