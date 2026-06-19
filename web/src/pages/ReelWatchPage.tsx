import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchHomePost } from "../api/home";
import type { HomePost } from "../api/types";
import { useAuth } from "../auth/AuthContext";
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

  const appLink = post ? `agrovibes://reel/${post.id}` : "";

  return (
    <div className="reel-watch">
      <header className="reel-watch__header">
        <Link to="/" className="reel-watch__brand">
          Cropvibe
        </Link>
        {appLink ? (
          <a className="reel-watch__open-app" href={appLink}>
            Open app
          </a>
        ) : null}
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
          </div>
        </div>
      ) : null}
    </div>
  );
}
