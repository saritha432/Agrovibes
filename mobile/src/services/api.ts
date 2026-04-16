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
  // Upload to Cloudinary via backend-signed signature.
  const signRes = await fetch(`${API_BASE_URL}/v1/media/cloudinary-sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder: "agrovibes" })
  });
  if (!signRes.ok) throw new Error("Failed to sign upload");
  const sign = (await signRes.json()) as {
    cloudName: string;
    apiKey: string;
    timestamp: number;
    folder: string;
    signature: string;
  };

  const form = new FormData();
  form.append("file", {
    // @ts-ignore React Native file type
    uri: fileUri,
    name: `video-${Date.now()}.mp4`,
    type: "video/mp4"
  });
  form.append("api_key", sign.apiKey);
  form.append("timestamp", String(sign.timestamp));
  form.append("folder", sign.folder);
  form.append("signature", sign.signature);

  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${sign.cloudName}/video/upload`, {
    method: "POST",
    body: form
  });
  if (!uploadRes.ok) throw new Error("Cloud upload failed");
  const uploaded = (await uploadRes.json()) as { secure_url?: string; url?: string };
  const url = uploaded.secure_url ?? uploaded.url;
  if (!url) throw new Error("Cloud upload missing URL");
  return { url };
}
