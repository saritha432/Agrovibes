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
  return "https://apps.apple.com/app/id6784965103";
}

function getEstimatedAppSizeLabel() {
  const raw = stripEnv(process.env.APP_ESTIMATED_SIZE_MB);
  if (raw) return raw.includes("MB") ? raw : `${raw}MB`;
  return "121MB";
}

function getStoreUrls() {
  return {
    playStoreUrl: getPlayStoreUrl(),
    appStoreUrl: getAppStoreUrl()
  };
}

function buildReelDeepLinkUrls(postId, webOrigin) {
  const origin = String(webOrigin || "https://cropvibe.com").replace(/\/$/, "");
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

function buildProfileDeepLinkUrls(userKey, webOrigin) {
  const origin = String(webOrigin || "https://cropvibe.com").replace(/\/$/, "");
  const key = encodeURIComponent(String(userKey || "").trim());
  const customSchemeUrl = `${CUSTOM_SCHEME}://profile/${key}`;
  const httpsProfilePath = `/profile/${key}`;
  const httpsProfileUrl = `${origin}${httpsProfilePath}`;
  /** SPA page (not rewritten to share HTML) — used for "View details" / ?web=1. */
  const httpsWatchUrl = `${origin}/view/profile/${key}`;
  const installFallbackUrl = `${httpsProfileUrl}?install=1`;
  const androidIntentUrl =
    `intent://${origin.replace(/^https?:\/\//, "")}${httpsProfilePath}` +
    `#Intent;scheme=https;package=${ANDROID_PACKAGE};` +
    `S.browser_fallback_url=${encodeIntentFallback(installFallbackUrl)};end`;
  const androidCustomIntentUrl =
    `intent://profile/${key}` +
    `#Intent;scheme=${CUSTOM_SCHEME};package=${ANDROID_PACKAGE};` +
    `S.browser_fallback_url=${encodeIntentFallback(installFallbackUrl)};end`;
  const stores = getStoreUrls();

  return {
    customSchemeUrl,
    httpsProfileUrl,
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
  buildProfileDeepLinkUrls,
  getPlayStoreUrl,
  getAppStoreUrl,
  getStoreUrls,
  getEstimatedAppSizeLabel
};
