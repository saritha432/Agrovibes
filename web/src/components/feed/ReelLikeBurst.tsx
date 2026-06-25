import { useEffect, useRef, useState } from "react";
import { ReelIcon } from "./ReelIcon";
import "./ReelLikeBurst.css";

type Heart = {
  id: string;
  leftPct: number;
  topPct: number;
  xTo: number;
  yLift: number;
  size: number;
  delay: number;
};

export function ReelLikeBurst({ postId, trigger }: { postId: number; trigger: number }) {
  const seenRef = useRef<Record<number, number>>({});
  const [hearts, setHearts] = useState<Heart[]>([]);

  useEffect(() => {
    if (!trigger) return;
    const seen = seenRef.current[postId] || 0;
    if (trigger <= seen) return;
    seenRef.current[postId] = trigger;

    const created = Array.from({ length: 10 }, (_, idx) => ({
      id: `${trigger}-${idx}`,
      leftPct: 8 + Math.random() * 84,
      topPct: 16 + Math.random() * 66,
      xTo: Math.round((Math.random() - 0.5) * 72),
      yLift: 65 + Math.round(Math.random() * 70),
      size: 18 + Math.round(Math.random() * 20),
      delay: idx * 40
    }));
    setHearts(created);
    const clearT = window.setTimeout(() => setHearts([]), 1050);
    return () => window.clearTimeout(clearT);
  }, [trigger, postId]);

  if (!hearts.length) return null;

  return (
    <div className="reel-like-burst" aria-hidden>
      {hearts.map((h) => (
        <span
          key={h.id}
          className="reel-like-burst__heart"
          style={
            {
              left: `${h.leftPct}%`,
              top: `${h.topPct}%`,
              "--x-to": `${h.xTo}px`,
              "--y-lift": `${h.yLift}px`,
              "--delay": `${h.delay}ms`,
              "--size": `${h.size}px`
            } as React.CSSProperties
          }
        >
          <ReelIcon name="heart" filled size={h.size} color="#c9ff35" />
        </span>
      ))}
    </div>
  );
}
