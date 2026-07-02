/** Canonical public web origin for share / universal links (no trailing slash). */
export const DEFAULT_WEB_APP_ORIGIN = "https://cropvibe.com";

export function resolveWebAppOrigin(): string {
  const raw = (process.env as Record<string, string | undefined>).EXPO_PUBLIC_WEB_BASE_URL;
  const fromEnv = typeof raw === "string" ? raw.trim().replace(/\/$/, "") : "";
  if (fromEnv) return fromEnv;

  const loc = (globalThis as { location?: { protocol?: string; hostname?: string; port?: string } }).location;
  if (typeof loc?.hostname === "string" && loc.hostname.length > 0) {
    const host = loc.hostname;
    if (host !== "localhost" && host !== "127.0.0.1") {
      const port = loc.port ? `:${loc.port}` : "";
      const protocol = loc.protocol && loc.protocol.length > 0 ? loc.protocol : "https:";
      return `${protocol}//${host}${port}`;
    }
  }

  return DEFAULT_WEB_APP_ORIGIN;
}
