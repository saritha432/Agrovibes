import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HomePost } from "../services/api";

type Options = {
  enabled?: boolean;
  intervalMs?: number;
};

export function useReelGridAutoplay(posts: HomePost[], options?: Options) {
  const enabled = options?.enabled ?? true;
  const intervalMs = options?.intervalMs ?? 4500;
  const videoPosts = useMemo(
    () => posts.filter((post) => String(post.videoUrl || "").trim()),
    [posts]
  );
  const videoKey = useMemo(() => videoPosts.map((post) => post.id).join(","), [videoPosts]);
  const [cursor, setCursor] = useState(0);
  const failedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    setCursor(0);
    failedRef.current = new Set();
  }, [videoKey]);

  const advance = useCallback(() => {
    if (videoPosts.length <= 1) return;
    setCursor((prev) => {
      let attempts = 0;
      let next = (prev + 1) % videoPosts.length;
      while (failedRef.current.has(videoPosts[next].id) && attempts < videoPosts.length) {
        next = (next + 1) % videoPosts.length;
        attempts += 1;
      }
      return next;
    });
  }, [videoPosts]);

  useEffect(() => {
    if (!enabled || videoPosts.length <= 1) return;
    const timer = setInterval(advance, intervalMs);
    return () => clearInterval(timer);
  }, [advance, enabled, intervalMs, videoPosts.length]);

  const playingPostId =
    enabled && videoPosts.length > 0 ? videoPosts[cursor % videoPosts.length]?.id ?? null : null;

  const markVideoFailed = useCallback(
    (postId: number) => {
      if (!postId) return;
      failedRef.current.add(postId);
      advance();
    },
    [advance]
  );

  return { playingPostId, markVideoFailed };
}
