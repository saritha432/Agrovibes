const ANDROID_PACKAGE = "com.cropvibe.app";
const CUSTOM_SCHEME = "agrovibes";

function encodeIntentFallback(url) {
  return encodeURIComponent(url);
}

function buildReelPaths(postId) {
  const id = encodeURIComponent(String(postId));
  return {
    customSchemeUrl: `${CUSTOM_SCHEME}://reel/${id}`,
    httpsReelPath: `/reel/${id}`,
    httpsWatchPath: `/watch/${id}`
  };
}

function buildReelDeepLinkUrls(postId, webOrigin) {
  const origin = String(webOrigin || "https://www.cropvibe.com").replace(/\/$/, "");
  const { customSchemeUrl, httpsReelPath, httpsWatchPath } = buildReelPaths(postId);
  const httpsReelUrl = `${origin}${httpsReelPath}`;
  const httpsWatchUrl = `${origin}${httpsWatchPath}`;
  const androidIntentUrl =
    `intent://${origin.replace(/^https?:\/\//, "")}${httpsReelPath}` +
    `#Intent;scheme=https;package=${ANDROID_PACKAGE};` +
    `S.browser_fallback_url=${encodeIntentFallback(httpsWatchUrl)};end`;
  const androidCustomIntentUrl =
    `intent://reel/${encodeURIComponent(String(postId))}` +
    `#Intent;scheme=${CUSTOM_SCHEME};package=${ANDROID_PACKAGE};` +
    `S.browser_fallback_url=${encodeIntentFallback(httpsWatchUrl)};end`;

  return {
    customSchemeUrl,
    httpsReelUrl,
    httpsWatchUrl,
    androidIntentUrl,
    androidCustomIntentUrl
  };
}

module.exports = {
  ANDROID_PACKAGE,
  CUSTOM_SCHEME,
  buildReelDeepLinkUrls
};
