import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchHomePosts, fetchUsers, sendFollowRequest } from "../api/home";
import type { HomePost, UserSearchRecord } from "../api/types";
import { ProfileReelViewer } from "../components/profile/ProfileReelViewer";
import { useAuth } from "../auth/AuthContext";
import { isDropPost, orderPostsForFeed, reelGridStillUri, reelGridTileBackground } from "../utils/feedOrder";
import { resolveWebVideoUrl } from "../utils/videoUrl";
import "./SearchPage.css";
import "./ReelsPage.css";

const EXPLORE_LIMIT = 60;

export function SearchPage() {
  const { token, user } = useAuth();
  const [q, setQ] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [users, setUsers] = useState<UserSearchRecord[]>([]);
  const [explorePosts, setExplorePosts] = useState<HomePost[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingExplore, setLoadingExplore] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [reelViewer, setReelViewer] = useState<{ posts: HomePost[]; initialIndex: number } | null>(null);

  const trimmed = q.trim();
  const showTypeahead = searchFocused && trimmed.length > 0;

  const loadExplore = useCallback(async () => {
    setLoadingExplore(true);
    const seed = Date.now();
    try {
      const { posts } = await fetchHomePosts(token);
      const reels = orderPostsForFeed(
        posts.filter(isDropPost),
        seed,
        Date.now(),
        user?.id
      ).slice(0, EXPLORE_LIMIT);
      setExplorePosts(reels);
    } catch {
      setExplorePosts([]);
    } finally {
      setLoadingExplore(false);
    }
  }, [token, user?.id]);

  useEffect(() => {
    void loadExplore();
  }, [loadExplore]);

  useEffect(() => {
    if (!token || !trimmed) {
      setUsers([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoadingUsers(true);
      try {
        const res = await fetchUsers(token, { search: trimmed, limit: 50 });
        if (!cancelled) {
          const viewerId = Number(user?.id);
          setUsers(
            res.users.filter((u) => {
              const id = Number(u.id);
              return Number.isFinite(id) && id > 0 && id !== viewerId;
            })
          );
        }
      } catch {
        if (!cancelled) setUsers([]);
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [token, trimmed, user?.id]);

  const onFollow = async (target: UserSearchRecord) => {
    if (!token || busyId != null || target.viewerStatus === "pending") return;
    setBusyId(target.id);
    try {
      await sendFollowRequest(token, target.id);
      setUsers((prev) =>
        prev.map((u) => (u.id === target.id ? { ...u, viewerStatus: "pending" as const } : u))
      );
    } catch {
      // ignore
    } finally {
      setBusyId(null);
    }
  };

  const openExplorePost = (post: HomePost) => {
    const ix = explorePosts.findIndex((p) => p.id === post.id);
    setReelViewer({ posts: explorePosts, initialIndex: ix >= 0 ? ix : 0 });
  };

  return (
    <div className="search-page">
      <div className="search-page__header">
        <div className="search-page__search-wrap">
          <span className="search-page__search-icon" aria-hidden>
            ⌕
          </span>
          <input
            className="search-page__input"
            placeholder="Search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            autoComplete="off"
          />
          {q ? (
            <button
              type="button"
              className="search-page__clear"
              onClick={() => {
                setQ("");
                setUsers([]);
              }}
              aria-label="Clear"
            >
              ×
            </button>
          ) : null}
        </div>
        {showTypeahead ? (
          <button
            type="button"
            className="search-page__cancel"
            onClick={() => {
              setQ("");
              setUsers([]);
              setSearchFocused(false);
            }}
          >
            Cancel
          </button>
        ) : null}
      </div>

      <div className="search-page__body">
        {loadingExplore && !showTypeahead ? (
          <p className="search-page__hint">Loading explore…</p>
        ) : null}

        {!showTypeahead ? (
          <div className="explore-grid">
            {explorePosts.length === 0 && !loadingExplore ? (
              <p className="explore-grid__empty">No drops yet.</p>
            ) : null}
            {explorePosts.map((post, index) => {
              const cover = reelGridStillUri(post);
              const videoSrc = !cover ? resolveWebVideoUrl(post.videoUrl) : null;
              return (
                <button
                  key={post.id}
                  type="button"
                  className="explore-grid__tile"
                  style={{ backgroundColor: reelGridTileBackground(index) }}
                  onClick={() => openExplorePost(post)}
                >
                  {cover ? (
                    <img src={cover} alt="" loading="lazy" />
                  ) : videoSrc ? (
                    <video src={videoSrc} muted playsInline preload="metadata" />
                  ) : (
                    <span className="explore-grid__play">▶</span>
                  )}
                  <span className="explore-grid__play" aria-hidden>
                    ▶
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {showTypeahead ? (
          <div className="search-page__typeahead">
            {loadingUsers ? <p className="search-page__hint">Searching…</p> : null}
            {!loadingUsers && users.length === 0 ? (
              <p className="search-page__hint">No users found.</p>
            ) : null}
            <ul className="search-page__list">
              {users.map((u) => (
                <li key={u.id} className="search-page__item">
                  <span className="search-page__avatar">
                    {u.avatarUrl ? <img src={u.avatarUrl} alt="" /> : u.fullName.charAt(0)}
                  </span>
                  <div className="search-page__meta">
                    <strong>{u.fullName}</strong>
                    {u.username ? <span>@{u.username}</span> : null}
                  </div>
                  <div className="search-page__actions">
                    <Link to={`/messages/${u.id}`} className="search-page__message">
                      Message
                    </Link>
                    {u.viewerStatus === "accepted" ? (
                      <span className="search-page__status">Following</span>
                    ) : (
                      <button
                        type="button"
                        className="search-page__follow"
                        disabled={busyId === u.id || u.viewerStatus === "pending"}
                        onClick={() => void onFollow(u)}
                      >
                        {u.viewerStatus === "pending"
                          ? "Requested"
                          : busyId === u.id
                            ? "…"
                            : u.canFollowBack
                              ? "Follow back"
                              : "Follow"}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {reelViewer ? (
        <ProfileReelViewer
          posts={reelViewer.posts}
          initialIndex={reelViewer.initialIndex}
          onClose={() => setReelViewer(null)}
        />
      ) : null}
    </div>
  );
}
