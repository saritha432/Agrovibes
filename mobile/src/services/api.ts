import { Platform } from "react-native";
import { sanitizeHomePost, sanitizeHomeStory, stripLegacyCloudinaryUrl } from "../utils/mediaUrls";
import { assertVideoUnderUploadLimit } from "../utils/mediaUploadSize";

/** Production API URL used whenever the build/runtime can't determine a local backend. */
const PRODUCTION_API_BASE_URL = "https://agrovibes.onrender.com/api";

function resolveApiBaseUrl() {
  const envUrl = (process.env as Record<string, string | undefined>).EXPO_PUBLIC_API_BASE_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/$/, "");
  }

  const webLocation = (globalThis as { location?: { hostname?: string } }).location;
  if (Platform.OS === "web" && webLocation?.hostname) {
    const host = webLocation.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:5000/api";
    }
    return PRODUCTION_API_BASE_URL;
  }

  // Native binaries (APK / IPA) — when no env var is baked in, always hit production.
  // We used to fall back to http://10.0.2.2:5000 here, but that's emulator-only and
  // causes "Network Error" on real devices, so production is the safe default.
  if (__DEV__) {
    if (Platform.OS === "android") return "http://10.0.2.2:5000/api";
    return "http://localhost:5000/api";
  }
  return PRODUCTION_API_BASE_URL;
}

export const API_BASE_URL = resolveApiBaseUrl();

/**
 * Public web app origin for share / deep links (no trailing slash).
 * Set `EXPO_PUBLIC_WEB_BASE_URL` for native builds (EAS env). On web, the current
 * `window.location.origin` is used when env is unset so a new Vercel URL works without a rebuild.
 */
