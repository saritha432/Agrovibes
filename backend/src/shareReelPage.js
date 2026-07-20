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

function buildOpenAppScript(urls, icons) {
  const iconUrl = icons?.iconUrl || "";
  const iconFallbackUrl = icons?.iconFallbackUrl || "";
  const iconFallback2Url = icons?.iconFallback2Url || "";
  return `
    <script>
      (function () {
        var appUrl = ${JSON.stringify(urls.customSchemeUrl)};
        var androidIntent = ${JSON.stringify(urls.androidIntentUrl)};
        var androidCustom = ${JSON.stringify(urls.androidCustomIntentUrl)};
        var watchUrl = ${JSON.stringify(urls.httpsWatchUrl)};
        var playStoreUrl = ${JSON.stringify(urls.playStoreUrl)};
        var appStoreUrl = ${JSON.stringify(urls.appStoreUrl)};
        var iconUrl = ${JSON.stringify(iconUrl)};
        var iconFallbackUrl = ${JSON.stringify(iconFallbackUrl)};
        var iconFallback2Url = ${JSON.stringify(iconFallback2Url)};
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
          var icon = document.getElementById("cv-app-icon");
          if (loading) loading.hidden = true;
          if (install) install.hidden = false;
          if (icon && !icon.getAttribute("src")) {
            icon.setAttribute("src", iconUrl);
            icon.onerror = function () {
              icon.onerror = function () {
                icon.onerror = null;
                icon.src = iconFallback2Url;
              };
              icon.src = iconFallbackUrl;
            };
          }
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
  const iconUrl = `${getApiOrigin()}/api/share/assets/icons-ios.png`;
  const iconFallbackUrl = `${webOrigin}/icons-ios.png`;
  const iconFallback2Url = `${webOrigin}/cropvibe.png`;
  const redirectScript = previewBot
    ? ""
    : buildOpenAppScript(urls, { iconUrl, iconFallbackUrl, iconFallback2Url });
  const appLinksTags = `
  <meta property="al:android:url" content="${escapeHtml(urls.customSchemeUrl)}" />
  <meta property="al:android:package" content="com.cropvibe.app" />
  <meta property="al:android:app_name" content="Cropvibe" />
  <meta property="al:ios:url" content="${escapeHtml(urls.customSchemeUrl)}" />
  <meta property="al:ios:app_name" content="Cropvibe" />
  <meta property="al:web:url" content="${escapeHtml(canonicalPath)}" />`;
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
    html, body { height: 100%; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #fff;
      color: #111;
    }
    .page {
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      max-width: 480px;
      margin: 0 auto;
      padding: 0 20px calc(16px + env(safe-area-inset-bottom, 0px));
    }
    .topbar {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      height: 44px;
    }
    .back {
      width: 36px;
      height: 36px;
      border: none;
      background: transparent;
      font-size: 24px;
      line-height: 1;
      color: #111;
      cursor: pointer;
      padding: 0;
      margin-left: -4px;
    }
    .loading {
      flex: 1;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      color: #737373;
      font-size: 15px;
      padding-top: 42vh;
    }
    .install-shell {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .install-main {
      flex: 0 0 auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding-top: 2px;
    }
    .app-icon {
      width: 108px;
      height: 108px;
      border-radius: 22px;
      object-fit: cover;
      margin-bottom: 14px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.08);
      background: #111;
    }
    h1 {
      margin: 0 0 6px;
      font-size: 27px;
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
      margin: 10px 0 0;
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
    .install-footer {
      flex-shrink: 0;
      width: 100%;
      margin-top: auto;
      padding-top: 0;
    }
    .mobile-note {
      margin: 0 0 14px;
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
    <div id="cv-install" class="install-shell" hidden>
      <div class="install-main">
        <img class="app-icon" id="cv-app-icon" alt="" />
        <h1>Install Cropvibe</h1>
        <p class="tagline">Bringing you closer to the people and things you love in farming.</p>
        <p class="estimated">Estimated size: ${estimatedSize}</p>
        <button id="cv-details-btn" class="details-link" type="button">View details</button>
      </div>
      <div class="install-footer">
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
