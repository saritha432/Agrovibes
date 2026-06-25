import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  portal?: boolean;
  sidecar?: boolean;
  inline?: boolean;
};

export function CommentPanel({
  postId,
  commentsCount,
  onClose,
  onCountChange,
  portal = true,
  sidecar = false,
  inline = false
}: Props) {
  const { token, user } = useAuth();
  const [comments, setComments] = useState<HomeComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ id: string; user: string } | null>(null);

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
    const parentNum = replyingTo ? Number(replyingTo.id) : NaN;
    const parentCommentId = Number.isFinite(parentNum) && parentNum > 0 ? parentNum : undefined;
    setSubmitting(true);
    setError(null);
    try {
      const res = await createHomePostComment(token, postId, text, { parentCommentId });
      setComments((prev) => [...prev, res.comment]);
      setDraft("");
      setReplyingTo(null);
      onCountChange(res.commentsCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  };

  const rows = (() => {
    const byParent = new Map<string, HomeComment[]>();
    const top: HomeComment[] = [];
    for (const c of comments) {
      const parentKey = c.parentCommentId ? String(c.parentCommentId) : "";
      if (!parentKey) {
        top.push(c);
        continue;
      }
      const list = byParent.get(parentKey) || [];
      list.push(c);
      byParent.set(parentKey, list);
    }

    const out: Array<{ c: HomeComment; depth: 0 | 1 }> = [];
    for (const c of top) {
      out.push({ c, depth: 0 });
      const replies = byParent.get(String(c.id)) || [];
      for (const r of replies) out.push({ c: r, depth: 1 });
    }
    return out;
  })();

  const content = (
    <div
      className={`comment-panel${sidecar ? " comment-panel--sidecar" : ""}${inline ? " comment-panel--inline" : ""}`}
      role="dialog"
      aria-modal={sidecar || inline ? undefined : "true"}
      aria-label="Comments"
    >
      {!sidecar && !inline ? (
        <button type="button" className="comment-panel__backdrop" onClick={onClose} aria-label="Close" />
      ) : null}
      <div className={`comment-panel__sheet${inline ? " comment-panel__sheet--inline" : ""}`}>
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
          {rows.map(({ c, depth }) => (
            <div key={`${c.id}-${depth}`} className={`comment-panel__row${depth ? " comment-panel__row--reply" : ""}`}>
              <span className="comment-panel__avatar">
                {c.avatarUrl ? <img src={c.avatarUrl} alt="" /> : c.user.charAt(0).toUpperCase()}
              </span>
              <div>
                <strong>{c.user}</strong>
                <p>{c.text}</p>
                <button
                  type="button"
                  className="comment-panel__reply-btn"
                  onClick={() => {
                    const clean = String(c.user || "").replace(/^@/, "").trim();
                    setReplyingTo({ id: String(c.id), user: clean || c.user });
                    const mention = clean ? `@${clean} ` : "";
                    setDraft((d) => (d.trim() ? `${d} ${mention}` : mention));
                  }}
                >
                  Reply
                </button>
              </div>
            </div>
          ))}
        </div>

        {token ? (
          <footer className="comment-panel__composer">
            {replyingTo ? (
              <div className="comment-panel__replying">
                <span>
                  Replying to @{String(replyingTo.user || "").replace(/^@/, "")}
                </span>
                <button type="button" onClick={() => setReplyingTo(null)}>
                  Cancel
                </button>
              </div>
            ) : null}
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

  if (!portal || inline || typeof document === "undefined") return content;
  return createPortal(content, document.body);
}
