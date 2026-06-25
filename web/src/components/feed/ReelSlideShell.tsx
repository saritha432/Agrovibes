import { useEffect, useRef, useState } from "react";
import { likeHomePost, saveHomePost, unlikeHomePost, unsaveHomePost } from "../../api/home";
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
  sideComments?: boolean;
  initialCommentsOpen?: boolean;
};

export function ReelSlideShell({
  post,
  active,
  showActions = true,
  sideComments = false,
  initialCommentsOpen = false
}: Props) {
  const { token } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const tapTimeoutRef = useRef<number | null>(null);
  const lastTapRef = useRef(0);
  const src = resolveWebVideoUrl(post.videoUrl);
  const [muted, setMuted] = useState(true);
  const [liked, setLiked] = useState(!!post.viewerHasLiked);
  const [likes, setLikes] = useState(post.likesCount);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [likeBurst, setLikeBurst] = useState(0);
  const [saved, setSaved] = useState(!!post.viewerHasSaved);
  const [saveBusy, setSaveBusy] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);

  const poster = post.thumbnailUrl || post.imageUrl || post.imageUrls?.[0] || undefined;
  const caption = dropCaption(post.caption);

  useEffect(() => {
    setLiked(!!post.viewerHasLiked);
    setLikes(post.likesCount);
    setCommentsCount(post.commentsCount);
    setSaved(!!post.viewerHasSaved);
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

  useEffect(() => {
    if (!initialCommentsOpen) return;
    setCommentsOpen(true);
  }, [initialCommentsOpen, post.id]);

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
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
          window.alert("Link copied.");
        } else {
          window.prompt("Copy this link:", url);
        }
      }
    } catch {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(url);
          window.alert("Link copied.");
        } catch {
          window.prompt("Copy this link:", url);
        }
      } else {
        window.prompt("Copy this link:", url);
      }
    }
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    const el = videoRef.current;
    if (el) el.muted = next;
  };

  const toggleSave = async () => {
    if (!token || saveBusy) return;
    const next = !saved;
    setSaved(next);
    setSaveBusy(true);
    try {
      const res = next ? await saveHomePost(token, post.id) : await unsaveHomePost(token, post.id);
      setSaved(!!res.saved);
      setOptionsOpen(false);
    } catch {
      setSaved(!next);
      window.alert("Could not update saved posts. Please try again.");
    } finally {
      setSaveBusy(false);
    }
  };

  const likeFromDoubleTap = async () => {
    setLikeBurst((n) => n + 1);
    if (!token || liked || likeBusy) return;
    await toggleLike();
  };

  const onSurfaceTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current <= 280) {
      if (tapTimeoutRef.current) {
        window.clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }
      lastTapRef.current = 0;
      void likeFromDoubleTap();
      return;
    }
    lastTapRef.current = now;
    if (tapTimeoutRef.current) window.clearTimeout(tapTimeoutRef.current);
    tapTimeoutRef.current = window.setTimeout(() => {
      tapTimeoutRef.current = null;
      const el = videoRef.current;
      if (!el) return;
      if (el.muted || muted) {
        setMuted(false);
        el.muted = false;
      }
    }, 280);
  };

  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) {
        window.clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }
    };
  }, []);

  return (
    <section className={`reel-slide${sideComments && commentsOpen ? " reel-slide--with-side-comments" : ""}`}>
      <div className="reel-slide__stage">
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
            onClick={onSurfaceTap}
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
            onMore={() => setOptionsOpen(true)}
            onMute={toggleMute}
          />
        ) : null}

        <div className="reel-slide__meta">
          <strong>{post.userName}</strong>
          {caption ? <p>{caption}</p> : null}
        </div>
      </div>

      {commentsOpen ? (
        <CommentPanel
          postId={post.id}
          commentsCount={commentsCount}
          onClose={() => setCommentsOpen(false)}
          onCountChange={setCommentsCount}
          portal={!sideComments}
          sidecar={sideComments}
        />
      ) : null}

      {optionsOpen ? (
        <div className="reel-slide__options" role="dialog" aria-modal="true" aria-label="Reel options">
          <button className="reel-slide__options-backdrop" type="button" onClick={() => setOptionsOpen(false)} />
          <div className="reel-slide__options-sheet">
            <button type="button" onClick={() => void toggleSave()} disabled={!token || saveBusy}>
              {saved ? "Remove from saved" : "Save"}
            </button>
            <button
              type="button"
              onClick={async () => {
                const url = `${window.location.origin}/watch/${post.id}`;
                try {
                  if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(url);
                    window.alert("Link copied.");
                  } else {
                    window.prompt("Copy this link:", url);
                  }
                } finally {
                  setOptionsOpen(false);
                }
              }}
            >
              Copy link
            </button>
            <button
              type="button"
              onClick={() => {
                window.alert("Report submitted.");
                setOptionsOpen(false);
              }}
            >
              Report
            </button>
            <button type="button" onClick={() => setOptionsOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
