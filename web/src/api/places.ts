import { API_BASE_URL, fetchWithAuth } from "./client";

export async function fetchMapsConfig(token: string) {
  const envKey = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "").trim();
  try {
    const data = (await fetchWithAuth(`${API_BASE_URL}/v1/places/maps-config`, token)) as {
      configured?: boolean;
      key?: string;
    };
    const key = String(data?.key || envKey).trim();
    return { configured: Boolean(key), key };
  } catch {
    return { configured: Boolean(envKey), key: envKey };
  }
}
