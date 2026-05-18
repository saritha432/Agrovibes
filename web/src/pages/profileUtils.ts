import type { HomePost } from "../api/types";
import type { AuthUser } from "../api/types";

export type GalleryTab = "Posts" | "Reels" | "Saved" | "Tagged";

export function normalizeName(value: string) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function safeHandle(name: string) {
  const base = String(name || "user")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `@${base || "user_farmer"}`;
}

export function displayHandle(user: Pick<AuthUser, "username" | "fullName" | "email">) {
  const u = user.username?.trim();
  if (u) return `@${u.replace(/^@+/, "")}`;
  return safeHandle(user.fullName || user.email || "");
}

export function userInitials(name: string) {
  return (
    String(name || "U")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("") || "U"
  );
}

export function reelGridStillUri(post: HomePost): string | null {
  const th = post.thumbnailUrl?.trim();
  if (th) return th;
  const img = post.imageUrl?.trim();
  if (img) return img;
  const carousel0 = post.imageUrls?.find((u) => typeof u === "string" && u.trim())?.trim();
  if (carousel0) return carousel0;
  return null;
}

export function filterUserPosts(allPosts: HomePost[], user: AuthUser) {
  const myId = Number(user.id);
  const nameA = normalizeName(user.fullName || "");
  const nameB = normalizeName(String(user.email || "").split("@")[0] || "");
  const nameC = normalizeName(user.username || "");
  return allPosts.filter((p) => {
    if (Number.isFinite(myId) && myId > 0 && Number(p.userId) === myId) return true;
    const postName = normalizeName(p.userName || "");
    return postName === nameA || postName === nameB || postName === nameC;
  });
}

export function visibleGalleryPosts(
  tab: GalleryTab,
  userPosts: HomePost[],
  savedPosts: HomePost[],
  taggedPosts: HomePost[]
) {
  if (tab === "Reels") return userPosts.filter((p) => !!p.videoUrl);
  if (tab === "Saved") return savedPosts.filter((p) => !!p.videoUrl);
  if (tab === "Tagged") return taggedPosts.filter((p) => !!p.videoUrl);
  return userPosts.filter((p) => !p.videoUrl);
}

export function parsePersonUserId(person: { key?: string }) {
  const raw = String(person.key || "").trim();
  return /^\d+$/.test(raw) ? Number(raw) : null;
}

export function locationDisplay(label?: string | null) {
  if (!label?.trim()) return "Add your district";
  const parts = label.split(",").map((s) => s.trim());
  if (parts.length >= 2) return `${parts[0]}, ${parts[1]}`;
  return label;
}

export function roleLabel(role?: string) {
  if (role === "instructor" || role === "admin") return "Instructor · Seller";
  return "Farmer · Buyer";
}
