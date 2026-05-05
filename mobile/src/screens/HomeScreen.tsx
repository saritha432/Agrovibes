import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ViewStyle,
  type ViewToken
} from "react-native";
import { ResizeMode, Video } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppTopBar } from "../components/AppTopBar";
import { useAuth } from "../auth/AuthContext";
import {
  createHomeStory,
  createHomePostComment,
  deleteHomeStory,
  fetchHomePostComments,
  fetchHomePosts,
  fetchHomeStories,
  fetchRelationships,
  HomePost,
  HomeStory,
  likeHomePost,
  sendFollowRequest,
  unfollowUser,
  unlikeHomePost
} from "../services/api";
import {
  addLocalCommentForPost,
  appendLocalEngagementNotification,
  getLocalCommentsForPost,
  getLocalLikeStateForPosts,
  setLocalPostLikedByIdentity
} from "../social/localEngagementStore";
import { getLocalRelationshipMapByNames, removeLocalFollowByIdentity, sendLocalFollowRequestByIdentity } from "../social/localFollowStore";
import type { CreateType } from "../components/CreateModal";

interface HomeScreenProps {
  refreshToken?: number;
  onOpenCreate?: (type?: CreateType) => void;
}

const postTints = ["#8a5b00", "#0f5f43", "#8b3a62", "#105f75"];
const homeTopTabs = ["Feed", "Reels", "Friends", "live"] as const;
const friendLikeNames = ["Ramesh", "Sowndherya", "AgroRoots", "Meera", "Suresh"];
const likeActiveColor = "#16a34a";
const REEL_LIKE_COLOR = "#ffffff";

function normalizeIdentity(value: string) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function postImageGallery(post: HomePost | null | undefined): string[] {
  if (!post) return [];
  if (post.imageUrls?.length) return post.imageUrls;
  if (post.imageUrl) return [post.imageUrl];
  return [];
}

type HomeCommentRow = {
  id: string;
  user: string;
  text: string;
  likes: number;
  createdAt?: string;
  parentCommentId?: string;
};

const COMMENT_REPLY_INDENT = 14;
/** Show "View more replies" only when a comment has more than this many direct replies (i.e. 3+ → link). */
const REPLY_PREVIEW_VISIBLE = 2;

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
  return {
    id: String(c.id ?? ""),
    user: String(c.user ?? ""),
    text: String(c.text ?? ""),
    likes: Number.isFinite(Number(c.likes)) ? Number(c.likes) : 0,
    createdAt: typeof c.createdAt === "string" ? c.createdAt : c.createdAt != null ? String(c.createdAt) : undefined,
    parentCommentId
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
  const userName = String(raw.userName ?? raw["user_name"] ?? "You");
  const avatarLabelRaw = String(raw.avatarLabel ?? raw["avatar_label"] ?? userName.charAt(0) ?? "U").trim();
  const video = (raw.videoUrl as string | null | undefined) ?? (raw["video_url"] as string | null | undefined) ?? null;
  const image = (raw.imageUrl as string | null | undefined) ?? (raw["image_url"] as string | null | undefined) ?? null;
  return {
    id: Number(raw.id ?? Date.now()),
    userId: raw.userId != null ? Number(raw.userId) : raw["user_id"] != null ? Number(raw["user_id"]) : undefined,
    userName,
    district: String(raw.district ?? "My Farm"),
    avatarLabel: (avatarLabelRaw || "U").charAt(0).toUpperCase(),
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
    const key = `${normalizeIdentity(s.userName)}:${s.videoUrl || ""}:${s.imageUrl || ""}`;
    byKey.set(key, s);
  };
  for (const s of remote) put(s);
  for (const s of optimistic) {
    if (!s.videoUrl && !s.imageUrl) continue;
    const created = Date.parse(String(s.createdAt || "")) || Date.now();
    if (Date.now() - created <= 24 * 60 * 60 * 1000) put(s);
  }
  return [...byKey.values()].sort((a, b) => {
    const ta = Date.parse(String(a.createdAt || "")) || 0;
    const tb = Date.parse(String(b.createdAt || "")) || 0;
    return tb - ta;
  });
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
  const target = e["target"] as HTMLVideoElement | undefined;
  if (target && target.videoWidth > 0 && target.videoHeight > 0) {
    return { width: target.videoWidth, height: target.videoHeight };
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
  containerWidth: number;
  containerHeight: number;
  /** `cover` = full bleed (no side bars; may crop). `contain` = full frame visible (letterboxing). */
  fit?: "contain" | "cover";
  isLooping?: boolean;
  isMuted?: boolean;
  useNativeControls?: boolean;
};

function ContainedExpoVideo({
  uri,
  shouldPlay,
  containerWidth,
  containerHeight,
  fit = "contain",
  isLooping = true,
  isMuted = false,
  useNativeControls = false
}: ContainedExpoVideoProps) {
  const isWeb = Platform.OS === "web";
  const isCover = fit === "cover";
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);

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

  return (
    <View
      style={{
        width: containerWidth,
        height: containerHeight,
        backgroundColor: "#000",
        ...(!isCover ? { justifyContent: "center", alignItems: "center" } : {})
      }}
    >
      <Video
        source={{ uri }}
        shouldPlay={shouldPlay}
        isLooping={isLooping}
        isMuted={isMuted}
        useNativeControls={useNativeControls}
        resizeMode={resizeMode}
        style={videoOuterStyle}
        videoStyle={isWeb ? webVideoObjectFitStyle(isCover ? "cover" : "contain") : undefined}
        onReadyForDisplay={
          isWeb || isCover
            ? undefined
            : (ev) => {
                const dim = readVideoNaturalSize(ev);
                if (dim) setNatural(dim);
              }
        }
      />
    </View>
  );
}

