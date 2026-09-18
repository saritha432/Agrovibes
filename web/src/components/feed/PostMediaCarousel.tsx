import { useEffect, useRef, useState } from "react";
import "./PostMediaCarousel.css";

function isVideoMediaUrl(url: string) {
  const cleaned = String(url || "").trim();
  if (!cleaned) return false;
  if (/\.(mp4|mov|webm|m3u8|m4v|mkv|avi|ts)(\?|#|$)/i.test(cleaned)) return true;
  if (/\/agrovibes\/videos\//i.test(cleaned) || /\/videos\//i.test(cleaned)) return true;
  return false;
}

function CarouselSlide({ url, active }: { url: string; active: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (active) {
      void el.play().catch(() => undefined);
      return;
    }
    el.pause();
  }, [active]);

  if (isVideoMediaUrl(url)) {
    return (
      <video ref={videoRef} className="post-carousel__img" src={url} muted loop playsInline controls={false} />
    );
  }
  return <img src={url} alt="" className="post-carousel__img" />;
}

export function PostMediaCarousel({ urls }: { urls: string[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root || urls.length <= 1) return;

    const slides = Array.from(root.querySelectorAll<HTMLElement>(".post-carousel__slide"));
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
        if (best && best.ratio >= 0.5) setActiveIndex(best.index);
      },
      { root, threshold: [0.5, 0.75] }
    );

    slides.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [urls.length]);

  if (urls.length === 0) return null;

  if (urls.length === 1) {
    return (
      <div className="post-carousel">
        <CarouselSlide url={urls[0]} active />
      </div>
    );
  }

  return (
    <div className="post-carousel post-carousel--multi">
      <div ref={scrollerRef} className="post-carousel__scroller">
        {urls.map((url, index) => (
          <div key={`${url}-${index}`} className="post-carousel__slide" data-index={index}>
            <CarouselSlide url={url} active={index === activeIndex} />
          </div>
        ))}
      </div>
      <div className="post-carousel__dots" aria-hidden>
        {urls.map((_, index) => (
          <span
            key={index}
            className={`post-carousel__dot${index === activeIndex ? " post-carousel__dot--active" : ""}`}
          />
        ))}
      </div>
    </div>
  );
}
