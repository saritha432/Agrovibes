import { Link, useParams } from "react-router-dom";
import { useEffect, useRef } from "react";
import { getWebAppOrigin } from "../api/client";
import { openProfileInApp, pickStoreUrl } from "../utils/appDeepLink";
import "./ReelWatchPage.css";

export function PublicProfilePage() {
  const { userIdOrHandle } = useParams();
  const segment = String(userIdOrHandle || "").trim();
  const numericId = Number(segment);
  const userKey = Number.isFinite(numericId) && numericId > 0 ? numericId : segment;
  const webOrigin = getWebAppOrigin();
  const triedAppOpenRef = useRef(false);
  const appLink = userKey
    ? `agrovibes://profile/${encodeURIComponent(String(userKey))}`
    : "";

  useEffect(() => {
    if (!userKey || triedAppOpenRef.current) return;
    const params = new URLSearchParams(window.location.search || "");
    if (params.get("web") === "1") return;
    triedAppOpenRef.current = true;
    openProfileInApp(userKey, webOrigin);
  }, [userKey, webOrigin]);

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
            {segment ? `@${segment}` : "Profile"} — open the Cropvibe app to follow and see posts.
          </p>
          {appLink ? (
            <p style={{ marginTop: 20, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <a className="reel-watch__open-app" href={appLink}>
                Open in app
              </a>
              <a className="reel-watch__open-app" href={pickStoreUrl()}>
                Install
              </a>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
