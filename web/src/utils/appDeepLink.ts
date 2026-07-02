const ANDROID_PACKAGE = "com.cropvibe.app";
const CUSTOM_SCHEME = "agrovibes";

const PLAY_STORE_URL =
  (import.meta.env.VITE_PLAY_STORE_URL as string | undefined)?.trim() ||
  "https://play.google.com/store/apps/details?id=com.cropvibe.app";

const APP_STORE_URL =
  (import.meta.env.VITE_APP_STORE_URL as string | undefined)?.trim() ||
  "https://apps.apple.com/search?term=cropvibe";

function encodeIntentFallback(url: string) {
  return encodeURIComponent(url);
}

export function getStoreUrls() {
  return { playStoreUrl: PLAY_STORE_URL, appStoreUrl: APP_STORE_URL };
}

export function buildReelDeepLinkUrls(postId: number, webOrigin: string) {
  const origin = webOrigin.replace(/\/$/, "");
  const id = encodeURIComponent(String(postId));
  const customSchemeUrl = `${CUSTOM_SCHEME}://reel/${id}`;
  const httpsReelPath = `/reel/${id}`;
  const httpsWatchPath = `/watch/${id}`;
  const httpsReelUrl = `${origin}${httpsReelPath}`;
  const httpsWatchUrl = `${origin}${httpsWatchPath}`;
  const installFallbackUrl = `${httpsReelUrl}?install=1`;
  const androidIntentUrl =
    `intent://${origin.replace(/^https?:\/\//, "")}${httpsReelPath}` +
    `#Intent;scheme=https;package=${ANDROID_PACKAGE};` +
    `S.browser_fallback_url=${encodeIntentFallback(installFallbackUrl)};end`;
  const androidCustomIntentUrl =
    `intent://reel/${id}` +
    `#Intent;scheme=${CUSTOM_SCHEME};package=${ANDROID_PACKAGE};` +
    `S.browser_fallback_url=${encodeIntentFallback(installFallbackUrl)};end`;

  return {
    customSchemeUrl,
    httpsReelUrl,
    httpsWatchUrl,
    installFallbackUrl,
    androidIntentUrl,
    androidCustomIntentUrl,
    playStoreUrl: PLAY_STORE_URL,
    appStoreUrl: APP_STORE_URL
  };
}

export function isAndroidBrowser() {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent);
}

export function isIosBrowser() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function pickStoreUrl() {
  return isIosBrowser() ? APP_STORE_URL : PLAY_STORE_URL;
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
