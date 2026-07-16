import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ViewStyle,
  type ViewToken
} from "react-native";
import { Audio, InterruptionModeAndroid, InterruptionModeIOS, ResizeMode, Video, type AVPlaybackStatus } from "expo-av";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import { navigateToMyProfile, navigateToPublicProfile } from "../navigation/navigationRef";
import { stripLegacyCloudinaryUrl } from "../utils/mediaUrls";
import { videoPlaybackSources, videoPlaybackUrl } from "../utils/videoPlaybackUrl";
import { isOversizedFeedVideo, readVideoSizeFromPlaybackStatus } from "../utils/feedVideoLimits";
import { UserAvatar } from "./UserAvatar";
import { StoryRingAvatar } from "./StoryRingAvatar";
import { CommentComposerBar, commentPlaceholderForPost } from "./CommentComposerBar";
import { PostShareSheet, type SharePeer } from "./PostShareSheet";
import * as Clipboard from "expo-clipboard";
import { PostOptionsSheet } from "./PostOptionsSheet";
import { PostReportSheet } from "./PostReportSheet";
import { PostRepostSheet } from "./PostRepostSheet";
import { RepostAttribution } from "./RepostAttribution";
import { ReelSeekBar } from "./ReelSeekBar";
import { shownResharesCount } from "../social/homeFeedCache";
import { useLanguage } from "../localization/LanguageContext";
import {
  formatDisplayName,
  formatFeedText,
  formatReelCaption,
  postMusicDisplayLabel,
  postShowsMusicRow,
  resolvePersonDisplayName,
  stripInternalCaptionPrefix
} from "../localization/feedDisplay";
import {
  createHomePostComment,
  deleteHomePost,
  fetchHomePostComments,
  HomePost,
  likeHomePost,
  saveHomePost,
  unlikeHomePost,
  unsaveHomePost
} from "../services/api";
import {
  addLocalCommentForPost,
  getLocalCommentsForPost,
  setLocalPostLikedByIdentity
} from "../social/localEngagementStore";
import { APP_DARK_BG, APP_LIME } from "../theme/appColors";
import { useModalTopChromeInset } from "../theme/topChromeInset";

import { reelGridStillUri, reelPlayerBackground, pickReelVideoFit, postShowsVolumeControl } from "../utils/reelGrid";
import { buildPostShareLink } from "../utils/postShare";
const REEL_LIKE_COLOR = "#ffffff";
const REEL_ACTION_ICON = 22;
const REEL_ACTION_ICON_LIKE = 24;

type HomeCommentRow = {
  id: string;
  user: string;
  text: string;
  likes: number;
  createdAt?: string;
  parentCommentId?: string;
  avatarUrl?: string;
};

export type PostsReelViewerModalProps = {
  visible: boolean;
  posts: HomePost[];
  initialIndex: number;
  initialCommentsPostId?: number | null;
  onClose: () => void;
  onPostsChange: (posts: HomePost[]) => void;
  /** When true, viewer can delete posts owned by the signed-in user (profile Posts/Reels tabs). */
  canDeleteOwnPosts?: boolean;
  followingPeers?: SharePeer[];
  onAddToStory?: (post: HomePost) => void | Promise<void>;
};

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
  const fromPost = stripLegacyCloudinaryUrl(post.authorAvatarUrl);
  if (fromPost) return fromPost;
  if (viewer != null && Number.isFinite(Number(viewer.id)) && Number(viewer.id) > 0) {
    if (viewerOwnsPost(post, { id: Number(viewer.id), fullName: viewer.fullName })) {
      const u = stripLegacyCloudinaryUrl(viewer.avatarUrl);
      if (u) return u;
    }
  }
  return undefined;
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

function carouselIndexFromOffset(offsetX: number, pageWidth: number, maxIndex: number): number {
  if (pageWidth <= 0) return 0;
  const idx = Math.round(offsetX / pageWidth);
  return Math.min(maxIndex, Math.max(0, idx));
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
  fit?: "contain" | "cover" | "auto";
  isLooping?: boolean;
  isMuted?: boolean;
  posterUri?: string;
  onStatusUpdate?: (status: AVPlaybackStatus) => void;
};

type ContainedExpoVideoHandle = {
  seekToRatio: (ratio: number) => Promise<void>;
};

