import { Platform } from "react-native";
import { buildLocalLoginSessionsFallback, isLocalLoginSessionId, LOGIN_ACTIVITY_DEPLOY_HINT } from "../utils/loginActivityFallback";
import { sanitizeHomePost, sanitizeHomeStory, stripLegacyCloudinaryUrl } from "../utils/mediaUrls";
import { assertVideoUnderUploadLimit, assertVideoResolutionWithinLimit } from "../utils/mediaUploadSize";
import { ensureLocalFileUri } from "../utils/mediaLocalUri";
import { prepareImageForUpload, prepareProfileImageForUpload } from "../utils/mediaUpload";
import { resolveWebAppOrigin } from "../utils/webAppOrigin";

/** Production API URL used whenever the build/runtime can't determine a local backend. */
const PRODUCTION_API_BASE_URL = "https://agrovibes.onrender.com/api";

const API_FETCH_TIMEOUT_MS = 45_000;
const API_FETCH_RETRIES = 2;

function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (!host || host === "localhost" || host === "127.0.0.1" || host === "10.0.2.2") return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^10\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  return false;
}

function isPrivateOrLocalApiUrl(url: string): boolean {
  try {
    return isPrivateOrLocalHost(new URL(url).hostname);
  } catch {
    return false;
  }
}

function resolveApiBaseUrl() {
  const envUrl = (process.env as Record<string, string | undefined>).EXPO_PUBLIC_API_BASE_URL;
  if (envUrl && envUrl.trim().length > 0) {
    const trimmed = envUrl.trim().replace(/\/$/, "");
    // Release builds must not call a LAN/dev API — mobile data cannot reach 192.168.x.x etc.
    if (!__DEV__ && isPrivateOrLocalApiUrl(trimmed)) {
      return PRODUCTION_API_BASE_URL;
    }
    return trimmed;
  }

  const webLocation = (globalThis as { location?: { hostname?: string } }).location;
  if (Platform.OS === "web" && webLocation?.hostname) {
    const host = webLocation.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:5000/api";
    }
    return PRODUCTION_API_BASE_URL;
  }

  // Native release + dev default: public HTTPS API (works on Wi‑Fi and mobile data).
  return PRODUCTION_API_BASE_URL;
}

async function fetchWithRetry(url: string, init: RequestInit = {}, timeoutMs = API_FETCH_TIMEOUT_MS): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= API_FETCH_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if (attempt < API_FETCH_RETRIES && [502, 503, 504].includes(response.status)) {
        await new Promise((resolve) => setTimeout(resolve, 1800 * (attempt + 1)));
        continue;
      }
      return response;
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      if (attempt < API_FETCH_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 1800 * (attempt + 1)));
        continue;
      }
    }
  }
  if (lastError instanceof Error) throw lastError;
  throw new Error("Network request failed");
}

export const API_BASE_URL = resolveApiBaseUrl();

/**
 * Public web app origin for share / deep links (no trailing slash).
 * Set `EXPO_PUBLIC_WEB_BASE_URL` for native builds (EAS env).
 */
export function getWebAppOrigin(): string {
  return resolveWebAppOrigin();
}

export interface AuthResponse {
  token: string;
  user: {
    id: number;
    email: string;
    fullName: string;
    role: "student" | "instructor" | "admin";
    phone?: string;
    username?: string;
    avatarUrl?: string;
    bio?: string;
    website?: string;
    locationLabel?: string;
    accountStatus?: "active" | "deactivated";
    isPrivate?: boolean;
  };
  isNewUser?: boolean;
}

export interface AdminUserRecord {
  id: number;
  email: string;
  fullName: string;
  role: "student" | "instructor" | "admin";
  phone?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  website?: string | null;
  locationLabel?: string | null;
  createdAt: string;
  postsCount: number;
  reelsCount: number;
  followersCount: number;
  followingCount: number;
  messagesSentCount: number;
  messagesReceivedCount: number;
}

export interface UserSearchRecord {
  id: number;
  fullName: string;
  username?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  website?: string | null;
  locationLabel?: string | null;
  createdAt: string;
  postsCount: number;
  reelsCount: number;
  followersCount: number;
  followingCount: number;
  viewerStatus: FollowStatus;
  reverseStatus?: FollowStatus;
  canFollowBack: boolean;
}

async function parseJsonOrThrow(response: Response) {
  const text = await response.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!response.ok) {
    const msg = parsed?.message || `Request failed (${response.status})`;
    const err: any = new Error(msg);
    err.status = response.status;
    err.payload = parsed;
    throw err;
  }
  return parsed;
}

export function formatLiveStreamError(error: unknown): string {
  const err = error as { message?: string; status?: number; payload?: { issues?: string[]; message?: string } };
  const message = error instanceof Error ? error.message : "Could not join live.";
  const status = typeof err?.status === "number" ? err.status : null;
  if (Array.isArray(err?.payload?.issues) && err.payload.issues.length) {
    return err.payload.issues.join(" ");
  }
  if (status === 404 || message.includes("(404)")) {
    return "Live streaming API is not deployed on Render yet. Redeploy the latest backend, then add LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET.";
  }
  if (status === 503 || message.includes("(503)")) {
    return "LiveKit is not configured on the server. Add LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET in Render env vars.";
  }
  if (/insufficient permissions/i.test(message)) {
    return "Live server denied camera/mic publish. Close the stream fully, then start again. If it keeps happening, check LiveKit keys on Render.";
  }
  if (/could not establish signal|network request failed|failed to connect/i.test(message)) {
    return "Cannot connect to LiveKit. Check mobile internet and confirm Render LIVEKIT_URL is wss://your-project.livekit.cloud with matching API key/secret.";
  }
  if (/invalid token/i.test(message)) {
    return "LiveKit rejected the token. Camera may turn on, but video won't show until Render LIVEKIT_URL, API key and secret all match the same LiveKit Cloud project. Redeploy after saving env vars.";
  }
  return message;
}

/** User-facing auth errors (login/register); avoids raw "Request failed (502)". */
export function formatAuthError(error: unknown, fallback = "Something went wrong. Please try again."): string {
  const err = error as { message?: string; status?: number; payload?: { message?: string } };
  const status = typeof err?.status === "number" ? err.status : null;
  const msg = String(err?.payload?.message || err?.message || "").trim();

  if (status === 401 || /invalid credentials/i.test(msg)) {
    return "Incorrect mobile number or password.";
  }
  if (status === 400) {
    return msg || "Please check your details and try again.";
  }
  if (status === 502 || status === 503 || status === 504) {
    return "Server is temporarily unavailable. Please try again in a moment.";
  }
  if (/network request failed|failed to fetch|aborted|timed out|network error/i.test(msg)) {
    return "No internet connection. Turn on mobile data or Wi‑Fi and try again.";
  }
  if (status != null && status >= 500) {
    return "Something went wrong on our side. Please try again.";
  }
  if (/request failed \(\d{3}\)/i.test(msg)) {
    const code = Number(msg.match(/\((\d{3})\)/)?.[1]);
    if (code === 401) return "Incorrect mobile number or password.";
    if (code === 502 || code === 503 || code === 504) {
      return "Server is temporarily unavailable. Please try again in a moment.";
    }
    if (code != null && code >= 500) return "Something went wrong on our side. Please try again.";
  }
  return msg || fallback;
}

