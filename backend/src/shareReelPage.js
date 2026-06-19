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
  return "https://agrovibes.app";
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

function isSocialCrawler(userAgent) {
  const ua = String(userAgent || "").toLowerCase();
  return (
    ua.includes("facebookexternalhit") ||
    ua.includes("whatsapp") ||
    ua.includes("twitterbot") ||
    ua.includes("linkedinbot") ||
    ua.includes("slackbot") ||
    ua.includes("telegrambot") ||
    ua.includes("discordbot") ||
    ua.includes("googlebot")
  );
}

function buildShareReelHtml(post, { postId, userAgent }) {
  const webOrigin = getWebAppOrigin();
  const shareUrl = `${webOrigin}/reel/${encodeURIComponent(String(postId))}`;
  const watchUrl = `${webOrigin}/watch/${encodeURIComponent(String(postId))}`;
  const appUrl = `agrovibes://reel/${encodeURIComponent(String(postId))}`;
  const author = escapeHtml(post?.userName || "Cropvibe");
  const caption = escapeHtml(stripReelCaptionPrefix(post?.caption) || "Watch this reel on Cropvibe");
  const title = `${author} on Cropvibe`;
  const image = reelShareImage(post);
  const imageTag = image ? `<meta property="og:image" content="${escapeHtml(image)}" />` : "";
  const crawler = isSocialCrawler(userAgent);

  const redirectScript = crawler
    ? ""
    : `
    <script>
      (function () {
        var appUrl = ${JSON.stringify(appUrl)};
        var webUrl = ${JSON.stringify(watchUrl)};
        var started = Date.now();
        try {
          window.location.href = appUrl;
        } catch (e) {}
        setTimeout(function () {
          if (Date.now() - started < 1600) {
            window.location.replace(webUrl);
          }
        }, 900);
      })();
    </script>`;

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
  <meta property="og:url" content="${escapeHtml(shareUrl)}" />
  ${imageTag}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${caption}" />
  ${image ? `<meta name="twitter:image" content="${escapeHtml(image)}" />` : ""}
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; background: #111; color: #f5f5f5; }
    .wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px; text-align: center; }
    a { color: #c9ff35; }
  </style>
  ${redirectScript}
</head>
<body>
  <div class="wrap">
    <h1>${author}</h1>
    <p>${caption}</p>
    <p><a href="${escapeHtml(watchUrl)}">Open in Cropvibe</a></p>
  </div>
</body>
</html>`;
}

module.exports = {
  buildShareReelHtml,
  getWebAppOrigin,
  stripReelCaptionPrefix,
  reelShareImage
};
