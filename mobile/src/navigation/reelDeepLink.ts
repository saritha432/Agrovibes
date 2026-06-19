export function parseReelDeepLink(url: string): number | null {
  const raw = String(url || "").trim();
  if (!raw) return null;
  const patterns = [/agrovibes:\/\/reel\/(\d+)/i, /\/reel\/(\d+)/i, /\/watch\/(\d+)/i];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (!match) continue;
    const id = Number(match[1]);
    if (Number.isFinite(id) && id > 0) return id;
  }
  return null;
}
