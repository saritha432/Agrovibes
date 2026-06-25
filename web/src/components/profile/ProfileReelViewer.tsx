import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { HomePost } from "../../api/types";
import { ReelSlideShell } from "../feed/ReelSlideShell";
import "./ProfileReelViewer.css";

function ProfileReelViewerContent({
  posts,
  initialIndex,
  initialCommentsPostId,
  onClose
}: {
  posts: HomePost[];
  initialIndex: number;
  initialCommentsPostId?: number | null;
  onClose: () => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const target = root.querySelector<HTMLElement>(`[data-index="${initialIndex}"]`);
    target?.scrollIntoView({ block: "start" });
    setActiveIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;

    const slides = Array.from(root.querySelectorAll<HTMLElement>(".profile-reel-viewer__slide-wrap"));
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
        if (best && best.ratio >= 0.55) setActiveIndex(best.index);
      },
      { root, threshold: [0.45, 0.55, 0.7, 0.9] }
    );

    slides.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [posts.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div className="profile-reel-viewer" role="dialog" aria-modal="true" aria-label="Reels">
      <button type="button" className="profile-reel-viewer__close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <div ref={scrollerRef} className="profile-reel-viewer__scroller">
        {posts.map((post, index) => (
          <div key={post.id} className="profile-reel-viewer__slide-wrap" data-index={index}>
            <ReelSlideShell
              post={post}
              active={index === activeIndex}
              sideComments
              initialCommentsOpen={post.id === initialCommentsPostId}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProfileReelViewer({
  posts,
  initialIndex,
  initialCommentsPostId,
  onClose
}: {
  posts: HomePost[];
  initialIndex: number;
  initialCommentsPostId?: number | null;
  onClose: () => void;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <ProfileReelViewerContent
      posts={posts}
      initialIndex={initialIndex}
      initialCommentsPostId={initialCommentsPostId}
      onClose={onClose}
    />,
    document.body
  );
}
