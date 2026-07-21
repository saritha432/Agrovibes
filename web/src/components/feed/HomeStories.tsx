import { useEffect, useMemo, useState } from "react";
import type { HomeStory } from "../../api/types";
import { markHomeStoryViewed } from "../../api/home";
import { UserAvatar } from "../messages/UserAvatar";
import { groupHomeStories } from "../../utils/storyUtils";
import { resolveWebVideoUrl } from "../../utils/videoUrl";
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

  const { ownStories, otherGroups } = useMemo(
    () => groupHomeStories(stories, viewerId ?? null),
    [stories, viewerId]
  );

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
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, queueIndex, queue.length]);

  const ownHasNew = ownStories.some((s) => !storySeen(s));

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
  onClose,
  onNext,
  onPrev
}: {
  active: HomeStory;
  activeMedia: string;
  isVideo: boolean;
  queueIndex: number;
  queueLength: number;
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
        <div className="story-viewer__progress" aria-hidden>
          {Array.from({ length: queueLength }, (_, i) => (
            <span key={i} className={`story-viewer__seg${i <= queueIndex ? " story-viewer__seg--on" : ""}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
