import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { HomePost } from "../../api/types";
import { resolveWebVideoUrl } from "../../utils/videoUrl";
import "./ProfileReelViewer.css";

function reelCaption(caption?: string | null) {
  return String(caption || "")
    .replace(/^\[REEL\]\s*/i, "")
    .trim();
}

function ProfileReelSlide({ post, active }: { post: HomePost; active: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const src = resolveWebVideoUrl(post.videoUrl);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !src) return;
    if (active) {
      el.muted = false;
      void el.play().catch(() => {
        el.muted = true;
        void el.play().catch(() => {});
      });
    } else {
      el.pause();
    }
  }, [active, src]);

  const poster = post.thumbnailUrl || post.imageUrl || post.imageUrls?.[0] || undefined;

  return (
    <section className="profile-reel-viewer__slide">
      {src ? (
        <video
          ref={videoRef}
          className="profile-reel-viewer__video"
          src={src}
          poster={poster}
          playsInline
          loop
          onClick={() => {
            const el = videoRef.current;
            if (!el) return;
            el.muted = false;
            if (el.paused) void el.play();
            else el.pause();
          }}
        />
      ) : (
        <div className="profile-reel-viewer__missing">Video unavailable</div>
      )}
      <div className="profile-reel-viewer__meta">
        <strong>{post.userName}</strong>
        {reelCaption(post.caption) ? <p>{reelCaption(post.caption)}</p> : null}
      </div>
    </section>
  );
}

function ProfileReelViewerContent({
  posts,
  initialIndex,
  onClose
}: {
  posts: HomePost[];
  initialIndex: number;
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
            <ProfileReelSlide post={post} active={index === activeIndex} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProfileReelViewer({
  posts,
  initialIndex,
  onClose
}: {
  posts: HomePost[];
  initialIndex: number;
  onClose: () => void;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <ProfileReelViewerContent posts={posts} initialIndex={initialIndex} onClose={onClose} />,
    document.body
  );
}
