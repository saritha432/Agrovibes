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
    const err: any = new Error(msg);
    err.status = response.status;
    err.payload = parsed;
    throw err;
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
}

export interface HomePost {
  id: number;
  userName: string;
  location: string;
  caption: string;
  likesCount: number;
  commentsCount: number;
  videoUrl: string;
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

export async function createHomeStory(payload: { userName: string; district: string; videoUrl?: string }) {
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
  userName: string;
  location: string;
  caption: string;
  videoUrl: string;
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

export async function uploadVideoFile(fileUri: string) {
  const form = new FormData();
  const normalizedUri = String(fileUri || "").trim();
  const inferredName = normalizedUri.split("?")[0].split("/").pop() || `video-${Date.now()}.mp4`;
  const safeName = inferredName.includes(".") ? inferredName : `${inferredName}.mp4`;
  const ext = safeName.split(".").pop()?.toLowerCase() || "mp4";
  const mimeType = ext === "mov" ? "video/quicktime" : ext === "webm" ? "video/webm" : "video/mp4";

  if (Platform.OS === "web") {
    const webResp = await fetch(normalizedUri);
    const blob = await webResp.blob();
    (form as any).append("video", blob, safeName);
  } else {
    form.append("video", {
      uri: normalizedUri,
      name: safeName,
      type: mimeType
    } as any);
  }

  const response = await fetch(`${API_BASE_URL}/v1/uploads/video`, {
    method: "POST",
    body: form as any
  });
  return (await parseJsonOrThrow(response)) as { url: string; filename: string; mimeType: string; size: number };
}
