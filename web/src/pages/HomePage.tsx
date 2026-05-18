import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchHomePosts, fetchSocialNetwork } from "../api/home";
import type { HomePost } from "../api/types";
import { PostCard } from "../components/feed/PostCard";
import { useAuth } from "../auth/AuthContext";
import "./HomePage.css";

const TABS_ALL = ["Feed", "Reels", "Friends", "live"] as const;
type HomeTab = (typeof TABS_ALL)[number];

function isReel(post: HomePost) {
  return !!post.videoUrl && /^\[REEL\]/i.test(String(post.caption || "").trim());
}

export function HomePage() {
  const { token, user } = useAuth();
  const [posts, setPosts] = useState<HomePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<HomeTab>("Feed");
  const [followingIds, setFollowingIds] = useState<Set<number>>(new Set());
  const [followerIds, setFollowerIds] = useState<Set<number>>(new Set());
  const [networkReady, setNetworkReady] = useState(false);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { posts: list } = await fetchHomePosts(token);
      setPosts(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load feed");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    if (!token || !user?.id) {
      setFollowingIds(new Set());
      setFollowerIds(new Set());
      setNetworkReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const network = await fetchSocialNetwork(token, user.id);
        if (cancelled) return;
        const following = new Set<number>();
        const followers = new Set<number>();
        for (const p of network.following || []) {
          const raw = String((p as { key?: string }).key || "").trim();
          const id = /^\d+$/.test(raw) ? Number(raw) : NaN;
          if (Number.isFinite(id) && id > 0) following.add(id);
        }
        for (const p of network.followers || []) {
          const raw = String((p as { key?: string }).key || "").trim();
          const id = /^\d+$/.test(raw) ? Number(raw) : NaN;
          if (Number.isFinite(id) && id > 0) followers.add(id);
        }
        setFollowingIds(following);
        setFollowerIds(followers);
      } catch {
        if (!cancelled) {
          setFollowingIds(new Set());
          setFollowerIds(new Set());
        }
      } finally {
        if (!cancelled) setNetworkReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, user?.id]);

  const showFriends = networkReady && (followingIds.size > 0 || followerIds.size > 0);
  const tabs = useMemo(
    () => (showFriends ? [...TABS_ALL] : TABS_ALL.filter((t) => t !== "Friends")),
    [showFriends]
  );

  useEffect(() => {
    if (tab === "Friends" && !showFriends) setTab("Feed");
  }, [tab, showFriends]);

  const filtered = useMemo(() => {
    if (tab === "Reels") return posts.filter(isReel);
    if (tab === "Friends") {
      return posts.filter((p) => {
        const uid = Number(p.userId);
        return Number.isFinite(uid) && uid > 0 && followingIds.has(uid) && isReel(p);
      });
    }
    if (tab === "live") return [];
    return posts.filter((p) => !isReel(p) || tab === "Feed");
  }, [posts, tab, followingIds]);

  const tabLabel = (t: HomeTab) => (t === "live" ? "Live" : t);

  return (
    <div className="home-page">
      <div className="home-tabs">
        <div className="home-tabs__row">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              className={`home-tabs__btn${tab === t ? " home-tabs__btn--active" : ""}`}
              onClick={() => setTab(t)}
            >
              {tabLabel(t)}
            </button>
          ))}
        </div>
        <div className="home-tabs__line" />
      </div>

      {loading ? <p className="home-page__status">Loading feed…</p> : null}
      {error ? <p className="home-page__error">{error}</p> : null}

      {!loading && !error && tab === "live" ? (
        <div className="home-page__empty">
          <h2>Live</h2>
          <p>Live streaming is coming soon.</p>
        </div>
      ) : null}

      {!loading && !error && tab !== "live" && filtered.length === 0 ? (
        <div className="home-page__empty">
          <p>No posts in this tab yet.</p>
        </div>
      ) : null}

      <div className="home-feed">
        {filtered.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
}