export async function authRegister(payload: {
  email?: string;
  password: string;
  fullName: string;
  role?: string;
  username?: string;
  phone?: string;
  deviceName?: string;
  platform?: string;
  locationLabel?: string;
  deviceInfo?: { deviceName?: string; platform?: string; locationLabel?: string };
}) {
  const response = await fetchWithRetry(`${API_BASE_URL}/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return (await parseJsonOrThrow(response)) as AuthResponse;
}

export async function authLogin(payload: {
  email?: string;
  identifier?: string;
  password: string;
  deviceName?: string;
  platform?: string;
  locationLabel?: string;
  deviceInfo?: { deviceName?: string; platform?: string; locationLabel?: string };
}) {
  const response = await fetchWithRetry(`${API_BASE_URL}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return (await parseJsonOrThrow(response)) as AuthResponse;
}

export async function sendPhoneOtp(payload: { phone: string }) {
  const response = await fetchWithRetry(`${API_BASE_URL}/v1/auth/phone/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return (await parseJsonOrThrow(response)) as { success: boolean; phone: string; channel: "sms" | "whatsapp" };
}

export async function verifyPhoneOtp(payload: {
  phone: string;
  code: string;
  deviceName?: string;
  platform?: string;
  locationLabel?: string;
  deviceInfo?: { deviceName?: string; platform?: string; locationLabel?: string };
}) {
  const response = await fetchWithRetry(`${API_BASE_URL}/v1/auth/phone/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return (await parseJsonOrThrow(response)) as AuthResponse;
}

export async function fetchMyAccount(token: string) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/auth/me`, token)) as {
    user: AuthResponse["user"];
    passwordUpdatedAt?: string | null;
    createdAt?: string | null;
  };
}

export async function deactivateMyAccount(token: string, password: string) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/auth/me/deactivate`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password })
  })) as { success: boolean; user: AuthResponse["user"] };
}

export async function activateMyAccount(token: string) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/auth/me/activate`, token, {
    method: "POST"
  })) as { success: boolean; user: AuthResponse["user"] };
}

export async function deleteMyAccount(token: string, password: string) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/auth/me`, token, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password })
  })) as { success: boolean };
}

export async function changeMyPassword(
  token: string,
  payload: { currentPassword: string; newPassword: string; logoutOtherDevices?: boolean }
) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/auth/me/change-password`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })) as { success: boolean; passwordUpdatedAt?: string };
}

export type LoginSessionPlatform = "android" | "ios" | "web" | "windows" | "unknown";

export interface LoginSession {
  id: string;
  deviceName: string;
  platform: LoginSessionPlatform;
  locationLabel?: string | null;
  isRecognized: boolean;
  lastActiveAt: string;
  createdAt: string;
  isCurrent: boolean;
}

export interface LoginSessionsResponse {
  sessions: LoginSession[];
  platformSummaries: Array<{
    platform: LoginSessionPlatform;
    deviceName: string;
    extraCount: number;
    summary: string;
  }>;
  unrecognizedLoginCount: number;
  hasUnrecognizedLogins: boolean;
  refreshedToken?: string;
  /** True when the server has not deployed session APIs yet (404). */
  legacyFallback?: boolean;
}

export interface SecurityCheckupRecommendation {
  key: string;
  title: string;
  subtitle: string;
  route: "ProfilesPersonalDetails" | "WhereLoggedIn";
}

export interface SecurityCheckupResponse {
  recommendationCount: number;
  recommendations: SecurityCheckupRecommendation[];
  passwordUpdatedAt?: string | null;
  devicesReviewedAt?: string | null;
  unrecognizedLoginCount: number;
  sessions: LoginSession[];
  contactComplete: boolean;
  twoFactorEnabled: boolean;
  legacyFallback?: boolean;
}

export async function fetchLoginSessions(
  token: string,
  device?: { deviceName?: string; platform?: string; locationLabel?: string }
) {
  const qs = new URLSearchParams();
  if (device?.deviceName) qs.set("deviceName", device.deviceName);
  if (device?.platform) qs.set("platform", device.platform);
  if (device?.locationLabel) qs.set("locationLabel", device.locationLabel);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  try {
    return (await fetchWithAuth(`${API_BASE_URL}/v1/auth/sessions${suffix}`, token)) as LoginSessionsResponse;
  } catch (error: unknown) {
    const status = (error as { status?: number })?.status;
    if (status === 404) {
      return buildLocalLoginSessionsFallback(device);
    }
    throw error;
  }
}

export async function fetchLoginSession(token: string, sessionId: string) {
  if (isLocalLoginSessionId(sessionId)) {
    const fallback = buildLocalLoginSessionsFallback();
    const session = fallback.sessions[0];
    return { session };
  }
  try {
    return (await fetchWithAuth(`${API_BASE_URL}/v1/auth/sessions/${encodeURIComponent(sessionId)}`, token)) as {
      session: LoginSession;
    };
  } catch (error: unknown) {
    const status = (error as { status?: number })?.status;
    if (status === 404) {
      const fallback = buildLocalLoginSessionsFallback();
      return { session: fallback.sessions[0] };
    }
    throw error;
  }
}

export async function revokeLoginSession(token: string, sessionId: string) {
  if (isLocalLoginSessionId(sessionId)) {
    const err: Error & { status?: number } = new Error(LOGIN_ACTIVITY_DEPLOY_HINT);
    err.status = 404;
    throw err;
  }
  return (await fetchWithAuth(`${API_BASE_URL}/v1/auth/sessions/${encodeURIComponent(sessionId)}/revoke`, token, {
    method: "POST"
  })) as { success: boolean; revokedSessionId: string; isCurrent: boolean };
}

export async function reportLoginSession(token: string, sessionId: string) {
  if (isLocalLoginSessionId(sessionId)) {
    const err: Error & { status?: number } = new Error(LOGIN_ACTIVITY_DEPLOY_HINT);
    err.status = 404;
    throw err;
  }
  return (await fetchWithAuth(`${API_BASE_URL}/v1/auth/sessions/${encodeURIComponent(sessionId)}/report`, token, {
    method: "POST"
  })) as { success: boolean; revokedSessionId: string; isCurrent: boolean };
}

export async function markDevicesReviewed(token: string) {
  try {
    return (await fetchWithAuth(`${API_BASE_URL}/v1/auth/sessions/reviewed`, token, {
      method: "POST"
    })) as { success: boolean; reviewedAt: string };
  } catch (error: unknown) {
    if ((error as { status?: number })?.status === 404) {
      return { success: false, reviewedAt: new Date().toISOString() };
    }
    throw error;
  }
}

export async function fetchSecurityCheckup(token: string) {
  try {
    return (await fetchWithAuth(`${API_BASE_URL}/v1/auth/security-checkup`, token)) as SecurityCheckupResponse;
  } catch (error: unknown) {
    const status = (error as { status?: number })?.status;
    if (status !== 404) throw error;

    let passwordUpdatedAt: string | null = null;
    try {
      const account = await fetchMyAccount(token);
      passwordUpdatedAt = account.passwordUpdatedAt || null;
    } catch {
      passwordUpdatedAt = null;
    }

    const fallback = buildLocalLoginSessionsFallback();
    return {
      recommendationCount: 0,
      recommendations: [],
      passwordUpdatedAt,
      devicesReviewedAt: null,
      unrecognizedLoginCount: 0,
      sessions: fallback.sessions,
      contactComplete: true,
      twoFactorEnabled: false,
      legacyFallback: true
    } satisfies SecurityCheckupResponse;
  }
}

export async function updateMyProfile(
  token: string,
  payload: {
    fullName: string;
    username?: string | null;
    bio?: string;
    website?: string;
    locationLabel?: string;
    avatarUrl?: string;
  }
) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/auth/me`, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })) as AuthResponse;
}

