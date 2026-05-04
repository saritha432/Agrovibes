import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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
import { ResizeMode, Video } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppTopBar } from "../components/AppTopBar";
import { useAuth } from "../auth/AuthContext";
import {
  createHomePostComment,
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

interface HomeScreenProps {
  refreshToken?: number;
  onOpenCreate?: () => void;
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

type HomeCommentRow = { id: string; user: string; text: string; likes: number };

function mergeRemoteAndLocalComments(remote: HomeCommentRow[], local: HomeCommentRow[]): HomeCommentRow[] {
  const remoteIds = new Set(remote.map((c) => String(c.id)));
  const merged = [...remote];
  for (const c of local) {
    if (!remoteIds.has(String(c.id))) merged.push(c);
  }
  return merged;
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
  const [activeCommentsPost, setActiveCommentsPost] = useState<HomePost | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentsByPost, setCommentsByPost] = useState<Record<number, { id: string; user: string; text: string; likes: number }[]>>({});
  const [isStoryOpen, setStoryOpen] = useState(false);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [activeHomeTab, setActiveHomeTab] = useState<(typeof homeTopTabs)[number]>("Reels");
  const [relationships, setRelationships] = useState<Record<number, { viewerStatus: string; reverseStatus: string; canFollowBack: boolean }>>({});
  const [followBusyByUserId, setFollowBusyByUserId] = useState<Record<number, boolean>>({});
  const [legacyFollowStateByName, setLegacyFollowStateByName] = useState<Record<string, "none" | "pending" | "accepted">>({});
  const [legacyRelationshipByName, setLegacyRelationshipByName] = useState<Record<string, { viewerStatus: "none" | "pending" | "accepted"; canFollowBack: boolean }>>({});
  const [likeBusyByPostId, setLikeBusyByPostId] = useState<Record<number, boolean>>({});
  const [reelSlotHeight, setReelSlotHeight] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const commentsFetchSeqRef = useRef(0);

  const viewabilityConfig = useMemo(
    () => ({ itemVisiblePercentThreshold: 65, minimumViewTime: 200 }),
    []
  );
  const reelViewabilityConfig = useMemo(
    () => ({ itemVisiblePercentThreshold: 55, minimumViewTime: 120 }),
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
  const ownStories = useMemo(
    () =>
      stories.filter((s) => {
        const storyName = normalizeIdentity(s.userName);
        return storyName === "you" || storyName === currentUserStoryKey;
      }),
    [currentUserStoryKey, stories]
  );
  const otherStories = useMemo(
    () =>
      stories.filter((s) => {
        const storyName = normalizeIdentity(s.userName);
        return storyName !== "you" && storyName !== currentUserStoryKey;
      }),
    [currentUserStoryKey, stories]
  );
  const activeStory = playableStories[activeStoryIndex];

  const applyViewedStories = useCallback(
    (incoming: HomeStory[]) => incoming.map((story) => (viewedStoryIds.has(story.id) ? { ...story, viewed: true } : story)),
    [viewedStoryIds]
  );

  const closeStory = () => {
    setStoryOpen(false);
    progress.stopAnimation();
    progress.setValue(0);
  };

  const nextStory = () => {
    if (activeStoryIndex >= playableStories.length - 1) {
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

  useEffect(() => {
    let mounted = true;
    fetchHomeStories()
      .then((data) => {
        if (!mounted) return;
        setStories(applyViewedStories(data.stories));
      })
      .catch(() => {
        if (!mounted) return;
        setStories(
          applyViewedStories([
          { id: 1, userName: "You", district: "Nashik", avatarLabel: "Y", hasNew: false, viewed: true },
          { id: 2, userName: "Ramesh", district: "Nashik", avatarLabel: "R", hasNew: true, viewed: false },
          { id: 3, userName: "Suresh", district: "Indore", avatarLabel: "S", hasNew: true, viewed: false }
          ])
        );
      });
    return () => {
      mounted = false;
    };
  }, [applyViewedStories, refreshToken]);

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

  const openCommentsForPost = useCallback(
    (post: HomePost) => {
      setActiveCommentsPost(post);
      const reqKey = ++commentsFetchSeqRef.current;
      void (async () => {
        let remote: HomeCommentRow[] = [];
        try {
          const data = await fetchHomePostComments(post.id, token ?? null);
          remote = data.comments ?? [];
        } catch {
          remote = [];
        }
        if (reqKey !== commentsFetchSeqRef.current) return;
        const localRows = await getLocalCommentsForPost(post.id);
        if (reqKey !== commentsFetchSeqRef.current) return;
        const merged = mergeRemoteAndLocalComments(remote, localRows);
        setCommentsByPost((prev) => ({ ...prev, [post.id]: merged }));
      })();
    },
    [token]
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

    if (token) {
      try {
        const res = await createHomePostComment(token, post.id, text);
        const row: HomeCommentRow = {
          id: String(res.comment.id),
          user: res.comment.user || user?.fullName || "You",
          text: res.comment.text || text,
          likes: res.comment.likes ?? 0
        };
        setCommentsByPost((prev) => {
          const list = prev[post.id] ?? [];
          const withoutDup = list.filter((c) => String(c.id) !== row.id);
          return { ...prev, [post.id]: [...withoutDup, row] };
        });
        setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, commentsCount: res.commentsCount } : p)));
        setCommentDraft("");
        return;
      } catch {
        // fall through to local behavior
      }
    }

    setCommentsByPost((prev) => {
      const list = prev[post.id] ?? [];
      return {
        ...prev,
        [post.id]: [...list, { id: `c-${Date.now()}`, user: user?.fullName || "You", text, likes: 0 }]
      };
    });
    await addLocalCommentForPost({
      postId: post.id,
      user: user?.fullName || "You",
      userKey: user?.email || String(user?.id || ""),
      text,
      likes: 0
    });
    setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, commentsCount: p.commentsCount + 1 } : p)));
    setCommentDraft("");
    if (!isOwnPost) {
      await appendLocalEngagementNotification({
        type: "post_comment",
        actorName: user?.fullName || "Someone",
        recipientDisplayName: post.userName,
        postId: post.id,
        isReel: !!post.videoUrl,
        commentExcerpt: text.length > 120 ? `${text.slice(0, 117)}...` : text
      });
    }
  }, [activeCommentsPost, commentDraft, token, user?.fullName, user?.id]);

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
                onOpenCreate?.();
                return;
              }
              const idx = playableStories.findIndex((s) => s.id === ownPlayable.id);
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
                <View style={styles.yourStoryPlusBadge}>
                  <Ionicons name="add" size={12} color="#fff" />
                </View>
              </View>
            </View>
            <Text style={styles.storyNameDark} numberOfLines={1}>
              Your story
            </Text>
          </Pressable>

          {otherStories.map((story) => (
            <Pressable
              key={story.id}
              style={styles.storyItem}
              onPress={() => {
                if (!story.videoUrl && !story.imageUrl) return;
                setViewedStoryIds((prev) => {
                  if (prev.has(story.id)) return prev;
                  const next = new Set(prev);
                  next.add(story.id);
                  return next;
                });
                setStories((prev) => prev.map((s) => (s.id === story.id ? { ...s, viewed: true } : s)));
                const idx = playableStories.findIndex((s) => s.id === story.id);
                setActiveStoryIndex(Math.max(idx, 0));
                setStoryOpen(true);
              }}
            >
              <View style={[styles.storyRing, story.viewed ? styles.storyRingViewed : styles.storyRingNew]}>
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
    [activeHomeTab, onOpenCreate, otherStories, ownStories, playableStories, user?.fullName]
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
              <Pressable style={styles.reelActionItem}>
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
            {playableStories.map((s, idx) => {
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
            <Pressable onPress={closeStory} hitSlop={10}>
              <Ionicons name="close" size={26} color="#fff" />
            </Pressable>
          </View>

          <View style={styles.storyViewerBody}>
            {activeStory?.videoUrl ? (
              <Video
                style={styles.storyVideo}
                source={{ uri: activeStory.videoUrl }}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay
                isLooping={false}
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

      <Modal visible={!!activeCommentsPost} transparent animationType="slide" onRequestClose={() => setActiveCommentsPost(null)}>
        <Pressable style={styles.commentsBackdrop} onPress={() => setActiveCommentsPost(null)}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.commentsKeyboardWrap}>
            <Pressable style={styles.commentsSheet} onPress={(e) => e.stopPropagation?.()}>
              <View style={styles.commentsHandle} />
              <Text style={styles.commentsTitle}>Comments</Text>

              <ScrollView style={styles.commentsList} contentContainerStyle={styles.commentsListInner}>
                {(activeCommentsPost ? commentsByPost[activeCommentsPost.id] ?? [] : []).length === 0 ? (
                  <Text style={styles.noCommentsText}>No Comments</Text>
                ) : (
                  (activeCommentsPost ? commentsByPost[activeCommentsPost.id] ?? [] : []).map((c) => (
                    <View key={c.id} style={styles.commentRow}>
                      <View style={styles.commentAvatar}>
                        <Text style={styles.commentAvatarText}>{c.user[0].toUpperCase()}</Text>
                      </View>
                      <View style={styles.commentBody}>
                        <Text style={styles.commentUser}>{c.user}</Text>
                        <Text style={styles.commentText}>{c.text}</Text>
                      </View>
                      <View style={styles.commentLikeWrap}>
                        <Ionicons name="heart-outline" size={14} color="#9ca3af" />
                        <Text style={styles.commentLikeCount}>{c.likes}</Text>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>

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
                  placeholder="Add comment for PureFarm..."
                  placeholderTextColor="#6b7280"
                  style={styles.commentInput}
                />
                <Pressable style={styles.commentSendBtn} onPress={submitComment}>
                  <Ionicons name="send" size={14} color="#111827" />
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
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
  commentsBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end"
  },
  commentsKeyboardWrap: {
    width: "100%"
  },
  commentsSheet: {
    backgroundColor: "#1a1b1c",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: 360,
    maxHeight: "72%",
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 14
  },
  commentsHandle: {
    width: 42,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#b7ff37",
    alignSelf: "center",
    marginBottom: 12
  },
  commentsTitle: {
    color: "#b7ff37",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 10
  },
  commentsList: { flex: 1 },
  commentsListInner: { paddingBottom: 10, gap: 10 },
  noCommentsText: { color: "#b7ff37", textAlign: "center", marginTop: 40, fontWeight: "700" },
  commentRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  commentAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center"
  },
  commentAvatarText: { color: "#111827", fontSize: 11, fontWeight: "700" },
  commentBody: { flex: 1 },
  commentUser: { color: "#f9fafb", fontSize: 11, fontWeight: "700" },
  commentText: { color: "#d1d5db", fontSize: 11, marginTop: 1 },
  commentLikeWrap: { alignItems: "center", minWidth: 24 },
  commentLikeCount: { color: "#9ca3af", fontSize: 9, marginTop: 1 },
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
  }
});