const ContainedExpoVideo = React.forwardRef<ContainedExpoVideoHandle, ContainedExpoVideoProps>(function ContainedExpoVideo(
  {
    uri,
    shouldPlay,
    preloadOnly = false,
    containerWidth,
    containerHeight,
    fit = "auto",
    isLooping = true,
    isMuted = false,
    posterUri,
    onStatusUpdate
  },
  ref
) {
  const isWeb = Platform.OS === "web";
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const effectiveFit = useMemo((): "contain" | "cover" => {
    if (fit === "cover" || fit === "contain") return fit;
    if (!natural) return "cover";
    return pickReelVideoFit(natural.width, natural.height);
  }, [fit, natural]);
  const isCover = effectiveFit === "cover";
  const [blocked, setBlocked] = useState(false);
  const videoRef = useRef<Video | null>(null);
  const durationRef = useRef(0);
  const playbackSources = useMemo(() => videoPlaybackSources(uri), [uri]);
  const [sourceIndex, setSourceIndex] = useState(0);
  const activeUri = videoPlaybackUrl(playbackSources[sourceIndex] ?? uri);

  useEffect(() => {
    setNatural(null);
    setSourceIndex(0);
    setBlocked(false);
  }, [uri]);

  useEffect(() => {
    return () => {
      void videoRef.current?.unloadAsync().catch(() => {});
    };
  }, [uri]);

  const fitted = useMemo(() => {
    if (isCover || isWeb || !natural) return null;
    return containVideoBox(containerWidth, containerHeight, natural.width, natural.height);
  }, [isCover, isWeb, natural, containerWidth, containerHeight]);

  const videoOuterStyle: ViewStyle = useMemo(() => {
    if (isCover) return StyleSheet.absoluteFillObject;
    if (isWeb) return { width: "100%", height: "100%" };
    if (fitted) return { width: fitted.width, height: fitted.height };
    return { width: containerWidth, height: containerHeight };
  }, [isCover, isWeb, fitted, containerWidth, containerHeight]);

  const resizeMode = isCover ? ResizeMode.COVER : ResizeMode.CONTAIN;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (shouldPlay) v.playAsync().catch(() => {});
    else v.pauseAsync().catch(() => {});
  }, [shouldPlay, activeUri]);

  const tryNextPlaybackSource = React.useCallback(() => {
    setSourceIndex((idx) => (idx + 1 < playbackSources.length ? idx + 1 : idx));
  }, [playbackSources.length]);

  React.useImperativeHandle(ref, () => ({
    seekToRatio: async (ratio: number) => {
      const target = Math.max(0, Math.min(1, ratio));
      let dur = durationRef.current;
      if (!dur || !Number.isFinite(dur)) {
        const status = await videoRef.current?.getStatusAsync();
        if (status?.isLoaded) {
          dur = Number(status.durationMillis || 0);
          durationRef.current = dur;
        }
      }
      if (!dur || !Number.isFinite(dur)) return;
      await videoRef.current?.setPositionAsync(Math.round(dur * target));
    }
  }));

  if (blocked) {
    return (
      <View
        style={{
          width: containerWidth,
          height: containerHeight,
          backgroundColor: APP_DARK_BG,
          justifyContent: "center",
          alignItems: "center"
        }}
      >
        {posterUri ? (
          <Image source={{ uri: posterUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        ) : null}
      </View>
    );
  }

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
        key={activeUri}
        ref={(r) => {
          videoRef.current = r;
        }}
        source={{ uri: activeUri }}
        shouldPlay={shouldPlay}
        isLooping={isLooping}
        isMuted={isMuted || preloadOnly}
        useNativeControls={false}
        usePoster={!!posterUri}
        posterSource={posterUri ? { uri: posterUri } : undefined}
        resizeMode={resizeMode}
        style={videoOuterStyle}
        videoStyle={isWeb ? webVideoObjectFitStyle(isCover ? "cover" : "contain") : undefined}
        onPlaybackStatusUpdate={(status) => {
          onStatusUpdate?.(status);
          if (status.isLoaded) {
            durationRef.current = Number(status.durationMillis || 0);
            const { width, height } = readVideoSizeFromPlaybackStatus(status);
            if (width > 0 && height > 0 && (fit === "auto" || !isCover)) {
              setNatural((prev) =>
                prev?.width === width && prev?.height === height ? prev : { width, height }
              );
            }
            if (isOversizedFeedVideo(width, height)) {
              setBlocked(true);
              void videoRef.current?.pauseAsync().catch(() => {});
              void videoRef.current?.unloadAsync().catch(() => {});
            }
          } else if ("error" in status && status.error && sourceIndex + 1 < playbackSources.length) {
            tryNextPlaybackSource();
          }
        }}
        onReadyForDisplay={
          isCover && fit !== "auto"
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

function ReelLikeBurst({
  postId,
  trigger,
  seenRef
}: {
  postId: number;
  trigger: number;
  seenRef: React.MutableRefObject<Record<number, number>>;
}) {
  const [hearts, setHearts] = useState<
    Array<{ id: string; progress: Animated.Value; leftPct: number; topPct: number; xFrom: number; xTo: number; yLift: number; size: number; delay: number }>
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
        Animated.timing(h.progress, { toValue: 1, duration: 900, useNativeDriver: true })
      ]).start();
    });
    const timer = setTimeout(() => setHearts([]), 1200);
    return () => clearTimeout(timer);
  }, [postId, seenRef, trigger]);

  if (!hearts.length) return null;
  return (
    <View style={styles.reelLikeBurstLayer} pointerEvents="none">
      {hearts.map((h) => (
        <Animated.View
          key={h.id}
          style={{
            position: "absolute",
            left: `${h.leftPct}%`,
            top: `${h.topPct}%`,
            opacity: h.progress.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
            transform: [
              { translateX: h.progress.interpolate({ inputRange: [0, 1], outputRange: [h.xFrom, h.xTo] }) },
              { translateY: h.progress.interpolate({ inputRange: [0, 1], outputRange: [0, -h.yLift] }) },
              { scale: h.progress.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.4, 1.15, 0.85] }) }
            ]
          }}
        >
          <Ionicons name="heart" size={h.size} color="#C9FF35" />
        </Animated.View>
      ))}
    </View>
  );
}

