import { Link, useParams } from "react-router-dom";
import "./ReelWatchPage.css";

export function PublicProfilePage() {
  const { userIdOrHandle } = useParams();
  const segment = String(userIdOrHandle || "").trim();
  const numericId = Number(segment);
  const userId = Number.isFinite(numericId) && numericId > 0 ? numericId : undefined;
  const appLink = userId
    ? `agrovibes://profile/${userId}`
    : segment
      ? `agrovibes://profile/${encodeURIComponent(segment)}`
      : "";

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

      <div className="reel-watch__body">
        <div className="reel-watch__meta" style={{ maxWidth: 420, margin: "48px auto", textAlign: "center" }}>
          <strong>View profile on Cropvibe</strong>
          <p style={{ marginTop: 12, opacity: 0.85 }}>
            {userId ? `User #${userId}` : segment || "Profile"} — open the Cropvibe app to follow and see posts.
          </p>
          {appLink ? (
            <p style={{ marginTop: 20 }}>
              <a className="reel-watch__open-app" href={appLink}>
                Open in app
              </a>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
