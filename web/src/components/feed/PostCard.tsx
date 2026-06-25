import { useEffect, useRef, useState } from "react";
import { likeHomePost, unlikeHomePost } from "../../api/home";
import type { HomePost } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { dropCaption, isDropPost } from "../../utils/feedOrder";
import { ProfileReelViewer } from "../profile/ProfileReelViewer";
import { resolveWebVideoUrl } from "../../utils/videoUrl";
import { CommentPanel } from "./CommentPanel";
import { PostMediaCarousel } from "./PostMediaCarousel";
import { ReelIcon } from "./ReelIcon";
import "./PostCard.css";

function isReel(post: HomePost) {
  return isDropPost(post);
}

function galleryUrls(post: HomePost) {
  const urls = (post.imageUrls || []).filter(Boolean);
  if (urls.length) return urls;
  if (post.imageUrl) return [post.imageUrl];
  return [];
}

type Props = {
  post: HomePost;
  reelPosts?: HomePost[];
};

export function PostCard({ post, reelPosts = [] }: Props) {
  const { token } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const [liked, setLiked] = useState(!!post.viewerHasLiked);
  const [likes, setLikes] = useState(post.likesCount);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inView, setInView] = useState(false);
  const [muted, setMuted] = useState(true);
  const [reelViewerOpen, setReelViewerOpen] = useState(false);

  const images = galleryUrls(post);
  const videoSrc = resolveWebVideoUrl(post.videoUrl);
  const reel = isReel(post);
  const caption = dropCaption(post.caption);
  const poster = post.thumbnailUrl || post.imageUrl || post.imageUrls?.[0] || undefined;
  const likeColor = liked ? "#c9ff35" : "currentColor";

  const reelList = reelPosts.length ? reelPosts : reel && videoSrc ? [post] : [];
  const reelIndex = reelList.findIndex((p) => p.id === post.id);

  useEffect(() => {
    const root = mediaRef.current;
    if (!root || !videoSrc) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting && entry.intersectionRatio >= 0.45);
      },
      { threshold: [0.35, 0.45, 0.55, 0.7] }
    );

    observer.observe(root);
    return () => observer.disconnect();
  }, [videoSrc]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !videoSrc) return;

    if (inView) {
      el.muted = muted;
      void el.play().catch(() => {
        el.muted = true;
        setMuted(true);
        void el.play().catch(() => {});
      });
    } else {
      el.pause();
      if (!reel) el.currentTime = 0;
    }
  }, [inView, videoSrc, muted, reel]);

  const toggleLike = async () => {
    if (!token || busy) return;
    setBusy(true);
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
      setBusy(false);
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

  const openReelFullscreen = () => {
    if (!reel || !videoSrc) return;
    setReelViewerOpen(true);
  };

  return (
    <article className={`post-card${reel ? " post-card--reel" : ""}`}>
      <header className="post-card__head">
        <span className="post-card__avatar">
          {post.authorAvatarUrl ? (
            <img src={post.authorAvatarUrl} alt="" />
          ) : (
            post.userName.charAt(0).toUpperCase()
          )}
        </span>
        <div className="post-card__meta">
          <strong>{post.userName}</strong>
          {post.location ? <span>{post.location}</span> : null}
        </div>
      </header>

      <div
        ref={mediaRef}
        className={`post-card__media${reel ? " post-card__media--reel" : ""}`}
        onDoubleClick={reel ? openReelFullscreen : undefined}
      >
        {videoSrc ? (
          <video
            ref={videoRef}
            src={videoSrc}
            poster={poster}
            playsInline
            loop
            muted={muted}
            className="post-card__video"
          />
        ) : images.length ? (
          <PostMediaCarousel urls={images} />
        ) : (
          <div className="post-card__placeholder">{reel ? "Reel" : "Post"}</div>
        )}
      </div>

      <div className="post-card__actions">
        <div className="post-card__actions-left">
          <button
            type="button"
            onClick={() => void toggleLike()}
            disabled={!token || busy}
            aria-pressed={liked}
            aria-label="Like"
          >
            <ReelIcon name="heart" filled={liked} size={25} color={likeColor} />
          </button>
          <button
            type="button"
            onClick={() => setCommentsOpen(true)}
            className="post-card__comment-btn"
            aria-label="Comments"
          >
            <ReelIcon name="comment" size={23} color="currentColor" />
          </button>
          <button type="button" onClick={() => void sharePost()} aria-label="Share">
            <ReelIcon name="share" size={22} color="currentColor" />
          </button>
        </div>
        <button type="button" className="post-card__save-btn" aria-label="Save" disabled>
          <ReelIcon name="bookmark" size={22} color="currentColor" />
        </button>
      </div>

      {likes > 0 ? <p className="post-card__likes">{likes} {likes === 1 ? "like" : "likes"}</p> : null}

      {caption ? (
        <p className="post-card__caption">
          <strong>{post.userName}</strong> {caption}
        </p>
      ) : null}

      {commentsCount > 0 ? (
        <button type="button" className="post-card__view-comments" onClick={() => setCommentsOpen(true)}>
          View all {commentsCount} comments
        </button>
      ) : null}

      {commentsOpen ? (
        <CommentPanel
          postId={post.id}
          commentsCount={commentsCount}
          onClose={() => setCommentsOpen(false)}
          onCountChange={setCommentsCount}
        />
      ) : null}

      {reelViewerOpen && reelList.length ? (
        <ProfileReelViewer
          posts={reelList}
          initialIndex={reelIndex >= 0 ? reelIndex : 0}
          onClose={() => setReelViewerOpen(false)}
        />
      ) : null}
    </article>
  );
}
