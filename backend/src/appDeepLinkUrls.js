const ANDROID_PACKAGE = "com.cropvibe.app";
const CUSTOM_SCHEME = "agrovibes";

function stripEnv(value) {
  return String(value || "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

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

function getPlayStoreUrl() {
  const explicit = stripEnv(process.env.PLAY_STORE_URL || process.env.ANDROID_PLAY_STORE_URL);
  if (explicit) return explicit;
  return `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
}

function getAppStoreUrl() {
  const explicit = stripEnv(process.env.APP_STORE_URL || process.env.IOS_APP_STORE_URL);
  if (explicit) return explicit;
  return "https://apps.apple.com/search?term=cropvibe";
}

function getStoreUrls() {
  return {
    playStoreUrl: getPlayStoreUrl(),
    appStoreUrl: getAppStoreUrl()
  };
}

function buildReelDeepLinkUrls(postId, webOrigin) {
  const origin = String(webOrigin || "https://www.cropvibe.com").replace(/\/$/, "");
  const { customSchemeUrl, httpsReelPath, httpsWatchPath } = buildReelPaths(postId);
  const httpsReelUrl = `${origin}${httpsReelPath}`;
  const httpsWatchUrl = `${origin}${httpsWatchPath}`;
  const installFallbackUrl = `${httpsReelUrl}?install=1`;
  const androidIntentUrl =
    `intent://${origin.replace(/^https?:\/\//, "")}${httpsReelPath}` +
    `#Intent;scheme=https;package=${ANDROID_PACKAGE};` +
    `S.browser_fallback_url=${encodeIntentFallback(installFallbackUrl)};end`;
  const androidCustomIntentUrl =
    `intent://reel/${encodeURIComponent(String(postId))}` +
    `#Intent;scheme=${CUSTOM_SCHEME};package=${ANDROID_PACKAGE};` +
    `S.browser_fallback_url=${encodeIntentFallback(installFallbackUrl)};end`;
  const stores = getStoreUrls();

  return {
    customSchemeUrl,
    httpsReelUrl,
    httpsWatchUrl,
    installFallbackUrl,
    androidIntentUrl,
    androidCustomIntentUrl,
    playStoreUrl: stores.playStoreUrl,
    appStoreUrl: stores.appStoreUrl
  };
}

module.exports = {
  ANDROID_PACKAGE,
  CUSTOM_SCHEME,
  buildReelDeepLinkUrls,
  getPlayStoreUrl,
  getAppStoreUrl,
  getStoreUrls
};
