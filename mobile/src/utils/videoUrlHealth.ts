/** Incomplete compressor uploads are often ~28B (ftyp-only). Skip those before ExoPlayer hangs. */
export const MIN_PLAYABLE_REMOTE_VIDEO_BYTES = 80 * 1024;

const playableCache = new Map<string, boolean>();

/**
 * HEAD-check remote progressive video size. Returns false for known-truncated objects.
 * On network/HEAD failure, returns true so ExoPlayer can still attempt playback.
 */
export async function isRemoteVideoLikelyPlayable(url: string | null | undefined): Promise<boolean> {
  const u = String(url || "").trim();
  if (!u || !/^https?:\/\//i.test(u)) return true;
  // HLS playlists are small by design — do not size-reject.
  if (/\.m3u8(\?|#|$)/i.test(u)) return true;

  const cached = playableCache.get(u);
  if (cached != null) return cached;

  try {
    const head = await fetch(u, { method: "HEAD" });
    const len = Number(head.headers.get("content-length") || 0);
    if (len > 0 && len < MIN_PLAYABLE_REMOTE_VIDEO_BYTES) {
      console.warn("[Cropvibe Video] rejecting tiny remote file", len, u.slice(0, 160));
      playableCache.set(u, false);
      return false;
    }
    // Some CDNs omit Content-Length on HEAD — try a 1-byte range GET.
    if (!Number.isFinite(len) || len <= 0) {
      const ranged = await fetch(u, { headers: { Range: "bytes=0-0" } });
      const rangeLen = Number(String(ranged.headers.get("content-range") || "").split("/")[1] || 0);
      if (rangeLen > 0 && rangeLen < MIN_PLAYABLE_REMOTE_VIDEO_BYTES) {
        console.warn("[Cropvibe Video] rejecting tiny remote file", rangeLen, u.slice(0, 160));
        playableCache.set(u, false);
        return false;
      }
    }
    playableCache.set(u, true);
    return true;
  } catch {
    return true;
  }
}
