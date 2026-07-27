import type { AuthUser } from "./types";

const PRODUCTION_API_BASE_URL = "https://cropvibe-api-production.up.railway.app/api";
const API_FETCH_TIMEOUT_MS = 45_000;
const API_FETCH_RETRIES = 2;

function isPrivateOrLocalApiUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (!host || host === "localhost" || host === "127.0.0.1") return true;
    if (/^192\.168\./.test(host)) return true;
    if (/^10\./.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
    return false;
  } catch {
    return false;
  }
}

function resolveApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (envUrl?.trim()) {
    const trimmed = envUrl.trim().replace(/\/$/, "");
    if (!import.meta.env.DEV && isPrivateOrLocalApiUrl(trimmed)) {
      return PRODUCTION_API_BASE_URL;
    }
    return trimmed;
  }

  if (import.meta.env.DEV) {
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      if (host === "localhost" || host === "127.0.0.1") {
        return PRODUCTION_API_BASE_URL;
      }
    }
    return PRODUCTION_API_BASE_URL;
  }

  return PRODUCTION_API_BASE_URL;
}

export const API_BASE_URL = resolveApiBaseUrl();

export function getWebAppOrigin(): string {
  if (typeof window !== "undefined" && window.location.hostname) {
    const host = window.location.hostname;
    if (host !== "localhost" && host !== "127.0.0.1") {
      return window.location.origin;
    }
  }
  return "https://cropvibe.com";
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  timeoutMs = API_FETCH_TIMEOUT_MS
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= API_FETCH_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if (attempt < API_FETCH_RETRIES && [502, 503, 504].includes(response.status)) {
        await new Promise((resolve) => setTimeout(resolve, 1800 * (attempt + 1)));
        continue;
      }
      return response;
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      if (attempt < API_FETCH_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 1800 * (attempt + 1)));
        continue;
      }
    }
  }
  if (lastError instanceof Error) throw lastError;
  throw new Error("Network request failed");
}

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
  const response = await fetchWithRetry(url, { ...init, headers });
  return parseJsonOrThrow(response);
}

export type { AuthUser };
