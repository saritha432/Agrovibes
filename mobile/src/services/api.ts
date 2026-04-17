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
  user: { id: number; email: string; fullName: string; role: "student" | "instructor" | "admin" };
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
    throw new Error(msg);
  }
  return parsed;
}

export async function authRegister(payload: { email: string; password: string; fullName: string; role?: string }) {
  const response = await fetch(`${API_BASE_URL}/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return (await parseJsonOrThrow(response)) as AuthResponse;
}

export async function authLogin(payload: { email: string; password: string }) {
  const response = await fetch(`${API_BASE_URL}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return (await parseJsonOrThrow(response)) as AuthResponse;
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
  userName: string;
  district: string;
  avatarLabel: string;
  hasNew: boolean;
  viewed: boolean;
  videoUrl?: string | null;
  imageUrl?: string | null;
}

export interface HomePost {
  id: number;
  userName: string;
  location: string;
  caption: string;
  likesCount: number;
  commentsCount: number;
  videoUrl?: string | null;
  imageUrl?: string | null;
  thumbnailUrl?: string;
  createdAt: string;
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

export async function fetchHomePosts() {
  const response = await fetch(`${API_BASE_URL}/v1/home/posts`);
  if (!response.ok) {
    throw new Error("Failed to load home posts");
  }
  return (await response.json()) as { posts: HomePost[] };
}

export async function fetchLearnCourses() {
  const response = await fetch(`${API_BASE_URL}/v1/learn/courses`, {
    headers: { "Cache-Control": "no-cache" }
  });
  if (!response.ok) {
    throw new Error("Failed to load courses");
  }
  return (await response.json()) as { courses: Course[] };
}

export async function fetchLearnCourseById(courseId: string) {
  const response = await fetch(`${API_BASE_URL}/v1/learn/courses/${encodeURIComponent(courseId)}`, {
    headers: { "Cache-Control": "no-cache" }
  });
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

export async function uploadCourseVideo(
  token: string,
  file: { uri?: string; name?: string; type?: string; file?: Blob }
) {
  const form = new FormData();
  const formAny = form as any;
  const fileName = file.name || `lesson-${Date.now()}.mp4`;
  if (file.file) {
    // Web requires passing a Blob/File directly.
    formAny.append("video", file.file, fileName);
  } else {
    formAny.append("video", {
      uri: file.uri,
      name: fileName,
      type: file.type || "video/mp4"
    } as any);
  }

  const response = await fetch(`${API_BASE_URL}/v1/learn/videos/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: form
  });

  return (await parseJsonOrThrow(response)) as { videoUrl: string; fileName: string; size: number };
}

export async function createHomePost(payload: {
  userName: string;
  location: string;
  caption: string;
  videoUrl?: string;
  imageUrl?: string;
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

/** When expo-image-picker omits `type` (common on Android/web), infer from mime or file path. */
export function shouldUseImageUpload(
  uri: string,
  asset?: { type?: string | null; mimeType?: string | null; uri?: string | null } | null
): boolean {
  if (asset?.type === "image") return true;
  const mime = String(asset?.mimeType || "").toLowerCase();
  if (mime.startsWith("image/")) return true;
  const path = (uri || asset?.uri || "").split("?")[0];
  return /\.(jpe?g|png|gif|webp|heic|bmp|avif)$/i.test(path);
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
    const res = await fetch(fileUri);
    const blob = await res.blob();
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
    body: form
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
