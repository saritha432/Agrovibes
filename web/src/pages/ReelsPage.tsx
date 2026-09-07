import { useCallback, useEffect, useState } from "react";
import { fetchHomeReelsExplore } from "../api/home";
import type { HomePost } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { DropVideoSlide, useDropFeedAutoplay } from "../components/feed/DropsFeed";
import { orderPostsForFeed } from "../utils/feedOrder";
import "./ReelsPage.css";

export function ReelsPage() {
  const { token, user } = useAuth();
  const [drops, setDrops] = useState<HomePost[]>([]);
  const [shuffleSeed, setShuffleSeed] = useState(() => Date.now());
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const seed = Date.now();
    setShuffleSeed(seed);
    try {
      const page = await fetchHomeReelsExplore(token, { limit: 24 });
      const ordered = orderPostsForFeed(page.posts, seed, Date.now(), user?.id);
      setDrops(ordered);
      setActiveIndex(0);
    } catch {
      setDrops([]);
    } finally {
      setLoading(false);
    }
  }, [token, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onRefresh = () => void load();
    window.addEventListener("cropvibe:feed-refresh", onRefresh);
    return () => window.removeEventListener("cropvibe:feed-refresh", onRefresh);
  }, [load]);

  const onActiveChange = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  const scrollerRef = useDropFeedAutoplay(drops.length, onActiveChange);

  return (
    <div className="drops-page">
      {loading ? <p className="drops-page__status">Loading drops…</p> : null}
      {!loading && drops.length === 0 ? (
        <p className="drops-page__status">No drops yet.</p>
      ) : null}
      {!loading && drops.length > 0 ? (
        <div ref={scrollerRef} className="drops-feed" key={shuffleSeed}>
          {drops.map((post, index) => (
            <div key={post.id} className="drops-feed__slide-wrap" data-index={index}>
              <DropVideoSlide post={post} active={index === activeIndex} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