export async function updateMyPrivacySettings(token: string, payload: { isPrivate: boolean }) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/auth/me/privacy`, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })) as { user: AuthResponse["user"] };
}

export async function fetchAuthMe(token: string) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/auth/me`, token)) as { user: AuthResponse["user"] };
}

export async function fetchAdminUsers(token: string, params: { search?: string; limit?: number; offset?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.limit != null) qs.set("limit", String(params.limit));
  if (params.offset != null) qs.set("offset", String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return (await fetchWithAuth(`${API_BASE_URL}/v1/admin/users${suffix}`, token)) as {
    users: AdminUserRecord[];
    total: number;
    limit: number;
    offset: number;
  };
}

export async function fetchUsers(token: string, params: { search?: string; limit?: number; offset?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.limit != null) qs.set("limit", String(params.limit));
  if (params.offset != null) qs.set("offset", String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return (await fetchWithAuth(`${API_BASE_URL}/v1/users${suffix}`, token)) as {
    users: UserSearchRecord[];
    total: number;
    limit: number;
    offset: number;
  };
}

export async function resetPasswordWithOtp(payload: { phone: string; code: string; newPassword: string }) {
  const response = await fetchWithRetry(`${API_BASE_URL}/v1/auth/phone/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return (await parseJsonOrThrow(response)) as { success: boolean };
}

export async function fetchWithAuth(url: string, token: string | null, init: RequestInit = {}) {
  const headers: any = { ...(init.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetchWithRetry(url, { ...init, headers });
  return await parseJsonOrThrow(response);
}

export type MarketplaceListingType = "produce" | "machinery" | "knowledge" | "services";

export interface MarketplaceListing {
  id: number;
  cropName: string;
  district: string;
  pricePerKg: number;
  verifiedOnly: boolean;
  /** From API; older responses may omit — treated as produce */
  listingType?: MarketplaceListingType;
}

export interface CommunityQuestion {
  id: number;
  userName: string;
  district: string;
  textContent: string;
  upvotes: number;
  answersCount: number;
  isResolved: boolean;
  createdAt: string;
}

export interface HomeStory {
  id: number;
  userId?: number | null;
  userName: string;
  district: string;
  avatarLabel: string;
  /** Resolved from learn_users when available */
  avatarUrl?: string | null;
  hasNew: boolean;
  viewed: boolean;
  videoUrl?: string | null;
  imageUrl?: string | null;
  musicLabel?: string | null;
  createdAt?: string;
}

export interface HomePost {
  id: number;
  userId?: number | null;
  userName: string;
  location: string;
  caption: string;
  likesCount: number;
  commentsCount: number;
  /** Total reposts/reshares of this post. */
  resharesCount?: number;
  videoUrl?: string | null;
  imageUrl?: string | null;
  /** Present when the post is a multi-image carousel (2+ photos). */
  imageUrls?: string[];
  thumbnailUrl?: string;
  /** Reel: display label for the attached audio track. */
  musicLabel?: string | null;
  /** Reel: URL of the background track (played alongside muted video when set). */
  musicAudioUrl?: string | null;
  /** Reel editor metadata (filter/text styling) to render on playback. */
  creativeMeta?: {
    filter?: string;
    overlayText?: string;
    textColor?: string;
    textBackground?: boolean;
    font?: string;
  };
  /** User ids tagged in this post (Instagram-style). */
  taggedUserIds?: number[];
  createdAt: string;
  /** Present when posts are loaded with an auth token (server-tracked like). */
  viewerHasLiked?: boolean;
  /** Present when posts are loaded with an auth token (server-tracked save). */
  viewerHasSaved?: boolean;
  savedAt?: string;
  /** Present when posts are loaded with an auth token (server-tracked reshare). */
  viewerHasReshared?: boolean;
  resharedAt?: string;
  /** Viewer's quote when this post appears in their reshared tab. */
  reshareQuoteCaption?: string;
  /** When this feed row is a repost from someone you follow (Instagram-style). */
  repost?: {
    byUserId: number;
    byUserName: string;
    byAvatarUrl?: string | null;
    quoteCaption?: string;
    repostedAt: string;
  };
  /** Stable list key when the same post appears as original and as a repost row. */
  feedEntryKey?: string;
  /** Author profile image when joined from learn_users */
  authorAvatarUrl?: string | null;
  /** Users who liked this post (from feed API — used for likes list without a separate request). */
  recentLikers?: HomePostLiker[];
  /** Client-side live state used while a live recording is in progress. */
  liveStatus?: "active" | "ended";
  /** Optional live viewer count seed from realtime/live clients. */
  liveViewerCount?: number;
  /** Client-side timestamp for active live sessions. */
  liveStartedAt?: string;
  /** Timestamp when the live ended. */
  liveEndedAt?: string;
  /** LiveKit room name for active live sessions. */
  liveRoomName?: string;
  /** When set, post is in recently deleted bucket. */
  deletedAt?: string | null;
  /** Auto-permanent-delete time for recently deleted posts. */
  expiresAt?: string | null;
}

export type FollowStatus = "none" | "pending" | "accepted" | "declined" | "self";

export interface SocialRelationship {
  viewerStatus: FollowStatus;
  reverseStatus: FollowStatus;
  canFollowBack: boolean;
}

export interface MessageThread {
  peerUserId: number;
  peerName: string;
  peerEmail?: string;
  peerUsername?: string | null;
  peerAvatarUrl?: string | null;
  lastSenderId?: number;
  lastReceiverId?: number;
  lastMessage: string;
  lastAt: string;
  unreadCount?: number;
}

export interface DirectMessageItem {
  id: number;
  senderId: number;
  receiverId: number;
  body: string;
  createdAt: string;
}

export interface SocialNotificationItem {
  id: number;
  type: "follow_request" | "follow_accept";
  isRead: boolean;
  createdAt: string;
  followId: number;
  actorId: number;
  actorName: string;
  actorAvatarUrl?: string | null;
  followStatus: FollowStatus;
}

export interface SocialPostActivityNotification {
  id: number;
  type: "post_like" | "post_comment" | "comment_reply";
  isRead: boolean;
  createdAt: string;
  actorId: number;
  actorName: string;
  actorAvatarUrl?: string | null;
  postId: number | null;
  postIsReel?: boolean;
  postThumbnailUrl?: string | null;
  postImageUrl?: string | null;
  postVideoUrl?: string | null;
  commentExcerpt?: string | null;
}

export type CourseLevel = "Beginner" | "Intermediate" | "Advanced";

export interface CourseInstructor {
  name: string;
  title: string;
  bio: string;
}

export interface CourseSyllabusItem {
  id: string;
  title: string;
  durationLabel?: string;
  locked?: boolean;
}

export interface CourseLesson {
  id: string;
  title: string;
  durationLabel?: string;
  locked?: boolean;
  videoUrl: string;
}

export interface CourseReviewPreview {
  name: string;
  rating: number;
  text: string;
}

export interface Course {
  id: string;
  title: string;
  category: string;
  tags: string[];
  level: CourseLevel;
  rating: number;
  learnersCount: number;
  durationLabel: string;
  isFree: boolean;
  heroGradient: string[];
  instructor: CourseInstructor;
  syllabus: CourseSyllabusItem[];
  lessons?: CourseLesson[];
  reviewsPreview?: CourseReviewPreview[];
  updatedAt?: string;
}

export async function fetchMarketplaceListings() {
  const response = await fetchWithRetry(`${API_BASE_URL}/v1/marketplace/listings`);
  if (!response.ok) {
    throw new Error("Failed to load marketplace listings");
  }
  return (await response.json()) as { listings: MarketplaceListing[] };
}

export async function fetchCommunityQuestions() {
  const response = await fetchWithRetry(`${API_BASE_URL}/v1/community/questions`);
  if (!response.ok) {
    throw new Error("Failed to load community questions");
  }
  return (await response.json()) as { questions: CommunityQuestion[] };
}

export async function fetchHomeStories(token?: string | null) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetchWithRetry(`${API_BASE_URL}/v1/home/stories`, { headers });
  if (!response.ok) {
    throw new Error("Failed to load home stories");
  }
  const data = (await response.json()) as { stories: HomeStory[] };
  return { stories: data.stories.map(sanitizeHomeStory) };
}

export async function createHomeStory(
  payload: { userName: string; district: string; videoUrl?: string; imageUrl?: string; musicLabel?: string },
  token?: string | null
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetchWithRetry(`${API_BASE_URL}/v1/home/stories`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error("Failed to create story");
  }
  return (await response.json()) as { story: HomeStory };
}

export const HOME_FEED_PAGE_SIZE = 10;

export type HomeFeedPage = {
  posts: HomePost[];
  nextCursor: number | null;
  hasMore: boolean;
};

function homeFeedQuery(limit: number, cursor?: number | null) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor != null && cursor > 0) params.set("cursor", String(cursor));
  return params.toString();
}

export async function fetchHomePostsPage(
  token?: string | null,
  options?: { limit?: number; cursor?: number | null }
): Promise<HomeFeedPage> {
  const limit = options?.limit ?? HOME_FEED_PAGE_SIZE;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const qs = homeFeedQuery(limit, options?.cursor);
  const response = await fetchWithRetry(`${API_BASE_URL}/v1/home/posts?${qs}`, { headers });
  if (!response.ok) {
    throw new Error("Failed to load home posts");
  }
  const data = (await response.json()) as {
    posts?: HomePost[];
    nextCursor?: number | null;
    hasMore?: boolean;
  };
  const posts = Array.isArray(data.posts) ? data.posts.map(sanitizeHomePost) : [];
  return {
    posts,
    nextCursor: data.nextCursor ?? (posts.length ? posts[posts.length - 1]?.id ?? null : null),
    hasMore: Boolean(data.hasMore)
  };
}

export async function fetchHomeReelsExplore(
  token?: string | null,
  options?: { limit?: number; cursor?: number | null }
): Promise<HomeFeedPage> {
  const limit = options?.limit ?? 24;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const params = new URLSearchParams({ limit: String(limit) });
  if (options?.cursor != null && options.cursor > 0) params.set("cursor", String(options.cursor));
  const response = await fetchWithRetry(`${API_BASE_URL}/v1/home/posts/reels?${params}`, { headers });
  if (!response.ok) {
    throw new Error("Failed to load reels");
  }
  const data = (await response.json()) as {
    posts?: HomePost[];
    nextCursor?: number | null;
    hasMore?: boolean;
  };
  const posts = Array.isArray(data.posts) ? data.posts.map(sanitizeHomePost) : [];
  return {
    posts,
    nextCursor: data.nextCursor ?? (posts.length ? posts[posts.length - 1]?.id ?? null : null),
    hasMore: Boolean(data.hasMore)
  };
}

/** First page only — used where a small snapshot is enough. */
export async function fetchHomePosts(token?: string | null) {
  const page = await fetchHomePostsPage(token, { limit: 50 });
  return { posts: page.posts };
}

/** Current user's posts only — lighter than loading the full home feed for profile. */
export async function fetchMyHomePosts(token: string) {
  const data = (await fetchWithAuth(`${API_BASE_URL}/v1/home/posts/mine`, token)) as { posts: HomePost[] };
  return { posts: data.posts.map(sanitizeHomePost) };
}

/** Any user's profile posts (public profile view). */
export async function fetchUserHomePosts(
  token: string | null | undefined,
  userId: number,
  userName?: string
) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const qs = userName?.trim() ? `?userName=${encodeURIComponent(userName.trim())}` : "";
  const response = await fetchWithRetry(
    `${API_BASE_URL}/v1/home/posts/user/${encodeURIComponent(String(userId))}${qs}`,
    { headers }
  );
  if (!response.ok) {
    throw new Error("Failed to load user posts");
  }
  const data = (await response.json()) as { posts: HomePost[] };
  return { posts: data.posts.map(sanitizeHomePost) };
}

export async function fetchHomePost(token: string | null | undefined, postId: number) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetchWithRetry(`${API_BASE_URL}/v1/home/posts/${encodeURIComponent(String(postId))}`, { headers });
  if (!response.ok) {
    throw new Error("Failed to load post");
  }
  const data = (await response.json()) as { post: HomePost };
  return { post: sanitizeHomePost(data.post) };
}

export type HomePostLiker = {
  userId: number;
  fullName: string;
  username?: string;
  avatarUrl?: string;
  createdAt?: string;
};

export async function fetchHomePostLikes(postId: number, token?: string | null) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/v1/home/posts/${encodeURIComponent(String(postId))}/likes`, {
      headers
    });
    if (!response.ok) {
      return { likers: [] as HomePostLiker[] };
    }
    const data = (await response.json()) as { likers?: HomePostLiker[] };
    return { likers: Array.isArray(data.likers) ? data.likers : [] };
  } catch {
    return { likers: [] as HomePostLiker[] };
  }
}

export async function likeHomePost(token: string, postId: number) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/home/posts/${encodeURIComponent(String(postId))}/like`, token, {
    method: "POST"
  })) as { liked: boolean; likesCount: number };
}

export async function unlikeHomePost(token: string, postId: number) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/home/posts/${encodeURIComponent(String(postId))}/unlike`, token, {
    method: "POST"
  })) as { liked: boolean; likesCount: number };
}

