const STORAGE_KEY = "cropvibe.provider.listingImages.v1";

function readMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function listingImage(id: string | number) {
  return readMap()[String(id)] || "";
}

export function saveListingImage(id: string | number, dataUrl: string) {
  const next = readMap();
  next[String(id)] = dataUrl;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
