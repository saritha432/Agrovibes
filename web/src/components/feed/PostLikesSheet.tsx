import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { fetchHomePostLikes, type HomePostLiker } from "../../api/home";
import { useAuth } from "../../auth/AuthContext";
import "./PostLikesSheet.css";

type Props = {
  postId: number;
  likesCount: number;
  viewerHasLiked?: boolean;
  onClose: () => void;
};

function displayName(liker: HomePostLiker) {
  return liker.fullName?.trim() || liker.username?.trim() || "User";
}

export function PostLikesSheet({ postId, likesCount, viewerHasLiked, onClose }: Props) {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [likers, setLikers] = useState<HomePostLiker[]>([]);

  const load = useCallback(async () => {
    if (!likesCount && !viewerHasLiked) {
      setLikers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const seen = new Set<number>();
    const merged: HomePostLiker[] = [];
    const push = (row: HomePostLiker) => {
      const id = Number(row.userId);
      if (id > 0) {
        if (seen.has(id)) return;
        seen.add(id);
      }
      merged.push(row);
    };

    const res = await fetchHomePostLikes(postId, token);
    for (const row of res.likers || []) push(row);

    if (viewerHasLiked && user) {
      push({
        userId: Number(user.id),
        fullName: user.fullName || "You",
        username: user.username,
        avatarUrl: user.avatarUrl
      });
    }

    setLikers(merged);
    setLoading(false);
  }, [likesCount, viewerHasLiked, postId, token, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const content = (
    <div className="post-likes-sheet" role="dialog" aria-modal="true" aria-label="Likes">
      <button type="button" className="post-likes-sheet__backdrop" onClick={onClose} aria-label="Close" />
      <div className="post-likes-sheet__panel">
        <div className="post-likes-sheet__handle" aria-hidden />
        <header className="post-likes-sheet__head">
          <button type="button" className="post-likes-sheet__close" onClick={onClose} aria-label="Close likes">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 9l6 6 6-6" stroke="#c9ff35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <strong>Likes</strong>
          <span className="post-likes-sheet__spacer" />
        </header>
        <div className="post-likes-sheet__list">
          {loading ? <p className="post-likes-sheet__status">Loading…</p> : null}
          {!loading && likers.length === 0 ? (
            <p className="post-likes-sheet__status">No likes yet.</p>
          ) : null}
          {!loading
            ? likers.map((liker, idx) => {
                const name = displayName(liker);
                const profilePath = liker.userId ? `/profile/${liker.userId}` : null;
                const row = (
                  <>
                    <span className="post-likes-sheet__avatar">
                      {liker.avatarUrl ? <img src={liker.avatarUrl} alt="" /> : name.charAt(0).toUpperCase()}
                    </span>
                    <span className="post-likes-sheet__name">{name}</span>
                  </>
                );
                return profilePath ? (
                  <Link
                    key={`${liker.userId}-${idx}`}
                    className="post-likes-sheet__row"
                    to={profilePath}
                    onClick={onClose}
                  >
                    {row}
                  </Link>
                ) : (
                  <div key={`${name}-${idx}`} className="post-likes-sheet__row">
                    {row}
                  </div>
                );
              })
            : null}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return content;
  return createPortal(content, document.body);
}