export async function fetchSavedHomePosts(token: string) {
  const data = (await fetchWithAuth(`${API_BASE_URL}/v1/home/posts/saved`, token)) as { posts: HomePost[] };
  return { posts: data.posts.map(sanitizeHomePost) };
}

export async function fetchLikedHomePosts(token: string) {
  const data = (await fetchWithAuth(`${API_BASE_URL}/v1/home/posts/liked`, token)) as { posts: HomePost[] };
  return { posts: data.posts.map(sanitizeHomePost) };
}

/**
 * Posts where the current user appears in `taggedUserIds`.
 * Returns an empty list when the server does not expose this route yet (e.g. 404 before redeploy).
 */
export async function fetchTaggedHomePosts(token: string) {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const response = await fetchWithRetry(`${API_BASE_URL}/v1/home/posts/tagged`, { headers });
  if (response.status === 404) {
    return { posts: [] as HomePost[] };
  }
  const data = (await parseJsonOrThrow(response)) as { posts: HomePost[] };
  return { posts: data.posts.map(sanitizeHomePost) };
}

export async function saveHomePost(token: string, postId: number) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/home/posts/${encodeURIComponent(String(postId))}/save`, token, {
    method: "POST"
  })) as { saved: boolean };
}

export async function unsaveHomePost(token: string, postId: number) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/home/posts/${encodeURIComponent(String(postId))}/unsave`, token, {
    method: "POST"
  })) as { saved: boolean };
}

