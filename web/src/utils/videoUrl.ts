/** HTML5 video cannot play Cloudinary HLS (.m3u8) in most desktop browsers — use MP4. */
export function resolveWebVideoUrl(raw: string | null | undefined): string | null {
  const input = String(raw || "").trim();
  if (!input) return null;

  if (!/\.m3u8/i.test(input)) return input;

  if (/res\.cloudinary\.com/i.test(input)) {
    let out = input.replace(/\/video\/upload\/sp_auto,f_m3u8\//i, "/video/upload/f_mp4/");
    if (!/\/video\/upload\/f_mp4\//i.test(out)) {
      out = out.replace(/\/video\/upload\//i, "/video/upload/f_mp4/");
    }
    out = out.replace(/\.m3u8(?=\?|$)/i, ".mp4");
    return out;
  }

  return input;
}
