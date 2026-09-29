import { API_BASE_URL, fetchWithAuth } from "./client";

export async function fetchMapsConfig(token?: string | null) {
  const envKey = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "").trim();
  const auth = String(token || "").trim();
  if (!auth) return { configured: Boolean(envKey), key: envKey };
  try {
    const data = (await fetchWithAuth(`${API_BASE_URL}/v1/places/maps-config`, auth)) as {
      configured?: boolean;
      key?: string;
    };
    const key = String(data?.key || envKey).trim();
    return { configured: Boolean(key), key };
  } catch {
    return { configured: Boolean(envKey), key: envKey };
  }
}