export async function fetchResharedHomePosts(token: string) {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const response = await fetchWithRetry(`${API_BASE_URL}/v1/home/posts/reshared`, { headers });
  if (response.status === 404) {
    return { posts: [] as HomePost[] };
  }
  const data = (await parseJsonOrThrow(response)) as { posts: HomePost[] };
  return { posts: data.posts.map(sanitizeHomePost) };
}

export async function fetchRepostFeed(token: string, limit = 24) {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const response = await fetchWithRetry(`${API_BASE_URL}/v1/home/posts/repost-feed?limit=${limit}`, { headers });
  if (response.status === 404) {
    return { posts: [] as HomePost[] };
  }
  const data = (await parseJsonOrThrow(response)) as { posts: HomePost[] };
  return { posts: data.posts.map(sanitizeHomePost) };
}

export async function reshareHomePost(token: string, postId: number, quoteCaption?: string) {
  const body: { quoteCaption?: string } = {};
  if (quoteCaption != null && String(quoteCaption).trim()) {
    body.quoteCaption = String(quoteCaption).trim();
  }
  return (await fetchWithAuth(`${API_BASE_URL}/v1/home/posts/${encodeURIComponent(String(postId))}/reshare`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  })) as { reshared: boolean; quoteCaption?: string | null; resharesCount?: number };
}

export async function unreshareHomePost(token: string, postId: number) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/home/posts/${encodeURIComponent(String(postId))}/unreshare`, token, {
    method: "POST"
  })) as { reshared: boolean; resharesCount?: number };
}

export async function deleteHomePost(token: string, postId: number) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/home/posts/${encodeURIComponent(String(postId))}`, token, {
    method: "DELETE"
  })) as { ok: boolean };
}

export async function fetchRecentlyDeletedHomePosts(token: string) {
  const data = (await fetchWithAuth(`${API_BASE_URL}/v1/home/posts/recently-deleted`, token)) as { posts: HomePost[] };
  return { posts: data.posts.map(sanitizeHomePost) };
}

export async function restoreHomePost(token: string, postId: number) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/home/posts/${encodeURIComponent(String(postId))}/restore`, token, {
    method: "POST"
  })) as { ok: boolean; post?: HomePost };
}

export async function permanentlyDeleteHomePost(token: string, postId: number) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/home/posts/${encodeURIComponent(String(postId))}/permanent`, token, {
    method: "DELETE"
  })) as { ok: boolean };
}

export async function reportHomePost(token: string, postId: number, reason?: string) {
  const body: { reason?: string } = {};
  if (reason != null && String(reason).trim()) {
    body.reason = String(reason).trim().slice(0, 500);
  }
  return (await fetchWithAuth(
    `${API_BASE_URL}/v1/home/posts/${encodeURIComponent(String(postId))}/report`,
    token,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  )) as { ok: boolean };
}

export async function reportUser(token: string, userId: number, reason?: string) {
  const body: { reason?: string } = {};
  if (reason != null && String(reason).trim()) {
    body.reason = String(reason).trim().slice(0, 500);
  }
  return (await fetchWithAuth(`${API_BASE_URL}/v1/users/${encodeURIComponent(String(userId))}/report`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  })) as { ok: boolean };
}

export async function fetchHomePostComments(postId: number, token?: string | null) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetchWithRetry(`${API_BASE_URL}/v1/home/posts/${encodeURIComponent(String(postId))}/comments`, { headers });
  if (!response.ok) {
    throw new Error("Failed to load comments");
  }
  return (await response.json()) as {
    comments: {
      id: string;
      user: string;
      text: string;
      likes: number;
      avatarUrl?: string | null;
      createdAt?: string;
      parentCommentId?: string;
      userId?: number;
    }[];
  };
}

export async function createHomePostComment(
  token: string,
  postId: number,
  text: string,
  options?: { parentCommentId?: number | null }
) {
  const body: { text: string; parentCommentId?: number } = { text };
  if (options?.parentCommentId != null && Number.isFinite(options.parentCommentId) && options.parentCommentId > 0) {
    body.parentCommentId = Number(options.parentCommentId);
  }
  return (await fetchWithAuth(`${API_BASE_URL}/v1/home/posts/${encodeURIComponent(String(postId))}/comments`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  })) as {
    comment: {
      id: string;
      user: string;
      text: string;
      likes: number;
      createdAt?: string;
      avatarUrl?: string | null;
      parentCommentId?: string;
      userId?: number;
    };
    commentsCount: number;
  };
}

export async function deleteHomePostComment(token: string, postId: number, commentId: string) {
  return (await fetchWithAuth(
    `${API_BASE_URL}/v1/home/posts/${encodeURIComponent(String(postId))}/comments/${encodeURIComponent(commentId)}`,
    token,
    { method: "DELETE" }
  )) as { ok: boolean; commentsCount: number };
}

export async function fetchLearnCourses() {
  const response = await fetchWithRetry(`${API_BASE_URL}/v1/learn/courses`);
  if (!response.ok) {
    throw new Error("Failed to load courses");
  }
  return (await response.json()) as { courses: Course[] };
}

export async function fetchLearnCourseById(courseId: string) {
  const response = await fetchWithRetry(`${API_BASE_URL}/v1/learn/courses/${encodeURIComponent(courseId)}`);
  if (!response.ok) {
    throw new Error("Failed to load course");
  }
  return (await response.json()) as { course: Course };
}

