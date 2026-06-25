import { ReelIcon } from "./ReelIcon";
import "./ReelSlideShell.css";

type Props = {
  liked: boolean;
  likes: number;
  commentsCount: number;
  muted: boolean;
  likeBusy?: boolean;
  showMute?: boolean;
  showDisc?: boolean;
  discUrl?: string;
  onLike: () => void;
  onLikesPress?: () => void;
  onComment: () => void;
  onShare: () => void;
  onMore?: () => void;
  onMute?: () => void;
};

export function ReelActionsRail({
  liked,
  likes,
  commentsCount,
  muted,
  likeBusy = false,
  showMute = true,
  showDisc = true,
  discUrl,
  onLike,
  onLikesPress,
  onComment,
  onShare,
  onMore,
  onMute
}: Props) {
  return (
    <div className="reel-slide__actions">
      <div className="reel-slide__action-stack">
        <button
          type="button"
          className={`reel-slide__action${liked ? " reel-slide__action--liked" : ""}`}
          disabled={likeBusy}
          onClick={onLike}
          aria-label="Like"
        >
          <span className="reel-slide__action-icon">
            <ReelIcon name="heart" filled={liked} size={liked ? 24 : 22} color={liked ? "#c9ff35" : "#fff"} />
          </span>
        </button>
        <button
          type="button"
          className={`reel-slide__action-count-btn${liked ? " reel-slide__action-count--liked" : ""}`}
          disabled={!likes}
          onClick={onLikesPress}
          aria-label="View likes"
        >
          {likes}
        </button>
      </div>
      <button type="button" className="reel-slide__action" onClick={onComment} aria-label="Comments">
        <span className="reel-slide__action-icon">
          <ReelIcon name="comment" size={22} />
        </span>
        <span className="reel-slide__action-count">{commentsCount}</span>
      </button>
      <button type="button" className="reel-slide__action" onClick={onShare} aria-label="Share">
        <span className="reel-slide__action-icon">
          <ReelIcon name="share" size={22} />
        </span>
      </button>
      <button type="button" className="reel-slide__action" aria-label="More" onClick={onMore}>
        <span className="reel-slide__action-icon">
          <ReelIcon name="more" size={22} />
        </span>
      </button>
      {showMute && onMute ? (
        <button
          type="button"
          className="reel-slide__action reel-slide__action--mute"
          onClick={onMute}
          aria-label={muted ? "Unmute" : "Mute"}
        >
          <span className="reel-slide__action-icon">
            <ReelIcon name={muted ? "mute" : "unmute"} size={22} />
          </span>
        </button>
      ) : null}
      {showDisc && discUrl ? (
        <span className="reel-slide__disc">
          <img src={discUrl} alt="" />
        </span>
      ) : null}
    </div>
  );
}
