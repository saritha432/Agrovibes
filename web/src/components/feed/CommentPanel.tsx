import { useCallback, useEffect, useState } from "react";
import {
  createHomePostComment,
  fetchHomePostComments,
  type HomeComment
} from "../../api/home";
import { useAuth } from "../../auth/AuthContext";
import "./CommentPanel.css";

type Props = {
  postId: number;
  commentsCount: number;
  onClose: () => void;
  onCountChange: (count: number) => void;
};

export function CommentPanel({ postId, commentsCount, onClose, onCountChange }: Props) {
  const { token, user } = useAuth();
  const [comments, setComments] = useState<HomeComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchHomePostComments(postId, token);
      setComments(data.comments || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load comments");
    } finally {
      setLoading(false);
    }
  }, [postId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    const text = draft.trim();
    if (!text || !token || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await createHomePostComment(token, postId, text);
      setComments((prev) => [...prev, res.comment]);
      setDraft("");
      onCountChange(res.commentsCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="comment-panel" role="dialog" aria-modal="true" aria-label="Comments">
      <button type="button" className="comment-panel__backdrop" onClick={onClose} aria-label="Close" />
      <div className="comment-panel__sheet">
        <header className="comment-panel__head">
          <strong>Comments</strong>
          <span>{commentsCount}</span>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="comment-panel__list">
          {loading ? <p className="comment-panel__status">Loading…</p> : null}
          {error ? <p className="comment-panel__error">{error}</p> : null}
          {!loading && comments.length === 0 ? (
            <p className="comment-panel__status">No comments yet.</p>
          ) : null}
          {comments.map((c) => (
            <div key={c.id} className="comment-panel__row">
              <span className="comment-panel__avatar">
                {c.avatarUrl ? <img src={c.avatarUrl} alt="" /> : c.user.charAt(0).toUpperCase()}
              </span>
              <div>
                <strong>{c.user}</strong>
                <p>{c.text}</p>
              </div>
            </div>
          ))}
        </div>

        {token ? (
          <footer className="comment-panel__composer">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={user?.fullName ? `Comment as ${user.fullName}` : "Add a comment…"}
              maxLength={500}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submit();
                }
              }}
            />
            <button type="button" disabled={!draft.trim() || submitting} onClick={() => void submit()}>
              Post
            </button>
          </footer>
        ) : (
          <p className="comment-panel__login-hint">Log in to comment.</p>
        )}
      </div>
    </div>
  );
}