function normalizeCommentRow(c: Partial<HomeCommentRow> & Record<string, unknown>): HomeCommentRow {
  const pidRaw = c.parentCommentId ?? c["parent_comment_id"];
  const parentCommentId =
    pidRaw != null && String(pidRaw).trim() !== "" && String(pidRaw) !== "null" ? String(pidRaw).trim() : undefined;
  const avRaw = c.avatarUrl ?? c["avatar_url"];
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

function mergeRemoteAndLocalComments(remote: HomeCommentRow[], local: HomeCommentRow[]): HomeCommentRow[] {
  const remoteIds = new Set(remote.map((c) => String(c.id)));
  const merged = [...remote];
  for (const c of local) {
    if (!remoteIds.has(String(c.id))) merged.push(c);
  }
  return merged.sort((a, b) => {
    const ta = Date.parse(a.createdAt || "") || 0;
    const tb = Date.parse(b.createdAt || "") || 0;
    return tb - ta || String(b.id).localeCompare(String(a.id));
  });
}

function commentAgeLabel(createdAt?: string): string {
  const ms = Date.parse(String(createdAt || ""));
  if (!Number.isFinite(ms)) return "";
  const diffMs = Date.now() - ms;
  const mins = Math.max(1, Math.floor(diffMs / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(days / 365)}y`;
}

export function PostsReelViewerModal({
  visible,
  posts,
  initialIndex,
  initialCommentsPostId = null,
  onClose,
  onPostsChange,
  canDeleteOwnPosts = false,
  followingPeers,
  onAddToStory
}: PostsReelViewerModalProps) {
  const { user, token } = useAuth();
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const [viewerPosts, setViewerPosts] = useState<HomePost[]>([]);
  const [playingPostId, setPlayingPostId] = useState<number | null>(null);
  const [isReelMuted, setIsReelMuted] = useState(Platform.OS === "web");
  const [reelUserPaused, setReelUserPaused] = useState(false);
  const [reelMuteFeedback, setReelMuteFeedback] = useState<"muted" | "unmuted" | null>(null);
  const [likeBusyByPostId, setLikeBusyByPostId] = useState<Record<number, boolean>>({});
  const likeToggleInFlightRef = useRef<Record<number, boolean>>({});
  const postLikedByIdRef = useRef<Record<number, boolean>>({});
  const viewerPostsRef = useRef(viewerPosts);
  viewerPostsRef.current = viewerPosts;
  const [reelLikeBurstByPostId, setReelLikeBurstByPostId] = useState<Record<number, number>>({});
  const [carouselPageByPostId, setCarouselPageByPostId] = useState<Record<number, number>>({});
  const [reelProgressByPostId, setReelProgressByPostId] = useState<Record<number, { position: number; duration: number }>>({});
  const [activeCommentsPost, setActiveCommentsPost] = useState<HomePost | null>(null);
  const [commentsByPost, setCommentsByPost] = useState<Record<number, HomeCommentRow[]>>({});
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const commentSubmittingRef = useRef(false);
  const [optionsPost, setOptionsPost] = useState<HomePost | null>(null);
  const [reportTargetPost, setReportTargetPost] = useState<HomePost | null>(null);
  const [saveBusyByPostId, setSaveBusyByPostId] = useState<Record<number, boolean>>({});
  const [shareTargetPost, setShareTargetPost] = useState<HomePost | null>(null);
  const [repostTargetPost, setRepostTargetPost] = useState<HomePost | null>(null);

  const reelLikeBurstSeenRef = useRef<Record<number, number>>({});
  const reelVideoHandlesRef = useRef<Record<number, ContainedExpoVideoHandle | null>>({});
  const reelTapTsRef = useRef<Record<number, number>>({});
  const reelTapTimeoutRef = useRef<Record<number, ReturnType<typeof setTimeout> | null>>({});
  const reelMuteFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commentsFetchSeqRef = useRef(0);
  const reelViewerListRef = useRef<FlatList<HomePost> | null>(null);

  useEffect(() => {
    for (const p of viewerPosts) {
      postLikedByIdRef.current[p.id] = !!p.viewerHasLiked;
    }
  }, [viewerPosts]);

  useEffect(() => {
    const keepOn = visible && playingPostId != null && !reelUserPaused;
    if (!keepOn) {
      deactivateKeepAwake("reel-viewer");
      return;
    }
    void activateKeepAwakeAsync("reel-viewer");
    return () => {
      deactivateKeepAwake("reel-viewer");
    };
  }, [visible, playingPostId, reelUserPaused]);

  const readPostEngagement = useCallback((postId: number, fallback?: HomePost) => {
    const p = viewerPostsRef.current.find((row) => row.id === postId) || fallback;
    const liked = !!(postLikedByIdRef.current[postId] ?? p?.viewerHasLiked);
    const count = Math.max(0, Number(p?.likesCount) || 0);
    return { liked, count };
  }, []);

  const displayPersonName = useCallback((name: string) => formatDisplayName(name, language, t), [language, t]);
  const displayFeedCopy = useCallback((text: string) => formatFeedText(text, language, t), [language, t]);
  const displayPostCaption = useCallback(
    (caption?: string | null) => formatReelCaption(caption, language, t),
    [language, t]
  );

  const openPostAuthorProfile = useCallback(
    (post: HomePost) => {
      const postUserId = Number(post.userId);
      const isOwn = viewerOwnsPost(post, user ? { id: user.id, fullName: user.fullName } : null);
      onClose();
      if (isOwn) {
        navigateToMyProfile();
        return;
      }
      navigateToPublicProfile({
        userId: postUserId > 0 ? postUserId : undefined,
        userName: resolvePersonDisplayName({ fullName: post.userName, fallback: post.userName }),
        avatarUrl: post.authorAvatarUrl ?? null
      });
    },
    [onClose, user]
  );

  const openReposterProfile = useCallback(
    (post: HomePost) => {
      const repost = post.repost;
      if (!repost) return;
      const reposterId = Number(repost.byUserId);
      const isOwn = reposterId > 0 && reposterId === Number(user?.id);
      onClose();
      if (isOwn) {
        navigateToMyProfile();
        return;
      }
      navigateToPublicProfile({
        userId: reposterId > 0 ? reposterId : undefined,
        userName: resolvePersonDisplayName({ fullName: repost.byUserName, fallback: repost.byUserName }),
        avatarUrl: repost.byAvatarUrl ?? null
      });
    },
    [onClose, user?.id]
  );

  const applyPosts = useCallback(
    (updater: (prev: HomePost[]) => HomePost[]) => {
      setViewerPosts((prev) => {
        const next = updater(prev);
        onPostsChange(next);
        return next;
      });
    },
    [onPostsChange]
  );

  useEffect(() => {
    if (!visible) {
      setPlayingPostId(null);
      setActiveCommentsPost(null);
      setOptionsPost(null);
      setCommentDraft("");
      return;
    }
    const nextPosts = posts.length ? posts : [];
    setViewerPosts(nextPosts);
    const ix = Math.max(0, Math.min(initialIndex, Math.max(0, nextPosts.length - 1)));
    const post = nextPosts[ix];
    const nextPlayingId = post?.id ?? null;
    setPlayingPostId(nextPlayingId);
    setIsReelMuted(Platform.OS === "web");
    setReelUserPaused(false);
    setReelMuteFeedback(null);
    if (Platform.OS !== "web" && nextPlayingId) {
      const timer = setTimeout(() => setPlayingPostId(nextPlayingId), 80);
      return () => clearTimeout(timer);
    }
  }, [visible, posts, initialIndex]);

  useEffect(() => {
    if (!visible || Platform.OS === "web") return;
    void Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
      shouldDuckAndroid: true,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      playThroughEarpieceAndroid: false
    });
  }, [visible]);

  useEffect(() => {
    setReelUserPaused(false);
  }, [playingPostId]);

  const triggerReelLikeBurst = useCallback((postId: number) => {
    setReelLikeBurstByPostId((prev) => ({ ...prev, [postId]: (prev[postId] || 0) + 1 }));
  }, []);

  const togglePostLike = useCallback(
    async (post: HomePost) => {
      const postId = post.id;
      if (likeToggleInFlightRef.current[postId]) return;
      likeToggleInFlightRef.current[postId] = true;
      const { liked: likedNow, count: countNow } = readPostEngagement(postId, post);
      const nextLiked = !likedNow;
      const prevSnapshot = { liked: likedNow, count: countNow };

      applyPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, viewerHasLiked: nextLiked, likesCount: Math.max(0, p.likesCount + (nextLiked ? 1 : -1)) }
            : p
        )
      );
      postLikedByIdRef.current = { ...postLikedByIdRef.current, [postId]: nextLiked };

      void setLocalPostLikedByIdentity(post.id, {
        name: user?.fullName || user?.username || "You",
        key: user?.username || user?.email || "",
        userId: user?.id
      }, nextLiked).then((localResult) => {
        applyPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  viewerHasLiked: localResult.liked
                }
              : p
          )
        );
        postLikedByIdRef.current = { ...postLikedByIdRef.current, [postId]: localResult.liked };
      });

      if (!token) {
        likeToggleInFlightRef.current[postId] = false;
        return;
      }

      setLikeBusyByPostId((prev) => ({ ...prev, [postId]: true }));
      try {
        const res = nextLiked ? await likeHomePost(token, postId) : await unlikeHomePost(token, postId);
        applyPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, viewerHasLiked: res.liked, likesCount: res.likesCount ?? p.likesCount } : p
          )
        );
        postLikedByIdRef.current = { ...postLikedByIdRef.current, [postId]: res.liked };
      } catch {
        applyPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, viewerHasLiked: prevSnapshot.liked, likesCount: prevSnapshot.count } : p))
        );
        postLikedByIdRef.current = { ...postLikedByIdRef.current, [postId]: prevSnapshot.liked };
      } finally {
        setLikeBusyByPostId((prev) => ({ ...prev, [postId]: false }));
        likeToggleInFlightRef.current[postId] = false;
      }
    },
    [applyPosts, readPostEngagement, token, user?.email, user?.fullName, user?.id, user?.username]
  );

  const applyRepostState = useCallback(
    (postId: number, reshared: boolean, quoteCaption?: string, resharesCount?: number) => {
      applyPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          const nextResharesCount =
            resharesCount ??
            Math.max(
              0,
              (p.resharesCount ?? 0) + (reshared && !p.viewerHasReshared ? 1 : !reshared && p.viewerHasReshared ? -1 : 0)
            );
          return {
            ...p,
            viewerHasReshared: reshared,
            resharesCount: nextResharesCount,
            ...(quoteCaption !== undefined ? { reshareQuoteCaption: quoteCaption } : {})
          };
        })
      );
    },
    [applyPosts]
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

  const onReelSurfaceTap = useCallback(
    (post: HomePost) => {
      if (!post.videoUrl && !postImageGallery(post).length) return;
      const now = Date.now();
      const lastTap = reelTapTsRef.current[post.id] || 0;
      if (now - lastTap <= 420) {
        const pending = reelTapTimeoutRef.current[post.id];
        if (pending) clearTimeout(pending);
        reelTapTimeoutRef.current[post.id] = null;
        reelTapTsRef.current[post.id] = 0;
        triggerReelLikeBurst(post.id);
        if (!postLikedByIdRef.current[post.id]) void togglePostLike(post);
        return;
      }
      reelTapTsRef.current[post.id] = now;
      const pending = reelTapTimeoutRef.current[post.id];
      if (pending) clearTimeout(pending);
      reelTapTimeoutRef.current[post.id] = setTimeout(() => {
        reelTapTimeoutRef.current[post.id] = null;
        if (!post.videoUrl) return;
        setReelUserPaused((prev) => {
          const next = !prev;
          setIsReelMuted(next);
          setReelMuteFeedback(null);
          return next;
        });
      }, 220);
    },
    [togglePostLike, triggerReelLikeBurst]
  );

  const openCommentsForPost = useCallback(
    (post: HomePost) => {
      setActiveCommentsPost(post);
      setCommentDraft("");
      const reqKey = ++commentsFetchSeqRef.current;
      setCommentsLoading(true);
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
        setCommentsByPost((prev) => ({ ...prev, [post.id]: mergeRemoteAndLocalComments(remote, localRows) }));
        setCommentsLoading(false);
      })();
    },
    [token]
  );

  useEffect(() => {
    if (!visible || !initialCommentsPostId || !viewerPosts.length) return;
    const targetPost = viewerPosts.find((p) => p.id === initialCommentsPostId);
    if (!targetPost) return;
    const timer = setTimeout(() => {
      openCommentsForPost(targetPost);
    }, 80);
    return () => clearTimeout(timer);
  }, [initialCommentsPostId, openCommentsForPost, viewerPosts, visible]);

  const submitComment = useCallback(async () => {
    const text = commentDraft.trim();
    if (!text || !activeCommentsPost || commentSubmittingRef.current) return;
    commentSubmittingRef.current = true;
    setCommentSubmitting(true);
    const post = activeCommentsPost;

    try {
    if (token) {
      try {
        const res = await createHomePostComment(token, post.id, text);
        const row: HomeCommentRow = {
          id: String(res.comment.id),
          user: res.comment.user || user?.fullName || "You",
          text: res.comment.text || text,
          likes: res.comment.likes ?? 0,
          createdAt: new Date().toISOString(),
          ...(user?.avatarUrl ? { avatarUrl: user.avatarUrl } : {})
        };
        setCommentsByPost((prev) => {
          const list = prev[post.id] ?? [];
          const withoutDup = list.filter((c) => String(c.id) !== row.id);
          return { ...prev, [post.id]: [row, ...withoutDup] };
        });
        applyPosts((prev) =>
          prev.map((p) => (p.id === post.id ? { ...p, commentsCount: res.commentsCount ?? (p.commentsCount ?? 0) + 1 } : p))
        );
        setCommentDraft("");
        return;
      } catch {
        Alert.alert(t("shareFailed"), "Could not post comment. Check your connection and try again.");
        return;
      }
    }

    const localRow = await addLocalCommentForPost({
      postId: post.id,
      user: user?.fullName || "You",
      userKey: user?.username || user?.email,
      text
    });
    if (!localRow) return;
    setCommentsByPost((prev) => {
      const list = prev[post.id] ?? [];
      const row = normalizeCommentRow(localRow as HomeCommentRow & Record<string, unknown>);
      return { ...prev, [post.id]: [row, ...list] };
    });
    applyPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, commentsCount: (p.commentsCount ?? 0) + 1 } : p))
    );
    setCommentDraft("");
    } finally {
      commentSubmittingRef.current = false;
      setCommentSubmitting(false);
    }
  }, [activeCommentsPost, applyPosts, commentDraft, t, token, user?.avatarUrl, user?.fullName]);

  const confirmDeletePost = useCallback(
    (post: HomePost) => {
      if (!canDeleteOwnPosts || !viewerOwnsPost(post, user ? { id: user.id, fullName: user.fullName } : null)) return;
      if (!token) {
        Alert.alert(t("loginRequired"), t("loginRequiredDelete"));
        return;
      }

      const runDelete = async () => {
        try {
          await deleteHomePost(token, post.id);
          setOptionsPost(null);
          applyPosts((prev) => {
            const deletedIx = prev.findIndex((p) => p.id === post.id);
            const next = prev.filter((p) => p.id !== post.id);
            if (next.length === 0) {
              onClose();
            } else {
              setPlayingPostId((cur) => {
                if (cur !== post.id) return cur;
                const nextIx = Math.min(deletedIx >= 0 ? deletedIx : 0, next.length - 1);
                return next[nextIx]?.id ?? next[0]?.id ?? null;
              });
            }
            return next;
          });
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "Could not delete this post.";
          if (Platform.OS === "web" && typeof window !== "undefined") window.alert(msg);
          else Alert.alert(t("deleteFailed"), msg);
        }
      };

      setOptionsPost(null);
      if (Platform.OS === "web" && typeof window !== "undefined") {
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
    [applyPosts, canDeleteOwnPosts, onClose, t, token, user]
  );

  const togglePostSave = useCallback(
    async (post: HomePost) => {
      if (!token) {
        Alert.alert(t("loginRequired"), t("loginRequiredSave"));
        return;
      }
      setSaveBusyByPostId((prev) => ({ ...prev, [post.id]: true }));
      try {
        const res = post.viewerHasSaved ? await unsaveHomePost(token, post.id) : await saveHomePost(token, post.id);
        applyPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, viewerHasSaved: res.saved } : p)));
        setOptionsPost((cur) => (cur?.id === post.id ? { ...cur, viewerHasSaved: res.saved } : cur));
      } catch {
        Alert.alert(t("savePostFailed"));
      } finally {
        setSaveBusyByPostId((prev) => ({ ...prev, [post.id]: false }));
      }
    },
    [applyPosts, t, token]
  );

  const onCopyPostLink = useCallback(
    async (post: HomePost) => {
      try {
        await Clipboard.setStringAsync(buildPostShareLink(post));
        setOptionsPost(null);
        Alert.alert(t("copied"), t("copiedPostLink"));
      } catch {
        Alert.alert(t("copyFailedTitle"), t("copyFailed"));
      }
    },
    [t]
  );

  const onNotInterestedInPost = useCallback(
    (post: HomePost) => {
      applyPosts((prev) => {
        const deletedIx = prev.findIndex((p) => p.id === post.id);
        const next = prev.filter((p) => p.id !== post.id);
        if (next.length === 0) {
          onClose();
        } else {
          setPlayingPostId((cur) => {
            if (cur !== post.id) return cur;
            const nextIx = Math.min(deletedIx >= 0 ? deletedIx : 0, next.length - 1);
            return next[nextIx]?.id ?? next[0]?.id ?? null;
          });
        }
        return next;
      });
      setOptionsPost(null);
      Alert.alert(t("gotItHidePost"), t("gotItHidePostMsg"));
    },
    [applyPosts, onClose, t]
  );

  const onReportPost = useCallback(
    (post: HomePost) => {
      setOptionsPost(null);
      if (!token) {
        Alert.alert(t("loginRequired"), t("loginRequiredReport"));
        return;
      }
      setReportTargetPost(post);
    },
    [token, t]
  );

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const ordered = viewableItems
      .filter((v) => v.isViewable && v.item != null)
      .map((v) => ({ post: v.item as HomePost, index: v.index ?? 0 }))
      .sort((a, b) => a.index - b.index);
    if (!ordered.length) return;
    setPlayingPostId(ordered[ordered.length - 1].post.id);
  }, []);

  const viewabilityCallbackRef = useRef(onViewableItemsChanged);
  viewabilityCallbackRef.current = onViewableItemsChanged;

  const onViewableItemsChangedRef = useRef((info: { viewableItems: ViewToken[]; changed: ViewToken[] }) => {
    viewabilityCallbackRef.current(info);
  });

  const viewabilityConfig = useMemo(() => ({ itemVisiblePercentThreshold: 35, minimumViewTime: 0 }), []);

  const onReelViewerMomentumEnd = useCallback(
    (offsetY: number) => {
      if (!visible || windowHeight <= 0 || !viewerPosts.length) return;
      const index = Math.max(0, Math.min(viewerPosts.length - 1, Math.round(offsetY / windowHeight)));
      const post = viewerPosts[index];
      setPlayingPostId(post?.id ?? null);
    },
    [visible, viewerPosts, windowHeight]
  );

  const intendedPlayingId = useMemo(() => {
    if (!visible || !posts.length) return null;
    const ix = Math.max(0, Math.min(initialIndex, posts.length - 1));
    return posts[ix]?.id ?? null;
  }, [initialIndex, posts, visible]);

  const effectivePlayingId = playingPostId ?? intendedPlayingId;
  const modalTopInset = useModalTopChromeInset();

  const reelBottomInset = useMemo(() => {
    if (Platform.OS === "android") return Math.max(insets.bottom, 24);
    return Math.max(insets.bottom, 16);
  }, [insets.bottom]);

  const renderReelPage = useCallback(
    ({ item: post, index }: { item: HomePost; index: number }) => {
      const pageH = windowHeight;
      const reelContentWidth = windowWidth;
      const isActiveVideo = effectivePlayingId === post.id && !!post.videoUrl;
      const shouldPlayVideo = isActiveVideo && !reelUserPaused;
      const gallery = postImageGallery(post);
      const isCarousel = gallery.length > 1;
      const carouselPage = carouselPageByPostId[post.id] ?? 0;
      const thumbUri = reelGridStillUri(post);
      const reelPoster = reelGridStillUri(post);
      const reelProgress = reelProgressByPostId[post.id];
      const progressRatio = reelProgress?.duration ? reelProgress.position / reelProgress.duration : 0;
      const creativeMeta = post.creativeMeta || {};
      const creativeTint = reelCreativeFilterTint(creativeMeta.filter);
      const creativeOverlayTextRaw = String(creativeMeta.overlayText || "").trim();
      const creativeTextColor = reelCreativeTextColor(creativeMeta.textColor);
      const musicLabel = postMusicDisplayLabel(post, language, t);
      const showMusicRow = postShowsMusicRow(post) && !!musicLabel;
      const reelCaptionText = displayPostCaption(post.caption);
      const reelDisplayName = displayPersonName(post.userName);
      const reelOverlayText = creativeOverlayTextRaw ? displayFeedCopy(creativeOverlayTextRaw) : "";
      const showVolumeControl = postShowsVolumeControl(post);
      const postComments = commentsByPost[post.id] ?? [];
      const shownCommentsCount = Math.max(Number(post.commentsCount ?? 0), postComments.length);
      const shownRepostsCount = shownResharesCount(post);
      const mediaContentH = pageH - modalTopInset - reelBottomInset;
      const mediaFrameStyle = {
        position: "absolute" as const,
        left: 0,
        right: 0,
        top: modalTopInset,
        bottom: reelBottomInset
      };

      return (
        <View style={[styles.reelPage, { height: pageH, width: reelContentWidth, backgroundColor: reelPlayerBackground(index) }]}>
          {post.videoUrl && isActiveVideo ? (
            <Pressable style={mediaFrameStyle} onPress={() => onReelSurfaceTap(post)}>
              <ContainedExpoVideo
                ref={(r) => {
                  reelVideoHandlesRef.current[post.id] = r;
                }}
                uri={videoPlaybackUrl(post.videoUrl)}
                shouldPlay={shouldPlayVideo}
                containerWidth={reelContentWidth}
                containerHeight={mediaContentH}
                fit="auto"
                posterUri={reelPoster || undefined}
                isLooping
                isMuted={isReelMuted}
                onStatusUpdate={(status) => onReelStatusUpdate(post.id, status)}
              />
              {reelUserPaused ? (
                <View style={styles.reelPauseOverlay} pointerEvents="none">
                  <Ionicons name="volume-mute" size={24} color="#fff" style={styles.reelPauseMuteIcon} />
                  <Ionicons name="play" size={48} color="#fff" />
                </View>
              ) : null}
            </Pressable>
          ) : post.videoUrl && reelPoster ? (
            <Pressable style={mediaFrameStyle} onPress={() => onReelSurfaceTap(post)}>
              <Image source={{ uri: reelPoster }} style={StyleSheet.absoluteFillObject} resizeMode="contain" />
            </Pressable>
          ) : isCarousel ? (
            <ScrollView
              horizontal
              pagingEnabled
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              style={{ width: reelContentWidth, height: mediaContentH, position: "absolute", left: 0, right: 0, top: modalTopInset }}
              contentContainerStyle={{ width: reelContentWidth * gallery.length }}
              onScroll={(e) => {
                const w = e.nativeEvent.layoutMeasurement.width || reelContentWidth;
                if (w <= 0) return;
                const page = carouselIndexFromOffset(e.nativeEvent.contentOffset.x, w, gallery.length - 1);
                setCarouselPageByPostId((prev) => (prev[post.id] === page ? prev : { ...prev, [post.id]: page }));
              }}
              scrollEventThrottle={16}
            >
              {gallery.map((uri, i) => (
                <Pressable
                  key={`profile-reel-carousel-${post.id}-${i}`}
                  style={{ width: reelContentWidth, height: mediaContentH, backgroundColor: "#000", alignItems: "center", justifyContent: "center" }}
                  onPress={() => onReelSurfaceTap(post)}
                >
                  <Image source={{ uri }} style={{ width: reelContentWidth, height: mediaContentH }} resizeMode="contain" />
                </Pressable>
              ))}
            </ScrollView>
          ) : reelPoster ? (
            <Pressable style={mediaFrameStyle} onPress={() => onReelSurfaceTap(post)}>
              <Image source={{ uri: reelPoster }} style={styles.reelVideoFull} resizeMode="contain" />
            </Pressable>
          ) : (
            <Pressable style={mediaFrameStyle} onPress={() => onReelSurfaceTap(post)}>
              <View style={[styles.reelVideoFull, { backgroundColor: reelPlayerBackground(index) }]} />
            </Pressable>
          )}
          {isCarousel ? (
            <View style={[styles.carouselDotsWrap, { bottom: Math.max(reelBottomInset + 92, 112) }]} pointerEvents="none">
              {gallery.map((_, dotIndex) => (
                <View
                  key={`carousel-dot-${post.id}-${dotIndex}`}
                  style={[styles.carouselDot, dotIndex === carouselPage ? styles.carouselDotActive : null]}
                />
              ))}
            </View>
          ) : null}
          {creativeTint ? <View style={[styles.reelCreativeFilterLayer, { backgroundColor: creativeTint }]} pointerEvents="none" /> : null}
          {reelOverlayText ? (
            <View style={styles.reelCreativeTextWrap} pointerEvents="none">
              <Text style={[styles.reelCreativeText, { color: creativeTextColor }]} numberOfLines={2}>
                {reelOverlayText}
              </Text>
            </View>
          ) : null}
          <LinearGradient colors={["transparent", "rgba(0,0,0,0.45)", "rgba(0,0,0,0.92)"]} locations={[0.25, 0.55, 1]} style={styles.reelGradient} pointerEvents="none" />
          <ReelLikeBurst postId={post.id} trigger={reelLikeBurstByPostId[post.id] || 0} seenRef={reelLikeBurstSeenRef} />
          <View style={[styles.reelOverlayWrap, { paddingBottom: Math.max(18, reelBottomInset + 14) }]} pointerEvents="box-none">
            <View style={styles.reelLeftMeta} pointerEvents="auto">
              {post.repost ? (
                <RepostAttribution
                  variant="reel"
                  byUserName={displayPersonName(post.repost.byUserName)}
                  byAvatarUrl={post.repost.byAvatarUrl}
                  actionLabel={t("repostedAction")}
                  onPress={() => openReposterProfile(post)}
                />
              ) : null}
              <View style={styles.reelUserFollowRow}>
                <View style={styles.reelAuthorTap}>
                  <StoryRingAvatar
                    uri={postAuthorAvatarUri(post, user)}
                    name={post.userName}
                    userId={post.userId}
                    userName={post.userName}
                    size={44}
                    onPressFallback={() => openPostAuthorProfile(post)}
                    accessibilityLabel={reelDisplayName}
                  />
                  <Pressable onPress={() => openPostAuthorProfile(post)} accessibilityRole="button">
                    <Text style={styles.reelUserName} numberOfLines={1}>
                      {reelDisplayName}
                    </Text>
                  </Pressable>
                </View>
              </View>
              {showMusicRow ? (
                <View style={styles.reelMusicRow}>
                  <Ionicons name="musical-notes" size={14} color="rgba(255,255,255,0.95)" />
                  <Text style={styles.reelMusicText} numberOfLines={1}>
                    {musicLabel}
                  </Text>
                </View>
              ) : null}
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
                >
                  <Ionicons
                    name={post.viewerHasLiked ? "heart" : "heart-outline"}
                    size={REEL_ACTION_ICON_LIKE}
                    color={post.viewerHasLiked ? APP_LIME : REEL_LIKE_COLOR}
                  />
                </Pressable>
                <Text style={[styles.reelActionCount, post.viewerHasLiked ? styles.reelActionCountLiked : null]}>
                  {post.likesCount}
                </Text>
              </View>
              <Pressable style={styles.reelActionItem} onPress={() => openCommentsForPost(post)}>
                <Ionicons name="chatbubble-outline" size={REEL_ACTION_ICON} color="#fff" />
                <Text style={styles.reelActionCount}>{shownCommentsCount}</Text>
              </Pressable>
              <Pressable style={styles.reelActionItem} onPress={() => setShareTargetPost(post)}>
                <Ionicons name="paper-plane-outline" size={REEL_ACTION_ICON} color="#fff" />
              </Pressable>
              <Pressable
                style={styles.reelActionItem}
                onPress={() => setRepostTargetPost(post)}
                accessibilityRole="button"
                accessibilityLabel={post.viewerHasReshared ? t("removeRepost") : t("repost")}
              >
                <Ionicons
                  name={post.viewerHasReshared ? "repeat" : "repeat-outline"}
                  size={REEL_ACTION_ICON}
                  color={post.viewerHasReshared ? APP_LIME : "#fff"}
                />
                <Text style={[styles.reelActionCount, post.viewerHasReshared ? styles.reelActionCountLiked : null]}>
                  {shownRepostsCount}
                </Text>
              </Pressable>
              <Pressable style={styles.reelActionItem} onPress={() => setOptionsPost(post)}>
                <Ionicons name="ellipsis-horizontal" size={REEL_ACTION_ICON} color="#fff" />
              </Pressable>
              {showVolumeControl ? (
                <Pressable style={styles.reelActionItem} onPress={() => setIsReelMuted((v) => !v)}>
                  <Ionicons name={isReelMuted ? "volume-mute-outline" : "volume-high-outline"} size={REEL_ACTION_ICON} color="#fff" />
                </Pressable>
              ) : null}
              {thumbUri ? (
                <Image source={{ uri: thumbUri }} style={styles.reelDiscThumb} />
              ) : (
                <View style={[styles.reelDiscThumb, styles.reelDiscThumbPlaceholder]} />
              )}
            </View>
          </View>
          {post.videoUrl ? (
            <View style={styles.reelSeekWrap} pointerEvents="auto">
              <ReelSeekBar
                progressRatio={progressRatio}
                onSeek={(ratio) => {
                  const duration = reelProgress?.duration;
                  if (duration) {
                    setReelProgressByPostId((prev) => ({
                      ...prev,
                      [post.id]: { position: ratio * duration, duration }
                    }));
                  }
                  void reelVideoHandlesRef.current[post.id]?.seekToRatio(ratio);
                }}
              />
            </View>
          ) : null}
        </View>
      );
    },
    [
      commentsByPost,
      displayFeedCopy,
      displayPersonName,
      displayPostCaption,
      insets.bottom,
      isReelMuted,
      reelUserPaused,
      likeBusyByPostId,
      onReelStatusUpdate,
      onReelSurfaceTap,
      openCommentsForPost,
      openPostAuthorProfile,
      openReposterProfile,
      effectivePlayingId,
      reelLikeBurstByPostId,
      reelProgressByPostId,
      setRepostTargetPost,
      carouselPageByPostId,
      setShareTargetPost,
      language,
      t,
      togglePostLike,
      triggerReelLikeBurst,
      user,
      viewerPosts,
      reelBottomInset,
      modalTopInset,
      windowHeight,
      windowWidth
    ]
  );

  const safeInitialIndex =
    visible && viewerPosts.length > 0 ? Math.max(0, Math.min(initialIndex, viewerPosts.length - 1)) : 0;
  const activePlayingPost = viewerPosts.find((p) => p.id === effectivePlayingId);

  useEffect(() => {
    if (!visible || windowHeight <= 0 || safeInitialIndex <= 0) return;
    const timer = setTimeout(() => {
      reelViewerListRef.current?.scrollToIndex({ index: safeInitialIndex, animated: false });
    }, 0);
    return () => clearTimeout(timer);
  }, [safeInitialIndex, visible, windowHeight, viewerPosts.length]);

  if (!visible) return null;

  return (
    <>
      <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
        <View style={{ flex: 1, backgroundColor: APP_DARK_BG }}>
          <View style={[styles.reelViewerTopChrome, { paddingTop: modalTopInset }]} pointerEvents="box-none">
            <Pressable onPress={onClose} hitSlop={14} style={styles.reelViewerBackBtn} accessibilityRole="button" accessibilityLabel="Go back">
              <Ionicons name="arrow-back-outline" size={28} color="#fff" />
            </Pressable>
          </View>
          {reelMuteFeedback &&
          !reelUserPaused &&
          activePlayingPost &&
          postShowsVolumeControl(activePlayingPost) ? (
            <View style={styles.reelMuteFeedbackLayer} pointerEvents="none">
              <View style={styles.reelMuteFeedbackBubble}>
                <Ionicons name={reelMuteFeedback === "muted" ? "volume-mute" : "volume-high"} size={44} color="#fff" />
              </View>
            </View>
          ) : null}
          {viewerPosts.length > 0 && windowHeight > 0 ? (
            <FlatList
              ref={(r) => {
                reelViewerListRef.current = r;
              }}
              data={viewerPosts}
              keyExtractor={(item) => `profile-reel-viewer-${item.id}`}
              renderItem={renderReelPage}
              pagingEnabled
              showsVerticalScrollIndicator={false}
              snapToInterval={windowHeight}
              snapToAlignment="start"
              decelerationRate="fast"
              disableIntervalMomentum
              initialScrollIndex={
                safeInitialIndex > 0 && safeInitialIndex < viewerPosts.length ? safeInitialIndex : undefined
              }
              getItemLayout={(_data, idx) => ({ length: windowHeight, offset: windowHeight * idx, index: idx })}
              onViewableItemsChanged={onViewableItemsChangedRef.current}
              viewabilityConfig={viewabilityConfig}
              onMomentumScrollEnd={(e) => onReelViewerMomentumEnd(e.nativeEvent.contentOffset.y)}
              onScrollToIndexFailed={(info) => {
                reelViewerListRef.current?.scrollToOffset({
                  offset: info.averageItemLength * info.index,
                  animated: false
                });
              }}
              extraData={`${effectivePlayingId}-${reelUserPaused}-${isReelMuted}-${windowHeight}-${viewerPosts
                .map((p) => `${p.id}:${p.viewerHasLiked ? 1 : 0}:${p.likesCount}`)
                .join(",")}`}
              initialNumToRender={Math.min(3, viewerPosts.length || 1)}
              maxToRenderPerBatch={2}
              windowSize={3}
              removeClippedSubviews={false}
            />
          ) : null}
        </View>
      </Modal>

      <Modal visible={!!activeCommentsPost} transparent animationType="fade" onRequestClose={() => setActiveCommentsPost(null)}>
        <View style={styles.commentsSheetRoot}>
          <Pressable style={styles.commentsSheetBackdrop} onPress={() => setActiveCommentsPost(null)} />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={[styles.commentsSheetContainer, { height: Math.round(windowHeight * 0.5) }]}
          >
            <View style={[styles.commentsSheetPanel, { paddingBottom: Math.max(insets.bottom, 10) }]}>
              <View style={styles.commentsSheetHandle} />
              <View style={styles.commentsSheetHeader}>
                <Pressable onPress={() => setActiveCommentsPost(null)} hitSlop={12}>
                  <Ionicons name="chevron-down" size={28} color="#C9FF35" />
                </Pressable>
                <Text style={styles.commentsTitle}>{t("comments")}</Text>
                <View style={{ width: 28 }} />
              </View>
              {commentsLoading ? (
                <ActivityIndicator color="#C9FF35" style={{ marginTop: 24 }} />
              ) : (
                <ScrollView style={styles.commentsListScroll} contentContainerStyle={{ paddingBottom: 12 }}>
                  {(activeCommentsPost ? commentsByPost[activeCommentsPost.id] ?? [] : []).length === 0 ? (
                    <Text style={styles.noCommentsText}>{t("noCommentsYet")}</Text>
                  ) : (
                    (activeCommentsPost ? commentsByPost[activeCommentsPost.id] ?? [] : []).map((c) => (
                      <View key={c.id} style={styles.commentRowInsta}>
                        <UserAvatar uri={c.avatarUrl} name={c.user} size={32} borderRadius={16} fallbackBackgroundColor="#3f3f46" initialsColor="#fafafa" />
                        <View style={styles.commentBodyInsta}>
                          <View style={styles.commentTopLine}>
                            <Text style={styles.commentUserName} numberOfLines={1}>
                              {displayPersonName(c.user)}
                            </Text>
                            {commentAgeLabel(c.createdAt) ? <Text style={styles.commentTimeText}>{commentAgeLabel(c.createdAt)}</Text> : null}
                          </View>
                          <Text style={styles.commentTextInsta}>{c.text}</Text>
                          <View style={styles.commentReplyRow}>
                            <Pressable
                              hitSlop={6}
                              onPress={() => {
                                const handle = String(c.user || "").replace(/^@/, "");
                                setCommentDraft((prev) => (prev.trim() ? prev : `@${handle} `));
                              }}
                              style={styles.commentReplyBtn}
                            >
                              <Text style={styles.commentReplyText}>Reply</Text>
                            </Pressable>
                            {String(c.user || "").trim().toLowerCase() === String(user?.fullName || user?.username || "").trim().toLowerCase() ? (
                              <Pressable hitSlop={6} style={styles.commentReplyBtn}>
                                <Text style={styles.commentDeleteText}>Delete</Text>
                              </Pressable>
                            ) : null}
                          </View>
                        </View>
                        <View style={styles.commentRightActions}>
                          <Pressable hitSlop={6} style={styles.commentActionPill}>
                            <Ionicons name="heart-outline" size={18} color="#9ca3af" />
                            <Text style={styles.commentActionCount}>{c.likes ?? 0}</Text>
                          </Pressable>
                          <Pressable hitSlop={6} style={styles.commentActionPill}>
                            <Ionicons name="chatbubble-ellipses-outline" size={17} color="#9ca3af" />
                          </Pressable>
                        </View>
                      </View>
                    ))
                  )}
                </ScrollView>
              )}
              <View style={styles.commentComposerWrap}>
                <CommentComposerBar
                  value={commentDraft}
                  onChangeText={setCommentDraft}
                  onSubmit={() => void submitComment()}
                  placeholder={commentPlaceholderForPost(activeCommentsPost, null, t)}
                  avatarUri={user?.avatarUrl}
                  avatarName={user?.fullName || "You"}
                  submitting={commentSubmitting}
                />
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <PostOptionsSheet
        visible={!!optionsPost}
        post={optionsPost}
        onClose={() => setOptionsPost(null)}
        isOwnPost={!!optionsPost && viewerOwnsPost(optionsPost, user ? { id: user.id, fullName: user.fullName } : null)}
        isSaved={!!optionsPost?.viewerHasSaved}
        saveBusy={!!optionsPost && !!saveBusyByPostId[optionsPost.id]}
        onToggleSave={optionsPost ? () => togglePostSave(optionsPost) : undefined}
        onCopyLink={optionsPost ? () => void onCopyPostLink(optionsPost) : undefined}
        onNotInterested={optionsPost ? () => onNotInterestedInPost(optionsPost) : undefined}
        onReport={() => {
          if (optionsPost) onReportPost(optionsPost);
        }}
        onDelete={
          optionsPost && canDeleteOwnPosts && viewerOwnsPost(optionsPost, user ? { id: user.id, fullName: user.fullName } : null)
            ? () => confirmDeletePost(optionsPost)
            : undefined
        }
      />

      <PostReportSheet
        visible={!!reportTargetPost}
        post={reportTargetPost}
        onClose={() => setReportTargetPost(null)}
      />

      <PostShareSheet
        visible={!!shareTargetPost}
        post={shareTargetPost}
        onClose={() => setShareTargetPost(null)}
        followingPeers={followingPeers}
        onAddToStory={onAddToStory}
      />

      <PostRepostSheet
        visible={!!repostTargetPost}
        post={repostTargetPost}
        onClose={() => setRepostTargetPost(null)}
        onRepostChange={applyRepostState}
      />
    </>
  );
}

const styles = StyleSheet.create({
  reelPage: { backgroundColor: APP_DARK_BG, overflow: "hidden" },
  reelViewerTopChrome: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
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
  reelGradient: { position: "absolute", left: 0, right: 0, bottom: 0, height: 280, zIndex: 1 },
  reelLikeBurstLayer: { ...StyleSheet.absoluteFillObject, zIndex: 3, overflow: "hidden" },
  reelCreativeFilterLayer: { ...StyleSheet.absoluteFillObject, zIndex: 1.5 },
  reelCreativeTextWrap: { position: "absolute", top: "17%", left: 14, right: 14, zIndex: 1.7, alignItems: "center" },
  reelCreativeText: { maxWidth: "90%", fontSize: 20, fontWeight: "900", textAlign: "center" },
  reelMuteFeedbackLayer: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center", zIndex: 14 },
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
  reelPauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.28)",
    zIndex: 6
  },
  reelPauseMuteIcon: {
    marginBottom: 16,
    opacity: 0.95
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
  reelRepostMeta: { color: "rgba(255,255,255,0.72)", fontSize: 12, fontWeight: "700", marginBottom: 8 },
  reelUserFollowRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "nowrap", minWidth: 0 },
  reelAuthorTap: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  reelAvatarCircle: { borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", borderRadius: 22, overflow: "hidden" },
  reelUserName: { flex: 1, minWidth: 0, color: "#C9FF35", fontWeight: "800", fontSize: 16 },
  reelMusicRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  reelMusicText: { color: "rgba(255,255,255,0.95)", fontSize: 13, fontWeight: "600", flex: 1 },
  reelCaptionDark: { color: "rgba(255,255,255,0.96)", fontSize: 14, fontWeight: "600", marginTop: 10, lineHeight: 20 },
  reelActionsCol: { alignItems: "center", gap: 14, paddingBottom: 2, width: 44 },
  reelActionItem: { alignItems: "center", gap: 4 },
  reelActionCount: { color: "#fff", fontSize: 11, fontWeight: "700" },
  reelActionCountLiked: { color: "#C9FF35" },
  reelDiscThumb: { width: 38, height: 38, borderRadius: 10, borderWidth: 2, borderColor: "rgba(255,255,255,0.95)", marginTop: 4, backgroundColor: "#2a2a2a" },
  reelDiscThumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  reelSeekWrap: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 12 },
  reelSeekTrack: { width: "100%", height: 5, backgroundColor: "rgba(0,0,0,0.42)", overflow: "hidden" },
  reelSeekFill: { height: "100%", backgroundColor: "#C9FF35" },
  carouselDotsWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 9,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6
  },
  carouselDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.5)"
  },
  carouselDotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: APP_LIME
  },
  commentsSheetRoot: { flex: 1, justifyContent: "flex-end" },
  commentsSheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  commentsSheetContainer: { justifyContent: "flex-end" },
  commentsSheetPanel: { backgroundColor: "#111827", borderTopLeftRadius: 16, borderTopRightRadius: 16, flex: 1 },
  commentsSheetHandle: { alignSelf: "center", width: 42, height: 4, borderRadius: 2, backgroundColor: "#4b5563", marginTop: 8 },
  commentsSheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10 },
  commentsTitle: { color: "#fff", fontWeight: "800", fontSize: 16 },
  commentsListScroll: { flex: 1, paddingHorizontal: 16 },
  noCommentsText: { color: "#9ca3af", textAlign: "center", marginTop: 24 },
  commentRowInsta: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 14 },
  commentBodyInsta: { flex: 1 },
  commentTopLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  commentUserName: { color: "#fafafa", fontSize: 13, fontWeight: "800", maxWidth: "70%" },
  commentTimeText: { color: "#a1a1aa", fontSize: 12, fontWeight: "600" },
  commentTextInsta: { color: "#e5e7eb", marginTop: 2, lineHeight: 18 },
  commentReplyRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
  commentReplyBtn: { alignSelf: "flex-start", marginTop: 2 },
  commentReplyText: { color: "#a1a1aa", fontSize: 12, fontWeight: "700" },
  commentDeleteText: { color: "#f87171", fontSize: 12, fontWeight: "700" },
  commentRightActions: { alignItems: "flex-end", gap: 8, paddingTop: 2 },
  commentActionPill: { flexDirection: "row", alignItems: "center", gap: 4 },
  commentActionCount: { color: "#9ca3af", fontSize: 12, fontWeight: "700" },
  commentComposerWrap: { paddingHorizontal: 16 },
  reelOptionsModalRoot: { flex: 1, justifyContent: "flex-end" },
  reelOptionsDimTap: { backgroundColor: "rgba(0,0,0,0.45)" },
  reelOptionsSheet: { backgroundColor: "#111827", borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 16, paddingTop: 8 },
  shareHandle: { alignSelf: "center", width: 42, height: 4, borderRadius: 2, backgroundColor: "#4b5563", marginBottom: 10 },
  reelOptionsTitle: { color: "#fff", fontWeight: "800", fontSize: 16, marginBottom: 8 },
  reelOptionRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  reelOptionIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#1f2937", alignItems: "center", justifyContent: "center" },
  reelOptionTextCol: { flex: 1 },
  reelOptionTitle: { color: "#fff", fontWeight: "800", fontSize: 15 },
  reelOptionTitleDanger: { color: "#ff6b6b" },
  reelOptionSub: { color: "#9ca3af", marginTop: 2, fontSize: 12 }
});
