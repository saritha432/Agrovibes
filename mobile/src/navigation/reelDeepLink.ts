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

export type ProfileDeepLink = {
  userId?: number;
  userName?: string;
};

export function parseProfileDeepLink(url: string): ProfileDeepLink | null {
  const raw = String(url || "").trim();
  if (!raw) return null;
  const patterns = [/agrovibes:\/\/profile\/([^/?#]+)/i, /\/profile\/([^/?#]+)/i];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (!match) continue;
    const segment = decodeURIComponent(String(match[1] || "")).trim();
    if (!segment) continue;
    const asId = Number(segment);
    if (Number.isFinite(asId) && asId > 0) return { userId: asId };
    return { userName: segment };
  }
  return null;
}
