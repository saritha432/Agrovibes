import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchUsers, sendFollowRequest } from "../../api/home";
import type { UserSearchRecord } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { CommentPanel } from "../feed/CommentPanel";
import "./HomeRightPanel.css";

function displayHandle(user: { username?: string | null; fullName: string }) {
  const u = user.username?.trim();
  return u ? `@${u}` : user.fullName;
}

function isSuggestionCandidate(user: UserSearchRecord, viewerId: number) {
  const id = Number(user.id);
  if (!Number.isFinite(id) || id <= 0 || id === viewerId) return false;
  if (user.viewerStatus === "self" || user.viewerStatus === "accepted") return false;
  return true;
}

function suggestionSubtitle(user: UserSearchRecord) {
  if (user.followersCount > 0) {
    return `${user.followersCount.toLocaleString()} followers`;
  }
  if (user.bio?.trim()) return user.bio.trim();
  return "New to Cropvibe";
}

function UserAvatar({
  uri,
  name,
  size = 44
}: {
  uri?: string | null;
  name: string;
  size?: number;
}) {
  return (
    <span className="right-panel__avatar" style={{ width: size, height: size }}>
      {uri ? <img src={uri} alt="" /> : <span>{name.charAt(0).toUpperCase()}</span>}
    </span>
  );
}

export function HomeRightPanel() {
  const { token, user, loading: authLoading } = useAuth();
  const [suggestions, setSuggestions] = useState<UserSearchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [activeComments, setActiveComments] = useState<{ postId: number; commentsCount: number } | null>(null);

  const loadSuggestions = useCallback(async () => {
    if (authLoading) return;
    if (!token || !user?.id) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const viewerId = Number(user.id);
    setLoading(true);
    try {
      const { users } = await fetchUsers(token, { limit: 100 });
      setSuggestions(users.filter((u) => isSuggestionCandidate(u, viewerId)).slice(0, 5));
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [authLoading, token, user?.id]);

  useEffect(() => {
    void loadSuggestions();
  }, [loadSuggestions]);

  useEffect(() => {
    const onOpenComments = (evt: Event) => {
      const data = (evt as CustomEvent<{ postId?: number; commentsCount?: number }>).detail;
      const postId = Number(data?.postId);
      if (!Number.isFinite(postId) || postId <= 0) return;
      setActiveComments({
        postId,
        commentsCount: Number.isFinite(Number(data?.commentsCount)) ? Number(data?.commentsCount) : 0
      });
    };
    window.addEventListener("cropvibe:open-right-comments", onOpenComments as EventListener);
    return () => window.removeEventListener("cropvibe:open-right-comments", onOpenComments as EventListener);
  }, []);

  const onFollow = async (target: UserSearchRecord) => {
    if (!token || busyId != null) return;
    setBusyId(target.id);
    try {
      await sendFollowRequest(token, target.id);
      setSuggestions((prev) =>
        prev.map((u) => (u.id === target.id ? { ...u, viewerStatus: "pending" as const } : u))
      );
    } catch {
      // ignore
    } finally {
      setBusyId(null);
    }
  };

  if (!user) return null;

  if (activeComments) {
    return (
      <aside className="right-panel right-panel--comments" aria-label="Comments">
        <div className="right-panel__comments-head">
          <button type="button" className="right-panel__comments-back" onClick={() => setActiveComments(null)}>
            ← Back to suggestions
          </button>
        </div>
        <div className="right-panel__comments-wrap">
          <CommentPanel
            postId={activeComments.postId}
            commentsCount={activeComments.commentsCount}
            onClose={() => setActiveComments(null)}
            onCountChange={(count) => setActiveComments((prev) => (prev ? { ...prev, commentsCount: count } : prev))}
            portal={false}
            inline
          />
        </div>
      </aside>
    );
  }

  return (
    <aside className="right-panel" aria-label="Suggestions">
      <div className="right-panel__me">
        <UserAvatar uri={user.avatarUrl} name={user.fullName} size={44} />
        <div className="right-panel__me-text">
          <strong>{displayHandle(user)}</strong>
          <span>{user.fullName}</span>
        </div>
        <Link to="/profile" className="right-panel__link-action">
          Switch
        </Link>
      </div>

      <div className="right-panel__section-head">
        <span className="right-panel__section-title">Suggested for you</span>
        <Link to="/search" className="right-panel__link-action right-panel__link-action--sm">
          See all
        </Link>
      </div>

      <ul className="right-panel__list">
        {loading ? (
          <li className="right-panel__empty">Loading suggestions…</li>
        ) : null}
        {!loading
          ? suggestions.map((s) => (
              <li key={s.id} className="right-panel__row">
                <UserAvatar uri={s.avatarUrl} name={s.fullName} size={32} />
                <div className="right-panel__row-text">
                  <strong>{displayHandle(s)}</strong>
                  <span>{suggestionSubtitle(s)}</span>
                </div>
                <button
                  type="button"
                  className="right-panel__follow"
                  disabled={busyId === s.id || s.viewerStatus === "pending"}
                  onClick={() => void onFollow(s)}
                >
                  {s.viewerStatus === "pending"
                    ? "Requested"
                    : busyId === s.id
                      ? "…"
                      : s.canFollowBack
                        ? "Follow back"
                        : "Follow"}
                </button>
              </li>
            ))
          : null}
        {!loading && suggestions.length === 0 ? (
          <li className="right-panel__empty">No other users to suggest yet.</li>
        ) : null}
      </ul>

      <footer className="right-panel__footer">
        <p className="right-panel__copy">© {new Date().getFullYear()} Cropvibe</p>
      </footer>
    </aside>
  );
}
