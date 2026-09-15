import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { HomeStory } from "../../api/types";
import { likeHomeStory, markHomeStoryViewed, replyToHomeStory } from "../../api/home";
import { UserAvatar } from "../messages/UserAvatar";
import { ReelIcon } from "./ReelIcon";
import { groupHomeStories } from "../../utils/storyUtils";
import { resolveWebVideoUrl } from "../../utils/videoUrl";
import { onStoryViewed } from "../../services/socketChat";
import "./HomeStories.css";

type Props = {
  stories: HomeStory[];
  viewerName: string;
  viewerAvatarUrl?: string | null;
  viewerId?: number | null;
  token?: string | null;
};

export function HomeStories({ stories, viewerName, viewerAvatarUrl, viewerId, token }: Props) {
  const [viewedIds, setViewedIds] = useState<Set<number>>(() => new Set());
  const [queue, setQueue] = useState<HomeStory[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [likedIds, setLikedIds] = useState<Set<number>>(() => new Set());
  const [replyDraft, setReplyDraft] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);

  const { ownStories, otherGroups } = useMemo(
    () => groupHomeStories(stories, viewerId ?? null),
    [stories, viewerId]
  );

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
  };

  const markViewed = (story: HomeStory) => {
    setViewedIds((prev) => {
      if (prev.has(story.id)) return prev;
      const next = new Set(prev);
      next.add(story.id);
      return next;
    });
    const ownerId = Number(story.userId);
    const viewer = Number(viewerId);
    const isOwn = Number.isFinite(ownerId) && Number.isFinite(viewer) && ownerId === viewer;
    if (token && !isOwn && !story.viewed) {
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
      if (e.key === "Escape") closeViewer();
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (typing) return;
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, queueIndex, queue.length]);

  const ownHasNew = ownStories.some((s) => !storySeen(s));
  const isOwnActive = (() => {
    const ownerId = Number(active?.userId);
    const viewer = Number(viewerId);
    if (Number.isFinite(ownerId) && Number.isFinite(viewer) && ownerId === viewer) return true;
    return String(active?.userName || "").trim().toLowerCase() === "you";
  })();

  useEffect(() => {
    setReplyDraft("");
  }, [active?.id]);

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
          liked={likedIds.has(active.id)}
          likeBusy={likeBusy}
          replyDraft={replyDraft}
          replyBusy={replyBusy}
          onReplyDraftChange={setReplyDraft}
          onLike={() => void likeStory()}
          onSend={(e) => void sendReply(e)}
          onClose={closeViewer}
          onNext={goNext}
          onPrev={goPrev}
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
  liked,
  likeBusy,
  replyDraft,
  replyBusy,
  onReplyDraftChange,
  onLike,
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
  liked: boolean;
  likeBusy: boolean;
  replyDraft: string;
  replyBusy: boolean;
  onReplyDraftChange: (value: string) => void;
  onLike: () => void;
  onSend: (e?: FormEvent) => void;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  return (
    <div className="story-viewer" role="dialog" aria-modal="true" aria-label={`${active.userName} story`}>
      <button type="button" className="story-viewer__backdrop" onClick={onClose} aria-label="Close" />
      <div className="story-viewer__frame">
        <header className="story-viewer__header">
          <UserAvatar uri={active.avatarUrl} name={active.userName} size={32} />
          <span className="story-viewer__user">{active.userName}</span>
          <button type="button" className="story-viewer__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="story-viewer__media">
          {isVideo ? (
            <video key={activeMedia} src={activeMedia} controls autoPlay playsInline className="story-viewer__video" />
          ) : (
            <img src={activeMedia} alt="" className="story-viewer__image" />
          )}
        </div>
        <div className="story-viewer__nav">
          <button type="button" className="story-viewer__nav-zone story-viewer__nav-zone--left" onClick={onPrev} aria-label="Previous" />
          <button type="button" className="story-viewer__nav-zone story-viewer__nav-zone--right" onClick={onNext} aria-label="Next" />
        </div>
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
        ) : null}
        <div className="story-viewer__progress" aria-hidden>
          {Array.from({ length: queueLength }, (_, i) => (
            <span key={i} className={`story-viewer__seg${i <= queueIndex ? " story-viewer__seg--on" : ""}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