export async function enrollInCourse(courseId: string, token: string, paid: boolean) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/learn/courses/${encodeURIComponent(courseId)}/enroll`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paid })
  })) as { enrollment: { courseId: string; status: string; isPaid: boolean } };
}

export async function fetchCourseProgress(courseId: string, token: string) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/learn/courses/${encodeURIComponent(courseId)}/progress`, token)) as {
    progress: { lessonId: string; completed: boolean; lastWatchedSeconds: number; updatedAt: string }[];
  };
}

export async function saveCourseProgress(
  courseId: string,
  token: string,
  payload: { lessonId: string; completed: boolean; lastWatchedSeconds: number }
) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/learn/courses/${encodeURIComponent(courseId)}/progress`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })) as { progress: { lessonId: string; completed: boolean; lastWatchedSeconds: number; updatedAt: string } };
}

export async function createCourse(token: string, payload: Course) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/learn/courses`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })) as { courseId: string };
}

export async function updateCourse(token: string, courseId: string, payload: Course) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/learn/courses/${encodeURIComponent(courseId)}`, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })) as { ok: boolean };
}

export async function createHomePost(payload: {
  userId?: number;
  userName: string;
  location: string;
  caption: string;
  videoUrl?: string;
  imageUrl?: string;
  imageUrls?: string[];
  thumbnailUrl?: string;
  taggedUserIds?: number[];
  musicLabel?: string;
  musicAudioUrl?: string;
  creativeMeta?: {
    filter?: string;
    overlayText?: string;
    textColor?: string;
    textBackground?: boolean;
    font?: string;
  };
}, token?: string | null) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetchWithRetry(`${API_BASE_URL}/v1/home/posts`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error("Failed to create post");
  }
  const data = (await response.json()) as { post: HomePost };
  return { post: sanitizeHomePost(data.post) };
}

export async function updateHomePostLiveVideo(
  token: string,
  postId: number,
  payload: { videoUrl: string; thumbnailUrl?: string }
) {
  const data = (await fetchWithAuth(`${API_BASE_URL}/v1/home/posts/${encodeURIComponent(String(postId))}/live-video`, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })) as { post: HomePost };
  return { post: sanitizeHomePost(data.post) };
}

export type LiveRecordingMeta = {
  saved: boolean;
  egressConfigured?: boolean;
  egressStarted?: boolean;
  egressError?: string | null;
  message: string;
};

export async function fetchLiveSetupCheck(token: string) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/live/setup-check`, token, {
    method: "GET"
  })) as {
    configured: boolean;
    ok: boolean;
    egressRecording: boolean;
    issues?: string[];
  };
}

export async function endHomeLivePost(token: string, postId: number) {
  const data = (await fetchWithAuth(`${API_BASE_URL}/v1/home/posts/${encodeURIComponent(String(postId))}/end-live`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  })) as { post: HomePost; liveRecording?: LiveRecordingMeta };
  return {
    post: sanitizeHomePost(data.post),
    liveRecording: data.liveRecording
  };
}

export type ScheduledLive = {
  id: number;
  topic: string;
  scheduledAt: string;
  status: string;
  postId?: number | null;
  createdAt?: string;
  startedAt?: string | null;
};

export async function scheduleLiveSession(token: string, payload: { topic: string; scheduledAt: string }) {
  const init = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  };
  try {
    return (await fetchWithAuth(`${API_BASE_URL}/v1/live/schedule`, token, init)) as {
      ok: boolean;
      id?: number;
      topic: string;
      scheduledAt: string;
      reminderScheduled?: boolean;
    };
  } catch (error: any) {
    if (Number(error?.status) !== 404) throw error;
    return (await fetchWithAuth(`${API_BASE_URL}/v1/social/live/schedule`, token, init)) as {
      ok: boolean;
      id?: number;
      topic: string;
      scheduledAt: string;
      reminderScheduled?: boolean;
    };
  }
}

export async function fetchMyScheduledLives(token: string) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/live/scheduled/mine`, token)) as { scheduledLives: ScheduledLive[] };
}

export async function startScheduledLiveSession(token: string, scheduleId: number, postId?: number) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/live/scheduled/${encodeURIComponent(String(scheduleId))}/start`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(postId ? { postId } : {})
  })) as { scheduledLive: ScheduledLive };
}

export async function createLiveKitToken(token: string, payload: { roomName: string; canPublish: boolean }) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/live/token`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })) as { token: string; url: string; roomName: string; identity: string; name: string };
}

/** Ask the server to start LiveKit room composite egress (phone replay). */
export async function startLiveServerRecording(token: string, roomName: string) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/live/start-recording`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomName })
  })) as { started: boolean; egressId?: string | null; egressRecording?: boolean; error?: string | null };
}

export async function sendFollowRequest(token: string, targetUserId: number) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/social/follow/request`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetUserId })
  })) as {
    follow: { id: number; status: FollowStatus; followerId: number; followingId: number };
    actorCounts: { followersCount: number; followingCount: number };
    targetCounts: { followersCount: number; followingCount: number };
  };
}

export async function unfollowUser(token: string, targetUserId: number) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/social/follow/unfollow`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetUserId })
  })) as {
    ok: boolean;
    actorCounts: { followersCount: number; followingCount: number };
    targetCounts: { followersCount: number; followingCount: number };
  };
}

export type BlockedUser = {
  userId: number;
  fullName: string;
  username?: string | null;
  avatarUrl?: string | null;
  blockedAt?: string;
};

export async function fetchBlockedUsers(token: string) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/social/blocks`, token)) as { users: BlockedUser[] };
}

export async function blockUser(token: string, targetUserId: number) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/social/block`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetUserId })
  })) as { ok: boolean; blocked: boolean };
}

export async function unblockUser(token: string, targetUserId: number) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/social/block/${encodeURIComponent(String(targetUserId))}`, token, {
    method: "DELETE"
  })) as { ok: boolean; unblocked: boolean; removed?: number };
}

export async function removeFollower(token: string, targetUserId: number) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/social/follow/remove-follower`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetUserId })
  })) as {
    ok: boolean;
    actorCounts: { followersCount: number; followingCount: number };
    targetCounts: { followersCount: number; followingCount: number };
  };
}

export async function respondToFollowRequest(token: string, followId: number, action: "accept" | "decline") {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/social/follow/${followId}/respond`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action })
  })) as {
    follow: { id: number; status: FollowStatus; followerId: number; followingId: number };
    actorCounts: { followersCount: number; followingCount: number };
    targetCounts: { followersCount: number; followingCount: number };
  };
}

export async function fetchProfileStats(token: string, userId: number) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/social/profile-stats/${encodeURIComponent(String(userId))}`, token)) as {
    id: number;
    fullName: string;
    username?: string | null;
    avatarUrl?: string | null;
    bio?: string | null;
    website?: string | null;
    locationLabel?: string | null;
    createdAt?: string;
    postsCount: number;
    reelsCount: number;
    followersCount: number;
    followingCount: number;
    followers?: Array<{ name: string; key?: string; username?: string; avatarUrl?: string | null }>;
    following?: Array<{ name: string; key?: string; username?: string; avatarUrl?: string | null }>;
    viewerStatus: FollowStatus;
    reverseStatus: FollowStatus;
    canFollowBack: boolean;
    incomingFollowId?: number | null;
  };
}

