import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  createHomePostComment,
  deleteHomePostComment,
  fetchHomePostComments,
  type HomeComment
} from "../../api/home";
import { useAuth } from "../../auth/AuthContext";
import {
  buildCommentReplyTree,
  COMMENT_QUICK_EMOJIS,
  COMMENT_REPLY_INDENT,
  commentPlaceholderForPost,
  formatCommentRelativeTime,
  inferParentFromMention,
  normalizeCommentRow,
  REPLY_PREVIEW_VISIBLE,
  shownCommentsCount
} from "../../utils/commentUtils";
import { ReelIcon } from "./ReelIcon";
import "./CommentPanel.css";

type Props = {
  postId: number;
  commentsCount: number;
  postUserName?: string;
  onClose: () => void;
  onCountChange: (count: number) => void;
  portal?: boolean;
  sidecar?: boolean;
  inline?: boolean;
};

type CommentInteraction = { liked: boolean; disliked: boolean };

function interactionKey(postId: number, commentId: string) {
  return `${postId}:${commentId}`;
}

export function CommentPanel({
  postId,
  commentsCount,
  postUserName,
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
  const [interactions, setInteractions] = useState<Record<string, CommentInteraction>>({});
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchHomePostComments(postId, token);
      const normalized = inferParentFromMention(
        (data.comments || []).map((c) => normalizeCommentRow(c as HomeComment & Record<string, unknown>))
      );
      setComments(normalized);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load comments");
    } finally {
      setLoading(false);
    }
  }, [postId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (loading) return;
    const synced = shownCommentsCount(commentsCount, comments);
    if (synced !== commentsCount) onCountChange(synced);
  }, [loading, comments, commentsCount, onCountChange]);

  const { roots, children } = useMemo(() => buildCommentReplyTree(comments), [comments]);

  const toggleLike = (commentId: string) => {
    const key = interactionKey(postId, commentId);
    setInteractions((prev) => {
      const cur = prev[key] ?? { liked: false, disliked: false };
      const liked = !cur.liked;
      return { ...prev, [key]: { liked, disliked: liked ? false : cur.disliked } };
    });
  };

  const toggleDislike = (commentId: string) => {
    const key = interactionKey(postId, commentId);
    setInteractions((prev) => {
      const cur = prev[key] ?? { liked: false, disliked: false };
      const disliked = !cur.disliked;
      return { ...prev, [key]: { disliked, liked: disliked ? false : cur.liked } };
    });
  };

  const onReplyPress = (c: HomeComment) => {
    const clean = String(c.user || "").replace(/^@/, "").trim();
    setReplyingTo({ id: String(c.id), user: clean || c.user });
    const mention = clean ? `@${clean} ` : "";
    setDraft((d) => (d.trim() ? d : mention));
  };

  const viewerOwnsComment = (c: HomeComment) => {
    const uid = Number(user?.id);
    if (c.userId && uid > 0) return Number(c.userId) === uid;
    const mine = String(user?.fullName || "").trim().toLowerCase();
    return !!mine && mine === String(c.user || "").trim().toLowerCase();
  };

  const confirmDelete = async (c: HomeComment) => {
    if (!token) return;
    if (!window.confirm("Delete this comment?")) return;
    setError(null);
    try {
      const res = await deleteHomePostComment(token, postId, Number(c.id));
      setComments((prev) => prev.filter((row) => String(row.id) !== String(c.id)));
      onCountChange(res.commentsCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete comment");
    }
  };

  const submit = async () => {
    const text = draft.trim();
    if (!text || !token || submitting) return;
    const parentNum = replyingTo ? Number(replyingTo.id) : NaN;
    const parentCommentId = Number.isFinite(parentNum) && parentNum > 0 ? parentNum : undefined;
    setSubmitting(true);
    setError(null);
    try {
      const res = await createHomePostComment(token, postId, text, { parentCommentId });
      const normalized = normalizeCommentRow(res.comment as HomeComment & Record<string, unknown>);
      setComments((prev) => [...prev, normalized]);
      setDraft("");
      setReplyingTo(null);
      onCountChange(res.commentsCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  };

  const renderCommentRow = (c: HomeComment, depth: number): ReactNode => {
    const ikey = interactionKey(postId, String(c.id));
    const inter = interactions[ikey] ?? { liked: false, disliked: false };
    const likeCount = Math.max(0, Number(c.likes || 0) + (inter.liked ? 1 : 0));
    const rel = formatCommentRelativeTime(c.createdAt);
    const indent = Math.min(4, depth) * COMMENT_REPLY_INDENT;

    return (
      <div key={`${c.id}-${depth}`} className="comment-panel__block" style={{ marginLeft: indent }}>
        <div className="comment-panel__row">
          <span className="comment-panel__avatar">
            {c.avatarUrl ? <img src={c.avatarUrl} alt="" /> : c.user.charAt(0).toUpperCase()}
          </span>
          <div className="comment-panel__main">
            <div className="comment-panel__header-row">
              <strong>{c.user}</strong>
              {rel ? <span className="comment-panel__time">{rel}</span> : null}
            </div>
            <p className="comment-panel__body">{c.text}</p>
            <div className="comment-panel__reply-row">
              <button type="button" className="comment-panel__reply-btn" onClick={() => onReplyPress(c)}>
                Reply
              </button>
              {viewerOwnsComment(c) ? (
                <button type="button" className="comment-panel__delete-btn" onClick={() => void confirmDelete(c)}>
                  Delete
                </button>
              ) : null}
            </div>
          </div>
          <div className="comment-panel__actions-col">
            <button
              type="button"
              className={`comment-panel__action${inter.liked ? " comment-panel__action--liked" : ""}`}
              onClick={() => toggleLike(String(c.id))}
              aria-label="Like comment"
            >
              <ReelIcon name="heart" filled={inter.liked} size={18} color={inter.liked ? "#c9ff35" : "#9ca3af"} />
              <span>{likeCount}</span>
            </button>
            <button
              type="button"
              className={`comment-panel__action${inter.disliked ? " comment-panel__action--disliked" : ""}`}
              onClick={() => toggleDislike(String(c.id))}
              aria-label="Dislike comment"
            >
              <ReelIcon name="thumbs-down" filled={inter.disliked} size={17} color={inter.disliked ? "#f87171" : "#9ca3af"} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderBranch = (c: HomeComment, depth: number): ReactNode => {
    const direct = children.get(String(c.id)) ?? [];
    const needsMore = direct.length > REPLY_PREVIEW_VISIBLE;
    const expanded = !!expandedReplies[String(c.id)];
    const shown = needsMore && !expanded ? direct.slice(0, REPLY_PREVIEW_VISIBLE) : direct;
    const moreCount = needsMore && !expanded ? direct.length - REPLY_PREVIEW_VISIBLE : 0;
    const hideIndent = Math.min(4, depth + 1) * COMMENT_REPLY_INDENT;

    return (
      <>
        {renderCommentRow(c, depth)}
        {shown.map((child) => renderBranch(child, depth + 1))}
        {moreCount > 0 ? (
          <button
            type="button"
            className="comment-panel__view-more"
            style={{ marginLeft: hideIndent }}
            onClick={() => setExpandedReplies((p) => ({ ...p, [String(c.id)]: true }))}
          >
            <span className="comment-panel__view-more-line" aria-hidden />
            View {moreCount} more {moreCount === 1 ? "reply" : "replies"}
          </button>
        ) : null}
        {needsMore && expanded ? (
          <button
            type="button"
            className="comment-panel__view-more comment-panel__view-more--hide"
            style={{ marginLeft: hideIndent }}
            onClick={() => setExpandedReplies((p) => ({ ...p, [String(c.id)]: false }))}
          >
            <span className="comment-panel__view-more-line" aria-hidden />
            Hide replies
          </button>
        ) : null}
      </>
    );
  };

  const placeholder = commentPlaceholderForPost(postUserName, replyingTo?.user ?? null);
  const displayCount = shownCommentsCount(commentsCount, comments);

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
          {!inline ? (
            <button type="button" className="comment-panel__chevron" onClick={onClose} aria-label="Close comments">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M6 9l6 6 6-6" stroke="#c9ff35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : null}
          <strong className="comment-panel__title">Comments</strong>
          {inline ? (
            <button type="button" className="comment-panel__close-inline" onClick={onClose} aria-label="Close">
              ×
            </button>
          ) : (
            <span className="comment-panel__head-spacer" />
          )}
        </header>

        <div className="comment-panel__list">
          {loading ? <p className="comment-panel__status">Loading…</p> : null}
          {error ? <p className="comment-panel__error">{error}</p> : null}
          {!loading && roots.length === 0 ? <p className="comment-panel__status">No comments yet.</p> : null}
          {roots.map((r) => renderBranch(r, 0))}
        </div>

        {token ? (
          <footer className="comment-panel__composer">
            {replyingTo ? (
              <div className="comment-panel__replying">
                <span>Replying to @{String(replyingTo.user || "").replace(/^@/, "")}</span>
                <button type="button" onClick={() => setReplyingTo(null)}>
                  Cancel
                </button>
              </div>
            ) : null}
            <div className="comment-panel__emoji-row">
              {COMMENT_QUICK_EMOJIS.map((emoji) => (
                <button key={emoji} type="button" onClick={() => setDraft((d) => `${d}${emoji}`)} aria-label={`Add ${emoji}`}>
                  {emoji}
                </button>
              ))}
            </div>
            <div className="comment-panel__input-row">
              <span className="comment-panel__composer-avatar">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" />
                ) : (
                  (user?.fullName || "Y").charAt(0).toUpperCase()
                )}
              </span>
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={placeholder}
                maxLength={2000}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void submit();
                  }
                }}
              />
              <button type="button" className="comment-panel__send" disabled={!draft.trim() || submitting} onClick={() => void submit()}>
                Post
              </button>
            </div>
          </footer>
        ) : (
          <p className="comment-panel__login-hint">Log in to comment.</p>
        )}
        {!inline && displayCount > 0 ? (
          <p className="comment-panel__count-foot" aria-hidden>
            {displayCount} {displayCount === 1 ? "comment" : "comments"}
          </p>
        ) : null}
      </div>
    </div>
  );

  if (!portal || inline || typeof document === "undefined") return content;
  return createPortal(content, document.body);
}
