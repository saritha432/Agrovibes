import { useEffect, useRef, useState } from "react";
import { likeHomePost, unlikeHomePost } from "../../api/home";
import type { HomePost } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { dropCaption } from "../../utils/feedOrder";
import { resolveWebVideoUrl } from "../../utils/videoUrl";
import { CommentPanel } from "./CommentPanel";
import { ReelActionsRail } from "./ReelActionsRail";
import { ReelLikeBurst } from "./ReelLikeBurst";
import "./ReelSlideShell.css";

type Props = {
  post: HomePost;
  active: boolean;
  showActions?: boolean;
};

export function ReelSlideShell({ post, active, showActions = true }: Props) {
  const { token } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const src = resolveWebVideoUrl(post.videoUrl);
  const [muted, setMuted] = useState(true);
  const [liked, setLiked] = useState(!!post.viewerHasLiked);
  const [likes, setLikes] = useState(post.likesCount);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [likeBurst, setLikeBurst] = useState(0);

  const poster = post.thumbnailUrl || post.imageUrl || post.imageUrls?.[0] || undefined;
  const caption = dropCaption(post.caption);

  useEffect(() => {
    setLiked(!!post.viewerHasLiked);
    setLikes(post.likesCount);
    setCommentsCount(post.commentsCount);
  }, [post.viewerHasLiked, post.likesCount, post.commentsCount]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !src) return;
    if (active) {
      el.muted = muted;
      void el.play().catch(() => {
        el.muted = true;
        setMuted(true);
        void el.play().catch(() => {});
      });
    } else {
      el.pause();
      el.currentTime = 0;
    }
  }, [active, src, muted]);

  useEffect(() => {
    if (active) return;
    setCommentsOpen(false);
  }, [active]);

  const toggleLike = async () => {
    if (!token || likeBusy) return;
    if (!liked) setLikeBurst((n) => n + 1);
    setLikeBusy(true);
    try {
      if (liked) {
        const res = await unlikeHomePost(token, post.id);
        setLiked(res.liked);
        setLikes(res.likesCount);
      } else {
        const res = await likeHomePost(token, post.id);
        setLiked(res.liked);
        setLikes(res.likesCount);
      }
    } catch {
      // ignore
    } finally {
      setLikeBusy(false);
    }
  };

  const sharePost = async () => {
    const url = `${window.location.origin}/watch/${post.id}`;
    const text = caption ? `${post.userName}: ${caption}` : post.userName;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Cropvibe", text, url });
      } else {
        await navigator.clipboard.writeText(url);
        window.alert("Link copied.");
      }
    } catch {
      // cancelled
    }
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    const el = videoRef.current;
    if (el) el.muted = next;
  };

  return (
    <section className="reel-slide">
      {src ? (
        <video
          ref={videoRef}
          className="reel-slide__video"
          src={src}
          poster={poster}
          playsInline
          loop
          muted={muted}
          autoPlay={active}
          onClick={() => {
            const el = videoRef.current;
            if (!el) return;
            if (el.paused) void el.play();
            else el.pause();
          }}
        />
      ) : (
        <div className="reel-slide__missing">Video unavailable</div>
      )}

      <ReelLikeBurst postId={post.id} trigger={likeBurst} />
      <div className="reel-slide__gradient" aria-hidden />

      {showActions ? (
        <ReelActionsRail
          liked={liked}
          likes={likes}
          commentsCount={commentsCount}
          muted={muted}
          likeBusy={likeBusy || !token}
          discUrl={poster}
          onLike={() => void toggleLike()}
          onComment={() => setCommentsOpen(true)}
          onShare={() => void sharePost()}
          onMute={toggleMute}
        />
      ) : null}

      <div className="reel-slide__meta">
        <strong>{post.userName}</strong>
        {caption ? <p>{caption}</p> : null}
      </div>

      {commentsOpen ? (
        <CommentPanel
          postId={post.id}
          commentsCount={commentsCount}
          onClose={() => setCommentsOpen(false)}
          onCountChange={setCommentsCount}
        />
      ) : null}
    </section>
  );
}
