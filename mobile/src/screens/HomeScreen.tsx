import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  Share,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ViewStyle,
  type ViewToken
} from "react-native";
import { Audio, InterruptionModeAndroid, InterruptionModeIOS, ResizeMode, Video, type AVPlaybackStatus } from "expo-av";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { navigateToPublicProfile } from "../navigation/navigationRef";
import { takePendingSharedPostViewer } from "../navigation/sharedPostViewerBridge";
import { AppTopBar } from "../components/AppTopBar";
import { UserAvatar } from "../components/UserAvatar";
import { useAuth } from "../auth/AuthContext";
import {
  createHomeStory,
  createHomePostComment,
  deleteHomePost,
  reportHomePost,
  fetchHomePostComments,
  fetchHomePostLikes,
  fetchHomePosts,
  fetchSocialNotifications,
  type HomePostLiker,
  fetchHomeStories,
  fetchRelationships,
  fetchSocialNetwork,
  getWebAppOrigin,
  HomePost,
  HomeStory,
  likeHomePost,
  saveHomePost,
  sendDirectMessage,
  sendFollowRequest,
  unfollowUser,
  unlikeHomePost,
  unsaveHomePost
} from "../services/api";
import {
  addLocalCommentForPost,
  appendLocalEngagementNotification,
  getLocalCommentsForPost,
  getLocalLikeStateForPosts,
  getLikersFromLocalEngagementForPost,
  getLikersFromLocalLikeMap,
  setLocalPostLikedByIdentity,
  type PostLiker
} from "../social/localEngagementStore";
import { getLocalRelationshipMapByNames, removeLocalFollowByIdentity, sendLocalFollowRequestByIdentity } from "../social/localFollowStore";
import type { CreateType } from "../components/CreateModal";
import { LiveHomeSection } from "./live/LiveHomeSection";
import { useLanguage } from "../localization/LanguageContext";
import {
  formatDisplayName,
  formatFeedText,
  formatReelCaption,
  stripInternalCaptionPrefix
} from "../localization/feedDisplay";
import { APP_DARK_BG, APP_LIME } from "../theme/appColors";

interface HomeScreenProps {
  refreshToken?: number;
  onOpenCreate?: (type?: CreateType) => void;
  /** Returns at most once per successful create: API post to merge into the feed after refetch (read clears the slot). */
  takePendingFeedPost?: () => HomePost | undefined;
}

const postTints = ["#8a5b00", APP_LIME, "#8b3a62", "#105f75"];
const HOME_TOP_TABS_ALL = ["Feed", "Friends", "live"] as const;
type HomeTopTab = (typeof HOME_TOP_TABS_ALL)[number];
const likeActiveColor = APP_LIME;
const REEL_LIKE_COLOR = "#ffffff";
const REEL_ACTION_ICON = 22;
const REEL_ACTION_ICON_LIKE = 24;

function isReelPost(post: HomePost) {
  return /^\[REEL\]/i.test(String(post.caption || "").trim());
}

function isFullScreenReelItem(post: HomePost) {
  return !!(post.videoUrl && isReelPost(post));
}

function postHasViewableMedia(post: HomePost) {
  return !!(post.videoUrl || postImageGallery(post).length);
}

function mapApiLikerToPostLiker(row: HomePostLiker): PostLiker | null {
  const userId = Number(row.userId);
  if (!Number.isFinite(userId) || userId <= 0) return null;
  const username = String(row.username || "")
    .trim()
    .replace(/^@+/, "");
  const fullName = String(row.fullName || "").trim();
  const userName = username || fullName || `User ${userId}`;
  return {
    userId,
    userName,
    avatarUrl: row.avatarUrl || undefined
  };
}

function viewerAsPostLiker(user: {
  id?: number;
  fullName?: string;
  username?: string;
  avatarUrl?: string;
}): PostLiker | null {
  const userId = Number(user.id);
  if (!Number.isFinite(userId) || userId <= 0) return null;
  const username = String(user.username || "")
    .trim()
    .replace(/^@+/, "");
  const fullName = String(user.fullName || "").trim();
  return {
    userId,
    userName: username || fullName || "You",
    avatarUrl: user.avatarUrl || undefined
  };
}

function localLikeViewerIdentity(user: {
  id?: number;
  fullName?: string;
  username?: string;
  email?: string;
}) {
  return {
    name: user.fullName || user.username || "You",
    key: user.username || user.email || "",
    userId: user.id
  };
}

function postCreatedMs(post: HomePost): number {
  const raw = post.createdAt as string | number | Date | undefined;
  if (raw == null) return 0;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const t = Date.parse(String(raw));
  return Number.isFinite(t) ? t : 0;
}

/** Newest posts/reels first (Instagram-style feed order). */
function sortPostsNewestFirst(list: HomePost[]): HomePost[] {
  return [...list].sort((a, b) => postCreatedMs(b) - postCreatedMs(a) || b.id - a.id);
}

const REPORT_REASON_KEYS = [
  { key: "spam", labelKey: "reportSpam" },
  { key: "harassment", labelKey: "reportHarassment" },
  { key: "hate", labelKey: "reportHate" },
  { key: "nudity", labelKey: "reportNudity" },
  { key: "violence", labelKey: "reportViolence" },
  { key: "scam", labelKey: "reportScam" },
  { key: "ip", labelKey: "reportIp" },
  { key: "other", labelKey: "reportOther" }
] as const;

function dismissedPostsStorageKey(userId: string | number | undefined) {
  if (userId != null && String(userId) !== "" && Number(userId) > 0) {
    return `agrovibes.feed.dismissedPosts.v1.${userId}`;
  }
  return "agrovibes.feed.dismissedPosts.v1.anon";
}

function reelCreativeFilterTint(filter?: string): string | null {
  switch (String(filter || "").toLowerCase()) {
    case "warm":
      return "rgba(255, 190, 100, 0.22)";
    case "cool":
      return "rgba(100, 180, 255, 0.2)";
    case "mono":
      return "rgba(80, 80, 80, 0.3)";
    case "vivid":
      return "rgba(255, 60, 160, 0.12)";
    case "sunset":
      return "rgba(255, 120, 60, 0.24)";
    case "noir":
      return "rgba(0, 0, 0, 0.34)";
    default:
      return null;
  }
}

function reelCreativeTextColor(textColor?: string): string {
  switch (String(textColor || "").toLowerCase()) {
    case "black":
      return "#111111";
    case "yellow":
      return "#FFE066";
    case "pink":
      return "#FF66C4";
    case "blue":
      return "#66D2FF";
    case "green":
      return "#86EFAC";
    default:
      return "#FFFFFF";
  }
}

function normalizeIdentity(value: string) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function viewerOwnsPost(post: HomePost, viewer: { id: number; fullName?: string } | null) {
  if (!viewer) return false;
  const postUserId = Number(post.userId);
  const normalizedPostName = normalizeIdentity(post.userName);
  const normalizedCurrentUserName = normalizeIdentity(viewer.fullName || "");
  return (
    (postUserId > 0 && postUserId === Number(viewer.id)) ||
    (!postUserId && normalizedPostName.length > 0 && normalizedPostName === normalizedCurrentUserName)
  );
}

function postAuthorAvatarUri(
  post: HomePost,
  viewer: { id?: number; fullName?: string; avatarUrl?: string } | null | undefined
): string | undefined {
  const fromPost = post.authorAvatarUrl;
  if (typeof fromPost === "string" && fromPost.trim()) return fromPost.trim();
  if (viewer != null && Number.isFinite(Number(viewer.id)) && Number(viewer.id) > 0) {
    if (viewerOwnsPost(post, { id: Number(viewer.id), fullName: viewer.fullName })) {
      const u = viewer.avatarUrl;
      if (typeof u === "string" && u.trim()) return u.trim();
    }
  }
  return undefined;
}

function viewerOwnsStory(
  story: HomeStory,
  viewer: { id?: number; fullName?: string; username?: string } | null | undefined
) {
  if (!viewer) return false;
  const storyUserId = Number(story.userId);
  const viewerId = Number(viewer.id);
  if (Number.isFinite(storyUserId) && storyUserId > 0 && Number.isFinite(viewerId) && viewerId > 0) {
    return storyUserId === viewerId;
  }
  const storyName = normalizeIdentity(story.userName);
  if (!storyName || storyName === "you") return true;
  const viewerName = normalizeIdentity(viewer.fullName || "");
  const viewerUser = normalizeIdentity(String(viewer.username || "").replace(/^@+/, ""));
  return (viewerName.length > 0 && storyName === viewerName) || (viewerUser.length > 0 && storyName === viewerUser);
}

type AvatarLookup = { byId: Map<number, string>; byName: Map<string, string> };

function buildAvatarLookup(
  postsList: HomePost[],
  viewer: { id?: number; fullName?: string; username?: string; avatarUrl?: string } | null | undefined,
  socialByUserId: Map<number, string>
): AvatarLookup {
  const byId = new Map<number, string>(socialByUserId);
  const byName = new Map<string, string>();
  if (viewer) {
    const viewerId = Number(viewer.id);
    const viewerAvatar = typeof viewer.avatarUrl === "string" ? viewer.avatarUrl.trim() : "";
    if (Number.isFinite(viewerId) && viewerId > 0 && viewerAvatar) {
      byId.set(viewerId, viewerAvatar);
    }
    const viewerName = normalizeIdentity(viewer.fullName || "");
    if (viewerName && viewerAvatar) byName.set(viewerName, viewerAvatar);
    const viewerUser = normalizeIdentity(String(viewer.username || "").replace(/^@+/, ""));
    if (viewerUser && viewerAvatar) byName.set(viewerUser, viewerAvatar);
  }
  for (const post of postsList) {
    const avatar = post.authorAvatarUrl;
    if (typeof avatar !== "string" || !avatar.trim()) continue;
    const trimmed = avatar.trim();
    const postUserId = Number(post.userId);
    if (Number.isFinite(postUserId) && postUserId > 0) byId.set(postUserId, trimmed);
    const postName = normalizeIdentity(post.userName);
    if (postName) byName.set(postName, trimmed);
  }
  return { byId, byName };
}

function storyAuthorAvatarUri(
  story: HomeStory,
  viewer: { id?: number; fullName?: string; username?: string; avatarUrl?: string } | null | undefined,
  lookup: AvatarLookup,
  postsList: HomePost[]
): string | undefined {
  const fromStory = story.avatarUrl;
  if (typeof fromStory === "string" && fromStory.trim()) return fromStory.trim();
  const storyUserId = Number(story.userId);
  if (Number.isFinite(storyUserId) && storyUserId > 0) {
    const fromId = lookup.byId.get(storyUserId);
    if (fromId) return fromId;
  }
  const fromPosts = avatarFromHomePostsForStory(story, postsList);
  if (fromPosts) return fromPosts;
  const storyName = normalizeIdentity(story.userName);
  if (storyName) {
    const fromName = lookup.byName.get(storyName);
    if (fromName) return fromName;
  }
  if (viewerOwnsStory(story, viewer)) {
    const viewerAvatar = viewer?.avatarUrl;
    if (typeof viewerAvatar === "string" && viewerAvatar.trim()) return viewerAvatar.trim();
  }
  return undefined;
}

/** When story API omits avatarUrl, reuse a recent home post author's photo (same user id or display name). */
function avatarFromHomePostsForStory(head: HomeStory, postsList: HomePost[]): string | undefined {
  const uid = Number(head.userId);
  if (Number.isFinite(uid) && uid > 0) {
    for (const p of postsList) {
      if (Number(p.userId) === uid) {
        const a = p.authorAvatarUrl;
        if (typeof a === "string" && a.trim()) return a.trim();
      }
    }
  }
  const n = normalizeIdentity(head.userName);
  if (!n) return undefined;
  for (const p of postsList) {
    if (normalizeIdentity(p.userName) === n) {
      const a = p.authorAvatarUrl;
      if (typeof a === "string" && a.trim()) return a.trim();
    }
  }
  return undefined;
}

/** Stable key for grouping stories by author (prefer server user id). */
function storyAuthorKey(s: HomeStory): string {
  const sid = Number(s.userId);
  if (Number.isFinite(sid) && sid > 0) return `uid:${sid}`;
  const n = normalizeIdentity(s.userName);
  if (n && n !== "you") return `name:${n}`;
  return `row:${s.id}`;
}

function storyHasMedia(s: HomeStory) {
  return !!(s.videoUrl || s.imageUrl);
}

function storyTimeMs(s: HomeStory) {
  const t = Date.parse(String(s.createdAt || ""));
  return Number.isFinite(t) ? t : 0;
}

/** Oldest first (left-to-right segments like Instagram). */
function sortStoriesForPlayback(rows: HomeStory[]) {
  return [...rows].sort((a, b) => storyTimeMs(a) - storyTimeMs(b) || a.id - b.id);
}

function postImageGallery(post: HomePost | null | undefined): string[] {
  if (!post) return [];
  const raw = Array.isArray(post.imageUrls) ? post.imageUrls : [];
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const u of raw) {
    const s = String(u || "").trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    ordered.push(s);
  }
  if (ordered.length > 1) return ordered;
  if (ordered.length === 1) return ordered;
  const single = String(post.imageUrl || "").trim();
  return single ? [single] : [];
}

/** Dot / pager index for horizontal image carousels (works with onScroll + paging; avoids relying on onMomentumScrollEnd only). */
function carouselIndexFromOffset(offsetX: number, pageWidth: number, maxIndex: number): number {
  if (pageWidth <= 0) return 0;
  const idx = Math.round(offsetX / pageWidth);
  return Math.min(maxIndex, Math.max(0, idx));
}

type HomeCommentRow = {
  id: string;
  user: string;
  text: string;
  likes: number;
  createdAt?: string;
  parentCommentId?: string;
  avatarUrl?: string;
};

type OtherStoryGroup = {
  key: string;
  userId: number | null;
  userName: string;
  avatarLabel: string;
  avatarUrl?: string | null;
  stories: HomeStory[];
};

const COMMENT_REPLY_INDENT = 14;
/** Direct replies stay collapsed until the user taps "View N more reply/replies" (even when N is 1). */
const REPLY_PREVIEW_VISIBLE = 0;
const STORY_TTL_MS = 24 * 60 * 60 * 1000;

function sortCommentsByTime(a: HomeCommentRow, b: HomeCommentRow) {
  const ta = Date.parse(a.createdAt || "") || 0;
  const tb = Date.parse(b.createdAt || "") || 0;
  if (ta !== tb) return ta - tb;
  return String(a.id).localeCompare(String(b.id));
}

/** Roots = top-level comments; children map = direct replies only (sorted). */
function buildCommentReplyTree(rows: HomeCommentRow[]) {
  const byId = new Map<string, HomeCommentRow>();
  for (const r of rows) byId.set(String(r.id), r);
  const children = new Map<string, HomeCommentRow[]>();
  const roots: HomeCommentRow[] = [];
  for (const r of rows) {
    const pid = r.parentCommentId ? String(r.parentCommentId) : "";
    if (pid && byId.has(pid)) {
      const list = children.get(pid) ?? [];
      list.push(r);
      children.set(pid, list);
    } else {
      roots.push(r);
    }
  }
  for (const [, list] of children) {
    list.sort(sortCommentsByTime);
  }
  roots.sort(sortCommentsByTime);
  return { children, roots };
}

function mergeRemoteAndLocalComments(remote: HomeCommentRow[], local: HomeCommentRow[]): HomeCommentRow[] {
  const remoteIds = new Set(remote.map((c) => String(c.id)));
  const merged = [...remote];
  for (const c of local) {
    if (!remoteIds.has(String(c.id))) merged.push(c);
  }
  return merged;
}

/** Handles alternate API/proxy keys and numeric ids so threading survives refetch. */
function normalizeCommentRow(c: Partial<HomeCommentRow> & Record<string, unknown>): HomeCommentRow {
  const pidRaw = c.parentCommentId ?? c["parent_comment_id"] ?? c["parentcommentid"];
  const parentCommentId =
    pidRaw != null && String(pidRaw).trim() !== "" && String(pidRaw) !== "null"
      ? String(pidRaw).trim()
      : undefined;
  const avRaw = c.avatarUrl ?? c["avatar_url"] ?? c["avatarUrl"];
  const avatarUrl = typeof avRaw === "string" && avRaw.trim() ? avRaw.trim() : undefined;
  return {
    id: String(c.id ?? ""),
    user: String(c.user ?? ""),
    text: String(c.text ?? ""),
    likes: Number.isFinite(Number(c.likes)) ? Number(c.likes) : 0,
    createdAt: typeof c.createdAt === "string" ? c.createdAt : c.createdAt != null ? String(c.createdAt) : undefined,
    parentCommentId,
    ...(avatarUrl ? { avatarUrl } : {})
  };
}

/**
 * When the server omits parent_comment_id (legacy rows / older deploy), infer a parent from a leading @mention
 * so replies stay nested after closing and reopening the sheet.
 */
function inferParentFromMention(rows: HomeCommentRow[]): HomeCommentRow[] {
  if (!rows.length) return rows;
  const byId = new Map<string, HomeCommentRow>();
  for (const r of rows) {
    byId.set(String(r.id), { ...r });
  }
  const chronological = [...rows].sort((a, b) => {
    const ta = Date.parse(a.createdAt || "") || 0;
    const tb = Date.parse(b.createdAt || "") || 0;
    if (ta !== tb) return ta - tb;
    return String(a.id).localeCompare(String(b.id));
  });
  const seenChrono: HomeCommentRow[] = [];
  for (const r of chronological) {
    const cur = byId.get(String(r.id))!;
    if (!cur.parentCommentId) {
      const match = String(cur.text || "").trim().match(/^@([^\s@]+)/u);
      if (match) {
        const mentionNorm = normalizeIdentity(match[1]);
        if (mentionNorm) {
          for (let i = seenChrono.length - 1; i >= 0; i--) {
            if (normalizeIdentity(seenChrono[i].user) === mentionNorm) {
              cur.parentCommentId = String(seenChrono[i].id);
              break;
            }
          }
        }
      }
    }
    seenChrono.push(cur);
  }
  return rows.map((r) => byId.get(String(r.id))!);
}

function normalizeStoryRow(raw: Partial<HomeStory> & Record<string, unknown>): HomeStory {
  const userName = String(raw.userName ?? raw["user_name"] ?? "You").trim();
  const avatarLabelRaw = String(raw.avatarLabel ?? raw["avatar_label"] ?? userName.charAt(0) ?? "U").trim();
  const video = (raw.videoUrl as string | null | undefined) ?? (raw["video_url"] as string | null | undefined) ?? null;
  const image = (raw.imageUrl as string | null | undefined) ?? (raw["image_url"] as string | null | undefined) ?? null;
  const avRaw = raw.avatarUrl ?? raw["avatar_url"];
  const avatarUrl = typeof avRaw === "string" && avRaw.trim() ? avRaw.trim() : undefined;
  return {
    id: Number(raw.id ?? Date.now()),
    userId: raw.userId != null ? Number(raw.userId) : raw["user_id"] != null ? Number(raw["user_id"]) : undefined,
    userName,
    district: String(raw.district ?? "My Farm"),
    avatarLabel: (avatarLabelRaw || "U").charAt(0).toUpperCase(),
    ...(avatarUrl ? { avatarUrl } : {}),
    hasNew: raw.hasNew != null ? !!raw.hasNew : raw["has_new"] != null ? !!raw["has_new"] : true,
    viewed: !!raw.viewed,
    videoUrl: video || undefined,
    imageUrl: image || undefined,
    createdAt:
      typeof raw.createdAt === "string"
        ? raw.createdAt
        : typeof raw["created_at"] === "string"
          ? String(raw["created_at"])
          : undefined
  };
}

function mergeStories(remote: HomeStory[], optimistic: HomeStory[]): HomeStory[] {
  const byKey = new Map<string, HomeStory>();
  const put = (s: HomeStory) => {
    if (!isStoryFresh(s)) return;
    const key = `${normalizeIdentity(s.userName)}:${s.videoUrl || ""}:${s.imageUrl || ""}`;
    byKey.set(key, s);
  };
  for (const s of remote) put(s);
  for (const s of optimistic) {
    if (!s.videoUrl && !s.imageUrl) continue;
    if (isStoryFresh(s)) put(s);
  }
  return [...byKey.values()].sort((a, b) => {
    const ta = Date.parse(String(a.createdAt || "")) || 0;
    const tb = Date.parse(String(b.createdAt || "")) || 0;
    return tb - ta;
  });
}

