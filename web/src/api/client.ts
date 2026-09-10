import type { AuthUser } from "./types";

const PRODUCTION_API_BASE_URL = "https://cropvibe-api-production.up.railway.app/api";
const API_FETCH_TIMEOUT_MS = 15_000;
export const AUTH_FETCH_TIMEOUT_MS = 30_000;
const API_FETCH_RETRIES = 1;
const REQUEST_TIMEOUT_MESSAGE = "Server took too long. Please try again.";

let apiWarmupStarted = false;

function isAbortError(error: unknown): boolean {
  if (typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "AbortError") {
    return true;
  }
  return error instanceof Error && (error.name === "AbortError" || /aborted/i.test(error.message));
}

function timeoutError(): Error {
  return new Error(REQUEST_TIMEOUT_MESSAGE);
}

function abortRequest(controller: AbortController) {
  try {
    controller.abort("timeout");
  } catch {
    controller.abort();
  }
}

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

  // Default: production API (works on localhost:5173 without a local backend).
  // For local backend: create web/.env.local with VITE_API_BASE_URL=http://localhost:5000/api
  return PRODUCTION_API_BASE_URL;
}

export const API_BASE_URL = resolveApiBaseUrl();

/** Fire-and-forget ping so Railway can wake before login / first API call. */
export function warmUpApi(): void {
  if (apiWarmupStarted) return;
  apiWarmupStarted = true;
  void fetch(`${API_BASE_URL}/v1/ping`, { method: "GET", cache: "no-store" }).catch(() => {});
}

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
    const timer = setTimeout(() => abortRequest(controller), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if (attempt < API_FETCH_RETRIES && [502, 503, 504].includes(response.status)) {
        await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
        continue;
      }
      return response;
    } catch (error) {
      clearTimeout(timer);
      if (isAbortError(error)) {
        lastError = timeoutError();
        const retryTimeout = timeoutMs <= API_FETCH_TIMEOUT_MS && attempt < API_FETCH_RETRIES;
        if (retryTimeout) {
          await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
          continue;
        }
        break;
      }
      lastError = error;
      if (attempt < API_FETCH_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
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
  init: RequestInit = {},
  timeoutMs?: number
) {
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetchWithRetry(url, { ...init, headers }, timeoutMs);
  return parseJsonOrThrow(response);
}

export type { AuthUser };
