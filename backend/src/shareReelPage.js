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
          try { window.location.href = url; } catch (e) {}
        }

        function wireInstall() {
          var installBtn = document.getElementById("cv-install-btn");
          var watchBtn = document.getElementById("cv-watch-btn");
          if (installBtn) {
            installBtn.href = storeUrl();
            installBtn.addEventListener("click", function (e) {
              e.preventDefault();
              window.location.href = storeUrl();
            });
          }
          if (watchBtn) {
            watchBtn.href = watchUrl;
            watchBtn.addEventListener("click", function (e) {
              e.preventDefault();
              window.location.href = watchUrl;
            });
          }
        }

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
          setTimeout(function () { tryOpen(androidCustom); }, 120);
          setTimeout(function () { tryOpen(appUrl); }, 280);
        } else {
          tryOpen(appUrl);
        }

        setTimeout(function () {
          if (document.hidden || document.visibilityState === "hidden") return;
          if (Date.now() - started < 2200) {
            showInstall();
          }
        }, 1800);
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
  const logoUrl = `${webOrigin}/logo-wordmark.png`;
  const previewThumb = image
    ? `<img class="preview-thumb" src="${escapeHtml(image)}" alt="" />`
    : `<div class="preview-thumb preview-thumb--placeholder">CV</div>`;

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
      padding: 20px 20px 28px;
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
      margin-left: -6px;
    }
    .hero {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 12px 0 24px;
    }
    .logo {
      width: 88px;
      height: 88px;
      border-radius: 20px;
      object-fit: contain;
      margin-bottom: 18px;
      background: #262626;
      padding: 10px;
    }
    .preview-thumb {
      width: 120px;
      height: 120px;
      border-radius: 16px;
      object-fit: cover;
      margin-bottom: 16px;
      border: 1px solid #e8e8e8;
    }
    .preview-thumb--placeholder {
      display: grid;
      place-items: center;
      background: #c9ff35;
      color: #111;
      font-weight: 900;
      font-size: 28px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 28px;
      line-height: 1.15;
      font-weight: 800;
    }
    .tagline {
      margin: 0;
      color: #666;
      font-size: 15px;
      line-height: 1.45;
      max-width: 320px;
    }
    .author {
      margin: 14px 0 0;
      color: #888;
      font-size: 14px;
    }
    .caption {
      margin: 6px 0 0;
      color: #444;
      font-size: 14px;
      line-height: 1.4;
      max-width: 340px;
    }
    .meta {
      margin-top: 10px;
      color: #999;
      font-size: 13px;
    }
    .meta a {
      color: #1877f2;
      text-decoration: none;
      font-weight: 600;
    }
    .actions {
      margin-top: auto;
      padding-top: 20px;
    }
    .btn-install {
      display: block;
      width: 100%;
      padding: 14px 20px;
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
    .btn-secondary {
      display: block;
      width: 100%;
      margin-top: 12px;
      padding: 12px 20px;
      border-radius: 999px;
      background: transparent;
      color: #1877f2;
      font-size: 16px;
      font-weight: 700;
      text-align: center;
      text-decoration: none;
      cursor: pointer;
    }
    .loading {
      min-height: 60vh;
      display: grid;
      place-items: center;
      color: #666;
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
        : `<button class="back" type="button" onclick="history.length>1?history.back():window.location.href='${escapeHtml(webOrigin)}'">&#8592;</button>
    <div id="cv-loading" class="loading">Opening Cropvibe…</div>
    <div id="cv-install" class="hero" hidden>
      <img class="logo" src="${escapeHtml(logoUrl)}" alt="Cropvibe" onerror="this.style.display='none'" />
      ${previewThumb}
      <h1>Install Cropvibe</h1>
      <p class="tagline">Bringing you closer to the people and things you love in farming.</p>
      <p class="author">${author}</p>
      <p class="caption">${caption}</p>
      <p class="meta"><a href="${escapeHtml(canonicalPath)}">View details</a></p>
      <div class="actions">
        <a id="cv-install-btn" class="btn-install" href="${escapeHtml(urls.playStoreUrl)}">Install</a>
        <a id="cv-watch-btn" class="btn-secondary" href="${escapeHtml(urls.httpsWatchUrl)}">Watch in browser</a>
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