export async function syncLocalFollowEdgesToServer(
  token: string,
  payload: {
    edges: Array<{ peerFullName: string; relation: "i_follow" | "follows_me"; status: "accepted" | "pending" }>;
  }
) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/social/follow/sync-local`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })) as {
    ok: boolean;
    imported: number;
    synced?: Array<{ peerFullName: string; relation: string; status: string }>;
    followersCount: number;
    followingCount: number;
  };
}

export type MutualConnectionInfo = {
  followsYou: boolean;
  mutual: Array<{ userId: number; fullName: string; avatarUrl?: string }>;
  mutualCount: number;
};

export async function fetchMutualConnections(token: string, userIds: number[]) {
  const ids = [...new Set(userIds.filter((id) => Number.isFinite(id) && id > 0))].slice(0, 40);
  if (!ids.length) return { connections: {} as Record<number, MutualConnectionInfo> };
  return (await fetchWithAuth(`${API_BASE_URL}/v1/social/mutual-connections`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userIds: ids })
  })) as { connections: Record<number, MutualConnectionInfo> };
}

export async function fetchSocialNetwork(token: string, userId: number) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/social/network/${encodeURIComponent(String(userId))}`, token)) as {
    followers: Array<{
      name: string;
      key?: string;
      avatarUrl?: string | null;
      viewerStatus: "none" | "pending" | "accepted";
      canFollowBack: boolean;
    }>;
    following: Array<{
      name: string;
      key?: string;
      avatarUrl?: string | null;
      viewerStatus: "accepted";
      canFollowBack: false;
    }>;
  };
}

export async function fetchSocialNotifications(token: string) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/social/notifications`, token)) as {
    followRequests: SocialNotificationItem[];
    followAccepted: SocialNotificationItem[];
    postLikes?: SocialPostActivityNotification[];
    postComments?: SocialPostActivityNotification[];
    liveStarts?: SocialPostActivityNotification[];
    unreadCount: number;
  };
}

export async function markSocialNotificationRead(token: string, notificationId: number) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/social/notifications/${encodeURIComponent(String(notificationId))}/read`, token, {
    method: "POST"
  })) as { ok: boolean };
}

export async function markAllSocialNotificationsRead(token: string) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/social/notifications/read-all`, token, {
    method: "POST"
  })) as { ok: boolean; marked?: number };
}

export async function registerPushToken(
  token: string,
  body: { token: string; platform: "android" | "ios" | string }
) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/push/register`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  })) as { ok: boolean };
}

export type PushNotificationSettings = {
  pushEnabled: boolean;
  messagesEnabled: boolean;
  activityEnabled: boolean;
  sleepMode: boolean;
  pauseAii: boolean;
  followingAndFollowers: boolean;
  liveAndDrops: boolean;
};

export async function fetchPushSettings(token: string) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/push/settings`, token)) as PushNotificationSettings;
}

export async function updatePushSettings(token: string, settings: PushNotificationSettings) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/push/settings`, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings)
  })) as PushNotificationSettings;
}

export async function unregisterPushToken(authToken: string, deviceToken: string) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/push/register`, authToken, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: deviceToken })
  })) as { ok: boolean; removed?: number };
}

export async function fetchRelationships(token: string, userIds: number[]) {
  const cleaned = [...new Set(userIds.filter((v) => Number.isFinite(v) && v > 0))];
  if (!cleaned.length) return { relationships: {} as Record<number, SocialRelationship> };
  const qs = cleaned.join(",");
  return (await fetchWithAuth(`${API_BASE_URL}/v1/social/relationships?userIds=${encodeURIComponent(qs)}`, token)) as {
    relationships: Record<number, SocialRelationship>;
  };
}

export async function fetchMessageThreads(token: string) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/messages/threads`, token)) as {
    threads: MessageThread[];
  };
}

export async function fetchMessageThread(
  token: string,
  peerUserId: number,
  options?: { limit?: number; beforeId?: number }
) {
  const params = new URLSearchParams();
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.beforeId) params.set("beforeId", String(options.beforeId));
  const qs = params.toString();
  return (await fetchWithAuth(
    `${API_BASE_URL}/v1/messages/thread/${encodeURIComponent(String(peerUserId))}${qs ? `?${qs}` : ""}`,
    token
  )) as {
    peer: { id: number; fullName: string; email?: string; phone?: string; avatarUrl?: string | null };
    messages: DirectMessageItem[];
    hasMore?: boolean;
  };
}

export async function fetchPublicSocialLists(token: string, userId: number) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/social/public-lists/${encodeURIComponent(String(userId))}`, token)) as {
    followers: Array<{ name: string; key?: string; username?: string; avatarUrl?: string | null }>;
    following: Array<{ name: string; key?: string; username?: string; avatarUrl?: string | null }>;
  };
}

export async function ringDirectCall(
  token: string,
  payload: { peerUserId: number; mode: "voice" | "video" }
) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/calls/ring`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })) as { roomName: string; mode: "voice" | "video"; peerUserId: number };
}

export async function cancelDirectCall(
  token: string,
  payload: { peerUserId: number; roomName: string; mode?: "voice" | "video" }
) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/calls/cancel`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })) as { ok: boolean; peerUserId: number; roomName: string };
}

export async function sendDirectMessage(token: string, peerUserId: number, text: string) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/messages/thread/${encodeURIComponent(String(peerUserId))}`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  })) as { message: DirectMessageItem };
}

export async function deleteDirectMessage(token: string, messageId: number) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/messages/${encodeURIComponent(String(messageId))}`, token, {
    method: "DELETE"
  })) as { ok: boolean; messageId: number };
}

function mimeFromUri(uri: string, fallback: string) {
  const clean = uri.split("?")[0].toLowerCase();
  if (clean.endsWith(".mp4")) return "video/mp4";
  if (clean.endsWith(".mov") || clean.endsWith(".qt")) return "video/quicktime";
  if (clean.endsWith(".webm")) return "video/webm";
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".webp")) return "image/webp";
  if (clean.endsWith(".gif")) return "image/gif";
  if (clean.endsWith(".heic")) return "image/heic";
  if (clean.endsWith(".jpg") || clean.endsWith(".jpeg")) return "image/jpeg";
  return fallback;
}

export type PickerAssetMeta = {
  type?: string | null;
  mimeType?: string | null;
  uri?: string | null;
  fileName?: string | null;
  width?: number | null;
  height?: number | null;
  /** Expo: video duration in ms; images often 0 or undefined */
  duration?: number | null;
};

/**
 * True → image upload. False → video upload.
 * Android `content://` and web `blob:` URIs usually have no file extension — do not rely on uri alone.
 */
