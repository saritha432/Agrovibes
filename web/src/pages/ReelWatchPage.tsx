import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchHomePost } from "../api/home";
import type { HomePost } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { getWebAppOrigin } from "../api/client";
import { buildReelDeepLinkUrls, openReelInApp, pickReelAppOpenUrl, pickStoreUrl } from "../utils/appDeepLink";
import { resolveWebVideoUrl } from "../utils/videoUrl";
import "./ReelWatchPage.css";

function stripCaption(caption?: string | null) {
  return String(caption || "")
    .replace(/^\[REEL\]\s*/i, "")
    .replace(/^\[POST\]\s*/i, "")
    .trim();
}

function posterFor(post: HomePost) {
  return post.thumbnailUrl || post.imageUrl || post.imageUrls?.[0] || "";
}

export function ReelWatchPage() {
  const { postId } = useParams();
  const { token } = useAuth();
  const [post, setPost] = useState<HomePost | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const triedAppOpenRef = useRef(false);
  const webOrigin = getWebAppOrigin();

  const load = useCallback(async () => {
    const id = Number(postId);
    if (!Number.isFinite(id) || id <= 0) {
      setError("Invalid reel link.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { post: loaded } = await fetchHomePost(token, id);
      setPost(loaded);
    } catch {
      setPost(null);
      setError("This reel is unavailable or was removed.");
    } finally {
      setLoading(false);
    }
  }, [postId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const numericPostId = Number(postId);
  const appLink =
    Number.isFinite(numericPostId) && numericPostId > 0
      ? pickReelAppOpenUrl(numericPostId, webOrigin)
      : post
        ? pickReelAppOpenUrl(post.id, webOrigin)
        : "";

  useEffect(() => {
    if (triedAppOpenRef.current) return;
    const id = Number(postId);
    if (!Number.isFinite(id) || id <= 0) return;
    triedAppOpenRef.current = true;
    openReelInApp(id, webOrigin);
  }, [postId, webOrigin]);

  const handleOpenApp = (event: React.MouseEvent) => {
    event.preventDefault();
    const id = post?.id ?? numericPostId;
    if (!Number.isFinite(id) || id <= 0) return;
    openReelInApp(id, webOrigin);
  };

  const watchUrl =
    Number.isFinite(numericPostId) && numericPostId > 0
      ? buildReelDeepLinkUrls(numericPostId, webOrigin).httpsWatchUrl
      : "";

  const handleInstallApp = (event: React.MouseEvent) => {
    event.preventDefault();
    window.location.href = pickStoreUrl();
  };

  return (
    <div className="reel-watch">
      <header className="reel-watch__header">
        <span className="reel-watch__brand">Cropvibe</span>
        <div className="reel-watch__header-actions">
          <a className="reel-watch__install-app" href={pickStoreUrl()} onClick={handleInstallApp}>
            Install app
          </a>
          {appLink ? (
            <a className="reel-watch__open-app" href={appLink} onClick={handleOpenApp}>
              Open in app
            </a>
          ) : null}
        </div>
      </header>

      {loading ? <p className="reel-watch__status">Loading reel…</p> : null}
      {!loading && error ? <p className="reel-watch__status">{error}</p> : null}

      {!loading && post ? (
        <div className="reel-watch__body">
          <div className="reel-watch__player">
            {post.videoUrl ? (
              <video
                key={post.id}
                src={resolveWebVideoUrl(post.videoUrl) || post.videoUrl}
                poster={posterFor(post) || undefined}
                className="reel-watch__video"
                controls
                autoPlay
                playsInline
              />
            ) : posterFor(post) ? (
              <img src={posterFor(post)} alt="" className="reel-watch__image" />
            ) : (
              <div className="reel-watch__placeholder">No media</div>
            )}
          </div>
          <div className="reel-watch__meta">
            <strong>{post.userName}</strong>
            {stripCaption(post.caption) ? <p>{stripCaption(post.caption)}</p> : null}
            {watchUrl ? (
              <p className="reel-watch__hint">
                Prefer the app?{" "}
                <a href={appLink} onClick={handleOpenApp}>
                  Open in Cropvibe
                </a>
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
