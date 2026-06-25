import { useEffect, useRef, useState } from "react";
import "./PostMediaCarousel.css";

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
        <img src={urls[0]} alt="" className="post-carousel__img" />
      </div>
    );
  }

  return (
    <div className="post-carousel post-carousel--multi">
      <div ref={scrollerRef} className="post-carousel__scroller">
        {urls.map((url, index) => (
          <div key={`${url}-${index}`} className="post-carousel__slide" data-index={index}>
            <img src={url} alt="" className="post-carousel__img" />
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
