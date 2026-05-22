import { useEffect, useState } from "react";
import { likeHomePost, unlikeHomePost } from "../../api/home";
import type { HomePost } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { useDynamicTranslations } from "../../localization/dynamicTranslation";
import { useLanguage } from "../../localization/LanguageContext";
import { resolveWebVideoUrl } from "../../utils/videoUrl";
import "./PostCard.css";

function isReel(post: HomePost) {
  return !!post.videoUrl && /^\[REEL\]/i.test(String(post.caption || "").trim());
}

function mediaUrl(post: HomePost) {
  return post.imageUrl || post.imageUrls?.[0] || post.thumbnailUrl || null;
}

export function PostCard({ post }: { post: HomePost }) {
  const { token } = useAuth();
  const { language } = useLanguage();
  const { getTranslation, requestTranslation } = useDynamicTranslations(token, language);
  const [liked, setLiked] = useState(!!post.viewerHasLiked);
  const [likes, setLikes] = useState(post.likesCount);
  const [busy, setBusy] = useState(false);

  const onLike = async () => {
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

  const img = mediaUrl(post);
  const videoSrc = resolveWebVideoUrl(post.videoUrl);
  const reel = isReel(post);
  const rawCaption = post.caption?.replace(/^\[(?:POST|REEL|LIVE|STORY)\]\s*/i, "").trim() || "";
  const caption = getTranslation(rawCaption, rawCaption);

  useEffect(() => {
    if (rawCaption) void requestTranslation(rawCaption, "caption");
  }, [rawCaption, requestTranslation]);

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

      <div className="post-card__media">
        {videoSrc ? (
          <video src={videoSrc} controls playsInline className="post-card__video" />
        ) : img ? (
          <img src={img} alt="" className="post-card__img" />
        ) : (
          <div className="post-card__placeholder">{reel ? "Reel" : "Post"}</div>
        )}
      </div>

      <div className="post-card__actions">
        <button type="button" onClick={onLike} disabled={!token || busy} aria-pressed={liked}>
          {liked ? "♥" : "♡"} {likes}
        </button>
        <span>💬 {post.commentsCount}</span>
      </div>

      {caption ? <p className="post-card__caption">{caption}</p> : null}
    </article>
  );
}
