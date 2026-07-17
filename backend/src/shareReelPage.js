const { buildReelDeepLinkUrls, getEstimatedAppSizeLabel } = require("./appDeepLinkUrls");

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
  return "https://cropvibe.com";
}

function getApiOrigin() {
  const explicit = stripEnv(
    process.env.API_PUBLIC_ORIGIN || process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_API_URL
  );
  if (explicit) return explicit.replace(/\/$/, "");
  return "https://agrovibes.onrender.com";
}

function absolutizeMediaUrl(url) {
  const cleaned = stripEnv(url);
  if (!cleaned) return "";
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  if (cleaned.startsWith("/")) return `${getApiOrigin()}${cleaned}`;
  return cleaned;
}

function stripReelCaptionPrefix(caption) {
  return String(caption || "")
    .replace(/^\[REEL\]\s*/i, "")
    .replace(/^\[POST\]\s*/i, "")
    .trim();
}

function reelShareImage(post) {
  const thumb = stripEnv(post?.thumbnailUrl);
  if (thumb) return absolutizeMediaUrl(thumb);
  const image = stripEnv(post?.imageUrl);
  if (image) return absolutizeMediaUrl(image);
  const urls = Array.isArray(post?.imageUrls) ? post.imageUrls : [];
  const first = urls.map((u) => stripEnv(u)).find(Boolean);
  return first ? absolutizeMediaUrl(first) : "";
}

function captionSnippet(post, maxLen = 100) {
  const raw = stripReelCaptionPrefix(post?.caption) || "Watch on Cropvibe";
  if (raw.length <= maxLen) return raw;
  return `${raw.slice(0, Math.max(0, maxLen - 3)).trim()}...`;
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
    ua.includes("bingbot") ||
    ua.includes("whatsapp") ||
    ua.includes("lark") ||
    ua.includes("preview")
  );
}

function buildOpenAppScript(urls) {
  return `
    <script>
      (function () {
        var appUrl = ${JSON.stringify(urls.customSchemeUrl)};
        var androidIntent = ${JSON.stringify(urls.androidIntentUrl)};
        var androidCustom = ${JSON.stringify(urls.androidCustomIntentUrl)};
        var watchUrl = ${JSON.stringify(urls.httpsWatchUrl)};
        var playStoreUrl = ${JSON.stringify(urls.playStoreUrl)};
        var appStoreUrl = ${JSON.stringify(urls.appStoreUrl)};
        var ua = navigator.userAgent || "";
        var isAndroid = /android/i.test(ua);
        var isIos = /iphone|ipad|ipod/i.test(ua);
        var params = new URLSearchParams(window.location.search || "");
        var forceInstall = params.get("install") === "1";
        var forceWeb = params.get("web") === "1";
        var started = Date.now();
        var opened = false;
        var triedApp = false;

        function showInstall() {
          var loading = document.getElementById("cv-loading");
          var install = document.getElementById("cv-install");
          if (loading) loading.hidden = true;
          if (install) install.hidden = false;
        }

        function storeUrl() {
          if (isIos) return appStoreUrl;
          if (isAndroid) return playStoreUrl;
          return playStoreUrl;
        }

        function tryOpen(url) {
          if (!url || opened) return;
          opened = true;
          triedApp = true;
          try { window.location.href = url; } catch (e) {}
        }

        function wireInstall() {
          var installBtn = document.getElementById("cv-install-btn");
          var detailsBtn = document.getElementById("cv-details-btn");
          if (installBtn) {
            installBtn.href = storeUrl();
            installBtn.addEventListener("click", function (e) {
              e.preventDefault();
              window.location.href = storeUrl();
            });
          }
          if (detailsBtn) {
            detailsBtn.href = watchUrl + "?web=1";
            detailsBtn.addEventListener("click", function (e) {
              e.preventDefault();
              window.location.href = watchUrl + "?web=1";
            });
          }
        }

        document.addEventListener("visibilitychange", function () {
          if (!triedApp) return;
          if (document.visibilityState === "visible" && Date.now() - started > 400) {
            showInstall();
          }
        });

        if (forceWeb) {
          window.location.replace(watchUrl);
          return;
        }

        wireInstall();

        if (forceInstall) {
          showInstall();
          return;
        }

        if (isAndroid) {
          tryOpen(androidIntent);
          setTimeout(function () { tryOpen(androidCustom); }, 100);
          setTimeout(function () { tryOpen(appUrl); }, 240);
        } else if (isIos) {
          tryOpen(appUrl);
        }

        setTimeout(function () {
          if (document.hidden || document.visibilityState === "hidden") return;
          if (Date.now() - started < 1400) {
            showInstall();
          }
        }, 1200);
      })();
    </script>`;
}

