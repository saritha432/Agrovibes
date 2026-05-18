import { useCallback, useEffect, useState } from "react";
import { fetchHomePosts } from "../api/home";
import type { HomePost } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { resolveWebVideoUrl } from "../utils/videoUrl";
import "./ReelsPage.css";

function isReel(post: HomePost) {
  return !!post.videoUrl && /^\[REEL\]/i.test(String(post.caption || "").trim());
}

export function ReelsPage() {
  const { token } = useAuth();
  const [reels, setReels] = useState<HomePost[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { posts } = await fetchHomePosts(token);
      setReels(posts.filter(isReel));
      setIndex(0);
    } catch {
      setReels([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const active = reels[index];

  return (
    <div className="reels-page">
      {loading ? <p className="reels-page__status">Loading reelsâ€¦</p> : null}
      {!loading && reels.length === 0 ? (
        <p className="reels-page__status">No reels yet.</p>
      ) : null}
      {active ? (
        <div className="reels-page__viewer">
          <video
            key={active.id}
            src={resolveWebVideoUrl(active.videoUrl) || active.videoUrl!}
            className="reels-page__video"
            controls
            autoPlay
            playsInline
          />
          <div className="reels-page__meta">
            <strong>{active.userName}</strong>
            <p>{active.caption?.replace(/^\[REEL\]\s*/i, "")}</p>
          </div>
          <div className="reels-page__nav">
            <button type="button" disabled={index <= 0} onClick={() => setIndex((i) => i - 1)}>
              â†‘
            </button>
            <button
              type="button"
              disabled={index >= reels.length - 1}
              onClick={() => setIndex((i) => i + 1)}
            >
              â†“
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