export function shouldUseImageUpload(uri: string, asset?: PickerAssetMeta | null): boolean {
  if (asset?.type === "video") return false;
  if (asset?.type === "image") return true;

  const mime = String(asset?.mimeType || "").toLowerCase();
  if (mime.startsWith("video/")) return false;
  if (mime.startsWith("image/")) return true;

  if (asset && asset.duration != null && Number(asset.duration) > 0) return false;

  const fn = String(asset?.fileName || "").toLowerCase();
  if (/\.(jpe?g|png|gif|webp|heic|bmp|avif)$/i.test(fn)) return true;
  if (/\.(mp4|mov|webm|m4v|mkv|avi)$/i.test(fn)) return false;

  const raw = uri || asset?.uri || "";
  const path = decodeURIComponent(raw.split("?")[0] || "").toLowerCase();

  if (path.startsWith("data:image/")) return true;
  if (path.startsWith("data:video/")) return false;
  if (/\.(jpe?g|png|gif|webp|heic|bmp|avif)$/i.test(path)) return true;
  if (/\.(mp4|mov|webm|m4v|mkv|avi)$/i.test(path)) return false;

  if (path.startsWith("content://")) {
    if (path.includes("/images/") || path.includes("/image/")) return true;
    if (path.includes("/video/")) return false;
    if (path.includes("image%3a") || path.includes("image:")) return true;
    if (path.includes("video%3a") || path.includes("video:")) return false;
    if (path.includes("/document/image")) return true;
    if (path.includes("/document/video")) return false;
  }

  if (path.startsWith("blob:")) {
    if (mime.startsWith("video/")) return false;
    if (mime.startsWith("image/")) return true;
    return true;
  }

  if (path.startsWith("file://")) {
    return /\.(jpe?g|png|gif|webp|heic|bmp|avif)$/i.test(path);
  }

  if (path.startsWith("ph://") || path.startsWith("assets-library://")) {
    if (asset && asset.duration != null && Number(asset.duration) > 0) return false;
    return true;
  }

  return false;
}

function imageFilenameFromUri(uri: string) {
  const m = uri.split("?")[0].match(/\.(jpe?g|png|gif|webp|heic|bmp|avif)$/i);
  const ext = m ? m[0].toLowerCase() : ".jpg";
  return `image-${Date.now()}${ext}`;
}

async function uploadToSupabaseServer(fileUri: string, filename: string, nativeMime: string) {
  const form = new FormData();
  if (Platform.OS === "web") {
    const webResp = await fetch(fileUri);
    const blob = await webResp.blob();
    (form as any).append("file", blob, filename);
  } else {
    (form as any).append(
      "file",
      {
        // @ts-ignore React Native FormData file type shape
        uri: fileUri,
        name: filename,
        type: nativeMime
      } as any
    );
  }

  let uploadRes: Response;
  if (Platform.OS === "web") {
    // Web uploads can run longer on browser/network; keep one long request to avoid duplicate uploads.
    const controller = new AbortController();
    const timeoutMs = 10 * 60 * 1000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      uploadRes = await fetch(`${API_BASE_URL}/v1/media/upload`, {
        method: "POST",
        body: form as any,
        signal: controller.signal
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error || "");
      if (/aborted|abort|timed out|timeout/i.test(msg)) {
        throw new Error("Upload timed out. Check internet speed and try a smaller video.");
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  } else {
    uploadRes = await fetchWithRetry(
      `${API_BASE_URL}/v1/media/upload`,
      {
        method: "POST",
        body: form as any
      },
      120_000
    );
  }
  if (!uploadRes.ok) {
    let detail = `Upload failed (${uploadRes.status})`;
    try {
      const body = (await uploadRes.json()) as { message?: string; error?: string; hint?: string };
      const msg = body?.error || body?.message;
      if (msg) {
        detail = `${msg}${body?.hint ? ` (${body.hint})` : ""}`;
      }
      if (/maximum allowed size|file too large|50mb/i.test(detail)) {
        detail = `Maximum upload size is 50MB. Use a shorter clip or lower resolution.`;
      }
    } catch {
      // ignore
    }
    throw new Error(detail);
  }
  const uploaded = (await uploadRes.json()) as { url?: string };
  if (!uploaded.url) throw new Error("Upload response missing URL");
  return { url: uploaded.url };
}

export async function uploadVideoFile(fileUri: string, asset?: PickerAssetMeta | null) {
  const nameFromUri = fileUri.split("?")[0].match(/\.(mp4|mov|webm|m4v)$/i);
  const ext = nameFromUri ? nameFromUri[0].toLowerCase() : ".mp4";
  const localUri = await ensureLocalFileUri(fileUri, ext);
  await assertVideoUnderUploadLimit(localUri);
  assertVideoResolutionWithinLimit(asset?.width ?? undefined, asset?.height ?? undefined);
  const mime =
    ext === ".webm" ? "video/webm" : ext === ".mov" ? "video/quicktime" : ext === ".m4v" ? "video/x-m4v" : "video/mp4";
  return uploadToSupabaseServer(localUri, `video-${Date.now()}${ext}`, mime);
}

export async function uploadImageFile(fileUri: string, options?: { profile?: boolean }) {
  const prepared = options?.profile
    ? await prepareProfileImageForUpload(fileUri)
    : await prepareImageForUpload(fileUri);
  return uploadToSupabaseServer(prepared.uri, prepared.filename, prepared.mime);
}

export async function uploadAudioFile(fileUri: string) {
  const lower = fileUri.split("?")[0].toLowerCase();
  const ext = lower.endsWith(".caf") ? ".caf" : lower.endsWith(".mp3") ? ".mp3" : ".m4a";
  const mime = ext === ".mp3" ? "audio/mpeg" : ext === ".caf" ? "audio/x-caf" : "audio/m4a";
  return uploadToSupabaseServer(fileUri, `audio-${Date.now()}${ext}`, mime);
}

/** Single entry: picks image vs video upload from picker metadata (avoids JPEG → /video/upload). */
export async function uploadPickedMedia(uri: string, asset?: PickerAssetMeta | null) {
  return shouldUseImageUpload(uri, asset) ? uploadImageFile(uri) : uploadVideoFile(uri, asset);
}

export type RazorpayOrderPayload = {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
};

export type RazorpayCreateOrderResult =
  | { mock: true; keyId: string; order: RazorpayOrderPayload; message?: string }
  | { mock: false; keyId: string; order: RazorpayOrderPayload };

export async function createRazorpayOrder(payload: { amountPaise: number; receipt?: string }) {
  const response = await fetchWithRetry(`${API_BASE_URL}/v1/payments/razorpay/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amountPaise: payload.amountPaise, receipt: payload.receipt })
  });
  return (await parseJsonOrThrow(response)) as RazorpayCreateOrderResult;
}

export async function verifyRazorpayPayment(body: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}) {
  const response = await fetchWithRetry(`${API_BASE_URL}/v1/payments/razorpay/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return (await parseJsonOrThrow(response)) as { ok: boolean; mock?: boolean };
}