export function getWebAppOrigin(): string {
  const raw = (process.env as Record<string, string | undefined>).EXPO_PUBLIC_WEB_BASE_URL;
  const fromEnv = typeof raw === "string" ? raw.trim().replace(/\/$/, "") : "";
  if (fromEnv) return fromEnv;

  const loc = (globalThis as { location?: { protocol?: string; hostname?: string; port?: string } }).location;
  if (typeof loc?.hostname === "string" && loc.hostname.length > 0) {
    const host = loc.hostname;
    if (host !== "localhost" && host !== "127.0.0.1") {
      const port = loc.port ? `:${loc.port}` : "";
      const protocol = loc.protocol && loc.protocol.length > 0 ? loc.protocol : "https:";
      return `${protocol}//${host}${port}`;
    }
  }

  return "https://agrovibes.app";
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
  email: string;
  password: string;
  fullName: string;
  role?: string;
  username?: string;
  phone?: string;
}) {
  const response = await fetch(`${API_BASE_URL}/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return (await parseJsonOrThrow(response)) as AuthResponse;
}

export async function authLogin(payload: { email?: string; identifier?: string; password: string }) {
  const response = await fetch(`${API_BASE_URL}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return (await parseJsonOrThrow(response)) as AuthResponse;
}

export async function sendPhoneOtp(payload: { phone: string }) {
  const response = await fetch(`${API_BASE_URL}/v1/auth/phone/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return (await parseJsonOrThrow(response)) as { success: boolean; phone: string; channel: "sms" | "whatsapp" };
}

export async function verifyPhoneOtp(payload: { phone: string; code: string }) {
  const response = await fetch(`${API_BASE_URL}/v1/auth/phone/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return (await parseJsonOrThrow(response)) as AuthResponse;
}

export async function updateMyProfile(
  token: string,
  payload: {
    fullName: string;
    username?: string;
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
  const response = await fetch(`${API_BASE_URL}/v1/auth/phone/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return (await parseJsonOrThrow(response)) as { success: boolean };
}

export async function fetchWithAuth(url: string, token: string | null, init: RequestInit = {}) {
  const headers: any = { ...(init.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, { ...init, headers });
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
  followStatus: FollowStatus;
}

export interface SocialPostActivityNotification {
  id: number;
  type: "post_like" | "post_comment" | "comment_reply";
  isRead: boolean;
  createdAt: string;
  actorId: number;
  actorName: string;
  postId: number | null;
  postIsReel?: boolean;
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
  const response = await fetch(`${API_BASE_URL}/v1/marketplace/listings`);
  if (!response.ok) {
    throw new Error("Failed to load marketplace listings");
  }
  return (await response.json()) as { listings: MarketplaceListing[] };
}

export async function fetchCommunityQuestions() {
  const response = await fetch(`${API_BASE_URL}/v1/community/questions`);
  if (!response.ok) {
    throw new Error("Failed to load community questions");
  }
  return (await response.json()) as { questions: CommunityQuestion[] };
}

export async function fetchHomeStories() {
  const response = await fetch(`${API_BASE_URL}/v1/home/stories`);
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
  const response = await fetch(`${API_BASE_URL}/v1/home/stories`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error("Failed to create story");
  }
  return (await response.json()) as { story: HomeStory };
}

export async function fetchHomePosts(token?: string | null) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE_URL}/v1/home/posts`, { headers });
  if (!response.ok) {
    throw new Error("Failed to load home posts");
  }
  const data = (await response.json()) as { posts: HomePost[] };
  return { posts: data.posts.map(sanitizeHomePost) };
}

/** Current user's posts only — lighter than loading the full home feed for profile. */
export async function fetchMyHomePosts(token: string) {
  const data = (await fetchWithAuth(`${API_BASE_URL}/v1/home/posts/mine`, token)) as { posts: HomePost[] };
  return { posts: data.posts.map(sanitizeHomePost) };
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
    const response = await fetch(`${API_BASE_URL}/v1/home/posts/${encodeURIComponent(String(postId))}/likes`, {
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

/**
 * Posts where the current user appears in `taggedUserIds`.
 * Returns an empty list when the server does not expose this route yet (e.g. 404 before redeploy).
 */
export async function fetchTaggedHomePosts(token: string) {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const response = await fetch(`${API_BASE_URL}/v1/home/posts/tagged`, { headers });
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

export async function deleteHomePost(token: string, postId: number) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/home/posts/${encodeURIComponent(String(postId))}`, token, {
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

export async function fetchHomePostComments(postId: number, token?: string | null) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE_URL}/v1/home/posts/${encodeURIComponent(String(postId))}/comments`, { headers });
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
  const response = await fetch(`${API_BASE_URL}/v1/learn/courses`);
  if (!response.ok) {
    throw new Error("Failed to load courses");
  }
  return (await response.json()) as { courses: Course[] };
}

export async function fetchLearnCourseById(courseId: string) {
  const response = await fetch(`${API_BASE_URL}/v1/learn/courses/${encodeURIComponent(courseId)}`);
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
  const response = await fetch(`${API_BASE_URL}/v1/home/posts`, {
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

export async function endHomeLivePost(token: string, postId: number) {
  const data = (await fetchWithAuth(`${API_BASE_URL}/v1/home/posts/${encodeURIComponent(String(postId))}/end-live`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  })) as { post: HomePost };
  return { post: sanitizeHomePost(data.post) };
}

export async function scheduleLiveSession(token: string, payload: { topic: string; scheduledAt: string }) {
  const init = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  };
  try {
    return (await fetchWithAuth(`${API_BASE_URL}/v1/live/schedule`, token, init)) as {
      ok: boolean;
      topic: string;
      scheduledAt: string;
    };
  } catch (error: any) {
    if (Number(error?.status) !== 404) throw error;
    return (await fetchWithAuth(`${API_BASE_URL}/v1/social/live/schedule`, token, init)) as {
      ok: boolean;
      topic: string;
      scheduledAt: string;
    };
  }
}

export async function createLiveKitToken(token: string, payload: { roomName: string; canPublish: boolean }) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/live/token`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })) as { token: string; url: string; roomName: string; identity: string; name: string };
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
    viewerStatus: FollowStatus;
    reverseStatus: FollowStatus;
    canFollowBack: boolean;
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

export async function fetchMessageThread(token: string, peerUserId: number) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/messages/thread/${encodeURIComponent(String(peerUserId))}`, token)) as {
    peer: { id: number; fullName: string; email?: string; phone?: string; avatarUrl?: string | null };
    messages: DirectMessageItem[];
  };
}

export async function sendDirectMessage(token: string, peerUserId: number, text: string) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/messages/thread/${encodeURIComponent(String(peerUserId))}`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  })) as { message: DirectMessageItem };
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

  const uploadRes = await fetch(`${API_BASE_URL}/v1/media/upload`, {
    method: "POST",
    body: form as any
  });
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

export async function uploadVideoFile(fileUri: string) {
  await assertVideoUnderUploadLimit(fileUri);
  const nameFromUri = fileUri.split("?")[0].match(/\.(mp4|mov|webm|m4v)$/i);
  const ext = nameFromUri ? nameFromUri[0].toLowerCase() : ".mp4";
  return uploadToSupabaseServer(fileUri, `video-${Date.now()}${ext}`, "video/mp4");
}

export async function uploadImageFile(fileUri: string) {
  const filename = imageFilenameFromUri(fileUri);
  const mime = mimeFromUri(fileUri, "image/jpeg");
  return uploadToSupabaseServer(fileUri, filename, mime);
}

/** Single entry: picks image vs video upload from picker metadata (avoids JPEG → /video/upload). */
export async function uploadPickedMedia(uri: string, asset?: PickerAssetMeta | null) {
  return shouldUseImageUpload(uri, asset) ? uploadImageFile(uri) : uploadVideoFile(uri);
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
  const response = await fetch(`${API_BASE_URL}/v1/payments/razorpay/create-order`, {
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
  const response = await fetch(`${API_BASE_URL}/v1/payments/razorpay/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return (await parseJsonOrThrow(response)) as { ok: boolean; mock?: boolean };
}
