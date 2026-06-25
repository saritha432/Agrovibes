import { useMemo } from "react";
import type { HomePost } from "../../api/types";
import { reelGridStillUri } from "../../pages/profileUtils";
import { resolveWebVideoUrl } from "../../utils/videoUrl";

function GridPlayBadge() {
  return (
    <span className="profile-grid__play" aria-hidden>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5v14l11-7L8 5z" />
      </svg>
    </span>
  );
}

export function ProfileGridTile({
  post,
  isReelTab,
  allowMutedPreview,
  onOpenReel,
  onOpenImage,
  onDelete
}: {
  post: HomePost;
  isReelTab: boolean;
  allowMutedPreview: boolean;
  onOpenReel: () => void;
  onOpenImage: () => void;
  onDelete?: () => void;
}) {
  const still = reelGridStillUri(post);
  const isVideo = !!post.videoUrl;
  const cover = post.imageUrl || post.imageUrls?.[0] || post.thumbnailUrl || still || null;
  const videoSrc = useMemo(() => resolveWebVideoUrl(post.videoUrl), [post.videoUrl]);

  const tileClass = `profile-grid__tile${isReelTab ? " profile-grid__tile--reel" : ""}`;

  if (isVideo) {
    return (
      <button
        type="button"
        className={tileClass}
        onClick={onOpenReel}
        onContextMenu={(e) => {
          if (!onDelete) return;
          e.preventDefault();
          onDelete();
        }}
      >
        {still || cover ? (
          <img src={still || cover || ""} alt="" loading="lazy" />
        ) : allowMutedPreview && videoSrc ? (
          <video
            className="profile-grid__preview-video"
            src={videoSrc}
            muted
            playsInline
            preload="metadata"
            aria-hidden
          />
        ) : (
          <span className="profile-grid__video-ph" aria-hidden>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7L8 5z" />
            </svg>
          </span>
        )}
        <GridPlayBadge />
      </button>
    );
  }

  return (
    <button
      type="button"
      className={tileClass}
      onClick={() => (cover ? onOpenImage() : undefined)}
      onContextMenu={(e) => {
        if (!onDelete) return;
        e.preventDefault();
        onDelete();
      }}
      disabled={!cover}
    >
      {cover ? (
        <img src={cover} alt="" loading="lazy" />
      ) : (
        <span className="profile-grid__leaf-ph" aria-hidden>
          🌿
        </span>
      )}
      {post.imageUrls && post.imageUrls.length > 1 ? (
        <span className="profile-grid__album" aria-hidden>
          ⧉
        </span>
      ) : null}
    </button>
  );
}
