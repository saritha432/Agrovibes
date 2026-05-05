import { Platform } from "react-native";

function resolveApiBaseUrl() {
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/$/, "");
  }

  if (Platform.OS === "android") {
    return "http://10.0.2.2:5000/api";
  }
  return "http://localhost:5000/api";
}

export const API_BASE_URL = resolveApiBaseUrl();

export interface AuthResponse {
  token: string;
  user: { id: number; email: string; fullName: string; role: "student" | "instructor" | "admin"; phone?: string };
  isNewUser?: boolean;
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
  hasNew: boolean;
  viewed: boolean;
  videoUrl?: string | null;
  imageUrl?: string | null;
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
  createdAt: string;
  /** Present when posts are loaded with an auth token (server-tracked like). */
  viewerHasLiked?: boolean;
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
  lastMessage: string;
  lastAt: string;
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
  return (await response.json()) as { stories: HomeStory[] };
}

export async function createHomeStory(payload: { userName: string; district: string; videoUrl?: string; imageUrl?: string }) {
  const response = await fetch(`${API_BASE_URL}/v1/home/stories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error("Failed to create story");
  }
  return (await response.json()) as { story: HomeStory };
}

export async function deleteHomeStory(storyId: number, userName: string) {
  const response = await fetch(`${API_BASE_URL}/v1/home/stories/${encodeURIComponent(String(storyId))}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName })
  });
  if (!response.ok) {
    throw new Error("Failed to delete story");
  }
  return (await response.json()) as { ok: true; deletedId: number };
}

export async function fetchHomePosts(token?: string | null) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE_URL}/v1/home/posts`, { headers });
  if (!response.ok) {
    throw new Error("Failed to load home posts");
  }
  return (await response.json()) as { posts: HomePost[] };
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

export async function fetchHomePostComments(postId: number, token?: string | null) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE_URL}/v1/home/posts/${encodeURIComponent(String(postId))}/comments`, { headers });
  if (!response.ok) {
    throw new Error("Failed to load comments");
  }
  return (await response.json()) as {
    comments: { id: string; user: string; text: string; likes: number; createdAt?: string; parentCommentId?: string }[];
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
    comment: { id: string; user: string; text: string; likes: number; createdAt?: string; parentCommentId?: string };
    commentsCount: number;
  };
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
}) {
  const response = await fetch(`${API_BASE_URL}/v1/home/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error("Failed to create post");
  }
  return (await response.json()) as { post: HomePost };
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

export async function fetchSocialNetwork(token: string, userId: number) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/social/network/${encodeURIComponent(String(userId))}`, token)) as {
    followers: Array<{ name: string; key?: string; viewerStatus: "none" | "pending" | "accepted"; canFollowBack: boolean }>;
    following: Array<{ name: string; key?: string; viewerStatus: "accepted"; canFollowBack: false }>;
  };
}

export async function fetchSocialNotifications(token: string) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/social/notifications`, token)) as {
    followRequests: SocialNotificationItem[];
    followAccepted: SocialNotificationItem[];
    postLikes?: SocialPostActivityNotification[];
    postComments?: SocialPostActivityNotification[];
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
    peer: { id: number; fullName: string; email?: string };
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

async function signCloudinaryUpload(folder = "agrovibes") {
  const signRes = await fetch(`${API_BASE_URL}/v1/media/cloudinary-sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder })
  });
  if (!signRes.ok) throw new Error("Failed to sign upload");
  return (await signRes.json()) as {
    cloudName: string;
    apiKey: string;
    timestamp: number;
    folder: string;
    signature: string;
  };
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
 * True → use Cloudinary `image/upload`. False → `video/upload`.
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

async function throwCloudinaryError(uploadRes: Response, label: string) {
  let detail = `${uploadRes.status} ${uploadRes.statusText}`;
  try {
    const body = (await uploadRes.json()) as { error?: { message?: string } };
    if (body?.error?.message) detail = body.error.message;
  } catch {
    // ignore
  }
  throw new Error(`${label}: ${detail}`);
}

async function uploadToCloudinary(
  fileUri: string,
  filename: string,
  nativeMimeFallback: string,
  resource: "image" | "video"
) {
  const sign = await signCloudinaryUpload();
  const form = new FormData();
  const nativeMime = mimeFromUri(fileUri, nativeMimeFallback);

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

  form.append("api_key", sign.apiKey);
  form.append("timestamp", String(sign.timestamp));
  form.append("folder", sign.folder);
  form.append("signature", sign.signature);

  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${sign.cloudName}/${resource}/upload`, {
    method: "POST",
    body: form as any
  });

  if (!uploadRes.ok) await throwCloudinaryError(uploadRes, "Cloudinary upload failed");
  const uploaded = (await uploadRes.json()) as { secure_url?: string; url?: string };
  const url = uploaded.secure_url ?? uploaded.url;
  if (!url) throw new Error("Cloud upload missing URL");
  return { url };
}

export async function uploadVideoFile(fileUri: string) {
  const nameFromUri = fileUri.split("?")[0].match(/\.(mp4|mov|webm|m4v)$/i);
  const ext = nameFromUri ? nameFromUri[0].toLowerCase() : ".mp4";
  return uploadToCloudinary(fileUri, `video-${Date.now()}${ext}`, "video/mp4", "video");
}

export async function uploadImageFile(fileUri: string) {
  const filename = imageFilenameFromUri(fileUri);
  const mime = mimeFromUri(fileUri, "image/jpeg");
  return uploadToCloudinary(fileUri, filename, mime, "image");
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
