import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import type { HomeStory } from "../../api/types";
import {
  deleteHomeStory,
  fetchHomeStoryViewers,
  likeHomeStory,
  markHomeStoryViewed,
  replyToHomeStory,
  type HomeStoryViewer
} from "../../api/home";
import { UserAvatar } from "../messages/UserAvatar";
import { ReelIcon } from "./ReelIcon";
import { groupHomeStories, isOwnHomeStory } from "../../utils/storyUtils";
import { webProfilePath } from "../../utils/profilePath";
import { resolveWebVideoUrl } from "../../utils/videoUrl";
import { onStoryViewed } from "../../services/socketChat";
import "./HomeStories.css";

type Props = {
  stories: HomeStory[];
  viewerName: string;
  viewerAvatarUrl?: string | null;
  viewerId?: number | null;
  viewerUsername?: string | null;
  token?: string | null;
  onStoryDeleted?: (storyId: number) => void;
};

export function HomeStories({
  stories,
  viewerName,
  viewerAvatarUrl,
  viewerId,
  viewerUsername,
  token,
  onStoryDeleted
}: Props) {
  const [viewedIds, setViewedIds] = useState<Set<number>>(() => new Set());
  const [queue, setQueue] = useState<HomeStory[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [likedIds, setLikedIds] = useState<Set<number>>(() => new Set());
  const [replyDraft, setReplyDraft] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewers, setViewers] = useState<HomeStoryViewer[]>([]);
  const [viewersCount, setViewersCount] = useState(0);
  const [viewersLoading, setViewersLoading] = useState(false);

  const { ownStories, otherGroups } = useMemo(
    () => groupHomeStories(stories, viewerId ?? null, viewerName, viewerUsername),
    [stories, viewerId, viewerName, viewerUsername]
  );

  useEffect(() => {
    const ids = new Set(stories.map((story) => story.id));
    setQueue((prev) => {
      const next = prev.filter((story) => ids.has(story.id));
      return next.length === prev.length ? prev : next;
    });
  }, [stories]);

  useEffect(() => {
    setViewedIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const story of stories) {
        if (story.viewed && !next.has(story.id)) {
          next.add(story.id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [stories]);

  useEffect(() => {
    return onStoryViewed((payload) => {
      const id = Number(payload?.storyId);
      if (!Number.isFinite(id) || id <= 0) return;
      setViewedIds((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    });
  }, []);

  const active = queue[queueIndex] ?? null;
  const activeMedia = active?.imageUrl || resolveWebVideoUrl(active?.videoUrl) || null;
  const isVideo = !!active?.videoUrl && !active?.imageUrl;

  const openQueue = (list: HomeStory[]) => {
    const playable = list.filter((s) => s.videoUrl || s.imageUrl);
    if (!playable.length) return;
    setQueue(playable);
    setQueueIndex(0);
  };

  const closeViewer = () => {
    setQueue([]);
    setQueueIndex(0);
    setReplyDraft("");
    setViewersOpen(false);
    setViewers([]);
    setViewersCount(0);
  };

  const loadStoryViewers = useCallback(
    async (storyId: number) => {
      if (!token || !Number.isFinite(storyId) || storyId <= 0) {
        setViewers([]);
        setViewersCount(0);
        return;
      }
      setViewersLoading(true);
      try {
        const data = await fetchHomeStoryViewers(token, storyId);
        setViewers(Array.isArray(data.viewers) ? data.viewers : []);
        setViewersCount(Number(data.count) || 0);
      } catch {
        setViewers([]);
        setViewersCount(0);
      } finally {
        setViewersLoading(false);
      }
    },
    [token]
  );

  const markViewed = (story: HomeStory) => {
    setViewedIds((prev) => {
      if (prev.has(story.id)) return prev;
      const next = new Set(prev);
      next.add(story.id);
      return next;
    });
    if (token && !isOwnHomeStory(story, viewerId, viewerName, viewerUsername) && !story.viewed) {
      void markHomeStoryViewed(token, story.id).catch(() => {});
    }
  };

  const storySeen = (story: HomeStory) => story.viewed || viewedIds.has(story.id);

  const goNext = () => {
    if (!active) return;
    markViewed(active);
    if (queueIndex >= queue.length - 1) {
      closeViewer();
      return;
    }
    setQueueIndex((i) => i + 1);
  };

  const goPrev = () => {
    if (queueIndex <= 0) return;
    setQueueIndex((i) => i - 1);
  };

  useEffect(() => {
    if (!active) return;
    markViewed(active);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (viewersOpen) {
          e.stopPropagation();
          setViewersOpen(false);
          return;
        }
        closeViewer();
      }
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (typing) return;
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, queueIndex, queue.length, viewersOpen]);

  const ownHasNew = ownStories.some((s) => !storySeen(s));
  const isOwnActive = isOwnHomeStory(active, viewerId, viewerName, viewerUsername);

  useEffect(() => {
    setReplyDraft("");
    setViewersOpen(false);
    if (token && isOwnActive && active?.id) {
      void loadStoryViewers(active.id);
      return;
    }
    setViewers([]);
    setViewersCount(0);
  }, [active?.id, isOwnActive, loadStoryViewers, token]);

  const sendReply = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!token || !active || isOwnActive || replyBusy) return;
    const text = replyDraft.trim();
    if (!text) return;
    setReplyBusy(true);
    try {
      await replyToHomeStory(token, active.id, text);
      setReplyDraft("");
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not send reply.");
    } finally {
      setReplyBusy(false);
    }
  };

  const likeStory = async () => {
    if (!token || !active || isOwnActive || likeBusy || likedIds.has(active.id)) return;
    setLikeBusy(true);
    try {
      await likeHomeStory(token, active.id);
      setLikedIds((prev) => {
        const next = new Set(prev);
        next.add(active.id);
        return next;
      });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not like story.");
    } finally {
      setLikeBusy(false);
    }
  };

  const deleteStory = async () => {
    if (!token || !active || !isOwnActive || deleteBusy) return;
    if (!window.confirm("Delete this story?")) return;
    setDeleteBusy(true);
    try {
      await deleteHomeStory(token, active.id);
      const deletedId = active.id;
      const remaining = queue.filter((story) => story.id !== deletedId);
      onStoryDeleted?.(deletedId);
      window.dispatchEvent(new Event("cropvibe:feed-refresh"));
      if (!remaining.length) {
        closeViewer();
      } else {
        setQueue(remaining);
        setQueueIndex((index) => Math.min(index, remaining.length - 1));
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not delete story.");
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <>
      <StoriesRow
        ownHasNew={ownHasNew}
        ownStories={ownStories}
        otherGroups={otherGroups}
        viewerName={viewerName}
        viewerAvatarUrl={viewerAvatarUrl}
        storySeen={storySeen}
        onOpenQueue={openQueue}
      />

      {active && activeMedia ? (
        <StoryViewer
          active={active}
          activeMedia={activeMedia}
          isVideo={isVideo}
          queueIndex={queueIndex}
          queueLength={queue.length}
          canInteract={!!token && !isOwnActive}
          canDelete={!!token && isOwnActive}
          canViewViewers={!!token && isOwnActive}
          deleteBusy={deleteBusy}
          liked={likedIds.has(active.id)}
          likeBusy={likeBusy}
          replyDraft={replyDraft}
          replyBusy={replyBusy}
          viewersCount={viewersCount}
          viewersLoading={viewersLoading}
          onReplyDraftChange={setReplyDraft}
          onLike={() => void likeStory()}
          onDelete={() => void deleteStory()}
          onOpenViewers={() => setViewersOpen(true)}
          onSend={(e) => void sendReply(e)}
          onClose={closeViewer}
          onNext={goNext}
          onPrev={goPrev}
        />
      ) : null}

      {viewersOpen ? (
        <StoryViewersSheet
          viewers={viewers}
          count={viewersCount}
          loading={viewersLoading}
          viewerId={viewerId}
          onClose={() => setViewersOpen(false)}
        />
      ) : null}
    </>
  );
}

function StoriesRow({
  ownHasNew,
  ownStories,
  otherGroups,
  viewerName,
  viewerAvatarUrl,
  storySeen,
  onOpenQueue
}: {
  ownHasNew: boolean;
  ownStories: HomeStory[];
  otherGroups: ReturnType<typeof groupHomeStories>["otherGroups"];
  viewerName: string;
  viewerAvatarUrl?: string | null;
  storySeen: (story: HomeStory) => boolean;
  onOpenQueue: (list: HomeStory[]) => void;
}) {
  return (
    <div className="home-stories" aria-label="Stories">
      <div className="home-stories__scroll">
        <button
          type="button"
          className="home-stories__item"
          onClick={() => (ownStories.length ? onOpenQueue(ownStories) : undefined)}
          aria-label="Your story"
        >
          <span
            className={`home-stories__ring${
              ownStories.length
                ? ownHasNew
                  ? " home-stories__ring--new"
                  : " home-stories__ring--seen"
                : " home-stories__ring--empty"
            }`}
          >
            <UserAvatar uri={viewerAvatarUrl} name={viewerName} size={56} />
            <span className="home-stories__add" aria-hidden>
              +
            </span>
          </span>
          <span className="home-stories__name">Your story</span>
        </button>

        {otherGroups.map((group) => {
          const hasNew = group.stories.some((s) => !storySeen(s));
          return (
            <button
              key={group.key}
              type="button"
              className="home-stories__item"
              onClick={() => onOpenQueue(group.stories)}
            >
              <span
                className={`home-stories__ring${
                  hasNew ? " home-stories__ring--new" : " home-stories__ring--seen"
                }`}
              >
                <UserAvatar uri={group.avatarUrl} name={group.userName} size={56} />
              </span>
              <span className="home-stories__name">{group.userName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StoryViewer({
  active,
  activeMedia,
  isVideo,
  queueIndex,
  queueLength,
  canInteract,
  canDelete,
  canViewViewers,
  deleteBusy,
  liked,
  likeBusy,
  replyDraft,
  replyBusy,
  viewersCount,
  viewersLoading,
  onReplyDraftChange,
  onLike,
  onDelete,
  onOpenViewers,
  onSend,
  onClose,
  onNext,
  onPrev
}: {
  active: HomeStory;
  activeMedia: string;
  isVideo: boolean;
  queueIndex: number;
  queueLength: number;
  canInteract: boolean;
  canDelete: boolean;
  canViewViewers: boolean;
  deleteBusy: boolean;
  liked: boolean;
  likeBusy: boolean;
  replyDraft: string;
  replyBusy: boolean;
  viewersCount: number;
  viewersLoading: boolean;
  onReplyDraftChange: (value: string) => void;
  onLike: () => void;
  onDelete: () => void;
  onOpenViewers: () => void;
  onSend: (e?: FormEvent) => void;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  return (
    <div className="story-viewer" role="dialog" aria-modal="true" aria-label={`${active.userName} story`}>
      <button type="button" className="story-viewer__backdrop" onClick={onClose} aria-label="Close" />
      <div className="story-viewer__frame">
        <div className="story-viewer__progress" aria-hidden>
          {Array.from({ length: queueLength }, (_, i) => (
            <span key={i} className={`story-viewer__seg${i <= queueIndex ? " story-viewer__seg--on" : ""}`} />
          ))}
        </div>
        <header className="story-viewer__header">
          <UserAvatar uri={active.avatarUrl} name={active.userName} size={32} />
          <span className="story-viewer__user">{active.userName}</span>
          {canDelete ? (
            <button
              type="button"
              className="story-viewer__delete"
              onClick={onDelete}
              disabled={deleteBusy}
              aria-label="Delete story"
            >
              Delete
            </button>
          ) : null}
          <button type="button" className="story-viewer__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="story-viewer__media">
          {isVideo ? (
            <video key={activeMedia} src={activeMedia} autoPlay playsInline className="story-viewer__video" />
          ) : (
            <img src={activeMedia} alt="" className="story-viewer__image" />
          )}
        </div>
        <div className="story-viewer__nav">
          <button type="button" className="story-viewer__nav-zone story-viewer__nav-zone--left" onClick={onPrev} aria-label="Previous" />
          <button type="button" className="story-viewer__nav-zone story-viewer__nav-zone--right" onClick={onNext} aria-label="Next" />
        </div>
        {canViewViewers ? (
          <button type="button" className="story-viewer__viewers-overlay" onClick={onOpenViewers}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span>
              {viewersLoading ? "Viewers" : `${viewersCount} viewer${viewersCount === 1 ? "" : "s"}`}
            </span>
          </button>
        ) : null}
        {canInteract ? (
          <form className="story-viewer__actions" onSubmit={onSend} onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={replyDraft}
              onChange={(e) => onReplyDraftChange(e.target.value)}
              placeholder="Send message"
              maxLength={500}
              aria-label="Send message"
            />
            <button type="submit" className="story-viewer__send" disabled={!replyDraft.trim() || replyBusy} aria-label="Send">
              <ReelIcon name="share" size={18} color="#111" />
            </button>
            <button
              type="button"
              className={`story-viewer__like${liked ? " story-viewer__like--on" : ""}`}
              onClick={onLike}
              disabled={likeBusy || liked}
              aria-label="Like story"
              aria-pressed={liked}
            >
              <ReelIcon name="heart" filled={liked} size={26} color={liked ? "#ff2d55" : "#fff"} />
            </button>
          </form>
        ) : canViewViewers ? (
          <div className="story-viewer__actions story-viewer__actions--own" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="story-viewer__viewers-btn" onClick={onOpenViewers}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span>
                {viewersLoading
                  ? "Viewers"
                  : `${viewersCount} viewer${viewersCount === 1 ? "" : "s"}`}
              </span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StoryViewersSheet({
  viewers,
  count,
  loading,
  viewerId,
  onClose
}: {
  viewers: HomeStoryViewer[];
  count: number;
  loading: boolean;
  viewerId?: number | null;
  onClose: () => void;
}) {
  const content = (
    <div className="story-viewers-sheet" role="dialog" aria-modal="true" aria-label="Story viewers">
      <button type="button" className="story-viewers-sheet__backdrop" onClick={onClose} aria-label="Close" />
      <div className="story-viewers-sheet__panel">
        <div className="story-viewers-sheet__handle" aria-hidden />
        <header className="story-viewers-sheet__head">
          <strong>Viewers · {count}</strong>
          <button type="button" className="story-viewers-sheet__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="story-viewers-sheet__list">
          {loading ? <p className="story-viewers-sheet__status">Loading…</p> : null}
          {!loading && viewers.length === 0 ? <p className="story-viewers-sheet__status">No views yet</p> : null}
          {!loading
            ? viewers.map((viewer) => {
                const name = viewer.fullName?.trim() || viewer.username?.trim() || "User";
                const handle = viewer.username ? `@${String(viewer.username).replace(/^@+/, "")}` : "";
                const profilePath = webProfilePath(viewer.userId, viewerId);
                const row = (
                  <>
                    <UserAvatar uri={viewer.avatarUrl} name={name} size={40} />
                    <span className="story-viewers-sheet__meta">
                      <strong>{name}</strong>
                      {handle ? <span>{handle}</span> : null}
                    </span>
                  </>
                );
                return profilePath ? (
                  <Link
                    key={viewer.userId}
                    className="story-viewers-sheet__row"
                    to={profilePath}
                    onClick={onClose}
                  >
                    {row}
                  </Link>
                ) : (
                  <div key={viewer.userId} className="story-viewers-sheet__row">
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