export function HomeScreen({ refreshToken = 0, onOpenCreate }: HomeScreenProps) {
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const feedMediaWidth = windowWidth - 20;
  const [stories, setStories] = useState<HomeStory[]>([]);
  const [posts, setPosts] = useState<HomePost[]>([]);
  const [viewedStoryIds, setViewedStoryIds] = useState<Set<number>>(new Set());
  const [playingPostId, setPlayingPostId] = useState<number | null>(null);
  const [activePost, setActivePost] = useState<HomePost | null>(null);
  const [sharePost, setSharePost] = useState<HomePost | null>(null);
  const [shareSearch, setShareSearch] = useState("");
  const [optimisticStories, setOptimisticStories] = useState<HomeStory[]>([]);
  const [activeCommentsPost, setActiveCommentsPost] = useState<HomePost | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [replyingTo, setReplyingTo] = useState<{ id: string; user: string } | null>(null);
  const [commentsByPost, setCommentsByPost] = useState<Record<number, HomeCommentRow[]>>({});
  /** Parent comment ids whose direct replies are fully expanded (only used when direct reply count > REPLY_PREVIEW_VISIBLE). */
  const [expandedReplyThreads, setExpandedReplyThreads] = useState<Record<string, boolean>>({});
  const [commentInteractions, setCommentInteractions] = useState<Record<string, { liked: boolean; disliked: boolean }>>({});
  const [isStoryOpen, setStoryOpen] = useState(false);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [storyViewerOwnerKey, setStoryViewerOwnerKey] = useState<string | null>(null);
  const [activeHomeTab, setActiveHomeTab] = useState<(typeof homeTopTabs)[number]>("Reels");
  const [relationships, setRelationships] = useState<Record<number, { viewerStatus: string; reverseStatus: string; canFollowBack: boolean }>>({});
  const [followBusyByUserId, setFollowBusyByUserId] = useState<Record<number, boolean>>({});
  const [legacyFollowStateByName, setLegacyFollowStateByName] = useState<Record<string, "none" | "pending" | "accepted">>({});
  const [legacyRelationshipByName, setLegacyRelationshipByName] = useState<Record<string, { viewerStatus: "none" | "pending" | "accepted"; canFollowBack: boolean }>>({});
  const [likeBusyByPostId, setLikeBusyByPostId] = useState<Record<number, boolean>>({});
  const [reelSlotHeight, setReelSlotHeight] = useState(0);
  const [storyViewport, setStoryViewport] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const progress = useRef(new Animated.Value(0)).current;
  const commentsFetchSeqRef = useRef(0);

  const viewabilityConfig = useMemo(
    () => ({ itemVisiblePercentThreshold: 65, minimumViewTime: 200 }),
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
      const withVideo = ordered.find((c) => !!c.post.videoUrl);
      setPlayingPostId(withVideo ? withVideo.post.id : null);
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
    if (activeHomeTab === "Feed") return posts;
    if (activeHomeTab === "Reels" || activeHomeTab === "live") return posts.filter((p) => !!p.videoUrl);
    if (activeHomeTab === "Friends") return posts.filter((p) => !!p.videoUrl && p.likesCount > 0);
    return posts;
  }, [activeHomeTab, posts]);

  useEffect(() => {
    if (tabPosts.length === 0) {
      setPlayingPostId(null);
      return;
    }
    setPlayingPostId((current) => {
      if (current != null && tabPosts.some((p) => p.id === current)) return current;
      return tabPosts.find((p) => p.videoUrl)?.id ?? null;
    });
  }, [tabPosts]);

  const playableStories = useMemo(() => stories.filter((s) => !!s.videoUrl || !!s.imageUrl), [stories]);
  const currentUserStoryKey = useMemo(() => normalizeIdentity(user?.fullName || "You"), [user?.fullName]);
  const currentUserId = Number(user?.id);
  const ownOwnerKey =
    Number.isFinite(currentUserId) && currentUserId > 0 ? `uid:${currentUserId}` : `name:${currentUserStoryKey || "you"}`;
  const storyOwnerKeyOf = useCallback(
    (story: HomeStory) => {
      const sid = Number(story.userId);
      if (Number.isFinite(sid) && sid > 0) return `uid:${sid}`;
      const nameNorm = normalizeIdentity(story.userName || "");
      if (!nameNorm || nameNorm === "you") return ownOwnerKey;
      return `name:${nameNorm}`;
    },
    [ownOwnerKey]
  );
  const ownStories = useMemo(
    () =>
      playableStories.filter((s) => {
        return storyOwnerKeyOf(s) === ownOwnerKey;
      }),
    [ownOwnerKey, playableStories, storyOwnerKeyOf]
  );
  const otherStoryUsers = useMemo(() => {
    const grouped = new Map<
      string,
      { ownerKey: string; userName: string; avatarLabel: string; hasUnviewed: boolean; firstStoryId: number }
    >();
    for (const s of playableStories) {
      const ownerKey = storyOwnerKeyOf(s);
      if (ownerKey === ownOwnerKey) continue;
      const prev = grouped.get(ownerKey);
      if (!prev) {
        grouped.set(ownerKey, {
          ownerKey,
          userName: s.userName,
          avatarLabel: s.avatarLabel || (s.userName?.charAt(0) || "?").toUpperCase(),
          hasUnviewed: !s.viewed,
          firstStoryId: Number(s.id)
        });
      } else if (!s.viewed) {
        grouped.set(ownerKey, { ...prev, hasUnviewed: true });
      }
    }
    return [...grouped.values()];
  }, [ownOwnerKey, playableStories, storyOwnerKeyOf]);
  const viewerStories = useMemo(() => {
    if (!storyViewerOwnerKey) return playableStories;
    return playableStories.filter((s) => storyOwnerKeyOf(s) === storyViewerOwnerKey);
  }, [playableStories, storyOwnerKeyOf, storyViewerOwnerKey]);
  const activeStory = viewerStories[activeStoryIndex];

  const applyViewedStories = useCallback(
    (incoming: HomeStory[]) => incoming.map((story) => (viewedStoryIds.has(story.id) ? { ...story, viewed: true } : story)),
    [viewedStoryIds]
  );

  const closeStory = () => {
    setStoryOpen(false);
    setStoryViewerOwnerKey(null);
    progress.stopAnimation();
    progress.setValue(0);
  };

  const nextStory = () => {
    if (activeStoryIndex >= viewerStories.length - 1) {
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
    if (!isStoryOpen) return;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 7000,
      useNativeDriver: false
    }).start(({ finished }) => {
      if (finished) nextStory();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStoryOpen, activeStoryIndex]);

  const deleteActiveStory = useCallback(async () => {
    if (!activeStory) return;
    if (!token) {
      Alert.alert("Login required", "Please login to delete your story.");
      return;
    }
    const isMine = storyOwnerKeyOf(activeStory) === ownOwnerKey;
    if (!isMine) return;
    try {
      await deleteHomeStory(Number(activeStory.id), token);
      setStories((prev) => prev.filter((s) => Number(s.id) !== Number(activeStory.id)));
      setOptimisticStories((prev) => prev.filter((s) => Number(s.id) !== Number(activeStory.id)));
      setViewedStoryIds((prev) => {
        const n = new Set(prev);
        n.delete(Number(activeStory.id));
        return n;
      });
      setActiveStoryIndex((idx) => Math.max(0, idx - 1));
      if (viewerStories.length <= 1) {
        closeStory();
      }
    } catch {
      Alert.alert("Delete failed", "Could not delete story right now.");
    }
  }, [activeStory, closeStory, ownOwnerKey, storyOwnerKeyOf, token, viewerStories.length]);

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
        const localLikes = await getLocalLikeStateForPosts(
          { name: user?.fullName || "You", key: user?.email || String(user?.id || "") },
          data.posts.map((p) => p.id)
        );
        if (!mounted) return;
        setPosts(
          data.posts.map((p) => ({
            ...p,
            viewerHasLiked: !!p.viewerHasLiked || localLikes.likedPostIds.has(p.id),
            likesCount: Math.max(Number(p.likesCount || 0), Number(localLikes.likesCountByPost[p.id] || 0))
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
  }, [refreshToken, token, user?.email, user?.fullName, user?.id]);

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
        Alert.alert("Follow failed", error?.message || "Could not send follow request.");
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
      if (post?.videoUrl) setPlayingPostId(post.id);
    },
    [reelSlotHeight, tabPosts]
  );

  const buildShareLink = useCallback((post: HomePost) => {
    return `https://agrovibes.app/reel/${encodeURIComponent(String(post.id))}`;
  }, []);

  const shareMessage = useCallback(
    (post: HomePost) => {
      const caption = String(post.caption || "").replace(/^\[REEL\]\s*/i, "").trim();
      const link = buildShareLink(post);
      return `${post.userName} shared a reel on AgroVibe${caption ? `\n${caption}` : ""}\n${link}`;
    },
    [buildShareLink]
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
        Alert.alert("Share failed", "Could not open system share.");
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
        Alert.alert("No media", "This reel has no media to add as story.");
        return;
      }
      const optimistic: HomeStory = normalizeStoryRow({
        id: Date.now() * -1,
        userId: Number(user?.id) || undefined,
        userName: user?.fullName || "You",
        district: post.location || "My Farm",
        avatarLabel: (user?.fullName || "U").charAt(0).toUpperCase(),
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
        Alert.alert("Added", "Reel added to your story.");
      } catch {
        // fallback to existing create flow when API is unavailable
        setSharePost(null);
        onOpenCreate?.("story");
      }
    },
    [applyViewedStories, onOpenCreate, token, user?.fullName, user?.id]
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
        { name: user?.fullName || "You", key: user?.email || String(user?.id || "") },
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
        setPosts((prev) =>
          prev.map((p) => (p.id === post.id ? { ...p, viewerHasLiked: res.liked, likesCount: res.likesCount } : p))
        );
        await setLocalPostLikedByIdentity(
          post.id,
          { name: user?.fullName || "You", key: user?.email || String(user?.id || "") },
          res.liked
        );
      } catch {
        if (nextLiked && !isOwnPost) {
          await appendLocalEngagementNotification({
            type: "post_like",
            actorName: user?.fullName || "Someone",
            recipientDisplayName: post.userName,
            postId: post.id,
            isReel: !!post.videoUrl
          });
        }
        if (!nextLiked) {
          revert();
          await setLocalPostLikedByIdentity(
            post.id,
            { name: user?.fullName || "You", key: user?.email || String(user?.id || "") },
            true
          );
        }
      } finally {
        setLikeBusyByPostId((prev) => ({ ...prev, [post.id]: false }));
      }
    },
    [token, user?.email, user?.fullName, user?.id]
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
          parentCommentId: res.comment.parentCommentId ?? parentIdStr
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
            parentCommentId: parentIdStr
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
  }, [activeCommentsPost, commentDraft, replyingTo, token, user?.email, user?.fullName, user?.id]);

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
          style={[styles.storyRowWrapDark, styles.storyRowScrollCompact]}
          contentContainerStyle={styles.storyRow}
        >
          <Pressable
            style={styles.storyItem}
            onPress={() => {
              const ownPlayable = ownStories.find((s) => !!s.videoUrl || !!s.imageUrl);
              if (!ownPlayable) {
                onOpenCreate?.("story");
                return;
              }
              setStoryViewerOwnerKey(ownOwnerKey);
              const ownQueue = playableStories.filter((s) => storyOwnerKeyOf(s) === ownOwnerKey);
              const idx = ownQueue.findIndex((s) => s.id === ownPlayable.id);
              setActiveStoryIndex(Math.max(idx, 0));
              setStoryOpen(true);
            }}
          >
            <View
              style={[
                styles.storyRing,
                ownStories.some((s) => !s.viewed && (!!s.videoUrl || !!s.imageUrl)) ? styles.storyRingNew : styles.storyRingViewed
              ]}
            >
              <View style={styles.storyInner}>
                <View style={styles.storyAvatarFill}>
                  <Text style={styles.storyInitial}>{(user?.fullName || "Y").charAt(0).toUpperCase()}</Text>
                </View>
                <Pressable
                  style={styles.yourStoryPlusBadge}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    onOpenCreate?.("story");
                  }}
                  hitSlop={8}
                >
                  <Ionicons name="add" size={12} color="#fff" />
                </Pressable>
              </View>
            </View>
            <Text style={styles.storyNameDark} numberOfLines={1}>
              Your story
            </Text>
          </Pressable>

          {otherStoryUsers.map((story) => (
            <Pressable
              key={story.ownerKey}
              style={styles.storyItem}
              onPress={() => {
                const queue = playableStories.filter((s) => storyOwnerKeyOf(s) === story.ownerKey);
                const first = queue[0];
                if (!first) return;
                setViewedStoryIds((prev) => {
                  if (prev.has(first.id)) return prev;
                  const next = new Set(prev);
                  next.add(first.id);
                  return next;
                });
                setStories((prev) => prev.map((s) => (s.id === first.id ? { ...s, viewed: true } : s)));
                setStoryViewerOwnerKey(story.ownerKey);
                setActiveStoryIndex(0);
                setStoryOpen(true);
              }}
            >
              <View style={[styles.storyRing, story.hasUnviewed ? styles.storyRingNew : styles.storyRingViewed]}>
                <View style={styles.storyInner}>
                  <View style={styles.storyAvatarFill}>
                    <Text style={styles.storyInitial}>{story.avatarLabel}</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.storyNameDark} numberOfLines={1}>
                {story.userName}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.homeTopTabsRowDark}>
          {homeTopTabs.map((tab) => (
            <Pressable key={tab} onPress={() => setActiveHomeTab(tab)} style={styles.homeTopTabPressable}>
              <View style={[styles.homeTopTabPillDark, activeHomeTab === tab ? styles.homeTopTabPillActiveDark : null]}>
                <Text style={[styles.homeTopTabTextDark, activeHomeTab === tab ? styles.homeTopTabTextActiveDark : null]}>{tab}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    ),
    [activeHomeTab, onOpenCreate, otherStoryUsers, ownOwnerKey, ownStories, playableStories, storyOwnerKeyOf, user?.fullName]
  );

  const renderFullScreenReel = useCallback(
    ({ item: post, index }: { item: HomePost; index: number }) => {
      const pageH = reelSlotHeight > 0 ? reelSlotHeight : Math.max(420, windowHeight * 0.62);
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
      const followLabel = relationship?.viewerStatus === "accepted"
        ? "Following"
        : relationship?.viewerStatus === "pending"
          ? "Requested"
          : localRelationship?.viewerStatus === "accepted"
            ? "Following"
            : localRelationship?.viewerStatus === "pending"
              ? "Requested"
              : legacyStatus === "accepted"
                ? "Following"
                : legacyStatus === "pending"
                  ? "Requested"
                  : followBusyByUserId[postUserId]
                    ? "..."
                    : "Follow";
      const postComments = commentsByPost[post.id] ?? [];
      const shownCommentsCount = Math.max(Number(post.commentsCount ?? 0), postComments.length);
      const nextPost = tabPosts[index + 1];
      const thumbUri = post.thumbnailUrl || nextPost?.thumbnailUrl || nextPost?.imageUrl || post.imageUrl;
      const musicLabel =
        post.caption?.replace(/^\[REEL\]\s*/i, "").trim().slice(0, 36) || "Original audio";

      return (
        <View style={[styles.reelPage, { height: pageH, width: windowWidth }]}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => (post.videoUrl ? setActivePost(post) : null)}>
            {post.videoUrl ? (
              <ContainedExpoVideo
                uri={post.videoUrl}
                shouldPlay={isActive}
                containerWidth={windowWidth}
                containerHeight={pageH}
                fit="cover"
                isLooping
                isMuted={Platform.OS === "web"}
                useNativeControls={false}
              />
            ) : (
              <View style={[styles.reelVideoFull, { backgroundColor: postTints[index % postTints.length] }]} />
            )}
          </Pressable>
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.88)"]}
            locations={[0.35, 1]}
            style={styles.reelGradient}
            pointerEvents="none"
          />
          <View style={[styles.reelOverlayWrap, { paddingBottom: Math.max(12, insets.bottom + 8) }]} pointerEvents="box-none">
            <View style={styles.reelLeftMeta} pointerEvents="auto">
              <View style={styles.reelUserFollowRow}>
                <View style={styles.reelAvatarSq}>
                  <Text style={styles.reelAvatarSqText}>{post.userName[0]?.toUpperCase() || "?"}</Text>
                </View>
                <Text style={styles.reelUserName} numberOfLines={1}>
                  {post.userName}
                </Text>
                {!isOwnPost ? (
                  <Pressable
                    onPress={() => toggleFollow(postUserId > 0 ? postUserId : null, post.userName, currentFollowStatus)}
                    style={styles.reelFollowOutline}
                    disabled={(postUserId > 0 && !!followBusyByUserId[postUserId]) || currentFollowStatus === "pending"}
                  >
                    <Text style={styles.reelFollowOutlineText}>{followLabel}</Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.reelMusicRow}>
                <Ionicons name="musical-notes" size={14} color="rgba(255,255,255,0.95)" />
                <Text style={styles.reelMusicText} numberOfLines={1}>
                  {musicLabel}
                </Text>
              </View>
              <Text style={styles.reelCaptionDark} numberOfLines={2}>
                {post.caption}
              </Text>
            </View>
            <View style={styles.reelActionsCol} pointerEvents="auto">
              <Pressable style={styles.reelActionItem} onPress={() => togglePostLike(post)} disabled={!!likeBusyByPostId[post.id]}>
                <Ionicons
                  name={post.viewerHasLiked ? "heart" : "heart-outline"}
                  size={30}
                  color={post.viewerHasLiked ? likeActiveColor : REEL_LIKE_COLOR}
                />
                <Text style={styles.reelActionCount}>{post.likesCount}</Text>
              </Pressable>
              <Pressable style={styles.reelActionItem} onPress={() => openCommentsForPost(post)}>
                <Ionicons name="chatbubble-outline" size={28} color="#fff" />
                <Text style={styles.reelActionCount}>{shownCommentsCount}</Text>
              </Pressable>
              <Pressable style={styles.reelActionItem} onPress={() => setSharePost(post)}>
                <Ionicons name="paper-plane-outline" size={26} color="#fff" />
              </Pressable>
              <Pressable style={styles.reelActionItem}>
                <Ionicons name="ellipsis-horizontal" size={26} color="#fff" />
              </Pressable>
              {thumbUri ? (
                <Image source={{ uri: thumbUri }} style={styles.reelDiscThumb} />
              ) : (
                <View style={[styles.reelDiscThumb, styles.reelDiscThumbPlaceholder]} />
              )}
            </View>
          </View>
        </View>
      );
    },
    [
      commentsByPost,
      followBusyByUserId,
      insets.bottom,
      legacyFollowStateByName,
      legacyRelationshipByName,
      likeBusyByPostId,
      openCommentsForPost,
      onAddReelToStory,
      onShareToMessenger,
      onShareToSnapchat,
      onShareToSystem,
      onShareToWhatsApp,
      playingPostId,
      reelSlotHeight,
      relationships,
      tabPosts,
      toggleFollow,
      togglePostLike,
      user?.fullName,
      user?.id,
      windowHeight,
      windowWidth
    ]
  );

  const renderPost = useCallback(
    ({ item: post, index }: { item: HomePost; index: number }) => {
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
      const followLabel = relationship?.viewerStatus === "accepted"
        ? "Following"
        : relationship?.viewerStatus === "pending"
          ? "Requested"
            : localRelationship?.viewerStatus === "accepted"
              ? "Following"
              : localRelationship?.viewerStatus === "pending"
                ? "Requested"
            : legacyStatus === "accepted"
              ? "Following"
              : legacyStatus === "pending"
                ? "Requested"
                : followBusyByUserId[postUserId]
                  ? "..."
                  : "Follow";
      return (
        <View style={styles.postCard}>
          <View style={styles.postTop}>
            <View style={styles.postUserRow}>
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>{post.userName[0]}</Text>
              </View>
              <View>
                <Text style={styles.userName}>
                  {post.userName} <Text style={styles.timeText}>• 13h</Text>
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
              <Ionicons name="ellipsis-horizontal" size={18} color="#5f6f6a" />
            </View>
          </View>

          <View style={[styles.postMedia, { backgroundColor: postTints[index % postTints.length] }]}>
            {post.videoUrl ? (
              <Pressable style={styles.videoTapArea} onPress={() => setActivePost(post)}>
                <Video
                  style={styles.video}
                  source={{ uri: post.videoUrl }}
                  resizeMode={ResizeMode.COVER}
                  shouldPlay={isActive}
                  isLooping
                  isMuted
                  useNativeControls={false}
                />
              </Pressable>
            ) : isCarousel ? (
              <FlatList
                data={gallery}
                horizontal
                pagingEnabled
                nestedScrollEnabled
                scrollEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(uri, i) => `${post.id}-${i}-${uri}`}
                style={{ width: feedMediaWidth, height: feedMediaWidth }}
                renderItem={({ item: uri }) => (
                  <Image style={{ width: feedMediaWidth, height: feedMediaWidth }} source={{ uri }} resizeMode="cover" />
                )}
              />
            ) : gallery[0] ? (
              <Pressable style={styles.videoTapArea} onPress={() => setActivePost(post)}>
                <Image style={styles.video} source={{ uri: gallery[0] }} resizeMode="cover" />
              </Pressable>
            ) : (
              <Pressable style={styles.videoTapArea} onPress={() => setActivePost(post)}>
                <Ionicons name="play-circle-outline" size={48} color="#fff" />
              </Pressable>
            )}
            {isCarousel ? (
              <View style={styles.postCarouselDots} pointerEvents="none">
                {gallery.map((_, i) => (
                  <View key={i} style={styles.postCarouselDot} />
                ))}
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

          <Text style={styles.likes}>{post.likesCount} likes</Text>
          <Text style={styles.caption}>
            <Text style={styles.captionUser}>{post.userName}</Text> {post.caption}
          </Text>
          {activeHomeTab === "Friends" ? (
            <Text style={styles.friendLikeMeta}>
              Liked by {friendLikeNames[index % friendLikeNames.length]} and {Math.max(1, Math.floor(post.likesCount / 3))} others
            </Text>
          ) : null}
          <Pressable onPress={() => openCommentsForPost(post)}>
            <Text style={styles.comments}>View all {shownCommentsCount} comments</Text>
          </Pressable>
        </View>
      );
    },
    [
      activeHomeTab,
      commentsByPost,
      feedMediaWidth,
      followBusyByUserId,
      legacyFollowStateByName,
      legacyRelationshipByName,
      likeActiveColor,
      likeBusyByPostId,
      openCommentsForPost,
      playingPostId,
      relationships,
      toggleFollow,
      togglePostLike,
      user?.fullName,
      user?.id
    ]
  );

  const emptyTabTitle =
    activeHomeTab === "Feed"
      ? "No posts yet"
      : activeHomeTab === "Friends"
        ? "No friend-liked reels yet"
        : activeHomeTab === "live"
          ? "No live reels yet"
          : activeHomeTab === "Reels"
            ? "No reels yet"
            : "Nothing here yet";

  const useFullScreenReelLayout = activeHomeTab === "Reels" || activeHomeTab === "live";

  return (
    <View style={[styles.screen, styles.screenDark]}>
      {useFullScreenReelLayout ? (
        <View style={styles.reelsColumn}>
          {listHeader}
          <View style={styles.reelSlot} onLayout={(e) => setReelSlotHeight(Math.round(e.nativeEvent.layout.height))}>
            {reelSlotHeight > 0 ? (
              <FlatList
                data={tabPosts}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderFullScreenReel}
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
                extraData={`${playingPostId}-${reelSlotHeight}`}
                ListEmptyComponent={
                  <View style={[styles.emptyTabWrap, styles.emptyTabWrapDark]}>
                    <Text style={styles.emptyTabTitleDark}>{emptyTabTitle}</Text>
                    <Text style={styles.emptyTabSubDark}>Create a reel to start filling this section.</Text>
                  </View>
                }
              />
            ) : null}
          </View>
        </View>
      ) : (
        <FlatList
          data={tabPosts}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderPost}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <View style={[styles.emptyTabWrap, styles.emptyTabWrapDark]}>
              <Text style={styles.emptyTabTitleDark}>{emptyTabTitle}</Text>
              <Text style={styles.emptyTabSubDark}>Create a reel to start filling this section.</Text>
            </View>
          }
          contentContainerStyle={[styles.feedBottom, styles.feedBottomDark]}
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
            {viewerStories.map((s, idx) => {
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
              <View style={styles.storyViewerAvatar}>
                <Text style={styles.storyViewerAvatarText}>{activeStory?.avatarLabel ?? "U"}</Text>
              </View>
              <View>
                <Text style={styles.storyViewerName}>{activeStory?.userName ?? ""}</Text>
              </View>
            </View>
            <View style={styles.storyViewerTopActions}>
              {activeStory && storyOwnerKeyOf(activeStory) === ownOwnerKey ? (
                <Pressable onPress={deleteActiveStory} hitSlop={10}>
                  <Ionicons name="trash-outline" size={22} color="#fff" />
                </Pressable>
              ) : null}
              <Pressable onPress={closeStory} hitSlop={10}>
                <Ionicons name="close" size={26} color="#fff" />
              </Pressable>
            </View>
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
              fit="cover"
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
        visible={!!activeCommentsPost}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={() => setActiveCommentsPost(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.commentsKeyboardWrap}
        >
          <View style={[styles.commentsFullScreen, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <View style={[styles.commentsFullHeader, { paddingTop: Math.max(insets.top, 12) }]}>
              <Pressable
                onPress={() => setActiveCommentsPost(null)}
                hitSlop={12}
                style={styles.commentsCloseHit}
                accessibilityRole="button"
                accessibilityLabel="Close comments"
              >
                <Ionicons name="close" size={26} color="#b7ff37" />
              </Pressable>
              <Text style={styles.commentsTitle}>Comments</Text>
              <View style={styles.commentsHeaderSpacer} />
            </View>

            <ScrollView
              style={styles.commentsList}
              contentContainerStyle={styles.commentsListInner}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
                {(() => {
                  if (!activeCommentsPost) {
                    return <Text style={styles.noCommentsText}>No Comments</Text>;
                  }
                  const pid = activeCommentsPost.id;
                  const allRaw = commentsByPost[pid] ?? [];
                  const all = inferParentFromMention(allRaw.map((x) => normalizeCommentRow(x as HomeCommentRow & Record<string, unknown>)));
                  if (all.length === 0) {
                    return <Text style={styles.noCommentsText}>No Comments</Text>;
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
                          <View style={styles.commentAvatarSq}>
                            <Text style={styles.commentAvatarSqText}>{(c.user[0] || "?").toUpperCase()}</Text>
                          </View>
                          <View style={styles.commentMainCol}>
                            <View style={styles.commentHeaderRow}>
                              <Text style={styles.commentUserName} numberOfLines={1}>
                                {c.user}
                              </Text>
                              {rel ? <Text style={styles.commentTime}>{rel}</Text> : null}
                            </View>
                            <Text style={styles.commentBodyText}>{c.text}</Text>
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
                                color={inter.liked ? "#ec4899" : "#9ca3af"}
                              />
                              <Text style={styles.commentActionCount}>{likeCount}</Text>
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
                    <Text style={styles.replyingToCancelText}>Cancel</Text>
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
                <View style={styles.commentInputAvatar}>
                  <Ionicons name="person" size={12} color="#0f172a" />
                </View>
                <TextInput
                  value={commentDraft}
                  onChangeText={setCommentDraft}
                  placeholder={replyingTo ? "Write a reply…" : "Add comment for PureFarm..."}
                  placeholderTextColor="#6b7280"
                  style={styles.commentInput}
                />
                <Pressable style={styles.commentSendBtn} onPress={submitComment}>
                  <Ionicons name="send" size={14} color="#111827" />
                </Pressable>
              </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!sharePost} transparent animationType="slide" onRequestClose={() => setSharePost(null)}>
        <Pressable style={styles.shareBackdrop} onPress={() => setSharePost(null)}>
          <Pressable style={[styles.shareSheet, { paddingBottom: Math.max(insets.bottom + 10, 20) }]} onPress={(e) => e.stopPropagation?.()}>
            <View style={styles.shareHandle} />
            <View style={styles.shareSearchRow}>
              <Ionicons name="search" size={16} color="#b7ff37" />
              <TextInput
                value={shareSearch}
                onChangeText={setShareSearch}
                placeholder="Search"
                placeholderTextColor="#97a0a8"
                style={styles.shareSearchInput}
              />
              <Pressable style={styles.shareSearchAction} onPress={() => sharePost && onShareToSystem(sharePost)}>
                <Ionicons name="person-add-outline" size={16} color="#b7ff37" />
              </Pressable>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sharePeopleRow}>
              {(() => {
                const viewer = normalizeIdentity(user?.fullName || "");
                const seen = new Set<string>();
                const list = tabPosts
                  .map((p) => {
                    const name = String(p.userName || "").trim();
                    const key = normalizeIdentity(name);
                    if (!name || !key || key === viewer || seen.has(key)) return null;
                    seen.add(key);
                    return name;
                  })
                  .filter((x): x is string => !!x)
                  .filter((name) => {
                    const q = normalizeIdentity(shareSearch);
                    return !q || normalizeIdentity(name).includes(q);
                  })
                  .slice(0, 24);
                return list.map((name) => (
                  <Pressable key={name} style={styles.sharePersonItem} onPress={() => sharePost && onShareToSystem(sharePost)}>
                    <View style={styles.sharePersonAvatar}>
                      <Text style={styles.sharePersonAvatarText}>{(name[0] || "?").toUpperCase()}</Text>
                    </View>
                    <Text style={styles.sharePersonName} numberOfLines={1}>
                      {name}
                    </Text>
                  </Pressable>
                ));
              })()}
            </ScrollView>

            <View style={styles.shareFooterRow}>
              <Pressable style={styles.shareFooterAction} onPress={() => sharePost && onAddReelToStory(sharePost)}>
                <View style={styles.shareFooterIcon}><Ionicons name="add-circle-outline" size={20} color="#b7ff37" /></View>
                <Text style={styles.shareFooterText}>Add to story</Text>
              </Pressable>
              <Pressable style={styles.shareFooterAction} onPress={() => sharePost && onShareToSystem(sharePost)}>
                <View style={styles.shareFooterIcon}><Ionicons name="link-outline" size={20} color="#b7ff37" /></View>
                <Text style={styles.shareFooterText}>Copy Link</Text>
              </Pressable>
              <Pressable style={styles.shareFooterAction} onPress={() => sharePost && onShareToSystem(sharePost)}>
                <View style={styles.shareFooterIcon}><Ionicons name="open-outline" size={20} color="#b7ff37" /></View>
                <Text style={styles.shareFooterText}>Share To..</Text>
              </Pressable>
              <Pressable style={styles.shareFooterAction} onPress={() => sharePost && onShareToWhatsApp(sharePost)}>
                <View style={styles.shareFooterIcon}><Ionicons name="logo-whatsapp" size={20} color="#b7ff37" /></View>
                <Text style={styles.shareFooterText}>Whatsapp</Text>
              </Pressable>
              <Pressable style={styles.shareFooterAction} onPress={() => sharePost && onShareToMessenger(sharePost)}>
                <View style={styles.shareFooterIcon}><Ionicons name="chatbubble-ellipses-outline" size={20} color="#b7ff37" /></View>
                <Text style={styles.shareFooterText}>Messenger</Text>
              </Pressable>
              <Pressable style={styles.shareFooterAction} onPress={() => sharePost && onShareToSnapchat(sharePost)}>
                <View style={styles.shareFooterIcon}><Ionicons name="logo-snapchat" size={20} color="#b7ff37" /></View>
                <Text style={styles.shareFooterText}>Snapchat</Text>
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
  screenDark: { backgroundColor: "#000000" },
  reelsColumn: { flex: 1, minHeight: 0, flexDirection: "column" },
  homeTopChrome: { flexGrow: 0, flexShrink: 0 },
  storyRowScrollCompact: {
    flexGrow: 0,
    flexShrink: 0,
    maxHeight: 140
  },
  reelSlot: { flex: 1, minHeight: 0, backgroundColor: "#000" },
  reelPage: { backgroundColor: "#000", overflow: "hidden" },
  reelVideoFull: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  reelGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 220,
    zIndex: 1
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
    paddingLeft: 12,
    paddingRight: 8,
    paddingTop: 24
  },
  reelLeftMeta: { flex: 1, marginRight: 8, maxWidth: "72%" },
  reelUserFollowRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  reelAvatarSq: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#2d2d2d",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)"
  },
  reelAvatarSqText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  reelUserName: { color: "#d8ff37", fontWeight: "800", fontSize: 15, maxWidth: 140 },
  reelFollowOutline: {
    borderWidth: 1,
    borderColor: "#d8ff37",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: "transparent"
  },
  reelFollowOutlineText: { color: "#d8ff37", fontWeight: "800", fontSize: 12 },
  reelMusicRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  reelMusicText: { color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "600", flex: 1 },
  reelCaptionDark: { color: "#fff", fontSize: 13, fontWeight: "600", marginTop: 8, lineHeight: 18 },
  reelActionsCol: { alignItems: "center", gap: 16, paddingBottom: 4 },
  reelActionItem: { alignItems: "center", gap: 4 },
  reelActionCount: { color: "#fff", fontSize: 12, fontWeight: "700" },
  reelDiscThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#fff",
    marginTop: 4,
    backgroundColor: "#333"
  },
  reelDiscThumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  storyRowWrapDark: {
    backgroundColor: "#000000"
  },
  storyNameDark: { fontSize: 9, color: "rgba(255,255,255,0.72)", marginTop: 5, fontWeight: "600", textAlign: "center", width: "100%" },
  homeTopTabsRowDark: {
    flexDirection: "row",
    backgroundColor: "#000000",
    paddingHorizontal: 6,
    paddingVertical: 10,
    justifyContent: "space-between"
  },
  homeTopTabPillDark: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10
  },
  homeTopTabPillActiveDark: { backgroundColor: "#2a2a2a" },
  homeTopTabTextDark: { fontSize: 13, color: "#ffffff", fontWeight: "600" },
  homeTopTabTextActiveDark: { color: "#d8ff37", fontWeight: "800" },
  feedBottomDark: { backgroundColor: "#000000", paddingTop: 4 },
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
  emptyTabTitleDark: { fontWeight: "900", color: "#d8ff37", fontSize: 15 },
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
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center"
  },
  storyRingNew: { backgroundColor: "#16a34a" },
  storyRingViewed: { backgroundColor: "#9ca3af" },
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
    justifyContent: "center"
  },
  storyInitial: { fontSize: 18, fontWeight: "700", color: "#1f2c29" },
  yourStoryPlusBadge: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#0a9f46",
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center"
  },
  storyName: { fontSize: 8, color: "#7f868a", marginTop: 5, fontWeight: "500", textAlign: "center", width: "100%" },
  homeTopTabsRow: {
    flexDirection: "row",
    backgroundColor: "#f2f3f5",
    paddingHorizontal: 8,
    paddingVertical: 8,
    justifyContent: "space-between"
  },
  homeTopTabPressable: { flex: 1, alignItems: "center" },
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
    borderColor: "#0f7d3d",
    backgroundColor: "#eef8f1",
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  followChipText: { color: "#0f7d3d", fontWeight: "800", fontSize: 12 },
  postUserRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  userAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#22c55e",
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
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.85)"
  },
  storyViewerRoot: { flex: 1, backgroundColor: "#000" },
  storyProgressRow: { flexDirection: "row", gap: 6, paddingHorizontal: 10, paddingTop: 12 },
  storyProgressTrack: { flex: 1, height: 2.5, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 2, overflow: "hidden" },
  storyProgressFill: { height: "100%", backgroundColor: "#fff" },
  storyViewerTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10, paddingTop: 10 },
  storyViewerTopActions: { flexDirection: "row", alignItems: "center", gap: 14 },
  storyViewerUser: { flexDirection: "row", alignItems: "center", gap: 10 },
  storyViewerAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#22c55e", alignItems: "center", justifyContent: "center" },
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
    backgroundColor: "#000"
  },
  storyVideo: {
    width: "100%",
    height: "100%",
    ...(Platform.OS === "web" ? ({ maxWidth: "100%" } as const) : null)
  },
  storyTapZones: { ...StyleSheet.absoluteFillObject, flexDirection: "row" },
  storyTapZone: { flex: 1 },
  postViewerRoot: { flex: 1, backgroundColor: "#000" },
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
  commentsKeyboardWrap: {
    flex: 1,
    width: "100%",
    backgroundColor: "#1a1b1c"
  },
  commentsFullScreen: {
    flex: 1,
    backgroundColor: "#1a1b1c",
    paddingHorizontal: 14
  },
  commentsFullHeader: {
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
    color: "#b7ff37",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
    flex: 1
  },
  commentsList: { flex: 1 },
  commentsListInner: { paddingBottom: 12, gap: 14 },
  noCommentsText: { color: "#b7ff37", textAlign: "center", marginTop: 40, fontWeight: "700" },
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
  replyingToBannerText: { flex: 1, color: "#d8ff37", fontSize: 12, fontWeight: "800" },
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
    backgroundColor: "#b7ff37",
    alignItems: "center",
    justifyContent: "center"
  },
  shareBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end"
  },
  shareSheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: "#1d2126",
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
    backgroundColor: "#b7ff37"
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
  sharePersonAvatarText: { color: "#d8ff37", fontWeight: "900", fontSize: 16 },
  sharePersonName: { color: "#d5dde4", fontSize: 10, fontWeight: "700", maxWidth: 62, textAlign: "center" },
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
