/** Returns the stored media URL for HTML5 video (Supabase public URLs, etc.). */
export function resolveWebVideoUrl(raw: string | null | undefined): string | null {
  const input = String(raw || "").trim();
  return input || null;
}
