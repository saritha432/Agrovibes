const ANDROID_PACKAGE = "com.cropvibe.app";
const CUSTOM_SCHEME = "agrovibes";

function encodeIntentFallback(url: string) {
  return encodeURIComponent(url);
}

export function buildReelDeepLinkUrls(postId: number, webOrigin: string) {
  const origin = webOrigin.replace(/\/$/, "");
  const id = encodeURIComponent(String(postId));
  const customSchemeUrl = `${CUSTOM_SCHEME}://reel/${id}`;
  const httpsReelPath = `/reel/${id}`;
  const httpsWatchPath = `/watch/${id}`;
  const httpsReelUrl = `${origin}${httpsReelPath}`;
  const httpsWatchUrl = `${origin}${httpsWatchPath}`;
  const androidIntentUrl =
    `intent://${origin.replace(/^https?:\/\//, "")}${httpsReelPath}` +
    `#Intent;scheme=https;package=${ANDROID_PACKAGE};` +
    `S.browser_fallback_url=${encodeIntentFallback(httpsWatchUrl)};end`;
  const androidCustomIntentUrl =
    `intent://reel/${id}` +
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

export function isAndroidBrowser() {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent);
}

export function pickReelAppOpenUrl(postId: number, webOrigin: string) {
  const urls = buildReelDeepLinkUrls(postId, webOrigin);
  return isAndroidBrowser() ? urls.androidIntentUrl : urls.customSchemeUrl;
}

export function openReelInApp(postId: number, webOrigin: string) {
  const urls = buildReelDeepLinkUrls(postId, webOrigin);
  const primary = isAndroidBrowser() ? urls.androidIntentUrl : urls.customSchemeUrl;
  window.location.href = primary;
}
