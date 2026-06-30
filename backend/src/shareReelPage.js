const { buildReelDeepLinkUrls } = require("./appDeepLinkUrls");

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripEnv(value) {
  return String(value || "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

function getWebAppOrigin() {
  const explicit = stripEnv(process.env.WEB_APP_ORIGIN || process.env.PUBLIC_WEB_URL);
  if (explicit) return explicit.replace(/\/$/, "");
  const cors = stripEnv(process.env.CORS_ORIGIN)
    .split(",")
    .map((part) => part.trim())
    .find((part) => part.startsWith("http"));
  if (cors) return cors.replace(/\/$/, "");
  return "https://www.cropvibe.com";
}

function stripReelCaptionPrefix(caption) {
  return String(caption || "")
    .replace(/^\[REEL\]\s*/i, "")
    .replace(/^\[POST\]\s*/i, "")
    .trim();
}

function reelShareImage(post) {
  const thumb = stripEnv(post?.thumbnailUrl);
  if (thumb) return thumb;
  const image = stripEnv(post?.imageUrl);
  if (image) return image;
  const urls = Array.isArray(post?.imageUrls) ? post.imageUrls : [];
  const first = urls.map((u) => stripEnv(u)).find(Boolean);
  return first || "";
}

/** Bots that fetch HTML for link previews only — no JS, no app redirect. */
function isLinkPreviewBot(userAgent) {
  const ua = String(userAgent || "").toLowerCase();
  return (
    ua.includes("facebookexternalhit") ||
    ua.includes("twitterbot") ||
    ua.includes("linkedinbot") ||
    ua.includes("slackbot") ||
    ua.includes("discordbot") ||
    ua.includes("telegrambot") ||
    ua.includes("googlebot") ||
    ua.includes("bingbot")
  );
}

function buildOpenAppScript(urls) {
  return `
    <script>
      (function () {
        var appUrl = ${JSON.stringify(urls.customSchemeUrl)};
        var androidIntent = ${JSON.stringify(urls.androidIntentUrl)};
        var androidCustom = ${JSON.stringify(urls.androidCustomIntentUrl)};
        var webUrl = ${JSON.stringify(urls.httpsWatchUrl)};
        var ua = navigator.userAgent || "";
        var isAndroid = /android/i.test(ua);
        var started = Date.now();
        var opened = false;

        function tryOpen(url) {
          if (!url || opened) return;
          opened = true;
          try { window.location.href = url; } catch (e) {}
        }

        if (isAndroid) {
          tryOpen(androidIntent);
          setTimeout(function () { tryOpen(androidCustom); }, 120);
          setTimeout(function () { tryOpen(appUrl); }, 280);
        } else {
          tryOpen(appUrl);
        }

        setTimeout(function () {
          if (document.hidden || document.visibilityState === "hidden") return;
          if (Date.now() - started < 2200) {
            window.location.replace(webUrl);
          }
        }, 1800);
      })();
    </script>`;
}

function buildShareReelHtml(post, { postId, userAgent }) {
  const webOrigin = getWebAppOrigin();
  const urls = buildReelDeepLinkUrls(postId, webOrigin);
  const author = escapeHtml(post?.userName || "Cropvibe");
  const caption = escapeHtml(stripReelCaptionPrefix(post?.caption) || "Watch this reel on Cropvibe");
  const title = `${author} on Cropvibe`;
  const image = reelShareImage(post);
  const imageTag = image ? `<meta property="og:image" content="${escapeHtml(image)}" />` : "";
  const previewBot = isLinkPreviewBot(userAgent);
  const openAppHref = escapeHtml(urls.androidIntentUrl);
  const openAppOnClick = previewBot
    ? ""
    : `onclick="event.preventDefault();var u=/android/i.test(navigator.userAgent)?${JSON.stringify(urls.androidIntentUrl)}:${JSON.stringify(urls.customSchemeUrl)};window.location.href=u;return false;"`;

  const redirectScript = previewBot ? "" : buildOpenAppScript(urls);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${caption}" />
  <meta property="og:type" content="video.other" />
  <meta property="og:site_name" content="Cropvibe" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${caption}" />
  <meta property="og:url" content="${escapeHtml(urls.httpsReelUrl)}" />
  ${imageTag}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${caption}" />
  ${image ? `<meta name="twitter:image" content="${escapeHtml(image)}" />` : ""}
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; background: #111; color: #f5f5f5; }
    .wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px; text-align: center; }
    .btn {
      display: inline-block;
      margin-top: 20px;
      padding: 12px 22px;
      border-radius: 999px;
      background: #c9ff35;
      color: #111;
      font-weight: 800;
      text-decoration: none;
    }
    .sub { margin-top: 14px; color: #aaa; font-size: 14px; }
    .sub a { color: #c9ff35; }
  </style>
  ${redirectScript}
</head>
<body>
  <div class="wrap">
    <h1>${author}</h1>
    <p>${caption}</p>
    <a class="btn" href="${openAppHref}" ${openAppOnClick}>Open in Cropvibe</a>
    <p class="sub">No app? <a href="${escapeHtml(urls.httpsWatchUrl)}">Watch in browser</a></p>
  </div>
</body>
</html>`;
}

module.exports = {
  buildShareReelHtml,
  getWebAppOrigin,
  stripReelCaptionPrefix,
  reelShareImage,
  isLinkPreviewBot
};
