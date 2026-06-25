import { useEffect, useRef } from "react";
import type { HomePost } from "../../api/types";
import { ReelSlideShell } from "./ReelSlideShell";

export function DropVideoSlide({ post, active }: { post: HomePost; active: boolean }) {
  return <ReelSlideShell post={post} active={active} />;
}

export function useDropFeedAutoplay(postCount: number, onActiveChange: (index: number) => void) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root || postCount === 0) return;

    const slides = Array.from(root.querySelectorAll<HTMLElement>(".drops-feed__slide-wrap"));
    const observer = new IntersectionObserver(
      (entries) => {
        let best: { index: number; ratio: number } | null = null;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const idx = Number((entry.target as HTMLElement).dataset.index);
          if (!Number.isFinite(idx)) continue;
          if (!best || entry.intersectionRatio > best.ratio) {
            best = { index: idx, ratio: entry.intersectionRatio };
          }
        }
        if (best && best.ratio >= 0.55) onActiveChange(best.index);
      },
      { root, threshold: [0.45, 0.55, 0.7, 0.9] }
    );

    slides.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [postCount, onActiveChange]);

  return scrollerRef;
}