function isStoryFresh(story: Pick<HomeStory, "createdAt">) {
  if (!story.createdAt) return false;
  const created = Date.parse(String(story.createdAt));
  return Number.isFinite(created) && Date.now() - created <= STORY_TTL_MS;
}

function dedupeHomePosts(rows: HomePost[]): HomePost[] {
  const seen = new Set<string>();
  const out: HomePost[] = [];
  for (const post of rows) {
    const mediaKey = post.videoUrl ? `video:${post.videoUrl}` : post.imageUrl ? `image:${post.imageUrl}` : `id:${post.id}`;
    const key = post.videoUrl ? `${mediaKey}:${normalizeIdentity(post.userName)}:${post.caption}` : `id:${post.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(post);
  }
  return out;
}

function formatCommentRelativeTime(iso?: string): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const diff = Math.max(0, Date.now() - t);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  const months = Math.floor(days / 30);
  return `${Math.max(1, months)}mo`;
}

function commentInteractionKey(postId: number, commentId: string) {
  return `${postId}:${commentId}`;
}

/** Fit video inside a box without cropping (letterbox if needed). */
function containVideoBox(containerW: number, containerH: number, vw: number, vh: number) {
  if (!containerW || !containerH || !vw || !vh) {
    return { width: Math.max(1, containerW), height: Math.max(1, containerH) };
  }
  const scale = Math.min(containerW / vw, containerH / vh);
  return { width: Math.round(vw * scale), height: Math.round(vh * scale) };
}

function readVideoNaturalSize(event: unknown): { width: number; height: number } | null {
  const e = event as Record<string, unknown> | null | undefined;
  if (!e) return null;
  const nested = e["nativeEvent"] as Record<string, unknown> | undefined;
  const ns = (e["naturalSize"] ?? nested?.["naturalSize"]) as { width?: number; height?: number } | undefined;
  if (ns && typeof ns.width === "number" && typeof ns.height === "number" && ns.width > 0 && ns.height > 0) {
    return { width: ns.width, height: ns.height };
  }
  const target = e["target"] as { videoWidth?: number; videoHeight?: number } | undefined;
  if (target && Number(target.videoWidth) > 0 && Number(target.videoHeight) > 0) {
    return { width: Number(target.videoWidth), height: Number(target.videoHeight) };
  }
  return null;
}

/** Web: expo-av pins the video absolute-fill; relax so object-fit matches resizeMode. */
const webVideoObjectFitStyle = (fit: "contain" | "cover"): ViewStyle =>
  Platform.OS === "web"
    ? ({
        position: "relative",
        left: undefined,
        top: undefined,
        right: undefined,
        bottom: undefined,
        width: "100%",
        height: "100%",
        objectFit: fit
      } as ViewStyle)
    : ({} as ViewStyle);

type ContainedExpoVideoProps = {
  uri: string;
  shouldPlay: boolean;
  preloadOnly?: boolean;
  containerWidth: number;
  containerHeight: number;
  /** `cover` = full bleed (no side bars; may crop). `contain` = full frame visible (letterboxing). */
  fit?: "contain" | "cover";
  isLooping?: boolean;
  isMuted?: boolean;
  posterUri?: string;
  useNativeControls?: boolean;
  onStatusUpdate?: (status: AVPlaybackStatus) => void;
};

type ContainedExpoVideoHandle = {
  seekToRatio: (ratio: number) => Promise<void>;
};

const ContainedExpoVideo = React.forwardRef<ContainedExpoVideoHandle, ContainedExpoVideoProps>(function ContainedExpoVideo({
  uri,
  shouldPlay,
  preloadOnly = false,
  containerWidth,
  containerHeight,
  fit = "contain",
  isLooping = true,
  isMuted = false,
  posterUri,
  useNativeControls = false,
  onStatusUpdate
}: ContainedExpoVideoProps, ref) {
  const isWeb = Platform.OS === "web";
  const isCover = fit === "cover";
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const videoRef = useRef<Video | null>(null);
  const durationRef = useRef(0);

  useEffect(() => {
    setNatural(null);
  }, [uri]);

  const fitted = useMemo(() => {
    if (isCover || isWeb || !natural) return null;
    return containVideoBox(containerWidth, containerHeight, natural.width, natural.height);
  }, [isCover, isWeb, natural, containerWidth, containerHeight]);

  const videoOuterStyle: ViewStyle = useMemo(() => {
    if (isCover) {
      return StyleSheet.absoluteFillObject;
    }
    if (isWeb) {
      return { width: "100%", height: "100%" };
    }
    if (fitted) {
      return { width: fitted.width, height: fitted.height };
    }
    return { width: containerWidth, height: containerHeight };
  }, [isCover, isWeb, fitted, containerWidth, containerHeight]);

  const resizeMode = isCover ? ResizeMode.COVER : ResizeMode.CONTAIN;

  useEffect(() => {
    const ref = videoRef.current;
    if (!ref) return;
    if (shouldPlay) {
      ref.playAsync().catch(() => {});
    } else {
      ref.pauseAsync().catch(() => {});
    }
  }, [shouldPlay, uri]);

  React.useImperativeHandle(
    ref,
    () => ({
      seekToRatio: async (ratio: number) => {
        const target = Math.max(0, Math.min(1, ratio));
        const dur = durationRef.current;
        if (!dur || !Number.isFinite(dur)) return;
        await videoRef.current?.setPositionAsync(Math.round(dur * target));
      }
    }),
    []
  );

  return (
    <View
      style={{
        width: containerWidth,
        height: containerHeight,
        backgroundColor: APP_DARK_BG,
        ...(!isCover ? { justifyContent: "center", alignItems: "center" } : {})
      }}
    >
      <Video
        ref={(r) => {
          videoRef.current = r;
        }}
        source={{ uri }}
        shouldPlay={shouldPlay}
        isLooping={isLooping}
        isMuted={isMuted || preloadOnly}
        useNativeControls={useNativeControls}
        usePoster={!!posterUri}
        posterSource={posterUri ? { uri: posterUri } : undefined}
        resizeMode={resizeMode}
        style={videoOuterStyle}
        videoStyle={isWeb ? webVideoObjectFitStyle(isCover ? "cover" : "contain") : undefined}
        onPlaybackStatusUpdate={(status) => {
          onStatusUpdate?.(status);
          if (status.isLoaded) {
            durationRef.current = Number(status.durationMillis || 0);
          }
        }}
        onReadyForDisplay={
          isWeb || isCover
            ? undefined
            : (ev) => {
                const dim = readVideoNaturalSize(ev);
                if (dim) setNatural(dim);
              }
        }
        progressUpdateIntervalMillis={preloadOnly ? 4000 : 750}
      />
    </View>
  );
});

type ReelSeekBarProps = {
  progressRatio: number;
};

/** Passive progress strip (no thumb, no scrub) — Instagram-style reel completion line. */
function ReelSeekBar({ progressRatio }: ReelSeekBarProps) {
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const safeRatio = clamp(progressRatio);
  return (
    <View style={styles.reelSeekTrack} pointerEvents="none">
      <View style={[styles.reelSeekFill, { width: `${safeRatio * 100}%` }]} />
    </View>
  );
}

type ReelLikeBurstProps = {
  postId: number;
  trigger: number;
  /** Persists across list item remounts so returning to a liked reel does not replay the burst. */
  seenRef: React.MutableRefObject<Record<number, number>>;
};

function ReelLikeBurst({ postId, trigger, seenRef }: ReelLikeBurstProps) {
  const [hearts, setHearts] = useState<
    Array<{
      id: string;
      progress: Animated.Value;
      leftPct: number;
      topPct: number;
      xFrom: number;
      xTo: number;
      yLift: number;
      size: number;
      delay: number;
    }>
  >([]);

  useEffect(() => {
    if (!trigger) return;
    const seen = seenRef.current[postId] || 0;
    if (trigger <= seen) return;
    seenRef.current[postId] = trigger;
    const created = Array.from({ length: 10 }, (_, idx) => ({
      id: `${trigger}-${idx}`,
      progress: new Animated.Value(0),
      leftPct: 8 + Math.random() * 84,
      topPct: 16 + Math.random() * 66,
      xFrom: Math.round((Math.random() - 0.5) * 18),
      xTo: Math.round((Math.random() - 0.5) * 72),
      yLift: 65 + Math.round(Math.random() * 70),
      size: 18 + Math.round(Math.random() * 20),
      delay: idx * 40
    }));
    setHearts(created);
    created.forEach((h) => {
      Animated.sequence([
        Animated.delay(h.delay),
        Animated.timing(h.progress, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true
        })
      ]).start();
    });
    const clearT = setTimeout(() => setHearts([]), 1050);
    return () => clearTimeout(clearT);
  }, [trigger, postId, seenRef]);

  if (!hearts.length) return null;
  return (
    <View style={styles.reelLikeBurstLayer} pointerEvents="none">
      {hearts.map((h) => {
        const translateY = h.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [14, -h.yLift]
        });
        const translateX = h.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [h.xFrom, h.xTo]
        });
        const scale = h.progress.interpolate({
          inputRange: [0, 0.22, 1],
          outputRange: [0.55, 1.2, 0.9]
        });
        const opacity = h.progress.interpolate({
          inputRange: [0, 0.2, 0.75, 1],
          outputRange: [0, 1, 0.95, 0]
        });
        return (
          <Animated.View
            key={h.id}
            style={{
              position: "absolute",
              left: `${h.leftPct}%`,
              top: `${h.topPct}%`,
              transform: [{ translateX }, { translateY }, { scale }],
              opacity
            }}
          >
            <Ionicons name="heart" size={h.size} color="#C9FF35" />
          </Animated.View>
        );
      })}
    </View>
  );
}

export function HomeScreen({ refreshToken = 0, onOpenCreate, takePendingFeedPost }: HomeScreenProps) {
  const { t, language } = useLanguage();

  const displayPersonName = React.useCallback(
    (name: string) => formatDisplayName(name, language, t),
    [language, t]
  );

  const displayFeedCopy = React.useCallback(
    (text: string) => formatFeedText(text, language, t),
    [language, t]
  );

  const displayPostCaption = React.useCallback(
    (caption: string | null | undefined) => formatReelCaption(caption, language, t),
    [language, t]
  );
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();
  /** Android feed reels often draw under the status bar; insets.top can be 0 while the clock row still shows. */
  const reelTopInset = useMemo(() => {
    const sbh = Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0;
    return Math.max(insets.top, sbh);
  }, [insets.top]);

  const homeTabLabel = React.useCallback(
    (tab: HomeTopTab) => {
      if (tab === "live") return t("tabLive");
      if (tab === "Feed") return t("tabFeed");
      if (tab === "Friends") return t("tabFriends");
      return tab;
    },
    [t]
  );

  const reportReasons = React.useMemo(
    () => REPORT_REASON_KEYS.map((r) => ({ key: r.key, label: t(r.labelKey) })),
    [t]
  );

  const labelForFollowStatus = React.useCallback(
    (
      viewerStatus: string | undefined,
      localViewerStatus: string | undefined,
      legacyStatus: "none" | "pending" | "accepted",
      busy: boolean
    ) => {
      if (viewerStatus === "accepted" || localViewerStatus === "accepted" || legacyStatus === "accepted") {
        return t("following");
      }
      if (viewerStatus === "pending" || localViewerStatus === "pending" || legacyStatus === "pending") {
        return t("requested");
      }
      if (busy) return t("followBusy");
      return t("follow");
    },
    [t]
  );

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const feedMediaWidth = windowWidth - 20;
  const [stories, setStories] = useState<HomeStory[]>([]);
  const [posts, setPosts] = useState<HomePost[]>([]);
  const [dismissedPostIds, setDismissedPostIds] = useState<number[]>([]);
  const [dismissedHydrated, setDismissedHydrated] = useState(false);
  const [reportModalPost, setReportModalPost] = useState<HomePost | null>(null);
  const [reportSubmitBusy, setReportSubmitBusy] = useState(false);
  const postsRef = useRef<HomePost[]>([]);
  postsRef.current = posts;
  const [viewedStoryIds, setViewedStoryIds] = useState<Set<number>>(new Set());
  const [playingPostId, setPlayingPostId] = useState<number | null>(null);
  const [activePost, setActivePost] = useState<HomePost | null>(null);
  const [reelViewerOpen, setReelViewerOpen] = useState<{ posts: HomePost[]; initialIndex: number } | null>(null);
  const reelViewerListRef = useRef<FlatList<HomePost> | null>(null);
  const reelBackgroundMusicRef = useRef<{ postId: number; sound: Audio.Sound } | null>(null);
  const [sharePost, setSharePost] = useState<HomePost | null>(null);
  const [activeReelOptionsPost, setActiveReelOptionsPost] = useState<HomePost | null>(null);
  const [shareSearch, setShareSearch] = useState("");
  const [shareBusyUserId, setShareBusyUserId] = useState<number | null>(null);
  const [optimisticStories, setOptimisticStories] = useState<HomeStory[]>([]);
  const [activeCommentsPost, setActiveCommentsPost] = useState<HomePost | null>(null);
  const [likesSheetPost, setLikesSheetPost] = useState<HomePost | null>(null);
  const [likesSheetUsers, setLikesSheetUsers] = useState<PostLiker[]>([]);
  const [likesSheetLoading, setLikesSheetLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [replyingTo, setReplyingTo] = useState<{ id: string; user: string } | null>(null);
  const [commentsByPost, setCommentsByPost] = useState<Record<number, HomeCommentRow[]>>({});
  /** Parent comment ids whose direct replies are fully expanded (only used when direct reply count > REPLY_PREVIEW_VISIBLE). */
  const [expandedReplyThreads, setExpandedReplyThreads] = useState<Record<string, boolean>>({});
  const [commentInteractions, setCommentInteractions] = useState<Record<string, { liked: boolean; disliked: boolean }>>({});
  const [isStoryOpen, setStoryOpen] = useState(false);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  /** Only this user's stories are shown in the viewer (Instagram-style, not a global merged list). */
  const [storyPlaybackQueue, setStoryPlaybackQueue] = useState<HomeStory[]>([]);
  const [activeHomeTab, setActiveHomeTab] = useState<HomeTopTab>("Feed");
  const [followingUserIds, setFollowingUserIds] = useState<Set<number>>(new Set());
  const [socialAvatarsByUserId, setSocialAvatarsByUserId] = useState<Map<number, string>>(() => new Map());
  const [followerUserIds, setFollowerUserIds] = useState<Set<number>>(new Set());
  const [socialNetworkHydrated, setSocialNetworkHydrated] = useState(false);
  /** Accepted following (name + id) for share sheet — not only users who appear as post authors. */
  const [followingSharePeers, setFollowingSharePeers] = useState<Array<{ id: number; name: string }>>([]);
  const [relationships, setRelationships] = useState<Record<number, { viewerStatus: string; reverseStatus: string; canFollowBack: boolean }>>({});
  const [followBusyByUserId, setFollowBusyByUserId] = useState<Record<number, boolean>>({});
  const [legacyFollowStateByName, setLegacyFollowStateByName] = useState<Record<string, "none" | "pending" | "accepted">>({});
  const [legacyRelationshipByName, setLegacyRelationshipByName] = useState<Record<string, { viewerStatus: "none" | "pending" | "accepted"; canFollowBack: boolean }>>({});
  const [likeBusyByPostId, setLikeBusyByPostId] = useState<Record<number, boolean>>({});
  const [reelLikeBurstByPostId, setReelLikeBurstByPostId] = useState<Record<number, number>>({});
  const [carouselPageByPostId, setCarouselPageByPostId] = useState<Record<number, number>>({});
  const reelLikeBurstSeenRef = useRef<Record<number, number>>({});
  const [activeReelMusicPostId, setActiveReelMusicPostId] = useState<number | null>(null);
  /** Web: start muted (browser autoplay). Native: start with sound so reel / track audio is audible. */
  const [isReelMuted, setIsReelMuted] = useState(Platform.OS === "web");
  /** Ephemeral center icon in full-screen reel viewer after tap mute/unmute (Instagram-style). */
  const [reelMuteFeedback, setReelMuteFeedback] = useState<"muted" | "unmuted" | null>(null);
  const [saveBusyByPostId, setSaveBusyByPostId] = useState<Record<number, boolean>>({});
  const [reelProgressByPostId, setReelProgressByPostId] = useState<Record<number, { position: number; duration: number }>>({});
  const [reelSlotHeight, setReelSlotHeight] = useState(0);
  const [reelFrameWidth, setReelFrameWidth] = useState(0);
  const [storyViewport, setStoryViewport] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const progress = useRef(new Animated.Value(0)).current;
  const commentsFetchSeqRef = useRef(0);
  const reelVideoHandlesRef = useRef<Record<number, ContainedExpoVideoHandle | null>>({});
  const lastActiveReelIdRef = useRef<number | null>(null);
  const reelTapTsRef = useRef<Record<number, number>>({});
  const reelTapTimeoutRef = useRef<Record<number, ReturnType<typeof setTimeout> | null>>({});
  const reelViewerOpenRef = useRef<typeof reelViewerOpen>(null);
  reelViewerOpenRef.current = reelViewerOpen;
  const reelMuteFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (Platform.OS === "web") return;
    void Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
      shouldDuckAndroid: true,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      playThroughEarpieceAndroid: false
    });
  }, []);

  const viewabilityConfig = useMemo(
    () => ({ itemVisiblePercentThreshold: 35, minimumViewTime: 0 }),
    []
  );
  const reelViewabilityConfig = useMemo(
    () => ({ itemVisiblePercentThreshold: 35, minimumViewTime: 0 }),
    []
  );

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const ordered = viewableItems
        .filter((v) => v.isViewable && v.item != null)
        .map((v) => ({ post: v.item as HomePost, index: v.index ?? 0 }))
        .sort((a, b) => a.index - b.index);
      if (ordered.length === 0) {
        setPlayingPostId(null);
        return;
      }
      // Follow the pager slot itself (reel or photo). Do not prefer "any visible video" — that kept the
      // previous reel playing when a photo slot was centered, so playback never switched every swipe.
      const primary = ordered[ordered.length - 1];
      setPlayingPostId(primary.post.id);
    },
    []
  );

  const viewabilityCallbackRef = useRef(onViewableItemsChanged);
  viewabilityCallbackRef.current = onViewableItemsChanged;

  const onViewableItemsChangedRef = useRef(
    (info: { viewableItems: ViewToken[]; changed: ViewToken[] }) => {
      viewabilityCallbackRef.current(info);
    }
  );

  const tabPosts = useMemo(() => {
    const dismissed = new Set(dismissedPostIds);
    const strip = (list: HomePost[]) => list.filter((p) => !dismissed.has(p.id));
    if (activeHomeTab === "Feed") return sortPostsNewestFirst(strip(posts));
    if (activeHomeTab === "Friends") {
      return sortPostsNewestFirst(
        strip(
          posts.filter((p) => {
            if (!p.videoUrl) return false;
            const uid = Number(p.userId);
            return Number.isFinite(uid) && uid > 0 && followingUserIds.has(uid);
          })
        )
      );
    }
    if (activeHomeTab === "live") {
      return sortPostsNewestFirst(strip(posts.filter((p) => !!p.videoUrl)));
    }
    return sortPostsNewestFirst(strip(posts));
  }, [activeHomeTab, posts, followingUserIds, dismissedPostIds]);

  useEffect(() => {
    let cancelled = false;
    setDismissedHydrated(false);
    setDismissedPostIds([]);
    const key = dismissedPostsStorageKey(user?.id);
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (cancelled) return;
        if (raw) {
          const parsed = JSON.parse(raw) as unknown;
          if (Array.isArray(parsed)) {
            const ids = parsed.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);
            setDismissedPostIds(Array.from(new Set(ids)).slice(-400));
          }
        }
      } catch {
        if (!cancelled) setDismissedPostIds([]);
      } finally {
        if (!cancelled) setDismissedHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!dismissedHydrated) return;
    const key = dismissedPostsStorageKey(user?.id);
    void AsyncStorage.setItem(key, JSON.stringify(Array.from(new Set(dismissedPostIds)).slice(-400)));
  }, [user?.id, dismissedPostIds, dismissedHydrated]);

  const showFriendsTab =
    socialNetworkHydrated && (followingUserIds.size > 0 || followerUserIds.size > 0);

  const visibleHomeTopTabs = useMemo(
    () => (showFriendsTab ? [...HOME_TOP_TABS_ALL] : HOME_TOP_TABS_ALL.filter((t) => t !== "Friends")),
    [showFriendsTab]
  );

  useEffect(() => {
    if (activeHomeTab === "Friends" && !showFriendsTab) {
      setActiveHomeTab("Feed");
    }
  }, [activeHomeTab, showFriendsTab]);

  /** Dark, full-screen vertical reel surface for Feed, Friends, and Live tabs. */
  const isReelSurfaceTab = activeHomeTab === "Feed" || activeHomeTab === "Friends";
  const isLiveTab = activeHomeTab === "live";

  const openPostFromFeed = useCallback((post: HomePost, opts?: { isolated?: boolean }) => {
    if (!postHasViewableMedia(post)) return;
    let ordered: HomePost[];
    let initialIndex: number;
    if (opts?.isolated) {
      ordered = [post];
      initialIndex = 0;
    } else {
      const list = tabPosts.filter((p) => postHasViewableMedia(p));
      ordered = list.length ? list : [post];
      const ix = ordered.findIndex((p) => p.id === post.id);
      initialIndex = ix >= 0 ? ix : 0;
    }
    setPlayingPostId(post.id);
    setReelViewerOpen({ posts: ordered, initialIndex });
  }, [tabPosts]);

  /** Open post/reel in the same fullscreen viewer when user taps a share card in chat. */
  useFocusEffect(
    useCallback(() => {
      const pending = takePendingSharedPostViewer();
      if (pending) openPostFromFeed(pending.post, { isolated: pending.isolated });
    }, [openPostFromFeed])
  );

  const resolveLikerProfile = useCallback(
    (liker: PostLiker): PostLiker => {
      let userId = liker.userId;
      let userName = liker.userName;
      let avatarUrl = liker.avatarUrl;
      if (userId && socialAvatarsByUserId.has(userId)) {
        avatarUrl = avatarUrl || socialAvatarsByUserId.get(userId);
      }
      if (!userId) {
        const norm = normalizeIdentity(userName);
        const peer = followingSharePeers.find((p) => normalizeIdentity(p.name) === norm);
        if (peer) {
          userId = peer.id;
          userName = peer.name;
          avatarUrl = avatarUrl || socialAvatarsByUserId.get(peer.id);
        } else {
          const fromPost = postsRef.current.find((p) => normalizeIdentity(p.userName) === norm);
          if (fromPost?.userId) {
            userId = Number(fromPost.userId);
            userName = fromPost.userName || userName;
            avatarUrl = avatarUrl || fromPost.authorAvatarUrl || socialAvatarsByUserId.get(userId);
          }
        }
      }
      return { userId, userName, avatarUrl };
    },
    [followingSharePeers, socialAvatarsByUserId]
  );

  const openPostLikesSheet = useCallback(
    async (post: HomePost) => {
      const livePost = postsRef.current.find((p) => p.id === post.id) ?? post;
      if (!livePost.likesCount && !livePost.viewerHasLiked) return;
      setLikesSheetPost(livePost);
      setLikesSheetLoading(true);
      setLikesSheetUsers([]);
      const seenUserIds = new Set<number>();
      const seenNames = new Set<string>();
      const merged: PostLiker[] = [];
      const pushLiker = (raw: PostLiker | null) => {
        if (!raw) return;
        const liker = resolveLikerProfile(raw);
        const nameKey = normalizeIdentity(liker.userName);
        if (liker.userId) {
          if (seenUserIds.has(liker.userId)) return;
          seenUserIds.add(liker.userId);
          if (nameKey) seenNames.add(nameKey);
          merged.push(liker);
          return;
        }
        if (!nameKey || seenNames.has(nameKey)) return;
        seenNames.add(nameKey);
        merged.push(liker);
      };

      for (const row of livePost.recentLikers || []) {
        pushLiker(mapApiLikerToPostLiker(row));
      }

      const res = await fetchHomePostLikes(livePost.id, token ?? null);
      for (const row of res.likers || []) {
        pushLiker(mapApiLikerToPostLiker(row));
      }

      if (livePost.viewerHasLiked) {
        pushLiker(viewerAsPostLiker(user || {}));
      }

      for (const row of await getLikersFromLocalLikeMap(livePost.id)) {
        pushLiker(row);
      }
      for (const row of await getLikersFromLocalEngagementForPost(livePost.id)) {
        pushLiker(row);
      }

      if (token && merged.length === 0 && livePost.likesCount > 0) {
        try {
          const notif = await fetchSocialNotifications(token);
          for (const n of notif.postLikes || []) {
            if (Number(n.postId) !== livePost.id) continue;
            pushLiker({
              userId: Number(n.actorId) || undefined,
              userName: String(n.actorName || "").trim() || "User",
              avatarUrl: n.actorId ? socialAvatarsByUserId.get(Number(n.actorId)) : undefined
            });
          }
        } catch {
          // ignore
        }
      }

      if (merged.length === 0 && livePost.likesCount > 0) {
        try {
          const fresh = await fetchHomePosts(token ?? null);
          const refreshed = fresh.posts.find((p) => p.id === livePost.id);
          for (const row of refreshed?.recentLikers || []) {
            pushLiker(mapApiLikerToPostLiker(row));
          }
          if (refreshed?.recentLikers?.length) {
            setPosts((prev) =>
              prev.map((p) => (p.id === livePost.id ? { ...p, recentLikers: refreshed.recentLikers } : p))
            );
          }
        } catch {
          // ignore
        }
      }

      const apiLikers: HomePostLiker[] = merged.map((l) => ({
        userId: l.userId || 0,
        fullName: l.userName,
        username: l.userName,
        avatarUrl: l.avatarUrl
      }));

      setLikesSheetUsers(merged);
      setLikesSheetLoading(false);

      if (merged.length > 0) {
        setPosts((prev) =>
          prev.map((p) => (p.id === livePost.id ? { ...p, recentLikers: apiLikers } : p))
        );
      }
    },
    [token, user, resolveLikerProfile, socialAvatarsByUserId]
  );

  const triggerReelLikeBurst = useCallback((postId: number) => {
    setReelLikeBurstByPostId((prev) => ({ ...prev, [postId]: (prev[postId] || 0) + 1 }));
  }, []);


  useEffect(() => {
    if (tabPosts.length === 0) {
      setPlayingPostId(null);
      return;
    }
    setPlayingPostId((current) => {
      if (current != null && tabPosts.some((p) => p.id === current)) return current;
      return tabPosts[0]?.id ?? null;
    });
  }, [tabPosts]);

  const currentUserId = Number(user?.id);
  const currentUserStoryKeys = useMemo(() => {
    const keys = new Set<string>();
    const n = normalizeIdentity(user?.fullName || "");
    const u = normalizeIdentity(String(user?.username || "").replace(/^@+/, ""));
    if (n) keys.add(n);
    if (u) keys.add(u);
    return keys;
  }, [user?.fullName, user?.username]);

  const ownStories = useMemo(
    () =>
      stories.filter((s) => {
        const sid = Number(s.userId);
        if (Number.isFinite(currentUserId) && currentUserId > 0 && Number.isFinite(sid) && sid > 0) {
          return sid === currentUserId;
        }
        const storyName = normalizeIdentity(s.userName);
        if (!storyName || storyName === "you") return false;
        return currentUserStoryKeys.has(storyName);
      }),
    [currentUserId, currentUserStoryKeys, stories]
  );
  const otherStories = useMemo(
    () =>
      stories.filter((s) => {
        const sid = Number(s.userId);
        if (Number.isFinite(currentUserId) && currentUserId > 0 && Number.isFinite(sid) && sid > 0) {
          return sid !== currentUserId;
        }
        const storyName = normalizeIdentity(s.userName);
        if (!storyName || storyName === "you") return true;
        return !currentUserStoryKeys.has(storyName);
      }),
    [currentUserId, currentUserStoryKeys, stories]
  );

  const avatarLookup = useMemo(
    () => buildAvatarLookup(posts, user, socialAvatarsByUserId),
    [posts, socialAvatarsByUserId, user]
  );

  const ownPlayableStories = useMemo(
    () => sortStoriesForPlayback(ownStories.filter((s) => storyHasMedia(s))),
    [ownStories]
  );

  const otherStoryGroups = useMemo(() => {
    const playable = otherStories.filter((s) => storyHasMedia(s));
    const byKey = new Map<string, HomeStory[]>();
    for (const s of playable) {
      const k = storyAuthorKey(s);
      const arr = byKey.get(k) ?? [];
      arr.push(s);
      byKey.set(k, arr);
    }
    const groups: OtherStoryGroup[] = [];
    for (const [key, list] of byKey) {
      const sorted = sortStoriesForPlayback(list);
      const head = sorted[0];
      const uid = Number(head.userId);
      const av = storyAuthorAvatarUri(head, user, avatarLookup, posts);
      groups.push({
        key,
        userId: Number.isFinite(uid) && uid > 0 ? uid : null,
        userName: head.userName,
        avatarLabel: head.avatarLabel,
        ...(av ? { avatarUrl: av } : {}),
        stories: sorted
      });
    }
    groups.sort((a, b) => storyTimeMs(b.stories[b.stories.length - 1]) - storyTimeMs(a.stories[a.stories.length - 1]));
    return groups;
  }, [avatarLookup, otherStories, posts, user]);

  const activeStory = storyPlaybackQueue[activeStoryIndex];
  const activeStoryAvatarUri = activeStory ? storyAuthorAvatarUri(activeStory, user, avatarLookup, posts) : undefined;

  const applyViewedStories = useCallback(
    (incoming: HomeStory[]) => incoming.map((story) => (viewedStoryIds.has(story.id) ? { ...story, viewed: true } : story)),
    [viewedStoryIds]
  );

  const closeStory = () => {
    setStoryOpen(false);
    setStoryPlaybackQueue([]);
    progress.stopAnimation();
    progress.setValue(0);
  };

  const nextStory = () => {
    if (activeStoryIndex >= storyPlaybackQueue.length - 1) {
      closeStory();
      return;
    }
    progress.stopAnimation();
    progress.setValue(0);
    setActiveStoryIndex((v) => v + 1);
  };

  const prevStory = () => {
    if (activeStoryIndex <= 0) return;
    progress.stopAnimation();
    progress.setValue(0);
    setActiveStoryIndex((v) => v - 1);
  };

  useEffect(() => {
    if (!isStoryOpen || storyPlaybackQueue.length === 0) return;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 7000,
      useNativeDriver: false
    }).start(({ finished }) => {
      if (finished) nextStory();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStoryOpen, activeStoryIndex, storyPlaybackQueue.length]);

  useEffect(() => {
    let mounted = true;
    fetchHomeStories()
      .then((data) => {
        if (!mounted) return;
        const remoteRows = (data.stories || []).map((s) => normalizeStoryRow(s as HomeStory & Record<string, unknown>));
        setStories(applyViewedStories(mergeStories(remoteRows, optimisticStories)));
      })
      .catch(() => {
        if (!mounted) return;
        setStories(applyViewedStories(mergeStories([], optimisticStories)));
      });
    return () => {
      mounted = false;
    };
  }, [applyViewedStories, optimisticStories, refreshToken]);

  useEffect(() => {
    if (!activeStory?.id || !isStoryOpen) return;
    setViewedStoryIds((prev) => {
      if (prev.has(activeStory.id)) return prev;
      const next = new Set(prev);
      next.add(activeStory.id);
      return next;
    });
    setStories((prev) => prev.map((s) => (s.id === activeStory.id ? { ...s, viewed: true } : s)));
  }, [activeStory?.id, isStoryOpen]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await fetchHomePosts(token ?? null);
        if (!mounted) return;
        const pending = takePendingFeedPost?.();
        const rows = dedupeHomePosts(data.posts);
        const merged = pending ? dedupeHomePosts([pending, ...rows]) : rows;
        const localLikes = await getLocalLikeStateForPosts(
          localLikeViewerIdentity(user || {}),
          merged.map((p) => p.id)
        );
        if (!mounted) return;
        setPosts(
          merged.map((p) => ({
            ...p,
            viewerHasLiked: !!p.viewerHasLiked || localLikes.likedPostIds.has(p.id),
            likesCount: token
              ? Number(p.likesCount || 0)
              : Math.max(Number(p.likesCount || 0), Number(localLikes.likesCountByPost[p.id] || 0))
          }))
        );
      } catch {
        if (!mounted) return;
        setPosts([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [refreshToken, token, user?.email, user?.fullName, user?.id, takePendingFeedPost]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!token || !user?.id) {
        if (mounted) setRelationships({});
        return;
      }
      const targetIds = [...new Set(posts.map((p) => Number(p.userId)).filter((v) => Number.isFinite(v) && v > 0 && v !== user.id))];
      if (!targetIds.length) {
        if (mounted) setRelationships({});
        return;
      }
      try {
        const data = await fetchRelationships(token, targetIds);
        if (!mounted) return;
        setRelationships(data.relationships || {});
      } catch {
        if (!mounted) return;
        setRelationships({});
      }
    })();
    return () => {
      mounted = false;
    };
  }, [posts, token, user?.id]);

  /** Populates the set of user ids the current user follows — used by the Friends tab to show reels from those users. */
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!token || !user?.id) {
        if (mounted) {
          setFollowingUserIds(new Set());
          setFollowerUserIds(new Set());
          setFollowingSharePeers([]);
          setSocialAvatarsByUserId(new Map());
          setSocialNetworkHydrated(true);
        }
        return;
      }
      try {
        const network = await fetchSocialNetwork(token, Number(user.id));
        if (!mounted) return;
        const followingIds = new Set<number>();
        const followerIds = new Set<number>();
        const peers: Array<{ id: number; name: string }> = [];
        const avatarMap = new Map<number, string>();
        const rememberAvatar = (person: { key?: string; avatarUrl?: string | null }) => {
          const raw = String(person.key || "").trim();
          const uid = /^\d+$/.test(raw) ? Number(raw) : NaN;
          const av = typeof person.avatarUrl === "string" ? person.avatarUrl.trim() : "";
          if (Number.isFinite(uid) && uid > 0 && av) avatarMap.set(uid, av);
          return uid;
        };
        for (const person of network.following || []) {
          const uid = rememberAvatar(person);
          if (Number.isFinite(uid) && uid > 0) {
            followingIds.add(uid);
            const name = String(person.name || "").trim();
            if (name) peers.push({ id: uid, name });
          }
        }
        for (const person of network.followers || []) {
          const uid = rememberAvatar(person);
          if (Number.isFinite(uid) && uid > 0) followerIds.add(uid);
        }
        setFollowingUserIds(followingIds);
        setFollowerUserIds(followerIds);
        setFollowingSharePeers(peers);
        setSocialAvatarsByUserId(avatarMap);
        setSocialNetworkHydrated(true);
      } catch {
        if (!mounted) return;
        setFollowingUserIds(new Set());
        setFollowerUserIds(new Set());
        setFollowingSharePeers([]);
        setSocialAvatarsByUserId(new Map());
        setSocialNetworkHydrated(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token, user?.id, refreshToken]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!user?.fullName) {
        if (mounted) setLegacyRelationshipByName({});
        return;
      }
      const names = [...new Set(posts.map((p) => normalizeIdentity(p.userName)).filter(Boolean))];
      if (!names.length) {
        if (mounted) setLegacyRelationshipByName({});
        return;
      }
      const map = await getLocalRelationshipMapByNames(
        { name: user.fullName, key: user.email || String(user.id || "") },
        names
      );
      if (!mounted) return;
      setLegacyRelationshipByName(map);
      setLegacyFollowStateByName((prev) => {
        const next = { ...prev };
        for (const name of Object.keys(map)) {
          if (!next[name] || next[name] === "none") next[name] = map[name].viewerStatus;
        }
        return next;
      });
    })();
    return () => {
      mounted = false;
    };
  }, [posts, user?.email, user?.fullName, user?.id]);

  const toggleFollow = useCallback(
    async (targetUserId: number | null, postUserName: string, currentStatus: "none" | "pending" | "accepted") => {
      const legacyKey = normalizeIdentity(postUserName);
      if (currentStatus === "accepted") {
        if (!targetUserId) {
          await removeLocalFollowByIdentity(
            { name: user?.fullName || "Farmer", key: user?.email || String(user?.id || "") },
            { name: postUserName || "Farmer" }
          );
          setLegacyFollowStateByName((prev) => ({ ...prev, [legacyKey]: "none" }));
          setLegacyRelationshipByName((prev) => ({
        ...prev,
            [legacyKey]: { ...(prev[legacyKey] || { canFollowBack: false }), viewerStatus: "none", canFollowBack: true }
          }));
          return;
        }
        if (!token || followBusyByUserId[targetUserId]) return;
        setFollowBusyByUserId((prev) => ({ ...prev, [targetUserId]: true }));
        try {
          await unfollowUser(token, targetUserId);
          setRelationships((prev) => ({
            ...prev,
            [targetUserId]: {
              ...(prev[targetUserId] || { reverseStatus: "none", canFollowBack: false }),
              viewerStatus: "none",
              canFollowBack: !!prev[targetUserId]?.canFollowBack
            }
          }));
        } catch {
          // If backend route is unavailable on hosted env, keep UI stable.
          setRelationships((prev) => ({
            ...prev,
            [targetUserId]: {
              ...(prev[targetUserId] || { reverseStatus: "none", canFollowBack: false }),
              viewerStatus: "none",
              canFollowBack: !!prev[targetUserId]?.canFollowBack
            }
          }));
        } finally {
          setFollowBusyByUserId((prev) => ({ ...prev, [targetUserId]: false }));
        }
        return;
      }
      if (!targetUserId) {
        await sendLocalFollowRequestByIdentity(
          { name: user?.fullName || "Farmer", key: user?.email || String(user?.id || "") },
          { name: postUserName || "Farmer", key: undefined }
        );
        setLegacyFollowStateByName((prev) => ({ ...prev, [legacyKey]: prev[legacyKey] === "accepted" ? "accepted" : "pending" }));
        return;
      }
      if (!token || followBusyByUserId[targetUserId]) return;
      setFollowBusyByUserId((prev) => ({ ...prev, [targetUserId]: true }));
      try {
        const data = await sendFollowRequest(token, targetUserId);
        setRelationships((prev) => ({
          ...prev,
          [targetUserId]: {
            ...(prev[targetUserId] || { reverseStatus: "none", canFollowBack: false }),
            viewerStatus: data.follow.status,
            canFollowBack: false
          }
        }));
      } catch (error: any) {
        Alert.alert(t("followFailed"), error?.message || t("followFailedMessage"));
      } finally {
        setFollowBusyByUserId((prev) => ({ ...prev, [targetUserId]: false }));
      }
    },
    [followBusyByUserId, token, user?.email, user?.fullName, user?.id]
  );

  useEffect(() => {
    setExpandedReplyThreads({});
  }, [activeCommentsPost?.id]);

  useEffect(() => {
    if (!activeCommentsPost) setReplyingTo(null);
  }, [activeCommentsPost]);

  const openCommentsForPost = useCallback(
    (post: HomePost) => {
      setActiveCommentsPost(post);
      setReplyingTo(null);
      setExpandedReplyThreads({});
      const reqKey = ++commentsFetchSeqRef.current;
      void (async () => {
        let remote: HomeCommentRow[] = [];
        try {
          const data = await fetchHomePostComments(post.id, token ?? null);
          remote = (data.comments ?? []).map((x) => normalizeCommentRow(x as HomeCommentRow & Record<string, unknown>));
        } catch {
          remote = [];
        }
        if (reqKey !== commentsFetchSeqRef.current) return;
        const localRowsRaw = await getLocalCommentsForPost(post.id);
        if (reqKey !== commentsFetchSeqRef.current) return;
        const localRows = localRowsRaw.map((x) => normalizeCommentRow(x as HomeCommentRow & Record<string, unknown>));
        const merged = mergeRemoteAndLocalComments(remote, localRows);
        setCommentsByPost((prev) => ({ ...prev, [post.id]: merged }));
      })();
    },
    [token]
  );

  const onReelMomentumEnd = useCallback(
    (offsetY: number) => {
      if (reelSlotHeight <= 0 || tabPosts.length === 0) return;
      const index = Math.max(0, Math.min(tabPosts.length - 1, Math.round(offsetY / reelSlotHeight)));
      const post = tabPosts[index];
      setPlayingPostId(post?.id ?? null);
    },
    [reelSlotHeight, tabPosts]
  );

  const onReelViewerMomentumEnd = useCallback(
    (offsetY: number) => {
      if (!reelViewerOpen || windowHeight <= 0) return;
      const { posts: viewerPosts } = reelViewerOpen;
      if (!viewerPosts.length) return;
      const index = Math.max(0, Math.min(viewerPosts.length - 1, Math.round(offsetY / windowHeight)));
      const post = viewerPosts[index];
      setPlayingPostId(post?.id ?? null);
    },
    [reelViewerOpen, windowHeight]
  );

  const onReelStatusUpdate = useCallback((postId: number, status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    const position = Number(status.positionMillis || 0);
    const duration = Math.max(1, Number(status.durationMillis || 0));
    setReelProgressByPostId((prev) => {
      const cur = prev[postId];
      if (cur && Math.abs(cur.position - position) < 120 && cur.duration === duration) return prev;
      return { ...prev, [postId]: { position, duration } };
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const existing = reelBackgroundMusicRef.current;
      if (existing) {
        try {
          await existing.sound.unloadAsync();
        } catch {
          //
        }
        reelBackgroundMusicRef.current = null;
        setActiveReelMusicPostId((cur) => (cur === existing.postId ? null : cur));
      }
      if (playingPostId == null) return;
      const post =
        postsRef.current.find((p) => p.id === playingPostId) ?? reelViewerOpen?.posts.find((p) => p.id === playingPostId);
      const musicUrl = post?.musicAudioUrl?.trim();
      if (!musicUrl) return;
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: musicUrl },
          { shouldPlay: !isReelMuted, isLooping: true, volume: 1, isMuted: false }
        );
        if (cancelled) {
          await sound.unloadAsync();
          return;
        }
        reelBackgroundMusicRef.current = { postId: playingPostId, sound };
        setActiveReelMusicPostId(playingPostId);
      } catch {
        setActiveReelMusicPostId((cur) => (cur === playingPostId ? null : cur));
      }
    };
    void run();
    return () => {
      cancelled = true;
      const cur = reelBackgroundMusicRef.current;
      if (cur) {
        void cur.sound.unloadAsync();
        reelBackgroundMusicRef.current = null;
      }
      setActiveReelMusicPostId(null);
    };
  }, [isReelMuted, playingPostId, reelViewerOpen]);

  useEffect(() => {
    const cur = reelBackgroundMusicRef.current;
    if (!cur) return;
    if (isReelMuted) {
      void cur.sound.pauseAsync().catch(() => {});
    } else {
      void cur.sound.playAsync().catch(() => {});
    }
  }, [isReelMuted]);

  useEffect(() => {
    const prev = lastActiveReelIdRef.current;
    const next = playingPostId;
    if (prev != null && prev !== next) {
      setReelProgressByPostId((state) => {
        const cur = state[prev];
        if (!cur) return state;
        if (cur.position === 0) return state;
        return { ...state, [prev]: { ...cur, position: 0 } };
      });
      void reelVideoHandlesRef.current[prev]?.seekToRatio(0);
    }
    lastActiveReelIdRef.current = next ?? null;
  }, [playingPostId]);

  const buildShareLink = useCallback((post: HomePost) => {
    return `${getWebAppOrigin()}/reel/${encodeURIComponent(String(post.id))}`;
  }, []);

  const shareMessage = useCallback(
    (post: HomePost) => {
      const caption = displayPostCaption(post.caption);
      const link = buildShareLink(post);
      const intro = t("shareReelMessage", { name: displayPersonName(post.userName) });
      return `${intro}${caption ? `\n${caption}` : ""}\n${link}`;
    },
    [buildShareLink, displayPersonName, displayPostCaption, t]
  );

  const reelChatMessage = useCallback(
    (post: HomePost) => {
      return `[Cropvibe Reel]\n${JSON.stringify({
        id: post.id,
        userId: post.userId ?? null,
        userName: post.userName,
        author: post.userName,
        location: post.location || "",
        caption: post.caption || "",
        likesCount: post.likesCount ?? 0,
        commentsCount: post.commentsCount ?? 0,
        videoUrl: post.videoUrl || null,
        imageUrl: post.imageUrl || null,
        imageUrls: Array.isArray(post.imageUrls) && post.imageUrls.length > 0 ? post.imageUrls : undefined,
        thumbnailUrl: post.thumbnailUrl || post.imageUrl || null,
        musicLabel: post.musicLabel ?? null,
        musicAudioUrl: post.musicAudioUrl ?? null,
        creativeMeta: post.creativeMeta,
        authorAvatarUrl: post.authorAvatarUrl ?? null,
        createdAt: post.createdAt || new Date().toISOString(),
        viewerHasLiked: post.viewerHasLiked,
        viewerHasSaved: post.viewerHasSaved,
        link: buildShareLink(post)
      })}`;
    },
    [buildShareLink]
  );

  const shareRecipients = useMemo(() => {
    const viewerName = normalizeIdentity(user?.fullName || "");
    const viewerId = Number(user?.id);
    const seen = new Set<string>();
    type ShareRecipient = { id: number | null; name: string; avatarUrl?: string | null };
    const rows: ShareRecipient[] = [];

    const add = (name: string, userId: number | null, avatarUrl?: string | null) => {
      const n = String(name || "").trim();
      if (!n) return;
      const uid = userId != null && Number.isFinite(userId) && userId > 0 ? userId : null;
      const key = uid != null ? `id:${uid}` : `name:${normalizeIdentity(n)}`;
      if (seen.has(key)) return;
      if ((uid != null && uid === viewerId) || normalizeIdentity(n) === viewerName) return;
      seen.add(key);
      const entry: ShareRecipient = { id: uid, name: n };
      if (typeof avatarUrl === "string" && avatarUrl.trim()) entry.avatarUrl = avatarUrl.trim();
      rows.push(entry);
    };

    for (const peer of followingSharePeers) {
      add(peer.name, peer.id);
    }
    const q = normalizeIdentity(shareSearch);
    return rows
      .filter((item) => !q || normalizeIdentity(item.name).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
      .slice(0, 48);
  }, [followingSharePeers, shareSearch, user?.fullName, user?.id]);

  const onSendReelToChat = useCallback(
    async (post: HomePost, recipient: { id: number | null; name: string; avatarUrl?: string | null }) => {
      if (!token) {
        Alert.alert(t("loginRequired"), t("loginRequiredChat"));
        return;
      }
      if (!recipient.id) {
        Alert.alert(t("chatUnavailable"), t("chatUnavailableSend"));
        return;
      }
      setShareBusyUserId(recipient.id);
      try {
        await sendDirectMessage(token, recipient.id, reelChatMessage(post));
        setSharePost(null);
        setShareSearch("");
        Alert.alert(t("sentTitle"), t("reelSentTo", { name: displayPersonName(recipient.name) }));
      } catch {
        Alert.alert(t("sendFailed"), t("sendFailedReel"));
      } finally {
        setShareBusyUserId(null);
      }
    },
    [reelChatMessage, token]
  );

  const openExternalWithFallback = useCallback(async (primaryUrl: string, fallbackUrl: string) => {
    try {
      const supported = await Linking.canOpenURL(primaryUrl);
      if (supported) {
        await Linking.openURL(primaryUrl);
        return;
      }
    } catch {
      // fallback to web URL
    }
    await Linking.openURL(fallbackUrl);
  }, []);

  const onShareToSystem = useCallback(
    async (post: HomePost) => {
      try {
        await Share.share({ message: shareMessage(post) });
      } catch {
        Alert.alert(t("shareFailed"), t("shareFailedSystem"));
      }
    },
    [shareMessage]
  );

  const onShareToWhatsApp = useCallback(
    async (post: HomePost) => {
      const msg = encodeURIComponent(shareMessage(post));
      await openExternalWithFallback(`whatsapp://send?text=${msg}`, `https://wa.me/?text=${msg}`);
    },
    [openExternalWithFallback, shareMessage]
  );

  const onShareToMessenger = useCallback(
    async (post: HomePost) => {
      const link = encodeURIComponent(buildShareLink(post));
      await openExternalWithFallback(
        `fb-messenger://share?link=${link}`,
        `https://www.messenger.com/share?link=${link}`
      );
    },
    [buildShareLink, openExternalWithFallback]
  );

  const onShareToSnapchat = useCallback(
    async (post: HomePost) => {
      const link = encodeURIComponent(buildShareLink(post));
      await openExternalWithFallback(`snapchat://share?link=${link}`, `https://www.snapchat.com/`);
    },
    [buildShareLink, openExternalWithFallback]
  );

  const onAddReelToStory = useCallback(
    async (post: HomePost) => {
      const media = post.videoUrl ? { videoUrl: post.videoUrl } : post.imageUrl ? { imageUrl: post.imageUrl } : null;
      if (!media) {
        Alert.alert(t("noMediaTitle"), t("noMediaStory"));
        return;
      }
      const optimistic: HomeStory = normalizeStoryRow({
        id: Date.now() * -1,
        userId: Number(user?.id) || undefined,
        userName: user?.fullName || "You",
        district: post.location || "My Farm",
        avatarLabel: (user?.fullName || "U").charAt(0).toUpperCase(),
        avatarUrl: user?.avatarUrl,
        hasNew: true,
        viewed: false,
        ...media,
        createdAt: new Date().toISOString()
      });
      setOptimisticStories((prev) => [optimistic, ...prev].slice(0, 20));
      setStories((prev) => applyViewedStories(mergeStories(prev, [optimistic])));
      try {
        const created = await createHomeStory({
          userName: user?.fullName || "You",
          district: post.location || "My Farm",
          ...media
        }, token ?? null);
        const normalizedCreated = normalizeStoryRow(created.story as HomeStory & Record<string, unknown>);
        const serverStory: HomeStory = {
          ...normalizedCreated,
          videoUrl: normalizedCreated.videoUrl || optimistic.videoUrl,
          imageUrl: normalizedCreated.imageUrl || optimistic.imageUrl,
          createdAt: normalizedCreated.createdAt || optimistic.createdAt
        };
        setOptimisticStories((prev) =>
          [serverStory, ...prev.filter((s) => Number(s.id) !== Number(optimistic.id) && Number(s.id) !== Number(serverStory.id))].slice(0, 20)
        );
        setStories((prev) => applyViewedStories(mergeStories([serverStory, ...prev], [])));
        setSharePost(null);
        Alert.alert(t("addedTitle"), t("addedToStory"));
      } catch {
        // fallback to existing create flow when API is unavailable
        setSharePost(null);
        onOpenCreate?.("story");
      }
    },
    [applyViewedStories, onOpenCreate, token, user?.avatarUrl, user?.fullName, user?.id]
  );

  const togglePostLike = useCallback(
    async (post: HomePost) => {
      const likedNow = !!post.viewerHasLiked;
      const nextLiked = !likedNow;
      const prevSnapshot = { liked: likedNow, count: post.likesCount };
      const normalizedPostName = normalizeIdentity(post.userName);
      const normalizedCurrentUserName = normalizeIdentity(user?.fullName || "");
      const postUserId = Number(post.userId);
      const isOwnPost =
        (postUserId > 0 && postUserId === Number(user?.id)) ||
        (!postUserId && normalizedPostName && normalizedPostName === normalizedCurrentUserName);

      const applyOptimistic = () => {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id
              ? { ...p, viewerHasLiked: nextLiked, likesCount: Math.max(0, p.likesCount + (nextLiked ? 1 : -1)) }
              : p
          )
        );
      };

      const revert = () => {
        setPosts((prev) =>
          prev.map((p) => (p.id === post.id ? { ...p, viewerHasLiked: prevSnapshot.liked, likesCount: prevSnapshot.count } : p))
        );
      };

      applyOptimistic();
      const localResult = await setLocalPostLikedByIdentity(
        post.id,
        localLikeViewerIdentity(user || {}),
        nextLiked
      );
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, viewerHasLiked: localResult.liked, likesCount: localResult.likesCount } : p))
      );

      if (!token) {
        if (nextLiked && !isOwnPost) {
          await appendLocalEngagementNotification({
            type: "post_like",
            actorName: user?.fullName || "Someone",
            recipientDisplayName: post.userName,
            postId: post.id,
            isReel: !!post.videoUrl
          });
        }
        return;
      }

      setLikeBusyByPostId((prev) => ({ ...prev, [post.id]: true }));
      try {
        const res = nextLiked ? await likeHomePost(token, post.id) : await unlikeHomePost(token, post.id);
        const me = viewerAsPostLiker(user || {});
        setPosts((prev) =>
          prev.map((p) => {
            if (p.id !== post.id) return p;
            let recentLikers = [...(p.recentLikers || [])];
            if (res.liked && me?.userId) {
              if (!recentLikers.some((l) => Number(l.userId) === me.userId)) {
                recentLikers = [
                  {
                    userId: me.userId,
                    fullName: me.userName,
                    username: user?.username || me.userName,
                    avatarUrl: me.avatarUrl
                  },
                  ...recentLikers
                ];
              }
            } else if (me?.userId) {
              recentLikers = recentLikers.filter((l) => Number(l.userId) !== me.userId);
            }
            return {
              ...p,
              viewerHasLiked: res.liked,
              likesCount: res.likesCount,
              recentLikers
            };
          })
        );
        await setLocalPostLikedByIdentity(post.id, localLikeViewerIdentity(user || {}), res.liked);
      } catch {
        revert();
        await setLocalPostLikedByIdentity(post.id, localLikeViewerIdentity(user || {}), prevSnapshot.liked);
        if (nextLiked && !isOwnPost) {
          await appendLocalEngagementNotification({
            type: "post_like",
            actorName: user?.fullName || "Someone",
            recipientDisplayName: post.userName,
            postId: post.id,
            isReel: !!post.videoUrl
          });
        }
      } finally {
        setLikeBusyByPostId((prev) => ({ ...prev, [post.id]: false }));
      }
    },
    [token, user?.email, user?.fullName, user?.id, user?.username]
  );

  const likeReelFromDoubleTap = useCallback(
    (post: HomePost) => {
      triggerReelLikeBurst(post.id);
      if (!post.viewerHasLiked) {
        void togglePostLike(post);
      }
    },
    [togglePostLike, triggerReelLikeBurst]
  );

  const onReelSurfaceTap = useCallback(
    (post: HomePost) => {
      if (!postHasViewableMedia(post)) return;
      if (!post.videoUrl) {
        openPostFromFeed(post);
        return;
      }
      const now = Date.now();
      const lastTap = reelTapTsRef.current[post.id] || 0;
      if (now - lastTap <= 280) {
        const pending = reelTapTimeoutRef.current[post.id];
        if (pending) clearTimeout(pending);
        reelTapTimeoutRef.current[post.id] = null;
        reelTapTsRef.current[post.id] = 0;
        likeReelFromDoubleTap(post);
        return;
      }
      reelTapTsRef.current[post.id] = now;
      const pending = reelTapTimeoutRef.current[post.id];
      if (pending) clearTimeout(pending);
      const delay = reelViewerOpenRef.current ? 200 : 280;
      reelTapTimeoutRef.current[post.id] = setTimeout(() => {
        reelTapTimeoutRef.current[post.id] = null;
        if (reelViewerOpenRef.current) {
          setIsReelMuted((prev) => {
            const next = !prev;
            setReelMuteFeedback(next ? "muted" : "unmuted");
            if (reelMuteFeedbackTimerRef.current) clearTimeout(reelMuteFeedbackTimerRef.current);
            reelMuteFeedbackTimerRef.current = setTimeout(() => {
              setReelMuteFeedback(null);
              reelMuteFeedbackTimerRef.current = null;
            }, 900);
            return next;
          });
        } else {
          openPostFromFeed(post);
        }
      }, delay);
    },
    [likeReelFromDoubleTap, openPostFromFeed]
  );

  useEffect(() => {
    return () => {
      const pending = Object.values(reelTapTimeoutRef.current);
      pending.forEach((t) => {
        if (t) clearTimeout(t);
      });
      if (reelMuteFeedbackTimerRef.current) clearTimeout(reelMuteFeedbackTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (reelViewerOpen) {
      setIsReelMuted(false);
    } else {
      setIsReelMuted(true);
    }
    setReelMuteFeedback(null);
    if (reelMuteFeedbackTimerRef.current) {
      clearTimeout(reelMuteFeedbackTimerRef.current);
      reelMuteFeedbackTimerRef.current = null;
    }
  }, [reelViewerOpen]);

  const togglePostSave = useCallback(
    async (post: HomePost) => {
      if (!token) {
        Alert.alert(t("loginRequired"), t("loginRequiredSave"));
        return;
      }
      const nextSaved = !post.viewerHasSaved;
      setSaveBusyByPostId((prev) => ({ ...prev, [post.id]: true }));
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, viewerHasSaved: nextSaved } : p)));
      try {
        const res = nextSaved ? await saveHomePost(token, post.id) : await unsaveHomePost(token, post.id);
        setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, viewerHasSaved: res.saved } : p)));
        setActiveReelOptionsPost((current) => (current?.id === post.id ? { ...current, viewerHasSaved: res.saved } : current));
      } catch {
        setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, viewerHasSaved: !nextSaved } : p)));
        Alert.alert(t("saveFailed"), t("savePostFailed"));
      } finally {
        setSaveBusyByPostId((prev) => ({ ...prev, [post.id]: false }));
      }
    },
    [token]
  );

  const onCopyPostLink = useCallback(
    async (post: HomePost) => {
      try {
        await Clipboard.setStringAsync(buildShareLink(post));
        setActiveReelOptionsPost(null);
        Alert.alert(t("copied"), t("copiedPostLink"));
      } catch {
        Alert.alert(t("copyFailedTitle"), t("copyFailed"));
      }
    },
    [buildShareLink]
  );

  const onNotInterestedInPost = useCallback((post: HomePost) => {
    setDismissedPostIds((prev) => (prev.includes(post.id) ? prev : [...prev, post.id]));
    setReelViewerOpen((v) => {
      if (!v || !v.posts.some((p) => p.id === post.id)) return v;
      const nextPosts = v.posts.filter((p) => p.id !== post.id);
      if (nextPosts.length === 0) return null;
      const removedIndex = v.posts.findIndex((p) => p.id === post.id);
      let nextInitial = v.initialIndex;
      if (removedIndex !== -1 && removedIndex < nextInitial) {
        nextInitial = Math.max(0, nextInitial - 1);
      }
      if (removedIndex !== -1 && removedIndex === nextInitial && nextInitial >= nextPosts.length) {
        nextInitial = Math.max(0, nextPosts.length - 1);
      }
      if (nextInitial >= nextPosts.length) nextInitial = Math.max(0, nextPosts.length - 1);
      return { posts: nextPosts, initialIndex: nextInitial };
    });
    setPlayingPostId((cur) => (cur === post.id ? null : cur));
    setActiveReelOptionsPost(null);
    Alert.alert(t("gotItHidePost"), t("gotItHidePostMsg"));
  }, []);

  const submitReportWithReason = useCallback(
    async (reasonKey: string) => {
      if (!reportModalPost || !token) return;
      setReportSubmitBusy(true);
      try {
        await reportHomePost(token, reportModalPost.id, reasonKey);
        setReportModalPost(null);
        Alert.alert(t("thanksReport"), t("thanksReportMsg"));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Could not send report.";
        Alert.alert(t("reportFailed"), msg);
      } finally {
        setReportSubmitBusy(false);
      }
    },
    [reportModalPost, token]
  );

  const onReportPost = useCallback(
    (post: HomePost) => {
      setActiveReelOptionsPost(null);
      if (!token) {
        Alert.alert(t("loginRequired"), t("loginRequiredReport"));
        return;
      }
      setReportModalPost(post);
    },
    [token]
  );

  const confirmDeleteOwnPost = useCallback(
    (post: HomePost) => {
      if (post.id < 0) {
        setPosts((prev) => prev.filter((p) => p.id !== post.id));
        setPlayingPostId((cur) => (cur === post.id ? null : cur));
        return;
      }
      if (!token) {
        if (Platform.OS === "web" && typeof window !== "undefined") {
          window.alert("Please log in to delete posts.");
        } else {
          Alert.alert(t("loginRequired"), t("loginRequiredDelete"));
        }
        return;
      }
      if (!viewerOwnsPost(post, user)) {
        if (Platform.OS === "web" && typeof window !== "undefined") {
          window.alert("You can only delete your own posts.");
        } else {
          Alert.alert(t("notAllowedTitle"), t("notAllowedDeleteOwn"));
        }
        return;
      }

      const runDelete = async () => {
        try {
          await deleteHomePost(token, post.id);
          setPosts((prev) => prev.filter((p) => p.id !== post.id));
          setActiveReelOptionsPost(null);
          setReelViewerOpen((v) => {
            if (!v) return null;
            const nextPosts = v.posts.filter((p) => p.id !== post.id);
            if (nextPosts.length === 0) return null;
            const nextIndex = Math.min(v.initialIndex, nextPosts.length - 1);
            return { posts: nextPosts, initialIndex: nextIndex };
          });
          setPlayingPostId((cur) => (cur === post.id ? null : cur));
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "Could not delete this post.";
          if (Platform.OS === "web" && typeof window !== "undefined") {
            window.alert(msg);
          } else {
            Alert.alert(t("deleteFailed"), msg);
          }
        }
      };

      // React Native Web: Alert.alert with buttons is unreliable; nothing runs → no DELETE request.
      if (Platform.OS === "web" && typeof window !== "undefined") {
        setActiveReelOptionsPost(null);
        setTimeout(() => {
          if (!window.confirm(`${t("deletePostTitle")} ${t("deletePostBody")}`)) return;
          void runDelete();
        }, 0);
        return;
      }

      Alert.alert(t("deletePostTitle"), t("deletePostBody"), [
        { text: t("cancel"), style: "cancel" },
        { text: t("deleteConfirm"), style: "destructive", onPress: () => void runDelete() }
      ]);
    },
    [t, token, user]
  );

  const submitComment = useCallback(async () => {
    const text = commentDraft.trim();
    if (!text || !activeCommentsPost) return;
    const post = activeCommentsPost;
    const normalizedPostName = normalizeIdentity(post.userName);
    const normalizedCurrentUserName = normalizeIdentity(user?.fullName || "");
    const postUserId = Number(post.userId);
    const isOwnPost =
      (postUserId > 0 && postUserId === Number(user?.id)) ||
      (!postUserId && normalizedPostName && normalizedPostName === normalizedCurrentUserName);

    const replyTarget = replyingTo;
    const parentNum = replyTarget ? Number(replyTarget.id) : NaN;
    const parentIdStr = Number.isFinite(parentNum) && parentNum > 0 ? String(Math.trunc(parentNum)) : undefined;

    if (token) {
      try {
        const res = await createHomePostComment(token, post.id, text, {
          parentCommentId: parentIdStr != null ? Number(parentIdStr) : undefined
        });
        const createdRaw = res.comment.createdAt;
        const createdIso =
          typeof createdRaw === "string"
            ? createdRaw
            : createdRaw != null
              ? new Date(createdRaw as Date).toISOString()
              : new Date().toISOString();
        const row: HomeCommentRow = {
          id: String(res.comment.id),
          user: res.comment.user || user?.fullName || "You",
          text: res.comment.text || text,
          likes: res.comment.likes ?? 0,
          createdAt: createdIso,
          parentCommentId: res.comment.parentCommentId ?? parentIdStr,
          ...(res.comment.avatarUrl && String(res.comment.avatarUrl).trim()
            ? { avatarUrl: String(res.comment.avatarUrl).trim() }
            : user?.avatarUrl && String(user.avatarUrl).trim()
              ? { avatarUrl: String(user.avatarUrl).trim() }
              : {})
        };
    setCommentsByPost((prev) => {
          const list = prev[post.id] ?? [];
          const withoutDup = list.filter((c) => String(c.id) !== row.id);
          return { ...prev, [post.id]: [...withoutDup, row] };
        });
        setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, commentsCount: res.commentsCount } : p)));
        setCommentDraft("");
        setReplyingTo(null);
        return;
      } catch {
        // fall through to local behavior
      }
    }

    const nowIso = new Date().toISOString();
    setCommentsByPost((prev) => {
      const list = prev[post.id] ?? [];
      return {
        ...prev,
        [post.id]: [
          ...list,
          {
            id: `c-${Date.now()}`,
            user: user?.fullName || "You",
            text,
            likes: 0,
            createdAt: nowIso,
            parentCommentId: parentIdStr,
            ...(user?.avatarUrl && String(user.avatarUrl).trim() ? { avatarUrl: String(user.avatarUrl).trim() } : {})
          }
        ]
      };
    });
    await addLocalCommentForPost({
      postId: post.id,
      user: user?.fullName || "You",
      userKey: user?.email || String(user?.id || ""),
      text,
      likes: 0,
      parentCommentId: parentIdStr
    });
    setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, commentsCount: p.commentsCount + 1 } : p)));
    setCommentDraft("");
    setReplyingTo(null);
    const excerpt = text.length > 120 ? `${text.slice(0, 117)}...` : text;
    if (replyTarget) {
      const parentNameNorm = normalizeIdentity(replyTarget.user);
      if (parentNameNorm && parentNameNorm !== normalizedCurrentUserName) {
        await appendLocalEngagementNotification({
          type: "comment_reply",
          actorName: user?.fullName || "Someone",
          recipientDisplayName: replyTarget.user,
          postId: post.id,
          isReel: !!post.videoUrl,
          commentExcerpt: excerpt
        });
      }
    } else if (!isOwnPost) {
      await appendLocalEngagementNotification({
        type: "post_comment",
        actorName: user?.fullName || "Someone",
        recipientDisplayName: post.userName,
        postId: post.id,
        isReel: !!post.videoUrl,
        commentExcerpt: excerpt
      });
    }
  }, [activeCommentsPost, commentDraft, replyingTo, token, user?.avatarUrl, user?.email, user?.fullName, user?.id]);

  const toggleCommentSheetLike = useCallback((postId: number, commentId: string) => {
    setCommentInteractions((prev) => {
      const k = commentInteractionKey(postId, commentId);
      const cur = prev[k] ?? { liked: false, disliked: false };
      const liked = !cur.liked;
      return { ...prev, [k]: { liked, disliked: liked ? false : cur.disliked } };
    });
  }, []);

  const toggleCommentSheetDislike = useCallback((postId: number, commentId: string) => {
    setCommentInteractions((prev) => {
      const k = commentInteractionKey(postId, commentId);
      const cur = prev[k] ?? { liked: false, disliked: false };
      const disliked = !cur.disliked;
      return { ...prev, [k]: { liked: disliked ? false : cur.liked, disliked } };
    });
  }, []);

  const onCommentReplyPress = useCallback((c: HomeCommentRow) => {
    setReplyingTo({ id: String(c.id), user: c.user });
    const clean = String(c.user || "").replace(/^@/, "").trim();
    if (!clean) return;
    const mention = `@${clean} `;
    setCommentDraft((d) => (d.trim() ? `${d} ${mention}` : mention));
  }, []);

  const listHeader = useMemo(
    () => (
      <View style={styles.homeTopChrome}>
        <AppTopBar />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          style={[isReelSurfaceTab ? styles.storyRowWrapDark : styles.storyRowWrap, styles.storyRowScrollCompact]}
          contentContainerStyle={styles.storyRow}
        >
          <Pressable
            style={styles.storyItem}
            onPress={() => {
              if (!ownPlayableStories.length) {
                onOpenCreate?.("story");
                return;
              }
              setReelViewerOpen(null);
              setStoryPlaybackQueue(
                ownPlayableStories.map((s) => {
                  const av = storyAuthorAvatarUri(s, user, avatarLookup, posts);
                  return av ? { ...s, avatarUrl: av } : s;
                })
              );
              setActiveStoryIndex(0);
              setStoryOpen(true);
            }}
          >
            <View
              style={[
                styles.storyRing,
                ownPlayableStories.length
                  ? ownPlayableStories.some((s) => !s.viewed)
                    ? styles.storyRingNew
                    : styles.storyRingViewed
                  : isReelSurfaceTab
                    ? styles.storyRingEmptyDark
                    : styles.storyRingEmptyLight
              ]}
            >
                <View style={styles.storyInner}>
                <UserAvatar
                  uri={
                    (ownPlayableStories.length
                      ? storyAuthorAvatarUri(ownPlayableStories[0], user, avatarLookup, posts)
                      : undefined) || user?.avatarUrl
                  }
                  name={user?.fullName || "You"}
                  size={56}
                  borderRadius={28}
                  style={styles.storyAvatarFill}
                  fallbackBackgroundColor="#d4dce0"
                  initialsColor="#1f2c29"
                />
                <Pressable
                  style={styles.yourStoryPlusBadge}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    onOpenCreate?.("story");
                  }}
                  hitSlop={8}
                >
                  <Ionicons name="add" size={12} color="#111" />
                </Pressable>
                </View>
              </View>
            <Text style={isReelSurfaceTab ? styles.storyNameDark : styles.storyName} numberOfLines={1}>
              {t("yourStory")}
            </Text>
          </Pressable>

          {otherStoryGroups.map((group) => (
            <Pressable
              key={group.key}
              style={styles.storyItem}
              onPress={() => {
                const first = group.stories.find((s) => !!(s.videoUrl || s.imageUrl)) ?? group.stories[0];
                if (!first || (!first.videoUrl && !first.imageUrl)) {
                  return;
                }
                setReelViewerOpen(null);
                setViewedStoryIds((prev) => {
                  if (prev.has(first.id)) return prev;
                  const next = new Set(prev);
                  next.add(first.id);
                  return next;
                });
                setStories((prev) => prev.map((s) => (s.id === first.id ? { ...s, viewed: true } : s)));
                const enriched = group.stories.map((s) => {
                  const av = storyAuthorAvatarUri(s, user, avatarLookup, posts) || group.avatarUrl;
                  return typeof av === "string" && av.trim() ? { ...s, avatarUrl: av.trim() } : s;
                });
                setStoryPlaybackQueue(enriched);
                setActiveStoryIndex(0);
                setStoryOpen(true);
              }}
            >
              <View
                style={[
                  styles.storyRing,
                  group.stories.some((s) => !s.viewed) ? styles.storyRingNew : styles.storyRingViewed
                ]}
              >
                <View style={styles.storyInner}>
                  <UserAvatar
                    uri={storyAuthorAvatarUri(group.stories[0], user, avatarLookup, posts) || group.avatarUrl}
                    name={group.userName}
                    size={56}
                    borderRadius={28}
                    style={styles.storyAvatarFill}
                    fallbackBackgroundColor="#d4dce0"
                    initialsColor="#1f2c29"
                  />
                </View>
              </View>
              <Text style={styles.storyNameDark} numberOfLines={1}>
                {displayPersonName(group.userName)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.homeTopTabsBarDark}>
          <View style={styles.homeTopTabsRowDark}>
            {visibleHomeTopTabs.map((tab) => {
              const isActive = activeHomeTab === tab;
              return (
                <Pressable
                  key={tab}
                  onPress={() => setActiveHomeTab(tab)}
                  style={({ pressed }) => [
                    styles.homeTopTabPressable,
                    pressed ? styles.homeTopTabPressablePressed : null
                  ]}
                >
                  <View style={[styles.homeTopTabPillDark, isActive ? styles.homeTopTabPillActiveDark : null]}>
                    <Text style={[styles.homeTopTabTextDark, isActive ? styles.homeTopTabTextActivePillDark : null]}>
                      {homeTabLabel(tab)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.homeTopTabsSeparator} />
        </View>
      </View>
    ),
    [
      activeHomeTab,
      avatarLookup,
      displayPersonName,
      homeTabLabel,
      isReelSurfaceTab,
      onOpenCreate,
      otherStoryGroups,
      ownPlayableStories,
      posts,
      user,
      visibleHomeTopTabs
    ]
  );

  const renderFullScreenReel = useCallback(
    ({ item: post, index }: { item: HomePost; index: number }) => {
      const reelContentWidth = reelViewerOpen ? windowWidth : reelFrameWidth > 0 ? reelFrameWidth : windowWidth - 20;
      const pageH = reelViewerOpen
        ? windowHeight
        : reelSlotHeight > 0
          ? reelSlotHeight
          : Math.max(420, windowHeight * 0.62);
      const isActive = playingPostId === post.id && !!post.videoUrl;
      const postUserId = Number(post.userId);
      const normalizedPostName = normalizeIdentity(post.userName);
      const normalizedCurrentUserName = normalizeIdentity(user?.fullName || "");
      const isOwnPost =
        (postUserId > 0 && postUserId === Number(user?.id)) ||
        (!postUserId && normalizedPostName && normalizedPostName === normalizedCurrentUserName);
      const relationship = postUserId > 0 ? relationships[postUserId] : null;
      const localRelationship = legacyRelationshipByName[normalizedPostName];
      const legacyStatus = legacyFollowStateByName[normalizedPostName] || "none";
      const currentFollowStatus: "none" | "pending" | "accepted" =
        relationship?.viewerStatus === "accepted" || localRelationship?.viewerStatus === "accepted" || legacyStatus === "accepted"
          ? "accepted"
          : relationship?.viewerStatus === "pending" || localRelationship?.viewerStatus === "pending" || legacyStatus === "pending"
            ? "pending"
            : "none";
      const followLabel = labelForFollowStatus(
        relationship?.viewerStatus,
        localRelationship?.viewerStatus,
        legacyStatus,
        !!(postUserId > 0 && followBusyByUserId[postUserId])
      );
      const postComments = commentsByPost[post.id] ?? [];
      const shownCommentsCount = Math.max(Number(post.commentsCount ?? 0), postComments.length);
      const reelRowPosts = reelViewerOpen?.posts ?? tabPosts;
      const activeIndex = reelRowPosts.findIndex((p) => p.id === playingPostId);
      const isNearActive = activeIndex >= 0 && Math.abs(index - activeIndex) <= 1;
      const nextPost = reelRowPosts[index + 1];
      const gallery = postImageGallery(post);
      const isCarousel = gallery.length > 1;
      const thumbUri = post.thumbnailUrl || gallery[0] || nextPost?.thumbnailUrl || nextPost?.imageUrl || post.imageUrl;
      const reelPoster =
        post.thumbnailUrl || gallery[0] || post.imageUrl || nextPost?.thumbnailUrl || nextPost?.imageUrl;
      const reelProgress = reelProgressByPostId[post.id];
      const progressRatio = reelProgress?.duration ? reelProgress.position / reelProgress.duration : 0;
      const creativeMeta = post.creativeMeta || {};
      const creativeTint = reelCreativeFilterTint(creativeMeta.filter);
      const creativeOverlayTextRaw = String(creativeMeta.overlayText || "").trim();
      const creativeTextColor = reelCreativeTextColor(creativeMeta.textColor);
      const musicSource =
        (post.musicLabel && post.musicLabel.trim()) ||
        stripInternalCaptionPrefix(post.caption).slice(0, 36) ||
        "";
      const musicLabel = musicSource ? displayFeedCopy(musicSource) : t("originalAudio");
      const reelCaptionText = displayPostCaption(post.caption);
      const reelDisplayName = displayPersonName(post.userName);
      const reelOverlayText = creativeOverlayTextRaw ? displayFeedCopy(creativeOverlayTextRaw) : "";
      const hasMusicTrack = !!post.musicAudioUrl?.trim();
      const separateMusicPlaying = hasMusicTrack && activeReelMusicPostId === post.id;

      return (
        <View style={[styles.reelPage, { height: pageH, width: reelContentWidth }]}>
          {post.videoUrl && (isActive || isNearActive) ? (
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => onReelSurfaceTap(post)}>
              <ContainedExpoVideo
                ref={(r) => {
                  reelVideoHandlesRef.current[post.id] = r;
                }}
                uri={post.videoUrl}
                shouldPlay={isActive}
                preloadOnly={!isActive}
                containerWidth={reelContentWidth}
                containerHeight={pageH}
                fit={reelViewerOpen ? "contain" : "cover"}
                isLooping
                isMuted={isReelMuted || separateMusicPlaying}
                useNativeControls={false}
                onStatusUpdate={(status) => onReelStatusUpdate(post.id, status)}
              />
            </Pressable>
          ) : isCarousel ? (
            <ScrollView
              horizontal
              pagingEnabled
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              style={{ width: reelContentWidth, height: pageH }}
              contentContainerStyle={{ width: reelContentWidth * gallery.length }}
              onScroll={(e) => {
                const w = e.nativeEvent.layoutMeasurement.width || reelContentWidth;
                if (w <= 0) return;
                const page = carouselIndexFromOffset(e.nativeEvent.contentOffset.x, w, gallery.length - 1);
                setCarouselPageByPostId((prev) =>
                  prev[post.id] === page ? prev : { ...prev, [post.id]: page }
                );
              }}
              scrollEventThrottle={16}
              onMomentumScrollEnd={(e) => {
                const w = e.nativeEvent.layoutMeasurement.width || reelContentWidth;
                if (w <= 0) return;
                const page = carouselIndexFromOffset(e.nativeEvent.contentOffset.x, w, gallery.length - 1);
                setCarouselPageByPostId((prev) =>
                  prev[post.id] === page ? prev : { ...prev, [post.id]: page }
                );
              }}
            >
              {gallery.map((uri, i) => (
                <Pressable
                  key={`reel-carousel-${post.id}-${i}-${uri.slice(-24)}`}
                  style={{
                    width: reelContentWidth,
                    height: pageH,
                    backgroundColor: "#000",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                  onPress={() => onReelSurfaceTap(post)}
                >
                  <Image
                    source={{ uri }}
                    style={{ width: reelContentWidth, height: pageH }}
                    resizeMode="contain"
                  />
                </Pressable>
              ))}
            </ScrollView>
          ) : reelPoster ? (
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => onReelSurfaceTap(post)}>
              <Image source={{ uri: reelPoster }} style={styles.reelVideoFull} resizeMode={post.videoUrl ? "cover" : "contain"} />
            </Pressable>
          ) : (
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => onReelSurfaceTap(post)}>
              <View style={[styles.reelVideoFull, { backgroundColor: postTints[index % postTints.length] }]} />
            </Pressable>
          )}
          {isCarousel ? (
            <View style={[styles.postCarouselDots, styles.reelCarouselDots]} pointerEvents="none">
              {gallery.map((_, i) => {
                const active = (carouselPageByPostId[post.id] ?? 0) === i;
                return (
                  <View
                    key={i}
                    style={[styles.postCarouselDot, active ? styles.postCarouselDotActive : styles.postCarouselDotInactive]}
                  />
                );
              })}
            </View>
          ) : null}
          {creativeTint ? <View style={[styles.reelCreativeFilterLayer, { backgroundColor: creativeTint }]} pointerEvents="none" /> : null}
          {reelOverlayText ? (
            <View style={styles.reelCreativeTextWrap} pointerEvents="none">
              <Text
                style={[
                  styles.reelCreativeText,
                  { color: creativeTextColor },
                  creativeMeta.textBackground ? styles.reelCreativeTextBg : null
                ]}
                numberOfLines={2}
              >
                {reelOverlayText}
              </Text>
            </View>
          ) : null}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.45)", "rgba(0,0,0,0.92)"]}
            locations={[0.25, 0.55, 1]}
            style={styles.reelGradient}
            pointerEvents="none"
          />
          <ReelLikeBurst
            postId={post.id}
            trigger={reelLikeBurstByPostId[post.id] || 0}
            seenRef={reelLikeBurstSeenRef}
          />
          <View
              style={[styles.reelOverlayWrap, { paddingBottom: Math.max(18, insets.bottom + 14) }]}
              pointerEvents="box-none"
            >
            <View style={styles.reelLeftMeta} pointerEvents="auto">
              <View style={styles.reelUserFollowRow}>
                <UserAvatar
                  uri={postAuthorAvatarUri(post, user)}
                  name={post.userName}
                  size={44}
                  borderRadius={12}
                  style={styles.reelAvatarSq}
                  fallbackBackgroundColor="#2a2a2a"
                  initialsColor="#fff"
                />
                <Text style={styles.reelUserName} numberOfLines={1}>
                  {reelDisplayName}
                </Text>
                {!isOwnPost ? (
                  <Pressable
                    onPress={() => toggleFollow(postUserId > 0 ? postUserId : null, post.userName, currentFollowStatus)}
                    style={[
                      styles.reelFollowBtn,
                      currentFollowStatus === "accepted"
                        ? styles.reelFollowFollowing
                        : currentFollowStatus === "pending"
                          ? styles.reelFollowRequested
                          : styles.reelFollowDefault
                    ]}
                    disabled={(postUserId > 0 && !!followBusyByUserId[postUserId]) || currentFollowStatus === "pending"}
                  >
                    <Text
                      style={[
                        styles.reelFollowBtnText,
                        currentFollowStatus === "accepted"
                          ? styles.reelFollowBtnTextLime
                          : currentFollowStatus === "pending"
                            ? styles.reelFollowBtnTextMuted
                            : styles.reelFollowBtnTextOnDark
                      ]}
                    >
                      {followLabel}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.reelMusicRow}>
                <Ionicons name="musical-notes" size={14} color="rgba(255,255,255,0.95)" />
                <Text style={styles.reelMusicText} numberOfLines={1}>
                  {musicLabel}
                </Text>
              </View>
              {reelCaptionText ? (
                <Text style={styles.reelCaptionDark} numberOfLines={3}>
                  {reelCaptionText}
                </Text>
              ) : null}
            </View>
            <View style={styles.reelActionsCol} pointerEvents="auto">
              <View style={styles.reelActionItem}>
                <Pressable
                  onPress={() => {
                    if (!post.viewerHasLiked) triggerReelLikeBurst(post.id);
                    void togglePostLike(post);
                  }}
                  disabled={!!likeBusyByPostId[post.id]}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={post.viewerHasLiked ? "Unlike" : "Like"}
                >
                  <Ionicons
                    name={post.viewerHasLiked ? "heart" : "heart-outline"}
                    size={REEL_ACTION_ICON_LIKE}
                    color={post.viewerHasLiked ? likeActiveColor : REEL_LIKE_COLOR}
                  />
                </Pressable>
                <Pressable
                  onPress={() => void openPostLikesSheet(post)}
                  disabled={!post.likesCount}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="View likes"
                >
                  <Text style={[styles.reelActionCount, post.viewerHasLiked ? styles.reelActionCountLiked : null]}>
                    {post.likesCount}
                  </Text>
                </Pressable>
              </View>
              <Pressable style={styles.reelActionItem} onPress={() => openCommentsForPost(post)}>
                <Ionicons name="chatbubble-outline" size={REEL_ACTION_ICON} color="#fff" />
                <Text style={styles.reelActionCount}>{shownCommentsCount}</Text>
              </Pressable>
              <Pressable style={styles.reelActionItem} onPress={() => setSharePost(post)}>
                <Ionicons name="paper-plane-outline" size={REEL_ACTION_ICON} color="#fff" />
              </Pressable>
              <Pressable style={styles.reelActionItem} onPress={() => setActiveReelOptionsPost(post)}>
                <Ionicons name="ellipsis-horizontal" size={REEL_ACTION_ICON} color="#fff" />
              </Pressable>
              <Pressable
                style={styles.reelActionItem}
                onPress={() => setIsReelMuted((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={isReelMuted ? "Unmute reel" : "Mute reel"}
              >
                <Ionicons
                  name={isReelMuted ? "volume-mute-outline" : "volume-high-outline"}
                  size={REEL_ACTION_ICON}
                  color="#fff"
                />
              </Pressable>
              {thumbUri ? (
                <Image source={{ uri: thumbUri }} style={styles.reelDiscThumb} />
              ) : (
                <View style={[styles.reelDiscThumb, styles.reelDiscThumbPlaceholder]} />
              )}
            </View>
            </View>
          {post.videoUrl ? (
            <View style={styles.reelSeekWrap} pointerEvents="box-none">
              <ReelSeekBar progressRatio={progressRatio} />
            </View>
          ) : null}
        </View>
      );
    },
    [
      carouselPageByPostId,
      commentsByPost,
      followBusyByUserId,
      insets.bottom,
      isReelMuted,
      legacyFollowStateByName,
      legacyRelationshipByName,
      likeBusyByPostId,
      openCommentsForPost,
      openPostLikesSheet,
      onAddReelToStory,
      onShareToMessenger,
      onShareToSnapchat,
      onShareToSystem,
      onShareToWhatsApp,
      playingPostId,
      activeReelMusicPostId,
      reelFrameWidth,
      reelSlotHeight,
      reelProgressByPostId,
      reelLikeBurstByPostId,
      relationships,
      saveBusyByPostId,
      tabPosts,
      toggleFollow,
      togglePostLike,
      triggerReelLikeBurst,
      onReelStatusUpdate,
      togglePostSave,
      user?.fullName,
      user?.id,
      user?.avatarUrl,
      windowHeight,
      windowWidth,
      reelViewerOpen,
      onReelSurfaceTap,
      displayFeedCopy,
      displayPersonName,
      displayPostCaption,
      t,
      labelForFollowStatus
    ]
  );

  const renderPost = useCallback(
    ({ item: post, index }: { item: HomePost; index: number }) => {
      const feedDisplayName = displayPersonName(post.userName);
      const feedCaption = displayPostCaption(post.caption);
      const isActive = playingPostId === post.id && !!post.videoUrl;
      const gallery = postImageGallery(post);
      const isCarousel = !post.videoUrl && gallery.length > 1;
      const postComments = commentsByPost[post.id] ?? [];
      const shownCommentsCount = Math.max(Number(post.commentsCount ?? 0), postComments.length);
      const postUserId = Number(post.userId);
      const normalizedPostName = normalizeIdentity(post.userName);
      const normalizedCurrentUserName = normalizeIdentity(user?.fullName || "");
      const isOwnPost = (postUserId > 0 && postUserId === Number(user?.id)) || (!postUserId && normalizedPostName && normalizedPostName === normalizedCurrentUserName);
      const relationship = postUserId > 0 ? relationships[postUserId] : null;
      const localRelationship = legacyRelationshipByName[normalizedPostName];
      const legacyStatus = legacyFollowStateByName[normalizedPostName] || "none";
      const currentFollowStatus: "none" | "pending" | "accepted" =
        relationship?.viewerStatus === "accepted" || localRelationship?.viewerStatus === "accepted" || legacyStatus === "accepted"
          ? "accepted"
          : relationship?.viewerStatus === "pending" || localRelationship?.viewerStatus === "pending" || legacyStatus === "pending"
            ? "pending"
            : "none";
      const followLabel = labelForFollowStatus(
        relationship?.viewerStatus,
        localRelationship?.viewerStatus,
        legacyStatus,
        !!(postUserId > 0 && followBusyByUserId[postUserId])
      );
      return (
        <View style={styles.postCard}>
          <View style={styles.postTop}>
            <View style={styles.postUserRow}>
              <UserAvatar
                uri={postAuthorAvatarUri(post, user)}
                name={post.userName}
                size={34}
                style={styles.userAvatar}
                fallbackBackgroundColor={APP_LIME}
                initialsColor="#fff"
              />
              <View>
                <Text style={styles.userName}>
                  {feedDisplayName} <Text style={styles.timeText}>• 13h</Text>
                </Text>
              </View>
            </View>
            <View style={styles.postTopActions}>
              {!isOwnPost ? (
                <Pressable
                  onPress={() => toggleFollow(postUserId > 0 ? postUserId : null, post.userName, currentFollowStatus)}
                  style={styles.followChip}
                  disabled={(postUserId > 0 && !!followBusyByUserId[postUserId]) || currentFollowStatus === "pending"}
                >
                  <Text style={styles.followChipText}>{followLabel}</Text>
                </Pressable>
              ) : null}
            <Pressable hitSlop={10} onPress={() => setActiveReelOptionsPost(post)} accessibilityLabel="Post options">
              <Ionicons name="ellipsis-horizontal" size={18} color="#5f6f6a" />
            </Pressable>
            </View>
          </View>

          <View style={[styles.postMedia, { backgroundColor: postTints[index % postTints.length] }]}>
            {post.videoUrl ? (
              <Pressable style={styles.videoTapArea} onPress={() => openPostFromFeed(post)}>
                {isActive ? (
                  <Video
                    style={styles.video}
                    source={{ uri: post.videoUrl }}
                    resizeMode={ResizeMode.COVER}
                    shouldPlay
                    isLooping
                    isMuted
                    useNativeControls={false}
                  />
                ) : (
                  <>
                    <Image
                      style={styles.video}
                      source={{ uri: post.thumbnailUrl || post.imageUrl || post.imageUrls?.[0] || "" }}
                      resizeMode="cover"
                    />
                    <View style={styles.videoPreviewPlayBadge} pointerEvents="none">
                      <Ionicons name="play" size={20} color="#fff" />
                    </View>
                  </>
                )}
              </Pressable>
            ) : isCarousel ? (
              <View style={styles.videoTapArea}>
                <ScrollView
                  horizontal
                  pagingEnabled
                  nestedScrollEnabled
                  showsHorizontalScrollIndicator={false}
                  style={{ width: feedMediaWidth, height: feedMediaWidth }}
                  contentContainerStyle={{ width: feedMediaWidth * gallery.length }}
                  onScroll={(e) => {
                    const w = e.nativeEvent.layoutMeasurement.width || feedMediaWidth;
                    if (w <= 0) return;
                    const page = carouselIndexFromOffset(e.nativeEvent.contentOffset.x, w, gallery.length - 1);
                    setCarouselPageByPostId((prev) =>
                      prev[post.id] === page ? prev : { ...prev, [post.id]: page }
                    );
                  }}
                  scrollEventThrottle={16}
                  onMomentumScrollEnd={(e) => {
                    const w = e.nativeEvent.layoutMeasurement.width || feedMediaWidth;
                    if (w <= 0) return;
                    const page = carouselIndexFromOffset(e.nativeEvent.contentOffset.x, w, gallery.length - 1);
                    setCarouselPageByPostId((prev) =>
                      prev[post.id] === page ? prev : { ...prev, [post.id]: page }
                    );
                  }}
                >
                  {gallery.map((uri, i) => (
                    <Pressable
                      key={`${post.id}-${i}-${uri}`}
                      style={{
                        width: feedMediaWidth,
                        height: feedMediaWidth,
                        backgroundColor: "#111",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                      onPress={() => openPostFromFeed(post)}
                    >
                      <Image
                        style={{ width: feedMediaWidth, height: feedMediaWidth }}
                        source={{ uri }}
                        resizeMode="contain"
                      />
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : gallery[0] ? (
              <Pressable style={styles.videoTapArea} onPress={() => openPostFromFeed(post)}>
                <Image style={styles.video} source={{ uri: gallery[0] }} resizeMode="cover" />
              </Pressable>
            ) : (
              <Pressable style={styles.videoTapArea} onPress={() => openPostFromFeed(post)}>
                <Ionicons name="play-circle-outline" size={48} color="#fff" />
              </Pressable>
            )}
            {isCarousel ? (
              <View style={styles.postCarouselDots} pointerEvents="none">
                {gallery.map((_, i) => {
                  const active = (carouselPageByPostId[post.id] ?? 0) === i;
                  return (
                    <View
                      key={i}
                      style={[styles.postCarouselDot, active ? styles.postCarouselDotActive : styles.postCarouselDotInactive]}
                    />
                  );
                })}
              </View>
            ) : null}
          </View>

          <View style={styles.postActionsRow}>
            <View style={styles.postActionsLeft}>
              <Pressable
                style={styles.postActionIconBtn}
                onPress={() => togglePostLike(post)}
                disabled={!!likeBusyByPostId[post.id]}
              >
                <Ionicons
                  name={post.viewerHasLiked ? "heart" : "heart-outline"}
                  size={25}
                  color={post.viewerHasLiked ? likeActiveColor : "#111"}
                />
              </Pressable>
              <Pressable style={styles.postActionIconBtn} onPress={() => openCommentsForPost(post)}>
                <Ionicons name="chatbubble-outline" size={23} color="#111" />
              </Pressable>
              <Pressable style={styles.postActionIconBtn}>
                <Ionicons name="paper-plane-outline" size={22} color="#111" />
              </Pressable>
            </View>
            <Pressable style={styles.postActionIconBtn}>
              <Ionicons name="bookmark-outline" size={22} color="#111" />
            </Pressable>
          </View>

          <Pressable onPress={() => void openPostLikesSheet(post)} disabled={!post.likesCount}>
            <Text style={styles.likes}>{t("likesCountLabel", { count: post.likesCount })}</Text>
          </Pressable>
          <Text style={styles.caption}>
            <Text style={styles.captionUser}>{feedDisplayName}</Text>
            {feedCaption ? ` ${feedCaption}` : ""}
          </Text>
          <Pressable onPress={() => openCommentsForPost(post)}>
            <Text style={styles.comments}>{t("viewAllComments", { count: shownCommentsCount })}</Text>
          </Pressable>
        </View>
      );
    },
    [
      activeHomeTab,
      carouselPageByPostId,
      commentsByPost,
      feedMediaWidth,
      followBusyByUserId,
      legacyFollowStateByName,
      legacyRelationshipByName,
      likeActiveColor,
      likeBusyByPostId,
      openCommentsForPost,
      openPostFromFeed,
      openPostLikesSheet,
      playingPostId,
      relationships,
      toggleFollow,
      togglePostLike,
      displayPersonName,
      displayPostCaption,
      t,
      labelForFollowStatus,
      user?.avatarUrl,
      user?.fullName,
      user?.id
    ]
  );

  const emptyTabTitle =
    activeHomeTab === "Friends"
      ? t("emptyFriendsTitle")
      : activeHomeTab === "live"
        ? t("emptyLiveTitle")
        : activeHomeTab === "Feed"
          ? t("emptyFeedTitle")
          : t("emptyNothingTitle");
  const emptyTabSubtitle =
    activeHomeTab === "Friends"
      ? t("emptyFriendsSub")
      : activeHomeTab === "live"
        ? t("emptyLiveSub")
        : t("emptyDefaultSub");

  const useFullScreenReelLayout = activeHomeTab === "Feed" || activeHomeTab === "Friends";

  return (
    <View style={[styles.screen, isReelSurfaceTab ? styles.screenDark : null]}>
      {isLiveTab ? (
        <View style={styles.reelsColumn}>
          {listHeader}
          <LiveHomeSection
            posts={posts}
            onOpenCreate={() => onOpenCreate?.("live")}
            canDeletePost={(post) => viewerOwnsPost(post, user)}
            onDeletePost={confirmDeleteOwnPost}
          />
        </View>
      ) : useFullScreenReelLayout ? (
        <View style={styles.reelsColumn}>
          {listHeader}
          <View style={[styles.reelSlot, isReelSurfaceTab ? styles.reelSlotCardGap : null]}>
            <View
              style={[styles.reelFrame, isReelSurfaceTab ? styles.reelFrameCard : null]}
              onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                setReelFrameWidth(Math.round(width));
                setReelSlotHeight(Math.round(height));
              }}
            >
            {reelSlotHeight > 0 ? (
              reelViewerOpen ? (
                <View style={styles.reelFramePlaceholder} />
              ) : (
                <FlatList
                  style={styles.reelFrameList}
                  data={tabPosts}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={renderFullScreenReel}
                  removeClippedSubviews
                  initialNumToRender={2}
                  maxToRenderPerBatch={2}
                  windowSize={3}
                  pagingEnabled
                  showsVerticalScrollIndicator={false}
                  snapToInterval={reelSlotHeight}
                  snapToAlignment="start"
                  decelerationRate="fast"
                  disableIntervalMomentum
                  getItemLayout={(_data, index) => ({
                    length: reelSlotHeight,
                    offset: reelSlotHeight * index,
                    index
                  })}
                  onViewableItemsChanged={onViewableItemsChangedRef.current}
                  viewabilityConfig={reelViewabilityConfig}
                  onMomentumScrollEnd={(e) => onReelMomentumEnd(e.nativeEvent.contentOffset.y)}
                  extraData={`${playingPostId}-${reelSlotHeight}-${reelFrameWidth}`}
                  ListEmptyComponent={
                    <View style={[styles.emptyTabWrap, styles.emptyTabWrapDark]}>
                      <Text style={styles.emptyTabTitleDark}>{emptyTabTitle}</Text>
                      <Text style={styles.emptyTabSubDark}>{emptyTabSubtitle}</Text>
                    </View>
                  }
                />
              )
            ) : null}
            </View>
          </View>
        </View>
      ) : (
      <FlatList
        data={tabPosts}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderPost}
        removeClippedSubviews
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={5}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
            <View style={[styles.emptyTabWrap, isReelSurfaceTab ? styles.emptyTabWrapDark : null]}>
              <Text style={isReelSurfaceTab ? styles.emptyTabTitleDark : styles.emptyTabTitle}>{emptyTabTitle}</Text>
              <Text style={isReelSurfaceTab ? styles.emptyTabSubDark : styles.emptyTabSub}>{emptyTabSubtitle}</Text>
          </View>
        }
          contentContainerStyle={[styles.feedBottom, isReelSurfaceTab ? styles.feedBottomDark : null]}
        onViewableItemsChanged={onViewableItemsChangedRef.current}
        viewabilityConfig={viewabilityConfig}
      />
      )}

      <Modal
        visible={isStoryOpen}
        animationType="fade"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={closeStory}
      >
        <View style={styles.storyViewerRoot}>
          <View style={styles.storyProgressRow}>
            {storyPlaybackQueue.map((s, idx) => {
              const isPast = idx < activeStoryIndex;
              const isActive = idx === activeStoryIndex;
              const width = isActive
                ? progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] })
                : "100%";
              return (
                <View key={s.id} style={styles.storyProgressTrack}>
                  <Animated.View
                    style={[
                      styles.storyProgressFill,
                      {
                        width,
                        opacity: isPast || isActive ? 1 : 0.35
                      }
                    ]}
                  />
                </View>
              );
            })}
          </View>

          <View style={styles.storyViewerTopRow}>
            <View style={styles.storyViewerUser}>
              <UserAvatar
                uri={activeStoryAvatarUri}
                name={activeStory?.userName || "U"}
                size={34}
                style={styles.storyViewerAvatar}
                fallbackBackgroundColor={APP_LIME}
                initialsColor="#fff"
              />
              <View>
                <Text style={styles.storyViewerName}>
                  {activeStory?.userName ? displayPersonName(activeStory.userName) : ""}
                </Text>
              </View>
            </View>
            <Pressable onPress={closeStory} hitSlop={10}>
              <Ionicons name="close" size={26} color="#fff" />
            </Pressable>
          </View>

          <View
            style={styles.storyViewerBody}
            onLayout={(e) =>
              setStoryViewport({
                width: Math.max(1, Math.round(e.nativeEvent.layout.width)),
                height: Math.max(1, Math.round(e.nativeEvent.layout.height))
              })
            }
          >
            {activeStory?.videoUrl ? (
              <ContainedExpoVideo
                uri={activeStory.videoUrl}
                shouldPlay
                containerWidth={storyViewport.width || windowWidth}
                containerHeight={storyViewport.height || Math.max(1, windowHeight - 140)}
                fit="contain"
                isLooping={false}
                isMuted={false}
                useNativeControls={false}
              />
            ) : activeStory?.imageUrl ? (
              <Image style={styles.storyVideo} source={{ uri: activeStory.imageUrl }} resizeMode="contain" />
            ) : null}

            <View style={styles.storyTapZones}>
              <Pressable style={styles.storyTapZone} onPress={prevStory} />
              <Pressable style={styles.storyTapZone} onPress={nextStory} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!activePost}
        animationType="fade"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={() => setActivePost(null)}
      >
        <View style={styles.postViewerRoot}>
          <View style={styles.postViewerTop}>
            <Pressable onPress={() => setActivePost(null)} hitSlop={10}>
              <Ionicons name="close" size={28} color="#fff" />
            </Pressable>
          </View>
          {activePost?.videoUrl ? (
            <ContainedExpoVideo
              uri={activePost.videoUrl}
              shouldPlay
              containerWidth={windowWidth}
              containerHeight={windowHeight}
              fit="contain"
              isLooping
              isMuted={false}
              useNativeControls
            />
          ) : postImageGallery(activePost).length > 1 ? (
            <FlatList
              data={postImageGallery(activePost)}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(uri, i) => `pv-${activePost!.id}-${i}-${uri.slice(-32)}`}
              style={{ flex: 1 }}
              renderItem={({ item: uri }) => (
                <View style={{ width: windowWidth, flex: 1, justifyContent: "center" }}>
                  <Image style={styles.postViewerVideo} source={{ uri }} resizeMode="contain" />
                </View>
              )}
            />
          ) : postImageGallery(activePost)[0] ? (
            <Image style={styles.postViewerVideo} source={{ uri: postImageGallery(activePost)[0] }} resizeMode="contain" />
          ) : (
            <View style={styles.postViewerFallback}>
              <Ionicons name="play-circle-outline" size={62} color="#fff" />
              <Text style={styles.postViewerFallbackText}>No video available for this post</Text>
            </View>
          )}
        </View>
      </Modal>

      <Modal
        visible={!!reelViewerOpen}
        animationType="fade"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={() => setReelViewerOpen(null)}
      >
        <View style={{ flex: 1, backgroundColor: APP_DARK_BG }}>
          <View
            style={[styles.reelViewerTopChrome, { paddingTop: reelTopInset + 12 }]}
            pointerEvents="box-none"
          >
            <Pressable
              onPress={() => setReelViewerOpen(null)}
              hitSlop={14}
              style={styles.reelViewerBackBtn}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back-outline" size={28} color="#fff" />
            </Pressable>
          </View>
          {reelMuteFeedback ? (
            <View style={styles.reelMuteFeedbackLayer} pointerEvents="none">
              <View style={styles.reelMuteFeedbackBubble}>
                <Ionicons
                  name={reelMuteFeedback === "muted" ? "volume-mute" : "volume-high"}
                  size={44}
                  color="#fff"
                />
              </View>
            </View>
          ) : null}
          {reelViewerOpen && reelViewerOpen.posts.length > 0 ? (
            <FlatList
              ref={(r) => {
                reelViewerListRef.current = r;
              }}
              data={reelViewerOpen.posts}
              keyExtractor={(item) => `reel-viewer-${item.id}`}
              renderItem={renderFullScreenReel}
              pagingEnabled
              showsVerticalScrollIndicator={false}
              snapToInterval={windowHeight}
              snapToAlignment="start"
              decelerationRate="fast"
              disableIntervalMomentum
              initialScrollIndex={
                reelViewerOpen.initialIndex > 0 && reelViewerOpen.initialIndex < reelViewerOpen.posts.length
                  ? reelViewerOpen.initialIndex
                  : undefined
              }
              getItemLayout={(_data, idx) => ({
                length: windowHeight,
                offset: windowHeight * idx,
                index: idx
              })}
              onViewableItemsChanged={onViewableItemsChangedRef.current}
              viewabilityConfig={reelViewabilityConfig}
              onMomentumScrollEnd={(e) => onReelViewerMomentumEnd(e.nativeEvent.contentOffset.y)}
              extraData={`${playingPostId}-${windowHeight}-${reelViewerOpen.posts.length}`}
              initialNumToRender={Math.min(7, reelViewerOpen.posts.length || 1)}
              removeClippedSubviews={false}
            />
          ) : null}
        </View>
      </Modal>

      <Modal
        visible={!!likesSheetPost}
        transparent
        animationType="fade"
        onRequestClose={() => setLikesSheetPost(null)}
      >
        <View style={styles.commentsSheetRoot}>
          <Pressable style={styles.commentsSheetBackdrop} onPress={() => setLikesSheetPost(null)} />
          <View style={[styles.commentsSheetContainer, { height: Math.round(windowHeight * 0.5) }]}>
            <View style={[styles.commentsSheetPanel, { paddingBottom: Math.max(insets.bottom, 10) }]}>
              <View style={styles.commentsSheetHandle} />
              <View style={styles.commentsSheetHeader}>
                <Pressable
                  onPress={() => setLikesSheetPost(null)}
                  hitSlop={12}
                  style={styles.commentsCloseHit}
                  accessibilityRole="button"
                  accessibilityLabel="Close likes"
                >
                  <Ionicons name="chevron-down" size={28} color="#C9FF35" />
                </Pressable>
                <Text style={styles.commentsTitle}>{t("likes")}</Text>
                <View style={styles.commentsHeaderSpacer} />
              </View>
              {likesSheetLoading ? (
                <ActivityIndicator color="#C9FF35" style={{ marginTop: 24 }} />
              ) : likesSheetUsers.length === 0 ? (
                <Text style={styles.noCommentsText}>{t("noLikesYet")}</Text>
              ) : (
                <ScrollView style={styles.commentsListScroll} contentContainerStyle={styles.likesListInner}>
                  {likesSheetUsers.map((liker, idx) => (
                    <Pressable
                      key={`${liker.userId ?? "n"}-${liker.userName}-${idx}`}
                      style={styles.likesRow}
                      onPress={() => {
                        setLikesSheetPost(null);
                        navigateToPublicProfile({
                          userId: liker.userId,
                          userName: liker.userName,
                          avatarUrl: liker.avatarUrl ?? null
                        });
                      }}
                    >
                      <UserAvatar
                        uri={liker.avatarUrl}
                        name={liker.userName}
                        size={40}
                        borderRadius={20}
                        fallbackBackgroundColor="#3f3f46"
                        initialsColor="#fafafa"
                      />
                      <Text style={styles.likesRowName} numberOfLines={1}>
                        {displayPersonName(liker.userName)}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!activeCommentsPost}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveCommentsPost(null)}
      >
        <View style={styles.commentsSheetRoot}>
          <Pressable style={styles.commentsSheetBackdrop} onPress={() => setActiveCommentsPost(null)} />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={[styles.commentsSheetContainer, { height: Math.round(windowHeight * 0.5) }]}
          >
            <View style={[styles.commentsSheetPanel, { paddingBottom: Math.max(insets.bottom, 10) }]}>
              <View style={styles.commentsSheetHandle} />
              <View style={styles.commentsSheetHeader}>
                <Pressable
                  onPress={() => setActiveCommentsPost(null)}
                  hitSlop={12}
                  style={styles.commentsCloseHit}
                  accessibilityRole="button"
                  accessibilityLabel="Close comments"
                >
                  <Ionicons name="chevron-down" size={28} color="#C9FF35" />
                </Pressable>
                <Text style={styles.commentsTitle}>{t("comments")}</Text>
                <View style={styles.commentsHeaderSpacer} />
              </View>

              <ScrollView
                style={styles.commentsListScroll}
                contentContainerStyle={styles.commentsListInner}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                {(() => {
                  if (!activeCommentsPost) {
                    return <Text style={styles.noCommentsText}>{t("noComments")}</Text>;
                  }
                  const pid = activeCommentsPost.id;
                  const allRaw = commentsByPost[pid] ?? [];
                  const all = inferParentFromMention(allRaw.map((x) => normalizeCommentRow(x as HomeCommentRow & Record<string, unknown>)));
                  if (all.length === 0) {
                    return <Text style={styles.noCommentsText}>{t("noComments")}</Text>;
                  }
                  const { roots, children } = buildCommentReplyTree(all);

                  const renderOneRow = (c: HomeCommentRow, depth: number) => {
                    const ikey = commentInteractionKey(pid, c.id);
                    const inter = commentInteractions[ikey] ?? { liked: false, disliked: false };
                    const likeCount = Math.max(0, Number(c.likes || 0) + (inter.liked ? 1 : 0));
                    const rel = formatCommentRelativeTime(c.createdAt);
                    const indent = Math.min(4, depth) * COMMENT_REPLY_INDENT;
                    return (
                      <View style={[styles.commentBlock, { marginLeft: indent }]}>
                        <View style={styles.commentRowInsta}>
                          <UserAvatar
                            uri={c.avatarUrl}
                            name={c.user}
                            size={36}
                            borderRadius={10}
                            style={styles.commentAvatarSq}
                            fallbackBackgroundColor="#3f3f46"
                            initialsColor="#fafafa"
                          />
                          <View style={styles.commentMainCol}>
                            <View style={styles.commentHeaderRow}>
                              <Text style={styles.commentUserName} numberOfLines={1}>
                                {c.user}
                              </Text>
                              {rel ? <Text style={styles.commentTime}>{rel}</Text> : null}
                      </View>
                            <Text style={styles.commentBodyText}>{displayFeedCopy(c.text)}</Text>
                            <Pressable hitSlop={6} onPress={() => onCommentReplyPress(c)} style={styles.commentReplyBtn}>
                              <Text style={styles.commentReplyText}>Reply</Text>
                            </Pressable>
                      </View>
                          <View style={styles.commentActionsCol}>
                            <Pressable
                              hitSlop={8}
                              onPress={() => toggleCommentSheetLike(pid, c.id)}
                              style={styles.commentActionHit}
                            >
                              <Ionicons
                                name={inter.liked ? "heart" : "heart-outline"}
                                size={18}
                                color={inter.liked ? "#C9FF35" : "#9ca3af"}
                              />
                              <Text
                                style={[styles.commentActionCount, inter.liked ? styles.commentLikeCountActive : null]}
                              >
                                {likeCount}
                              </Text>
                            </Pressable>
                            <Pressable hitSlop={8} onPress={() => toggleCommentSheetDislike(pid, c.id)} style={styles.commentActionHit}>
                              <Ionicons
                                name={inter.disliked ? "thumbs-down" : "thumbs-down-outline"}
                                size={17}
                                color={inter.disliked ? "#f87171" : "#9ca3af"}
                              />
                            </Pressable>
                    </View>
                        </View>
                      </View>
                    );
                  };

                  const renderBranch = (c: HomeCommentRow, depth: number): React.ReactNode => {
                    const direct = children.get(String(c.id)) ?? [];
                    const needsMoreLink = direct.length > REPLY_PREVIEW_VISIBLE;
                    const expanded = !!expandedReplyThreads[String(c.id)];
                    const shown = needsMoreLink && !expanded ? direct.slice(0, REPLY_PREVIEW_VISIBLE) : direct;
                    const moreCount = needsMoreLink && !expanded ? direct.length - REPLY_PREVIEW_VISIBLE : 0;

                    return (
                      <React.Fragment key={c.id}>
                        {renderOneRow(c, depth)}
                        {shown.map((child) => renderBranch(child, depth + 1))}
                        {moreCount > 0 ? (
                          <Pressable
                            onPress={() => setExpandedReplyThreads((p) => ({ ...p, [String(c.id)]: true }))}
                            style={[
                              styles.viewMoreCommentsWrap,
                              { marginLeft: Math.min(4, depth + 1) * COMMENT_REPLY_INDENT, paddingLeft: 0 }
                            ]}
                          >
                            <View style={styles.viewMoreCommentsLine} />
                            <Text style={styles.viewMoreCommentsText}>
                              View {moreCount} more {moreCount === 1 ? "reply" : "replies"}
                            </Text>
                          </Pressable>
                        ) : null}
                      </React.Fragment>
                    );
                  };

                  return <>{roots.map((r) => renderBranch(r, 0))}</>;
                })()}
              </ScrollView>

              {replyingTo ? (
                <View style={styles.replyingToBanner}>
                  <Text style={styles.replyingToBannerText} numberOfLines={1}>
                    Replying to @{String(replyingTo.user || "").replace(/^@/, "")}
                  </Text>
                  <Pressable hitSlop={8} onPress={() => setReplyingTo(null)} style={styles.replyingToCancel}>
                    <Text style={styles.replyingToCancelText}>{t("replyCancel")}</Text>
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.emojiRow}>
                {["😀", "😍", "🔥", "👏", "💯", "😅", "😎", "🥳"].map((emoji) => (
                  <Pressable key={emoji} onPress={() => setCommentDraft((v) => `${v}${emoji}`)}>
                    <Text style={styles.emojiText}>{emoji}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.commentInputRow}>
                <UserAvatar
                  uri={user?.avatarUrl}
                  name={user?.fullName || "You"}
                  size={20}
                  borderRadius={10}
                  style={styles.commentInputAvatar}
                  fallbackBackgroundColor="#d1d5db"
                  initialsColor="#0f172a"
                />
                <TextInput
                  value={commentDraft}
                  onChangeText={setCommentDraft}
                  placeholder={replyingTo ? t("writeReply") : t("addCommentPlaceholder")}
                  placeholderTextColor="#6b7280"
                  style={styles.commentInput}
                />
                <Pressable style={styles.commentSendBtn} onPress={submitComment}>
                  <Ionicons name="send" size={14} color="#111827" />
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={!!activeReelOptionsPost} transparent animationType="slide" onRequestClose={() => setActiveReelOptionsPost(null)}>
        <View style={styles.reelOptionsModalRoot}>
          <Pressable
            accessibilityLabel="Dismiss menu"
            style={[StyleSheet.absoluteFillObject, styles.reelOptionsDimTap]}
            onPress={() => setActiveReelOptionsPost(null)}
          />
          <View style={[styles.reelOptionsSheet, { paddingBottom: Math.max(insets.bottom + 12, 22) }]}>
            <View style={styles.shareHandle} />
            <Text style={styles.reelOptionsTitle}>
              {activeReelOptionsPost?.videoUrl && isReelPost(activeReelOptionsPost) ? "Reel options" : "Post options"}
            </Text>
            <Pressable
              style={styles.reelOptionRow}
              disabled={!activeReelOptionsPost || !!saveBusyByPostId[activeReelOptionsPost.id]}
              onPress={async () => {
                if (!activeReelOptionsPost) return;
                await togglePostSave(activeReelOptionsPost);
                setActiveReelOptionsPost(null);
              }}
            >
              <View style={styles.reelOptionIcon}>
                <Ionicons
                  name={activeReelOptionsPost?.viewerHasSaved ? "bookmark" : "bookmark-outline"}
                  size={22}
                  color="#C9FF35"
                />
              </View>
              <View style={styles.reelOptionTextCol}>
                <Text style={styles.reelOptionTitle}>
                  {activeReelOptionsPost?.viewerHasSaved ? t("removeFromSaved") : t("savePost")}
                </Text>
                <Text style={styles.reelOptionSub}>{t("savedPostsHint")}</Text>
              </View>
            </Pressable>
            <Pressable
              style={styles.reelOptionRow}
              onPress={() => {
                if (activeReelOptionsPost) void onCopyPostLink(activeReelOptionsPost);
              }}
            >
              <View style={styles.reelOptionIcon}>
                <Ionicons name="link-outline" size={22} color="#C9FF35" />
              </View>
              <View style={styles.reelOptionTextCol}>
                <Text style={styles.reelOptionTitle}>Copy link</Text>
                <Text style={styles.reelOptionSub}>Copy the post URL to your clipboard.</Text>
              </View>
            </Pressable>
            <Pressable
              style={styles.reelOptionRow}
              onPress={() => {
                if (activeReelOptionsPost) onNotInterestedInPost(activeReelOptionsPost);
              }}
            >
              <View style={styles.reelOptionIcon}>
                <Ionicons name="eye-off-outline" size={22} color="#C9FF35" />
              </View>
              <View style={styles.reelOptionTextCol}>
                <Text style={styles.reelOptionTitle}>Not interested</Text>
                <Text style={styles.reelOptionSub}>Hide this post from your feed on this device.</Text>
              </View>
            </Pressable>
            <Pressable
              style={styles.reelOptionRow}
              onPress={() => {
                if (activeReelOptionsPost) onReportPost(activeReelOptionsPost);
              }}
            >
              <View style={styles.reelOptionIcon}>
                <Ionicons name="flag-outline" size={22} color="#C9FF35" />
              </View>
              <View style={styles.reelOptionTextCol}>
                <Text style={styles.reelOptionTitle}>Report</Text>
                <Text style={styles.reelOptionSub}>Flag this content for review.</Text>
              </View>
            </Pressable>
            {activeReelOptionsPost && viewerOwnsPost(activeReelOptionsPost, user) ? (
              <Pressable
                style={styles.reelOptionRow}
                onPress={() => {
                  if (activeReelOptionsPost) confirmDeleteOwnPost(activeReelOptionsPost);
                }}
              >
                <View style={styles.reelOptionIcon}>
                  <Ionicons name="trash-outline" size={22} color="#ff6b6b" />
                </View>
                <View style={styles.reelOptionTextCol}>
                  <Text style={[styles.reelOptionTitle, styles.reelOptionTitleDanger]}>Delete</Text>
                  <Text style={styles.reelOptionSub}>Remove this post permanently. Only you can do this.</Text>
                </View>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!reportModalPost}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!reportSubmitBusy) setReportModalPost(null);
        }}
      >
        <Pressable style={styles.shareBackdrop} onPress={() => !reportSubmitBusy && setReportModalPost(null)}>
          <Pressable
            style={[styles.reelOptionsSheet, { paddingBottom: Math.max(insets.bottom + 12, 22), maxHeight: windowHeight * 0.72 }]}
            onPress={(e) => e.stopPropagation?.()}
          >
            <View style={styles.shareHandle} />
            <Text style={styles.reelOptionsTitle}>Report post</Text>
            <Text style={[styles.reelOptionSub, { marginBottom: 6 }]}>
              {reportModalPost ? t("reportUserPrompt", { name: displayPersonName(reportModalPost.userName) }) : ""}
            </Text>
            {reportSubmitBusy ? (
              <View style={{ paddingVertical: 24, alignItems: "center" }}>
                <ActivityIndicator color="#C9FF35" />
              </View>
            ) : (
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {reportReasons.map((r) => (
                  <Pressable
                    key={r.key}
                    style={styles.reelOptionRow}
                    onPress={() => void submitReportWithReason(r.key)}
                  >
                    <View style={styles.reelOptionIcon}>
                      <Ionicons name="alert-circle-outline" size={22} color="#C9FF35" />
                    </View>
                    <View style={styles.reelOptionTextCol}>
                      <Text style={styles.reelOptionTitle}>{r.label}</Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            <Pressable
              style={[styles.reelOptionRow, { borderBottomWidth: 0 }]}
              disabled={reportSubmitBusy}
              onPress={() => setReportModalPost(null)}
            >
              <Text style={[styles.reelOptionTitle, { flex: 1, textAlign: "center" }]}>{t("cancel")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!sharePost} transparent animationType="slide" onRequestClose={() => setSharePost(null)}>
        <Pressable style={styles.shareBackdrop} onPress={() => setSharePost(null)}>
          <Pressable style={[styles.shareSheet, { paddingBottom: Math.max(insets.bottom + 10, 20) }]} onPress={(e) => e.stopPropagation?.()}>
            <View style={styles.shareHandle} />
            <View style={styles.shareSearchRow}>
              <Ionicons name="search" size={16} color="#C9FF35" />
              <TextInput
                value={shareSearch}
                onChangeText={setShareSearch}
                placeholder={t("search")}
                placeholderTextColor="#97a0a8"
                style={styles.shareSearchInput}
              />
              <Pressable style={styles.shareSearchAction} onPress={() => sharePost && onShareToSystem(sharePost)}>
                <Ionicons name="person-add-outline" size={16} color="#C9FF35" />
              </Pressable>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sharePeopleRow}>
              {shareRecipients.length ? (
                shareRecipients.map((recipient) => (
                  <Pressable
                    key={`${recipient.id || "name"}-${recipient.name}`}
                    style={styles.sharePersonItem}
                    onPress={() => sharePost && onSendReelToChat(sharePost, recipient)}
                    disabled={shareBusyUserId === recipient.id}
                  >
                    <View style={styles.sharePersonAvatar}>
                      {shareBusyUserId === recipient.id ? (
                        <Ionicons name="checkmark" size={18} color="#C9FF35" />
                      ) : (
                        <UserAvatar
                          uri={recipient.avatarUrl}
                          name={recipient.name}
                          size={52}
                          borderRadius={26}
                          fallbackBackgroundColor="#343b43"
                          initialsColor="#C9FF35"
                        />
                      )}
                    </View>
                    <Text style={styles.sharePersonName} numberOfLines={1}>
                      {recipient.name}
                    </Text>
                  </Pressable>
                ))
              ) : (
                <Text style={styles.shareNoPeopleText}>No chats found</Text>
              )}
            </ScrollView>

            <View style={styles.shareFooterRow}>
              <Pressable style={styles.shareFooterAction} onPress={() => sharePost && onAddReelToStory(sharePost)}>
                <View style={styles.shareFooterIcon}><Ionicons name="add-circle-outline" size={20} color="#C9FF35" /></View>
                <Text style={styles.shareFooterText}>{t("addToStory")}</Text>
              </Pressable>
              <Pressable style={styles.shareFooterAction} onPress={() => sharePost && onShareToSystem(sharePost)}>
                <View style={styles.shareFooterIcon}><Ionicons name="link-outline" size={20} color="#C9FF35" /></View>
                <Text style={styles.shareFooterText}>{t("copyLink")}</Text>
              </Pressable>
              <Pressable style={styles.shareFooterAction} onPress={() => sharePost && onShareToSystem(sharePost)}>
                <View style={styles.shareFooterIcon}><Ionicons name="open-outline" size={20} color="#C9FF35" /></View>
                <Text style={styles.shareFooterText}>{t("shareTo")}</Text>
              </Pressable>
              <Pressable style={styles.shareFooterAction} onPress={() => sharePost && onShareToWhatsApp(sharePost)}>
                <View style={styles.shareFooterIcon}><Ionicons name="logo-whatsapp" size={20} color="#C9FF35" /></View>
                <Text style={styles.shareFooterText}>{t("whatsapp")}</Text>
              </Pressable>
              <Pressable style={styles.shareFooterAction} onPress={() => sharePost && onShareToMessenger(sharePost)}>
                <View style={styles.shareFooterIcon}><Ionicons name="chatbubble-ellipses-outline" size={20} color="#C9FF35" /></View>
                <Text style={styles.shareFooterText}>{t("messenger")}</Text>
              </Pressable>
              <Pressable style={styles.shareFooterAction} onPress={() => sharePost && onShareToSnapchat(sharePost)}>
                <View style={styles.shareFooterIcon}><Ionicons name="logo-snapchat" size={20} color="#C9FF35" /></View>
                <Text style={styles.shareFooterText}>{t("snapchat")}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f2f3f5" },
  screenDark: { backgroundColor: APP_DARK_BG },
  reelsColumn: { flex: 1, minHeight: 0, flexDirection: "column" },
  homeTopChrome: { flexGrow: 0, flexShrink: 0 },
  storyRowScrollCompact: {
    flexGrow: 0,
    flexShrink: 0,
    maxHeight: 140
  },
  reelSlot: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 10,
    paddingBottom: 12
  },
  reelSlotCardGap: {
    paddingTop: 12
  },
  reelFrame: {
    flex: 1,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: APP_DARK_BG
  },
  reelFrameCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)"
  },
  reelFramePlaceholder: { flex: 1, backgroundColor: APP_DARK_BG },
  reelFrameList: { flex: 1 },
  reelPage: {
    backgroundColor: APP_DARK_BG,
    overflow: "hidden",
    borderRadius: 22
  },
  reelViewerTopChrome: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingLeft: 4,
    paddingRight: 12,
    paddingBottom: 6
  },
  reelViewerBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)"
  },
  reelVideoFull: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  reelGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 280,
    zIndex: 1
  },
  reelLikeBurstLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 3,
    overflow: "hidden"
  },
  reelCreativeFilterLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1.5
  },
  reelCreativeTextWrap: {
    position: "absolute",
    top: "17%",
    left: 14,
    right: 14,
    zIndex: 1.7,
    alignItems: "center"
  },
  reelCreativeText: {
    maxWidth: "90%",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3
  },
  reelCreativeTextBg: {
    backgroundColor: "rgba(0,0,0,0.58)",
    borderRadius: 8,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  reelMuteFeedbackLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 14
  },
  reelMuteFeedbackBubble: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(0,0,0,0.58)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)"
  },
  reelOverlayWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingLeft: 14,
    paddingRight: 10,
    paddingTop: 28
  },
  reelLeftMeta: { flex: 1, marginRight: 6, maxWidth: "74%", paddingBottom: 2 },
  reelUserFollowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "nowrap",
    minWidth: 0
  },
  reelAvatarSq: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#2a2a2a",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)"
  },
  reelAvatarSqText: { color: "#fff", fontWeight: "800", fontSize: 17 },
  reelUserName: {
    flex: 1,
    minWidth: 0,
    color: "#C9FF35",
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: 0.2,
    textShadowColor: "rgba(0,0,0,0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3
  },
  reelFollowBtn: {
    flexShrink: 0,
    alignSelf: "center",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1
  },
  reelFollowFollowing: {
    backgroundColor: "transparent",
    borderColor: "#C9FF35"
  },
  reelFollowRequested: {
    backgroundColor: "rgba(255,255,255,0.16)",
    borderColor: "rgba(255,255,255,0.35)"
  },
  reelFollowDefault: {
    backgroundColor: "transparent",
    borderColor: "rgba(255,255,255,0.55)"
  },
  reelFollowBtnText: { fontWeight: "800", fontSize: 12 },
  reelFollowBtnTextLime: { color: "#C9FF35" },
  reelFollowBtnTextMuted: { color: "rgba(255,255,255,0.92)" },
  reelFollowBtnTextOnDark: { color: "#ffffff" },
  reelMusicRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  reelMusicText: {
    color: "rgba(255,255,255,0.95)",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
    textShadowColor: "rgba(0,0,0,0.65)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2
  },
  reelCaptionDark: {
    color: "rgba(255,255,255,0.96)",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 10,
    lineHeight: 20,
    textShadowColor: "rgba(0,0,0,0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3
  },
  reelActionsCol: { alignItems: "center", gap: 14, paddingBottom: 2, width: 44 },
  reelActionItem: { alignItems: "center", gap: 4 },
  reelActionCount: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2
  },
  reelActionCountLiked: { color: "#C9FF35" },
  reelDiscThumb: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.95)",
    marginTop: 4,
    backgroundColor: "#2a2a2a"
  },
  reelDiscThumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  reelSeekWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 0,
    alignItems: "stretch",
    zIndex: 12
  },
  reelSeekTrack: {
    width: "100%",
    height: 5,
    borderRadius: 0,
    backgroundColor: "rgba(0,0,0,0.42)",
    overflow: "hidden"
  },
  reelSeekFill: {
    height: "100%",
    backgroundColor: "#C9FF35"
  },
  storyRowWrapDark: {
    backgroundColor: APP_DARK_BG
  },
  storyNameDark: { fontSize: 9, color: "rgba(255,255,255,0.72)", marginTop: 5, fontWeight: "600", textAlign: "center", width: "100%" },
  homeTopTabsBarDark: {
    backgroundColor: APP_DARK_BG
  },
  homeTopTabsSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.22)"
  },
  homeTopTabsBarLight: {
    backgroundColor: "#f2f3f5",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.12)"
  },
  homeTopTabsRowDark: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "space-between"
  },
  homeTopTabPressablePressed: { opacity: 0.85 },
  homeTopTabPillDark: {
    height: 32,
    alignItems: "center",
    justifyContent: "center"
  },
  homeTopTabPillActiveDark: {
    minWidth: 89,
    height: 32,
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 24,
    paddingRight: 24,
    borderRadius: 9,
    backgroundColor: "#303132",
    overflow: "hidden"
  },
  homeTopTabTextDark: {
    fontSize: 14,
    color: "#ffffff",
    fontWeight: "600",
    lineHeight: 16,
    textAlign: "center"
  },
  homeTopTabTextActivePillDark: { color: "#C9FF35", fontWeight: "700", lineHeight: 16, textAlign: "center" },
  feedBottomDark: { backgroundColor: APP_DARK_BG, paddingTop: 4 },
  emptyTabWrapDark: {
    marginHorizontal: 12,
    marginTop: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#333",
    backgroundColor: "#1a1a1a",
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: "center"
  },
  emptyTabTitleDark: { fontWeight: "900", color: "#C9FF35", fontSize: 15 },
  emptyTabSubDark: { marginTop: 6, color: "rgba(255,255,255,0.65)", fontWeight: "600" },
  storyRow: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 10
  },
  storyRowWrap: {
    backgroundColor: "#ffffff"
  },
  storyItem: { alignItems: "center", width: 70 },
  storyRing: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: APP_LIME,
    alignItems: "center",
    justifyContent: "center"
  },
  storyRingNew: { backgroundColor: "#C9FF35" },
  storyRingViewed: { backgroundColor: "#C9FF35" },
  storyRingEmptyDark: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.28)"
  },
  storyRingEmptyLight: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.14)"
  },
  storyInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible"
  },
  storyAvatarFill: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#d4dce0",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  storyAvatarImage: { width: 56, height: 56, borderRadius: 28 },
  storyInitial: { fontSize: 18, fontWeight: "700", color: "#1f2c29" },
  yourStoryPlusBadge: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#C9FF35",
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center"
  },
  storyName: { fontSize: 8, color: "#7f868a", marginTop: 5, fontWeight: "500", textAlign: "center", width: "100%" },
  homeTopTabsRow: {
    flexDirection: "row",
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 10,
    justifyContent: "space-between",
    alignItems: "center"
  },
  homeTopTabPressable: { flex: 1, alignItems: "center", justifyContent: "center" },
  homeTopTabPill: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 7
  },
  homeTopTabPillActive: { backgroundColor: "#303132" },
  homeTopTabText: { fontSize: 14, color: "#374151", fontWeight: "500" },
  homeTopTabTextActive: { color: "#C9FF35", fontWeight: "700" },
  feedBottom: { paddingBottom: 100 },
  postCard: {
    backgroundColor: "#fff",
    marginTop: 10,
    paddingBottom: 10
  },
  postTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8
  },
  postTopActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  followChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: APP_LIME,
    backgroundColor: "#eef8f1",
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  followChipText: { color: APP_LIME, fontWeight: "800", fontSize: 12 },
  postUserRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  userAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: APP_LIME,
    alignItems: "center",
    justifyContent: "center"
  },
  userAvatarText: { color: "#fff", fontWeight: "700" },
  userName: { color: "#1f2c29", fontWeight: "700", fontSize: 14 },
  timeText: { color: "#6d7d79", fontWeight: "500" },
  postMedia: {
    width: "100%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative"
  },
  video: {
    width: "100%",
    height: "100%"
  },
  videoTapArea: {
    width: "100%",
    height: "100%"
  },
  videoPreviewPlayBadge: {
    position: "absolute",
    right: 10,
    bottom: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center"
  },
  postActionsRow: {
    marginTop: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  postActionsLeft: { flexDirection: "row", alignItems: "center" },
  postActionIconBtn: { marginRight: 14 },
  postCarouselDots: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 5
  },
  postCarouselDot: {
    width: 6,
    height: 6,
    borderRadius: 3
  },
  postCarouselDotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#C9FF35"
  },
  postCarouselDotInactive: {
    backgroundColor: "rgba(255,255,255,0.45)"
  },
  reelCarouselDots: { bottom: 88 },
  storyViewerRoot: { flex: 1, backgroundColor: APP_DARK_BG },
  storyProgressRow: { flexDirection: "row", gap: 6, paddingHorizontal: 10, paddingTop: 12 },
  storyProgressTrack: { flex: 1, height: 2.5, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 2, overflow: "hidden" },
  storyProgressFill: { height: "100%", backgroundColor: "#fff" },
  storyViewerTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10, paddingTop: 10 },
  storyViewerUser: { flexDirection: "row", alignItems: "center", gap: 10 },
  storyViewerAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: APP_LIME, alignItems: "center", justifyContent: "center" },
  storyViewerAvatarText: { color: "#fff", fontWeight: "800" },
  storyViewerName: { color: "#fff", fontWeight: "800" },
  storyViewerBody: {
    flex: 1,
    marginTop: 10,
    minHeight: 0,
    width: "100%",
    alignSelf: "stretch",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: APP_DARK_BG
  },
  storyVideo: {
    width: "100%",
    height: "100%",
    ...(Platform.OS === "web" ? ({ maxWidth: "100%" } as const) : null)
  },
  storyTapZones: { ...StyleSheet.absoluteFillObject, flexDirection: "row" },
  storyTapZone: { flex: 1 },
  postViewerRoot: { flex: 1, backgroundColor: APP_DARK_BG },
  postViewerTop: {
    position: "absolute",
    top: 44,
    right: 14,
    zIndex: 10
  },
  postViewerVideo: { width: "100%", height: "100%" },
  postViewerFallback: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  postViewerFallbackText: { color: "rgba(255,255,255,0.8)" },
  likes: { marginTop: 6, paddingHorizontal: 10, fontWeight: "700", color: "#1f2c29", fontSize: 13 },
  caption: { marginTop: 4, paddingHorizontal: 10, color: "#1f2c29", lineHeight: 20, fontSize: 13 },
  captionUser: { fontWeight: "700" },
  friendLikeMeta: { marginTop: 4, paddingHorizontal: 10, color: "#4b5e59", fontSize: 12, fontWeight: "700" },
  comments: { marginTop: 4, paddingHorizontal: 10, color: "#637571", fontSize: 13 },
  emptyTabWrap: {
    marginHorizontal: 12,
    marginTop: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dce4e1",
    backgroundColor: "#fff",
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: "center"
  },
  emptyTabTitle: { fontWeight: "900", color: "#22312d", fontSize: 15 },
  emptyTabSub: { marginTop: 6, color: "#5b6965", fontWeight: "600" }
  ,
  commentsSheetRoot: {
    flex: 1
  },
  commentsSheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent"
  },
  commentsSheetContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%"
  },
  commentsSheetPanel: {
    flex: 1,
    backgroundColor: "#1a1b1c",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 4,
    overflow: "hidden"
  },
  commentsSheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#52525b",
    alignSelf: "center",
    marginBottom: 10
  },
  commentsSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#303236",
    paddingBottom: 10
  },
  commentsCloseHit: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center"
  },
  commentsHeaderSpacer: {
    width: 40,
    height: 40
  },
  commentsTitle: {
    color: "#C9FF35",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
    flex: 1
  },
  commentsListScroll: { flex: 1, minHeight: 0 },
  commentsListInner: { paddingBottom: 12, gap: 14 },
  likesListInner: { paddingBottom: 12, gap: 4 },
  likesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 4
  },
  likesRowName: { flex: 1, color: "#fafafa", fontSize: 14, fontWeight: "700" },
  noCommentsText: { color: "#C9FF35", textAlign: "center", marginTop: 16, fontWeight: "700" },
  commentBlock: { marginBottom: 2 },
  commentRowInsta: { flexDirection: "row", alignItems: "flex-start" },
  commentAvatarSq: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#3f3f46",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10
  },
  commentAvatarSqText: { color: "#fafafa", fontSize: 14, fontWeight: "800" },
  commentMainCol: { flex: 1, minWidth: 0, paddingRight: 6 },
  commentHeaderRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  commentUserName: { color: "#fafafa", fontSize: 13, fontWeight: "800", maxWidth: "70%" },
  commentTime: { color: "#9ca3af", fontSize: 12, fontWeight: "600" },
  commentBodyText: { color: "#e4e4e7", fontSize: 13, lineHeight: 18, marginTop: 4 },
  commentReplyBtn: { alignSelf: "flex-start", marginTop: 8 },
  commentReplyText: { color: "#a1a1aa", fontSize: 12, fontWeight: "700" },
  commentActionsCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 2,
    marginLeft: 4,
    alignSelf: "flex-start"
  },
  commentActionHit: { flexDirection: "row", alignItems: "center", gap: 4, minWidth: 24 },
  commentActionCount: { color: "#9ca3af", fontSize: 11, fontWeight: "700" },
  commentLikeCountActive: { color: "#C9FF35" },
  viewMoreCommentsWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
    marginBottom: 4,
    paddingLeft: 46
  },
  viewMoreCommentsLine: {
    width: 22,
    height: 1,
    backgroundColor: "#52525b"
  },
  viewMoreCommentsText: { color: "#a1a1aa", fontSize: 12, fontWeight: "700" },
  replyingToBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: "#303236",
    backgroundColor: "rgba(184,255,55,0.08)"
  },
  replyingToBannerText: { flex: 1, color: "#C9FF35", fontSize: 12, fontWeight: "800" },
  replyingToCancel: { paddingVertical: 4, paddingHorizontal: 6 },
  replyingToCancelText: { color: "#a1a1aa", fontSize: 12, fontWeight: "700" },
  emojiRow: {
    borderTopWidth: 1,
    borderTopColor: "#303236",
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  emojiText: { fontSize: 16 },
  commentInputRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  commentInputAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center"
  },
  commentInput: {
    flex: 1,
    height: 28,
    borderRadius: 10,
    paddingHorizontal: 10,
    backgroundColor: "#f9fafb",
    color: "#111827",
    fontSize: 11
  },
  commentSendBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#C9FF35",
    alignItems: "center",
    justifyContent: "center"
  },
  reelOptionsSheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: "#262626",
    borderTopWidth: 1,
    borderColor: "#343b43",
    paddingHorizontal: 14,
    paddingTop: 8,
    gap: 10
  },
  reelOptionsTitle: { color: "#eef4f8", fontSize: 16, fontWeight: "900", paddingBottom: 4 },
  reelOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#303842"
  },
  reelOptionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2a3139"
  },
  reelOptionTextCol: { flex: 1, minWidth: 0 },
  reelOptionTitle: { color: "#f8fafc", fontSize: 14, fontWeight: "900" },
  reelOptionTitleDanger: { color: "#ff8f8f" },
  reelOptionSub: { color: "#97a0a8", fontSize: 11, fontWeight: "700", marginTop: 3 },
  shareBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end"
  },
  /** Bottom sheet host: dim tap layer + sheet as siblings so row Pressables receive presses on web. */
  reelOptionsModalRoot: {
    flex: 1,
    justifyContent: "flex-end"
  },
  reelOptionsDimTap: {
    backgroundColor: "rgba(0,0,0,0.5)"
  },
  shareSheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: "#262626",
    borderTopWidth: 1,
    borderColor: "#343b43",
    paddingHorizontal: 10,
    paddingTop: 8
  },
  shareHandle: {
    width: 52,
    height: 3,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 8,
    backgroundColor: "#C9FF35"
  },
  shareSearchRow: {
    height: 38,
    borderRadius: 10,
    backgroundColor: "#29303a",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    gap: 8
  },
  shareSearchInput: { flex: 1, color: "#eef4f8", fontSize: 12, fontWeight: "600" },
  shareSearchAction: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#222933"
  },
  sharePeopleRow: {
    paddingTop: 12,
    paddingBottom: 10,
    gap: 10
  },
  sharePersonItem: { width: 62, alignItems: "center", gap: 6 },
  sharePersonAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#343b43",
    borderWidth: 1,
    borderColor: "#4a525c"
  },
  sharePersonAvatarText: { color: "#C9FF35", fontWeight: "900", fontSize: 16 },
  sharePersonName: { color: "#d5dde4", fontSize: 10, fontWeight: "700", maxWidth: 62, textAlign: "center" },
  shareNoPeopleText: { color: "#97a0a8", fontSize: 12, fontWeight: "700", paddingVertical: 18, paddingHorizontal: 8 },
  shareFooterRow: {
    borderTopWidth: 1,
    borderTopColor: "#343b43",
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8
  },
  shareFooterAction: { alignItems: "center", gap: 6, flex: 1 },
  shareFooterIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2a3139",
    alignItems: "center",
    justifyContent: "center"
  },
  shareFooterText: { color: "#c7ced5", fontSize: 9, fontWeight: "700", textAlign: "center" }
});
