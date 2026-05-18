const envUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;

export const API_BASE_URL =
  envUrl?.trim().replace(/\/$/, "") ||
  (import.meta.env.DEV ? "/api" : "https://agrovibes.onrender.com/api");

export async function parseJsonOrThrow(response: Response) {
  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!response.ok) {
    const msg =
      (parsed as { message?: string } | null)?.message ||
      `Request failed (${response.status})`;
    throw new Error(msg);
  }
  return parsed;
}

export async function fetchWithAuth(
  url: string,
  token: string | null,
  init: RequestInit = {}
) {
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(url, { ...init, headers });
  return parseJsonOrThrow(response);
}