function buildShareReelHtml(post, { postId, userAgent, sharePath = "reel" }) {
  const webOrigin = getWebAppOrigin();
  const urls = buildReelDeepLinkUrls(postId, webOrigin);
  const authorName = String(post?.userName || "Cropvibe").trim() || "Cropvibe";
  const author = escapeHtml(authorName);
  const snippet = captionSnippet(post);
  const caption = escapeHtml(snippet);
  const title = escapeHtml(`${authorName} on Cropvibe: "${snippet}"`);
  const image = reelShareImage(post);
  const canonicalPath = sharePath === "watch" ? urls.httpsWatchUrl : urls.httpsReelUrl;
  const imageTags = image
    ? `<meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:image:secure_url" content="${escapeHtml(image)}" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />`
    : "";
  const previewBot = isLinkPreviewBot(userAgent);
  const redirectScript = previewBot ? "" : buildOpenAppScript(urls);
  const appLinksTags = `
  <meta property="al:android:url" content="${escapeHtml(urls.customSchemeUrl)}" />
  <meta property="al:android:package" content="com.cropvibe.app" />
  <meta property="al:android:app_name" content="Cropvibe" />
  <meta property="al:ios:url" content="${escapeHtml(urls.customSchemeUrl)}" />
  <meta property="al:ios:app_name" content="Cropvibe" />
  <meta property="al:web:url" content="${escapeHtml(canonicalPath)}" />`;
  const iconUrl = `${webOrigin}/icons-ios.png`;
  const estimatedSize = escapeHtml(getEstimatedAppSizeLabel());

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="description" content="${caption}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Cropvibe" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${caption}" />
  <meta property="og:url" content="${escapeHtml(canonicalPath)}" />
  ${imageTags}
  ${appLinksTags}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${caption}" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #fff;
      color: #111;
    }
    .page {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      max-width: 480px;
      margin: 0 auto;
      padding: 8px 24px 24px;
    }
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 44px;
    }
    .back {
      width: 40px;
      height: 40px;
      border: none;
      background: transparent;
      font-size: 28px;
      line-height: 1;
      color: #111;
      cursor: pointer;
      padding: 0;
    }
    .hero {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 12px 0 20px;
    }
    .app-icon {
      width: 118px;
      height: 118px;
      border-radius: 26px;
      object-fit: cover;
      margin-bottom: 18px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    }
    h1 {
      margin: 0 0 10px;
      font-size: 30px;
      line-height: 1.12;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .tagline {
      margin: 0;
      color: #111;
      font-size: 16px;
      line-height: 1.45;
      max-width: 340px;
      font-weight: 400;
    }
    .estimated {
      margin: 12px 0 0;
      color: #737373;
      font-size: 13px;
      font-weight: 400;
    }
    .details-link {
      margin: 10px 0 0;
      color: #1877f2;
      font-size: 15px;
      font-weight: 600;
      text-decoration: none;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
    }
    .actions {
      margin-top: auto;
      width: 100%;
      padding-top: 8px;
    }
    .mobile-note {
      margin: 0 0 16px;
      color: #111;
      font-size: 13px;
      line-height: 1.35;
      text-align: left;
    }
    .mobile-note .checkbox {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 1.6px solid #111;
      border-radius: 2px;
      margin-right: 8px;
      vertical-align: -2px;
      position: relative;
    }
    .mobile-note .checkbox:after {
      content: "";
      position: absolute;
      left: 3px;
      top: 0px;
      width: 5px;
      height: 9px;
      border: solid #111;
      border-width: 0 1.8px 1.8px 0;
      transform: rotate(45deg);
    }
    .btn-install {
      display: block;
      width: 100%;
      padding: 15px 20px;
      border: none;
      border-radius: 999px;
      background: #1877f2;
      color: #fff;
      font-size: 17px;
      font-weight: 700;
      text-align: center;
      text-decoration: none;
      cursor: pointer;
    }
    .loading {
      min-height: 70vh;
      display: grid;
      place-items: center;
      color: #737373;
      font-size: 15px;
    }
    .preview-only {
      padding: 24px;
      text-align: center;
      color: #444;
      font-size: 14px;
      line-height: 1.5;
    }
  </style>
  ${redirectScript}
</head>
<body>
  <div class="page">
    ${
      previewBot
        ? `<div class="preview-only">
      <p><strong>${author}</strong></p>
      <p>${caption}</p>
    </div>`
        : `<div class="topbar">
      <button class="back" type="button" aria-label="Back" onclick="history.length>1?history.back():window.location.href='${escapeHtml(webOrigin)}'">&#8592;</button>
    </div>
    <div id="cv-loading" class="loading">Opening Cropvibe…</div>
    <div id="cv-install" class="hero" hidden>
      <img class="app-icon" src="${escapeHtml(iconUrl)}" alt="Cropvibe" onerror="this.onerror=null;this.src='${escapeHtml(`${webOrigin}/cropvibe.png`)}';" />
      <h1>Install Cropvibe</h1>
      <p class="tagline">Bringing you closer to the people and things you love in farming.</p>
      <p class="estimated">Estimated size: ${estimatedSize}</p>
      <button id="cv-details-btn" class="details-link" type="button">View details</button>
      <div class="actions">
        <p class="mobile-note"><span class="checkbox"></span>Use mobile data if Wi-Fi isn't available. Data charges may apply. You can change this in Settings for future updates.</p>
        <a id="cv-install-btn" class="btn-install" href="${escapeHtml(urls.playStoreUrl)}">Install</a>
      </div>
    </div>`
    }
  </div>
</body>
</html>`;
}

module.exports = {
  buildShareReelHtml,
  getWebAppOrigin,
  getApiOrigin,
  absolutizeMediaUrl,
  stripReelCaptionPrefix,
  reelShareImage,
  isLinkPreviewBot,
  captionSnippet
};
