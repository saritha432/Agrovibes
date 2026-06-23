import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useAuth } from "../auth/AuthContext";
import { UserAvatar } from "../components/UserAvatar";
import { SvgAssetIcon } from "../components/SvgAssetIcon";
import { useLanguage } from "../localization/LanguageContext";
import {
  fetchHomePosts,
  fetchSavedHomePosts,
  fetchMyHomePosts,
  fetchUserHomePosts,
  fetchProfileStats,
  fetchSocialNetwork,
  fetchTaggedHomePosts,
  getWebAppOrigin,
  HomePost,
  deleteHomePost,
  removeFollower,
  sendFollowRequest,
  sendDirectMessage,
  unfollowUser,
} from "../services/api";
import {
  getLocalFollowCountsByIdentity,
  getLocalFollowEdgesForServerSync,
  getLocalFollowNetworkByIdentity,
  getLocalFollowNotificationsByIdentity,
  removeLocalFollowByIdentity,
  removeLocalFollowRecordsByIds,
  sendLocalFollowRequestByIdentity
} from "../social/localFollowStore";
import { clearProfilePostsCache, readProfilePostsCache, writeProfilePostsCache } from "../social/profilePostsCache";
import { navigateToEditProfile } from "../navigation/navigationRef";
import { PostsReelViewerModal } from "../components/PostsReelViewerModal";
import { APP_LIME } from "../theme/appColors";
import { stripLegacyCloudinaryUrl } from "../utils/mediaUrls";
import { isReelPost, reelGridStillUri, reelGridTileBackground, REEL_GRID_TILE_A, REEL_GRID_TILE_B } from "../utils/reelGrid";
import { hydrateReelPreviews } from "../utils/reelPreviewThumb";

const PAGE_BG = "#262626";
const SURFACE = "#303132";
const SURFACE_ALT = "#383838";
const TEXT = "#ffffff";
const LIME = APP_LIME;
const PROFILE_HEADER_HEIGHT = 61;
const PROFILE_HEADER_MAX_WIDTH = 430;
const PROFILE_TAB_ICON = 32;

const PROFILE_ASSETS = {
  menu: require("../../assets/menu-icon.svg")
} as const;

const PROFILE_TAB_ICONS = {
  Posts: {
    inactive: require("../../assets/feed.svg"),
    active: require("../../assets/feed-active.svg")
  },
  Reels: {
    inactive: require("../../assets/reels.svg"),
    active: require("../../assets/reels-active.svg")
  },
  Saved: {
    inactive: require("../../assets/reshare.svg"),
    active: require("../../assets/reshare-active.svg")
  },
  Tagged: {
    inactive: require("../../assets/tag.svg"),
    active: require("../../assets/tag-active.svg")
  }
} as const;

const PROFILE_TAB_FALLBACKS: Record<
  GalleryTab,
  { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }
> = {
  Posts: { active: "grid", inactive: "grid-outline" },
  Reels: { active: "film", inactive: "film-outline" },
  Saved: { active: "bookmark", inactive: "bookmark-outline" },
  Tagged: { active: "person", inactive: "person-outline" }
};

const VIDEO_GRID_ICON = require("../../assets/video-icon.svg");

type GalleryTab = "Posts" | "Reels" | "Saved" | "Tagged";

function profileTileBackground(index: number) {
  return reelGridTileBackground(index, 3);
}

function normalizeProfileName(value: string) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function postBelongsToProfileUser(
  post: HomePost,
  user: { id?: number | string; fullName?: string | null; username?: string | null; email?: string | null }
) {
  const uid = Number(user.id);
  if (uid > 0 && Number(post.userId) === uid) return true;
  const names = [user.fullName, user.username, user.email?.split("@")[0]]
    .map((v) => normalizeProfileName(String(v || "")))
    .filter(Boolean);
  const postName = normalizeProfileName(post.userName || "");
  return postName.length > 0 && names.some((name) => name === postName);
}

function pickDefaultGalleryTab(_posts: HomePost[]): GalleryTab {
  return "Posts";
}

function safeHandle(name: string) {
  const base = String(name || "user")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `@${base || "user_farmer"}`;
}

function formatStatCount(value: number) {
  return String(Math.max(0, value)).padStart(2, "0");
}

export function ProfileScreen({ route: routeProp }: { route?: any }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const navRoute = useRoute();
  const route = routeProp ?? navRoute;
  const isPublicProfileView = navRoute.name === "PublicProfile";
  const publicUserId = isPublicProfileView ? (route.params?.userId as number | undefined) : undefined;
  const publicUserName = isPublicProfileView ? String(route.params?.userName || "") : "";
  const publicUserKey = isPublicProfileView ? (route.params?.userKey as string | undefined) : undefined;
  const publicAvatarFromRoute = isPublicProfileView ? (route.params?.avatarUrl as string | null | undefined) : undefined;
  const { width, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { user, token, signOut } = useAuth();
  const { t } = useLanguage();
  const [publicUsername, setPublicUsername] = useState<string | null>(null);
  const [publicAvatarUrl, setPublicAvatarUrl] = useState<string | null | undefined>(publicAvatarFromRoute);
  const [publicBio, setPublicBio] = useState("");
  const [isFollowingPublic, setIsFollowingPublic] = useState(false);
  const [followPublicBusy, setFollowPublicBusy] = useState(false);
  const [userPosts, setUserPosts] = useState<HomePost[]>([]);
  const [savedPosts, setSavedPosts] = useState<HomePost[]>([]);
  const [taggedPosts, setTaggedPosts] = useState<HomePost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [previewUriByPostId, setPreviewUriByPostId] = useState<Record<number, string>>({});
  const [savedLoading, setSavedLoading] = useState(false);
  const [taggedLoading, setTaggedLoading] = useState(false);
  const savedLoadedRef = useRef(false);
  const taggedLoadedRef = useRef(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followersList, setFollowersList] = useState<
    Array<{ name: string; key?: string; avatarUrl?: string | null; viewerStatus: "none" | "pending" | "accepted"; canFollowBack: boolean }>
  >([]);
  const [followingList, setFollowingList] = useState<
    Array<{ name: string; key?: string; avatarUrl?: string | null; viewerStatus: "accepted"; canFollowBack: false }>
  >([]);
  const [activeListType, setActiveListType] = useState<"followers" | "following" | null>(null);
  const [followingActionMenuFor, setFollowingActionMenuFor] = useState<string | null>(null);
  const [followerRemoveConfirm, setFollowerRemoveConfirm] = useState<{ name: string; key?: string } | null>(null);
  const [removeFollowerBusy, setRemoveFollowerBusy] = useState(false);
  const [activeGalleryTab, setActiveGalleryTab] = useState<GalleryTab>(() => {
    const tab = route?.params?.initialTab;
    if (tab === "Saved" || tab === "Tagged" || tab === "Reels" || tab === "Posts") return tab;
    return "Posts";
  });
  const [activeReelIndex, setActiveReelIndex] = useState<number | null>(null);
  const [playingReelId, setPlayingReelId] = useState<number | null>(null);
  const [activeImagePost, setActiveImagePost] = useState<HomePost | null>(null);
  const [shareProfileOpen, setShareProfileOpen] = useState(false);
  const [shareBusyByUserId, setShareBusyByUserId] = useState<Record<number, boolean>>({});
  const [shareProfileSearch, setShareProfileSearch] = useState("");
  const [profileReelViewer, setProfileReelViewer] = useState<{ posts: HomePost[]; initialIndex: number } | null>(null);
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);
  const isMountedRef = useRef(true);
  const profileInitialTabRef = useRef<GalleryTab | undefined>(route?.params?.initialTab);

  const displayAvatarUrl = useMemo(
    () => stripLegacyCloudinaryUrl(isPublicProfileView ? publicAvatarUrl : user?.avatarUrl),
    [isPublicProfileView, publicAvatarUrl, user?.avatarUrl]
  );
  const avatarPreviewSize = Math.min(320, Math.max(200, Math.min(width, windowHeight) * 0.68));

  const gridGap = 2;
  const gridTileSize = (width - gridGap * 2) / 3;
  const reelTileHeight = Math.round(gridTileSize * (16 / 9));
  const isReelTab =
    activeGalleryTab === "Reels" || activeGalleryTab === "Saved" || activeGalleryTab === "Tagged";

  const normalizeName = (v: string) =>
    String(v || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const normalizeKey = (v?: string) => String(v || "").trim().toLowerCase();
  const personUniqueId = (person: { name: string; key?: string }) => `${normalizeKey(person.key)}::${normalizeName(person.name)}`;
  const parsePersonUserId = (person: { key?: string }) => {
    const raw = String(person.key || "").trim();
    return /^\d+$/.test(raw) ? Number(raw) : null;
  };

  const loadUserPosts = useCallback(async () => {
    if (isPublicProfileView) {
      setPostsLoading(true);
      try {
        const profileUser = {
          id: publicUserId,
          fullName: publicUserName,
          username: publicUsername ?? undefined
        };
        let posts: HomePost[] = [];

        if (publicUserId) {
          try {
            const data = await fetchUserHomePosts(token ?? undefined, publicUserId, publicUserName);
            posts = data.posts || [];
          } catch {
            // Dedicated endpoint may be unavailable on older backends; fall back below.
          }
        }

        if (!posts.length) {
          try {
            const home = await fetchHomePosts(token ?? undefined);
            posts = (home.posts || []).filter((post) => postBelongsToProfileUser(post, profileUser));
          } catch {
            posts = [];
          }
        }

        if (!isMountedRef.current) return;
        setUserPosts(posts);
      } catch {
        if (!isMountedRef.current) return;
        setUserPosts([]);
      } finally {
        if (isMountedRef.current) setPostsLoading(false);
      }
      return;
    }
    if (!token || !user?.id) {
      setUserPosts([]);
      return;
    }
    setPostsLoading(true);
    try {
      let posts: HomePost[] = [];
      try {
        const data = await fetchMyHomePosts(token);
        posts = data.posts || [];
      } catch {
        posts = [];
      }
      if (!posts.length) {
        try {
          const home = await fetchHomePosts(token);
          posts = (home.posts || []).filter((post) => postBelongsToProfileUser(post, user));
        } catch {
          posts = [];
        }
      }
      if (!isMountedRef.current) return;
      setUserPosts(posts);
      writeProfilePostsCache({ userId: Number(user.id), userPosts: posts, fetchedAt: Date.now() });
    } catch {
      if (!isMountedRef.current) return;
      setUserPosts([]);
    } finally {
      if (isMountedRef.current) setPostsLoading(false);
    }
  }, [isPublicProfileView, publicUserId, publicUserName, publicUsername, token, user]);

  const loadSavedPosts = useCallback(async () => {
    if (!token || !user?.id) {
      setSavedPosts([]);
      savedLoadedRef.current = false;
      return;
    }
    setSavedLoading(true);
    try {
      const data = await fetchSavedHomePosts(token);
      if (!isMountedRef.current) return;
      const posts = data.posts || [];
      setSavedPosts(posts);
      savedLoadedRef.current = true;
      writeProfilePostsCache({ userId: Number(user.id), savedPosts: posts, savedLoaded: true, fetchedAt: Date.now() });
    } catch {
      if (!isMountedRef.current) return;
      setSavedPosts([]);
      savedLoadedRef.current = false;
    } finally {
      if (isMountedRef.current) setSavedLoading(false);
    }
  }, [token, user?.id]);

  const loadTaggedPosts = useCallback(async () => {
    if (!token || !user?.id) {
      setTaggedPosts([]);
      taggedLoadedRef.current = false;
      return;
    }
    setTaggedLoading(true);
    try {
      const data = await fetchTaggedHomePosts(token);
      if (!isMountedRef.current) return;
      const posts = data.posts || [];
      setTaggedPosts(posts);
      taggedLoadedRef.current = true;
      writeProfilePostsCache({ userId: Number(user.id), taggedPosts: posts, taggedLoaded: true, fetchedAt: Date.now() });
    } catch {
      if (!isMountedRef.current) return;
      setTaggedPosts([]);
      taggedLoadedRef.current = false;
    } finally {
      if (isMountedRef.current) setTaggedLoading(false);
    }
  }, [token, user?.id]);

  const hydrateProfilePostsFromCache = useCallback(() => {
    if (!user?.id) return false;
    const cached = readProfilePostsCache(Number(user.id));
    if (!cached) return false;
    setUserPosts(cached.userPosts);
    if (cached.savedLoaded) {
      setSavedPosts(cached.savedPosts);
      savedLoadedRef.current = true;
    }
    if (cached.taggedLoaded) {
      setTaggedPosts(cached.taggedPosts);
      taggedLoadedRef.current = true;
    }
    return true;
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (isPublicProfileView) {
        profileInitialTabRef.current = undefined;
        setActiveGalleryTab("Posts");
        return;
      }
      const tab = route?.params?.initialTab;
      if (tab === "Saved" || tab === "Tagged" || tab === "Reels" || tab === "Posts") {
        profileInitialTabRef.current = tab;
        setActiveGalleryTab(tab);
      } else {
        profileInitialTabRef.current = undefined;
        setActiveGalleryTab(pickDefaultGalleryTab([]));
      }
    }, [isPublicProfileView, route?.params?.initialTab])
  );

  useFocusEffect(
    useCallback(() => {
      if (isPublicProfileView) {
        void loadUserPosts();
        return;
      }
      if (!user?.id) return;
      const hadCache = hydrateProfilePostsFromCache();
      void loadUserPosts();
      if (savedLoadedRef.current) void loadSavedPosts();
      if (taggedLoadedRef.current) void loadTaggedPosts();
      if (!hadCache && !savedLoadedRef.current && !taggedLoadedRef.current) {
        // Preload saved in background — common profile tab after reels.
        void loadSavedPosts();
      }
    }, [hydrateProfilePostsFromCache, isPublicProfileView, loadSavedPosts, loadTaggedPosts, loadUserPosts, user?.id])
  );

  useEffect(() => {
    if (activeGalleryTab === "Saved" && token && !savedLoadedRef.current) {
      void loadSavedPosts();
    }
    if (activeGalleryTab === "Tagged" && token && !taggedLoadedRef.current) {
      void loadTaggedPosts();
    }
  }, [activeGalleryTab, loadSavedPosts, loadTaggedPosts, token]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    savedLoadedRef.current = false;
    taggedLoadedRef.current = false;
    clearProfilePostsCache();
  }, [user?.id]);

  const refreshMergedFollowStats = useCallback(async () => {
    if (!user?.fullName) {
      setFollowersCount(0);
      setFollowingCount(0);
      setFollowersList([]);
      setFollowingList([]);
      return;
    }

    if (token && user?.id) {
      try {
        const [stats, network] = await Promise.all([fetchProfileStats(token, user.id), fetchSocialNetwork(token, user.id)]);
        const localCounts = await getLocalFollowCountsByIdentity({
          name: user.fullName,
          key: user.email || String(user.id)
        });
        const localNetwork = await getLocalFollowNetworkByIdentity({
          name: user.fullName,
          key: user.email || String(user.id)
        });
        if (!isMountedRef.current) return;
        const mergedFollowers = [...(network.followers || []), ...(localNetwork.followers || [])];
        const mergedFollowing = [...(network.following || []), ...(localNetwork.following || [])];
        const followersDedup = new Map<
          string,
          { name: string; key?: string; avatarUrl?: string | null; viewerStatus: "none" | "pending" | "accepted"; canFollowBack: boolean }
        >();
        const followingDedup = new Map<
          string,
          { name: string; key?: string; avatarUrl?: string | null; viewerStatus: "accepted"; canFollowBack: false }
        >();
        for (const person of mergedFollowers) {
          const id = personUniqueId(person);
          if (!followersDedup.has(id)) followersDedup.set(id, person);
        }
        for (const person of mergedFollowing) {
          const id = personUniqueId(person);
          if (!followingDedup.has(id)) followingDedup.set(id, person);
        }
        setFollowersCount(Math.max(Number(stats.followersCount || 0), followersDedup.size));
        setFollowingCount(Math.max(Number(stats.followingCount || 0), followingDedup.size));
        setFollowersList(Array.from(followersDedup.values()));
        setFollowingList(Array.from(followingDedup.values()));
      } catch {
        if (!isMountedRef.current) return;
        const localCounts = await getLocalFollowCountsByIdentity({
          name: user.fullName,
          key: user.email || String(user.id)
        });
        const localNetwork = await getLocalFollowNetworkByIdentity({
          name: user.fullName,
          key: user.email || String(user.id)
        });
        if (!isMountedRef.current) return;
        setFollowersCount(Number(localCounts.followersCount || 0));
        setFollowingCount(Number(localCounts.followingCount || 0));
        setFollowersList(localNetwork.followers);
        setFollowingList(localNetwork.following);
      }
    }
  }, [token, user?.id, user?.fullName, user?.email]);

  useEffect(() => {
    if (isPublicProfileView) return;
    void refreshMergedFollowStats();
  }, [isPublicProfileView, refreshMergedFollowStats]);

  useEffect(() => {
    if (!isPublicProfileView) return;
    let mounted = true;
    if (!(token && publicUserId)) {
      setFollowersCount(0);
      setFollowingCount(0);
      return;
    }
    fetchProfileStats(token, publicUserId)
      .then((stats) => {
        if (!mounted) return;
        setFollowersCount(Number(stats.followersCount || 0));
        setFollowingCount(Number(stats.followingCount || 0));
        setIsFollowingPublic(stats.viewerStatus === "accepted" || stats.viewerStatus === "pending");
        setPublicUsername(stats.username ? String(stats.username) : null);
        setPublicBio(String(stats.bio || "").trim());
        const fromApi =
          stats.avatarUrl != null && String(stats.avatarUrl).trim().length > 0 ? String(stats.avatarUrl).trim() : null;
        const fromRoute =
          publicAvatarFromRoute != null && String(publicAvatarFromRoute).trim().length > 0
            ? String(publicAvatarFromRoute).trim()
            : null;
        setPublicAvatarUrl(fromApi ?? fromRoute);
      })
      .catch(() => {
        if (!mounted) return;
        setFollowersCount(0);
        setFollowingCount(0);
      });
    return () => {
      mounted = false;
    };
  }, [isPublicProfileView, publicAvatarFromRoute, publicUserId, token]);

  const visiblePosts = useMemo(() => {
    if (activeGalleryTab === "Posts") return userPosts;
    if (activeGalleryTab === "Reels") return userPosts.filter((p) => isReelPost(p));
    if (activeGalleryTab === "Saved") return savedPosts.filter((p) => isReelPost(p));
    if (activeGalleryTab === "Tagged") return taggedPosts.filter((p) => isReelPost(p));
    return userPosts;
  }, [activeGalleryTab, savedPosts, taggedPosts, userPosts]);

  const handleGalleryTabPress = useCallback(
    (tabKey: GalleryTab) => {
      setActiveGalleryTab(tabKey);
      if (tabKey === "Posts" || tabKey === "Reels") {
        void loadUserPosts();
        return;
      }
      if (tabKey === "Saved") {
        void loadSavedPosts();
        return;
      }
      if (tabKey === "Tagged") {
        void loadTaggedPosts();
      }
    },
    [loadSavedPosts, loadTaggedPosts, loadUserPosts]
  );

  const galleryLoading = useMemo(() => {
    if (activeGalleryTab === "Saved") return savedLoading && savedPosts.length === 0;
    if (activeGalleryTab === "Tagged") return taggedLoading && taggedPosts.length === 0;
    return postsLoading && userPosts.length === 0;
  }, [activeGalleryTab, postsLoading, savedLoading, savedPosts.length, taggedLoading, taggedPosts.length, userPosts.length]);

  const previewHydrationKey = useMemo(
    () =>
      visiblePosts
        .filter((post) => post.videoUrl && !reelGridStillUri(post))
        .map((post) => post.id)
        .join(","),
    [visiblePosts]
  );

  useEffect(() => {
    let cancelled = false;
    const postsNeedingPreview = visiblePosts
      .filter((post) => post.videoUrl && !reelGridStillUri(post))
      .slice(0, 36);
    if (!postsNeedingPreview.length) return;
    void hydrateReelPreviews(
      postsNeedingPreview,
      (postId, uri) => {
        if (cancelled) return;
        setPreviewUriByPostId((prev) => (prev[postId] === uri ? prev : { ...prev, [postId]: uri }));
      },
      { maxConcurrent: 2, isCancelled: () => cancelled }
    );
    return () => {
      cancelled = true;
    };
  }, [previewHydrationKey, visiblePosts]);

  const canDeleteFromProfileGallery =
    !isPublicProfileView && (activeGalleryTab === "Posts" || activeGalleryTab === "Reels");

  const galleryTabs = useMemo(
    (): GalleryTab[] => (isPublicProfileView ? ["Posts", "Reels"] : ["Posts", "Reels", "Saved", "Tagged"]),
    [isPublicProfileView]
  );

  const openProfilePostsViewer = useCallback(
    (post: HomePost) => {
      const reelPosts = visiblePosts.filter((p) => isReelPost(p));
      if (isReelPost(post) && reelPosts.length > 0) {
        const reelIndex = reelPosts.findIndex((p) => p.id === post.id);
        setProfileReelViewer({ posts: reelPosts, initialIndex: reelIndex >= 0 ? reelIndex : 0 });
        return;
      }
      const ix = visiblePosts.findIndex((p) => p.id === post.id);
      setProfileReelViewer({ posts: visiblePosts, initialIndex: ix >= 0 ? ix : 0 });
    },
    [visiblePosts]
  );

  const handleProfileReelPostsChange = useCallback(
    (nextPosts: HomePost[]) => {
      if (activeGalleryTab === "Posts" || activeGalleryTab === "Reels") {
        setUserPosts(nextPosts);
      } else if (activeGalleryTab === "Saved") {
        setSavedPosts(nextPosts);
      } else if (activeGalleryTab === "Tagged") {
        setTaggedPosts(nextPosts);
      }
      setProfileReelViewer((v) => {
        if (!v) return v;
        if (!nextPosts.length) return null;
        const nextIndex = Math.min(v.initialIndex, nextPosts.length - 1);
        return { posts: nextPosts, initialIndex: nextIndex };
      });
    },
    [activeGalleryTab]
  );

  const confirmDeleteProfilePost = useCallback(
    (post: HomePost) => {
      if (!canDeleteFromProfileGallery) return;
      if (!token) {
        Alert.alert(t("loginRequired"), t("loginRequiredDelete"));
        return;
      }

      const runDelete = async () => {
        try {
          await deleteHomePost(token, post.id);
          setUserPosts((prev) => prev.filter((p) => p.id !== post.id));
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "Could not delete this post.";
          if (Platform.OS === "web" && typeof window !== "undefined") {
            window.alert(msg);
          } else {
            Alert.alert(t("deleteFailed"), msg);
          }
        }
      };

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
    [canDeleteFromProfileGallery, t, token]
  );

  const renderProfileGridItem = useCallback(
    ({ item: post, index }: { item: HomePost; index: number }) => {
      const tileHeight = isReelTab ? reelTileHeight : gridTileSize;
      const tileStyle = [
        styles.gridTile,
        { width: gridTileSize, height: tileHeight, backgroundColor: profileTileBackground(index) }
      ];
      if (post.videoUrl) {
        const stillUri = reelGridStillUri(post) || previewUriByPostId[post.id] || null;
        return (
          <Pressable
            key={post.id}
            style={tileStyle}
            onPress={() => openProfilePostsViewer(post)}
            onLongPress={canDeleteFromProfileGallery ? () => confirmDeleteProfilePost(post) : undefined}
          >
            {stillUri ? (
              <Image source={{ uri: stillUri }} style={styles.gridImage} resizeMode="cover" />
            ) : (
              <View style={[styles.gridImage, styles.gridVideoPlaceholder, { backgroundColor: profileTileBackground(index) }]} />
            )}
            <View style={styles.gridPlayBadge} pointerEvents="none">
              <SvgAssetIcon module={VIDEO_GRID_ICON} size={20} color={LIME} fallbackName="videocam" />
            </View>
          </Pressable>
        );
      }
      const galleryFirst = post.imageUrls && post.imageUrls.length > 0 ? post.imageUrls[0] : null;
      const cover = post.imageUrl || galleryFirst || null;
      const canOpen = !!cover;
      return (
        <Pressable
          key={post.id}
          style={tileStyle}
          onPress={() => (canOpen ? openProfilePostsViewer(post) : undefined)}
          onLongPress={canDeleteFromProfileGallery && canOpen ? () => confirmDeleteProfilePost(post) : undefined}
        >
          {cover ? (
            <Image source={{ uri: cover }} style={styles.gridImage} resizeMode="cover" />
          ) : (
            <View style={[styles.gridPlaceholder, { flex: 1, backgroundColor: profileTileBackground(index) }]} />
          )}
          {post.imageUrls && post.imageUrls.length > 1 ? (
            <View style={styles.gridGalleryBadge} pointerEvents="none">
              <Ionicons name="copy" size={12} color={TEXT} />
            </View>
          ) : null}
        </Pressable>
      );
    },
    [
      canDeleteFromProfileGallery,
      confirmDeleteProfilePost,
      gridTileSize,
      isReelTab,
      openProfilePostsViewer,
      previewUriByPostId,
      reelTileHeight
    ]
  );

  const profileSubject = useMemo(() => {
    if (isPublicProfileView) {
      if (!publicUserName) return null;
      return {
        id: publicUserId,
        fullName: publicUserName,
        username: publicUsername,
        avatarUrl: publicAvatarUrl,
        bio: publicBio
      };
    }
    if (!user) return null;
    return {
      id: user.id,
      fullName: user.fullName,
      username: user.username,
      avatarUrl: user.avatarUrl,
      bio: user.bio
    };
  }, [
    isPublicProfileView,
    publicAvatarUrl,
    publicBio,
    publicUserId,
    publicUserName,
    publicUsername,
    user
  ]);

  const profileModel = useMemo(() => {
    if (!profileSubject) return null;
    const handle = profileSubject.username
      ? `@${String(profileSubject.username).replace(/^@+/, "")}`
      : safeHandle(profileSubject.fullName || "user");
    const initials = String(profileSubject.fullName || "U")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("");
    return { posts: userPosts.length, followers: followersCount, following: followingCount, handle, initials: initials || "U" };
  }, [followersCount, followingCount, profileSubject, userPosts.length]);

  const isInstructor = Boolean(user && (user.role === "instructor" || user.role === "admin"));

  const handleLogout = async () => {
    await signOut();
    navigation.reset({ index: 0, routes: [{ name: "InitialSetup" }] });
  };

  const profileShareRecipients = useMemo(() => {
    const map = new Map<number, { id: number; name: string; avatarUrl?: string | null }>();
    // Share sheet should only show users the viewer is following.
    for (const p of followingList) {
      const id = p.key && /^\d+$/.test(String(p.key)) ? Number(p.key) : null;
      if (!id || map.has(id)) continue;
      map.set(id, { id, name: p.name, avatarUrl: p.avatarUrl });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [followingList]);

  const filteredProfileShareRecipients = useMemo(() => {
    const q = String(shareProfileSearch || "").trim().toLowerCase();
    if (!q) return profileShareRecipients;
    return profileShareRecipients.filter((r) => String(r.name || "").toLowerCase().includes(q));
  }, [profileShareRecipients, shareProfileSearch]);

  const profileChatMessage = useCallback(() => {
    if (!user) return "";
    const handle = profileModel?.handle || safeHandle(user.fullName || user.username || "user");
    return `[Cropvibe Profile]\n${JSON.stringify({
      userId: Number(user.id) || undefined,
      userName: user.fullName || "User",
      handle,
      bio: user.bio || "",
      avatarUrl: user.avatarUrl || null
    })}`;
  }, [profileModel?.handle, user]);

  const profileShareLink = useMemo(() => {
    if (!user) return "";
    const uid = Number(user.id);
    if (Number.isFinite(uid) && uid > 0) return `${getWebAppOrigin()}/profile/${uid}`;
    return `${getWebAppOrigin()}/profile/${encodeURIComponent(profileModel?.handle || safeHandle(user.fullName || user.username || "user"))}`;
  }, [profileModel?.handle, user]);

  const onShareProfileSystem = useCallback(async () => {
    if (!user) return;
    const shareHandle = profileModel?.handle || safeHandle(user.fullName || user.username || "user");
    const text = [`${user.fullName}'s profile on Agrovibes`, shareHandle, profileShareLink].filter(Boolean).join("\n");
    try {
      await Share.share({ title: `${user.fullName} - Agrovibes Profile`, message: text });
    } catch {
      // ignore
    }
  }, [profileModel?.handle, profileShareLink, user]);

  const onCopyProfileLink = useCallback(async () => {
    if (!profileShareLink) return;
    await Clipboard.setStringAsync(profileShareLink);
    Alert.alert(t("copied"), t("profileLinkCopied"));
  }, [profileShareLink]);

  const onShareProfileToWhatsApp = useCallback(async () => {
    if (!profileShareLink) return;
    const text = encodeURIComponent(`Check out this profile on Agrovibes\n${profileShareLink}`);
    const appUrl = `whatsapp://send?text=${text}`;
    const webUrl = `https://wa.me/?text=${text}`;
    try {
      const supported = await Linking.canOpenURL(appUrl);
      await Linking.openURL(supported ? appUrl : webUrl);
    } catch {
      await onShareProfileSystem();
    }
  }, [onShareProfileSystem, profileShareLink]);

  const handleSendProfileToRecipient = useCallback(async (recipient: { id: number; name: string }) => {
    if (!token || !user) return;
    setShareBusyByUserId((prev) => ({ ...prev, [recipient.id]: true }));
    try {
      await sendDirectMessage(token, recipient.id, profileChatMessage());
      Alert.alert(t("shared"), t("profileSharedTo", { name: recipient.name }));
      setShareProfileOpen(false);
    } catch {
      Alert.alert(t("shareFailed"), t("shareFailedProfile"));
    } finally {
      setShareBusyByUserId((prev) => ({ ...prev, [recipient.id]: false }));
    }
  }, [profileChatMessage, token, user]);

  const handleShareProfile = useCallback(async () => {
    if (!user) return;
    if (!profileShareRecipients.length) {
      Alert.alert(t("noRecipients"), t("shareProfileNoRecipients"));
      return;
    }
    setShareProfileSearch("");
    setShareProfileOpen(true);
  }, [profileShareRecipients.length, user]);

  const followBackFromFollowersList = async (person: { name: string; key?: string }) => {
    if (!user?.fullName) return;
    const targetId = person.key && /^\d+$/.test(String(person.key)) ? Number(person.key) : null;
    if (token && targetId && user?.id) {
      try {
        await sendFollowRequest(token, targetId);
        await refreshMergedFollowStats();
        return;
      } catch {
        /* fall back to local */
      }
    }
    await sendLocalFollowRequestByIdentity(
      { name: user.fullName, key: user.email || String(user.id || "") },
      { name: person.name, key: person.key }
    );
    await refreshMergedFollowStats();
  };

  const unfollowFromFollowingList = async (person: { name: string; key?: string }) => {
    if (!user?.fullName) return;
    const targetId = person.key && /^\d+$/.test(String(person.key)) ? Number(person.key) : null;
    if (token && targetId && user?.id) {
      try {
        await unfollowUser(token, targetId);
        await refreshMergedFollowStats();
        return;
      } catch {
        /* fall back to local */
      }
    }
    await removeLocalFollowByIdentity(
      { name: user.fullName, key: user.email || String(user.id || "") },
      { name: person.name, key: person.key }
    );
    await refreshMergedFollowStats();
  };

  const removeFollowerFromList = async (person: { name: string; key?: string }) => {
    if (!user?.fullName) return;
    const targetId = parsePersonUserId(person);
    if (token && targetId && user?.id) {
      try {
        await removeFollower(token, targetId);
        await refreshMergedFollowStats();
        return;
      } catch {
        /* fall back to local */
      }
    }
    await removeLocalFollowByIdentity(
      { name: person.name, key: person.key },
      { name: user.fullName, key: user.email || String(user.id || "") }
    );
    await refreshMergedFollowStats();
  };

  const confirmRemoveFollower = (person: { name: string; key?: string }) => {
    setFollowerRemoveConfirm({ name: person.name, key: person.key });
  };

  const dismissRemoveFollowerConfirm = () => {
    if (removeFollowerBusy) return;
    setFollowerRemoveConfirm(null);
  };

  const executeRemoveFollower = async () => {
    if (!followerRemoveConfirm || removeFollowerBusy) return;
    setRemoveFollowerBusy(true);
    try {
      await removeFollowerFromList(followerRemoveConfirm);
      setFollowerRemoveConfirm(null);
    } finally {
      setRemoveFollowerBusy(false);
    }
  };

  const openPersonChat = (person: { name: string; key?: string; avatarUrl?: string | null }) => {
    const peerUserId = parsePersonUserId(person);
    if (!peerUserId) {
      Alert.alert(t("unavailable"), t("chatUnavailable"));
      return;
    }
    navigation.navigate("DirectChat", {
      peerUserId,
      peerName: person.name,
      peerKey: person.key || String(peerUserId),
      peerAvatarUrl: person.avatarUrl
    });
    setActiveListType(null);
  };

  const toggleFollowingActions = (person: { name: string; key?: string }) => {
    const rowId = personUniqueId(person);
    setFollowingActionMenuFor((prev) => (prev === rowId ? null : rowId));
  };

  const profileHeaderName = isPublicProfileView
    ? publicUsername || publicUserName
    : user?.username || user?.fullName || "";

  const followPublicUser = async () => {
    if (!user?.fullName || isFollowingPublic || followPublicBusy) return;
    setFollowPublicBusy(true);
    try {
      if (token && publicUserId) {
        await sendFollowRequest(token, publicUserId);
      } else {
        await sendLocalFollowRequestByIdentity(
          { name: user.fullName, key: user.email || String(user.id || "") },
          { name: publicUserName, key: publicUserKey || (publicUserId ? String(publicUserId) : undefined) }
        );
      }
      setIsFollowingPublic(true);
      setFollowersCount((v) => v + 1);
    } catch {
      Alert.alert(t("followFailed"), t("tryAgainMoment"));
    } finally {
      setFollowPublicBusy(false);
    }
  };

  const openPublicMessage = () => {
    if (!publicUserId) {
      Alert.alert(t("unavailable"), t("cannotOpenChat"));
      return;
    }
    navigation.navigate("DirectChat", {
      peerUserId: publicUserId,
      peerName: publicUserName,
      peerKey: publicUserKey || String(publicUserId),
      peerAvatarUrl: publicAvatarUrl
    });
  };

  const profileListHeader = useMemo(
    () => (
      <>
        <View style={styles.profileCard}>
          <View style={styles.headerMidRow}>
            <Pressable
              onPress={() => displayAvatarUrl && setAvatarPreviewOpen(true)}
              disabled={!displayAvatarUrl}
              style={({ pressed }) => [styles.avatarPressable, pressed && displayAvatarUrl ? { opacity: 0.85 } : null]}
              accessibilityRole="button"
              accessibilityLabel={t("viewProfilePhoto")}
            >
              <UserAvatar
                uri={profileSubject?.avatarUrl}
                name={profileSubject?.fullName || profileSubject?.username || "U"}
                size={88}
                borderRadius={44}
                fallbackBackgroundColor={SURFACE}
                initialsColor={TEXT}
                style={styles.avatar}
              />
            </Pressable>

            <View style={styles.headerInfo}>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{formatStatCount(profileModel?.posts ?? 0)}</Text>
                  <Text style={styles.statLabel}>{t("posts")}</Text>
                </View>
                {isPublicProfileView ? (
                  <>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{formatStatCount(profileModel?.followers ?? 0)}</Text>
                      <Text style={styles.statLabel}>{t("followers")}</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{formatStatCount(profileModel?.following ?? 0)}</Text>
                      <Text style={styles.statLabel}>{t("profileFollowing")}</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <Pressable style={styles.statItem} onPress={() => setActiveListType("followers")}>
                      <Text style={styles.statValue}>{formatStatCount(profileModel?.followers ?? 0)}</Text>
                      <Text style={styles.statLabel}>{t("followers")}</Text>
                    </Pressable>
                    <Pressable style={styles.statItem} onPress={() => setActiveListType("following")}>
                      <Text style={styles.statValue}>{formatStatCount(profileModel?.following ?? 0)}</Text>
                      <Text style={styles.statLabel}>{t("profileFollowing")}</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          </View>

          {profileSubject?.bio?.trim() ? <Text style={styles.bio}>{profileSubject.bio.trim()}</Text> : null}

          {isPublicProfileView ? (
            <View style={styles.profileActionsRow}>
              <Pressable
                style={styles.profileActionBtn}
                onPress={() => void followPublicUser()}
                disabled={isFollowingPublic || followPublicBusy}
              >
                <Text style={styles.profileActionBtnText}>
                  {isFollowingPublic ? t("following") : followPublicBusy ? t("followBusy") : t("follow")}
                </Text>
              </Pressable>
              <Pressable style={styles.profileActionBtn} onPress={openPublicMessage}>
                <Text style={styles.profileActionBtnText}>{t("messageBtn")}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.profileActionsRow}>
              <Pressable style={styles.profileActionBtn} onPress={navigateToEditProfile}>
                <Text style={styles.profileActionBtnText}>{t("editProfile")}</Text>
              </Pressable>
              <Pressable style={styles.profileActionBtn} onPress={handleShareProfile}>
                <Text style={styles.profileActionBtnText}>Share Profile</Text>
              </Pressable>
            </View>
          )}

          {!isPublicProfileView && isInstructor ? (
            <Pressable style={styles.studioBtn} onPress={() => navigation.navigate("InstructorStudio")}>
              <Ionicons name="school-outline" size={18} color={LIME} />
              <Text style={styles.studioText}>Instructor Studio</Text>
              <Ionicons name="chevron-forward" size={18} color={TEXT} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.gallerySection}>
          <View style={styles.iconTabsRow}>
            {galleryTabs.map((tabKey) => {
              const icons = PROFILE_TAB_ICONS[tabKey];
              const active = activeGalleryTab === tabKey;
              return (
                <Pressable key={tabKey} style={styles.iconTab} onPress={() => handleGalleryTabPress(tabKey)}>
                  <SvgAssetIcon
                    module={active ? icons.active : icons.inactive}
                    size={PROFILE_TAB_ICON}
                    color={active ? LIME : TEXT}
                    fallbackName={active ? PROFILE_TAB_FALLBACKS[tabKey].active : PROFILE_TAB_FALLBACKS[tabKey].inactive}
                  />
                  {active ? <View style={styles.iconTabUnderline} /> : <View style={styles.iconTabSpacer} />}
                </Pressable>
              );
            })}
          </View>
        </View>
      </>
    ),
    [
      activeGalleryTab,
      displayAvatarUrl,
      followPublicBusy,
      galleryTabs,
      handleGalleryTabPress,
      handleShareProfile,
      isFollowingPublic,
      isInstructor,
      isPublicProfileView,
      openPublicMessage,
      profileModel?.followers,
      profileModel?.following,
      profileModel?.posts,
      profileSubject?.avatarUrl,
      profileSubject?.bio,
      profileSubject?.fullName,
      profileSubject?.username,
      t
    ]
  );

  const profileListEmpty = useMemo(() => {
    if (galleryLoading) {
      return (
        <View style={styles.galleryLoadingWrap}>
          <ActivityIndicator size="small" color={LIME} />
        </View>
      );
    }
    return (
      <View style={styles.galleryEmptyWrap}>
        <Text style={styles.galleryEmptyTitle}>{isReelTab ? t("emptyReelsTitle") : t("emptyNothingTitle")}</Text>
        <Text style={styles.galleryEmptySub}>{isReelTab ? t("emptyReelsSub") : t("emptyDefaultSub")}</Text>
      </View>
    );
  }, [galleryLoading, isReelTab, t]);

  return (
    <>
      <SafeAreaView style={styles.safeRoot} edges={["top"]}>
        {profileSubject ? (
          <View
            style={[
              styles.topBar,
              { maxWidth: Math.min(PROFILE_HEADER_MAX_WIDTH, width) }
            ]}
          >
            {isPublicProfileView ? (
              <Pressable style={styles.topBarBackBtn} hitSlop={8} accessibilityLabel="Back" onPress={() => navigation.goBack()}>
                <Ionicons name="chevron-back" size={26} color={TEXT} />
              </Pressable>
            ) : null}
            <View style={[styles.topBarUsernameWrap, isPublicProfileView ? styles.topBarUsernameWrapPublic : null]}>
              <Text style={styles.topBarUsername} numberOfLines={1}>
                {profileHeaderName}
              </Text>
            </View>
            {isPublicProfileView ? (
              <View style={styles.topBarBackBtn} />
            ) : (
              <Pressable
                style={styles.topBarMenuBtn}
                hitSlop={8}
                accessibilityLabel="Menu"
                onPress={() => navigation.navigate("SettingsMenu")}
              >
                <SvgAssetIcon module={PROFILE_ASSETS.menu} size={34} color={TEXT} fallbackName="menu-outline" />
              </Pressable>
            )}
          </View>
        ) : null}

        {!profileSubject && !isPublicProfileView ? (
          <ScrollView style={styles.screen} contentContainerStyle={styles.scrollBottom}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t("welcome")}</Text>
              <Text style={styles.cardSub}>{t("welcomeSub")}</Text>
              <Pressable style={styles.primaryBtn} onPress={() => navigation.reset({ index: 0, routes: [{ name: "InitialSetup" }] })}>
                <Ionicons name="log-in-outline" size={18} color={TEXT} />
                <Text style={styles.primaryBtnText}>{t("getStarted")}</Text>
              </Pressable>
            </View>
          </ScrollView>
        ) : profileSubject ? (
          <FlatList
            key={activeGalleryTab}
            style={styles.screen}
            contentContainerStyle={styles.scrollBottom}
            data={galleryLoading ? [] : visiblePosts}
            keyExtractor={(item) => String(item.id)}
            numColumns={3}
            renderItem={renderProfileGridItem}
            columnWrapperStyle={styles.gridRow}
            ListHeaderComponent={profileListHeader}
            ListEmptyComponent={profileListEmpty}
            initialNumToRender={12}
            maxToRenderPerBatch={9}
            windowSize={5}
            removeClippedSubviews={Platform.OS === "android"}
            showsVerticalScrollIndicator={false}
          />
        ) : null}
      </SafeAreaView>

      <PostsReelViewerModal
        visible={!!profileReelViewer}
        posts={profileReelViewer?.posts ?? []}
        initialIndex={profileReelViewer?.initialIndex ?? 0}
        onClose={() => setProfileReelViewer(null)}
        onPostsChange={handleProfileReelPostsChange}
        canDeleteOwnPosts={canDeleteFromProfileGallery}
      />

      <Modal
        visible={shareProfileOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setShareProfileOpen(false)}
      >
        <View style={styles.overlay}>
          <Pressable style={styles.overlayTapAboveSheet} onPress={() => setShareProfileOpen(false)} />
          <View style={styles.sheet} collapsable={false}>
            <View style={styles.profileShareHandle} />
            <View style={styles.profileShareSearchRow}>
              <Ionicons name="search" size={16} color={LIME} />
              <TextInput
                value={shareProfileSearch}
                onChangeText={setShareProfileSearch}
                placeholder={t("search")}
                placeholderTextColor={SURFACE_ALT}
                style={styles.profileShareSearchInput}
              />
              <Pressable style={styles.profileShareSearchAction} onPress={onShareProfileSystem}>
                <Ionicons name="person-add-outline" size={16} color={LIME} />
              </Pressable>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.profileSharePeopleRow}>
              {filteredProfileShareRecipients.length ? (
                filteredProfileShareRecipients.map((recipient) => (
                  <Pressable
                    key={recipient.id}
                    style={styles.profileSharePersonItem}
                    onPress={() => void handleSendProfileToRecipient(recipient)}
                    disabled={!!shareBusyByUserId[recipient.id]}
                  >
                    <View style={styles.profileSharePersonAvatar}>
                      {shareBusyByUserId[recipient.id] ? (
                        <Ionicons name="checkmark" size={18} color={LIME} />
                      ) : (
                        <UserAvatar
                          uri={recipient.avatarUrl}
                          name={recipient.name}
                          size={52}
                          borderRadius={26}
                          fallbackBackgroundColor={SURFACE}
                          initialsColor={LIME}
                        />
                      )}
                    </View>
                    <Text style={styles.profileSharePersonName} numberOfLines={1}>{recipient.name}</Text>
                  </Pressable>
                ))
              ) : (
                <Text style={styles.sheetEmpty}>{t("noChatsFound")}</Text>
              )}
            </ScrollView>
            <View style={styles.profileShareFooterRow}>
              <Pressable style={styles.profileShareFooterAction} onPress={onShareProfileSystem}>
                <View style={styles.profileShareFooterIcon}><Ionicons name="add-circle-outline" size={20} color={LIME} /></View>
                <Text style={styles.profileShareFooterText}>{t("addToStory")}</Text>
              </Pressable>
              <Pressable style={styles.profileShareFooterAction} onPress={onCopyProfileLink}>
                <View style={styles.profileShareFooterIcon}><Ionicons name="link-outline" size={20} color={LIME} /></View>
                <Text style={styles.profileShareFooterText}>{t("copyLink")}</Text>
              </Pressable>
              <Pressable style={styles.profileShareFooterAction} onPress={onShareProfileSystem}>
                <View style={styles.profileShareFooterIcon}><Ionicons name="open-outline" size={20} color={LIME} /></View>
                <Text style={styles.profileShareFooterText}>Share To..</Text>
              </Pressable>
              <Pressable style={styles.profileShareFooterAction} onPress={onShareProfileToWhatsApp}>
                <View style={styles.profileShareFooterIcon}><Ionicons name="logo-whatsapp" size={20} color={LIME} /></View>
                <Text style={styles.profileShareFooterText}>{t("whatsapp")}</Text>
              </Pressable>
              <Pressable style={styles.profileShareFooterAction} onPress={onShareProfileSystem}>
                <View style={styles.profileShareFooterIcon}><Ionicons name="chatbubble-ellipses-outline" size={20} color={LIME} /></View>
                <Text style={styles.profileShareFooterText}>{t("messenger")}</Text>
              </Pressable>
              <Pressable style={styles.profileShareFooterAction} onPress={onShareProfileSystem}>
                <View style={styles.profileShareFooterIcon}><Ionicons name="logo-snapchat" size={20} color={LIME} /></View>
                <Text style={styles.profileShareFooterText}>{t("snapchat")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!activeListType}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setFollowingActionMenuFor(null);
          setActiveListType(null);
        }}
      >
        <View style={styles.overlay}>
          <Pressable
            style={styles.overlayTapAboveSheet}
            onPress={() => {
              setFollowingActionMenuFor(null);
              setActiveListType(null);
            }}
          />
          <View style={styles.sheet} collapsable={false}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{activeListType === "followers" ? t("followers") : t("profileFollowing")}</Text>
              <Pressable
                onPress={() => {
                  setFollowingActionMenuFor(null);
                  setActiveListType(null);
                }}
              >
                <Ionicons name="close" size={22} color={TEXT} />
              </Pressable>
            </View>
            <ScrollView
              style={[styles.sheetScroll, { maxHeight: Math.min(440, Math.round(windowHeight * 0.52)) }]}
              contentContainerStyle={styles.sheetBody}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              bounces={false}
            >
              {(activeListType === "followers" ? followersList : followingList).length === 0 ? (
                <Text style={styles.sheetEmpty}>{t("noUsersFound")}</Text>
              ) : (
                (activeListType === "followers" ? followersList : followingList).map((person, idx) => {
                  const rowId = personUniqueId(person);
                  const isFollowingMenuOpen = activeListType === "following" && followingActionMenuFor === rowId;
                  return (
                    <View key={`${person.key || person.name}-${idx}`} style={[styles.personRow, isFollowingMenuOpen ? styles.personRowMenuOpen : null]}>
                      <UserAvatar
                        uri={person.avatarUrl}
                        name={person.name}
                        size={40}
                        borderRadius={20}
                        style={styles.personListAvatar}
                        fallbackBackgroundColor={SURFACE}
                        initialsColor={LIME}
                      />
                      <Text style={styles.personName} numberOfLines={2}>
                        {person.name}
                      </Text>
                      {activeListType === "followers" ? (
                        <View style={styles.personActionsRow} collapsable={false}>
                          <Pressable style={styles.messageBtn} onPress={() => openPersonChat(person)}>
                            <Text style={styles.messageBtnText}>Message</Text>
                          </Pressable>
                          <TouchableOpacity
                            activeOpacity={0.75}
                            style={styles.iconDangerBtn}
                            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                            onPress={() => confirmRemoveFollower(person)}
                            accessibilityRole="button"
                            accessibilityLabel={`Remove ${person.name} from followers`}
                          >
                            <Ionicons name="close" size={16} color={TEXT} />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={styles.personActionsRow}>
                          <Pressable style={styles.messageBtn} onPress={() => openPersonChat(person)}>
                            <Text style={styles.messageBtnText}>Message</Text>
                          </Pressable>
                          <Pressable style={styles.iconMoreBtn} hitSlop={10} onPress={() => toggleFollowingActions(person)}>
                            <Ionicons name="ellipsis-vertical" size={17} color={TEXT} />
                          </Pressable>
                          {isFollowingMenuOpen ? (
                            <View style={styles.followingMenuInlineRow}>
                              <Pressable
                                style={styles.followingMenuItem}
                                onPress={() => {
                                  setFollowingActionMenuFor(null);
                                  void unfollowFromFollowingList(person);
                                }}
                              >
                                <Text style={styles.followingMenuItemText}>Unfollow</Text>
                              </Pressable>
                            </View>
                          ) : null}
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!followerRemoveConfirm}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={dismissRemoveFollowerConfirm}
      >
        <View style={styles.confirmOverlayRoot}>
          <Pressable style={styles.confirmBackdrop} onPress={dismissRemoveFollowerConfirm} accessibilityLabel="Dismiss" />
          <View style={styles.confirmCard} accessibilityViewIsModal>
            <Text style={styles.confirmTitle}>Remove follower?</Text>
            <Text style={styles.confirmBody}>
              <Text style={styles.confirmName}>{followerRemoveConfirm?.name}</Text>
              <Text style={styles.confirmBodyMuted}> will be removed from your followers.</Text>
            </Text>
            <View style={styles.confirmActions}>
              <Pressable
                style={[styles.confirmBtnSecondary, removeFollowerBusy && styles.confirmBtnDisabled]}
                onPress={dismissRemoveFollowerConfirm}
                disabled={removeFollowerBusy}
              >
                <Text style={styles.confirmBtnSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmBtnDanger, removeFollowerBusy && styles.confirmBtnDisabled]}
                onPress={() => void executeRemoveFollower()}
                disabled={removeFollowerBusy}
              >
                <Text style={styles.confirmBtnDangerText}>{removeFollowerBusy ? "…" : "Remove"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={avatarPreviewOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAvatarPreviewOpen(false)}
      >
        <View style={styles.avatarPreviewRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAvatarPreviewOpen(false)} accessibilityLabel="Close preview" />
          <View style={styles.avatarPreviewLayer} pointerEvents="box-none">
            <View
              style={[
                styles.avatarPreviewCircle,
                {
                  width: avatarPreviewSize,
                  height: avatarPreviewSize,
                  borderRadius: avatarPreviewSize / 2
                }
              ]}
            >
              {displayAvatarUrl ? (
                <Image
                  source={{ uri: displayAvatarUrl }}
                  style={{ width: avatarPreviewSize, height: avatarPreviewSize }}
                  resizeMode="cover"
                />
              ) : null}
            </View>
            <Pressable
              onPress={() => setAvatarPreviewOpen(false)}
              style={[styles.avatarPreviewClose, { top: insets.top + 8 }]}
              hitSlop={12}
            >
              <Ionicons name="close-circle" size={44} color="rgba(255,255,255,0.92)" />
            </Pressable>
          </View>
        </View>
      </Modal>

    </>
  );
}

const styles = StyleSheet.create({
  safeRoot: { flex: 1, backgroundColor: PAGE_BG },
  screen: { flex: 1, backgroundColor: PAGE_BG },
  scrollBottom: { paddingBottom: 100 },

  topBar: {
    width: "100%",
    alignSelf: "center",
    height: PROFILE_HEADER_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: SURFACE_ALT
  },
  topBarUsernameWrap: {
    flex: 1,
    marginRight: 12,
    justifyContent: "center"
  },
  topBarUsername: {
    fontSize: 16,
    fontWeight: "800",
    color: LIME,
    lineHeight: 20
  },
  topBarMenuBtn: {
    flexShrink: 0
  },
  topBarBackBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  },
  topBarUsernameWrapPublic: {
    alignItems: "center"
  },
  menuIcon: {
    width: 34,
    height: 34
  },

  card: {
    margin: 12,
    borderRadius: 16,
    backgroundColor: PAGE_BG,
    borderWidth: 1,
    borderColor: SURFACE_ALT,
    padding: 16
  },
  cardTitle: { fontSize: 20, fontWeight: "900", color: TEXT },
  cardSub: { marginTop: 6, color: TEXT, opacity: 0.62, fontWeight: "600", lineHeight: 18 },
  primaryBtn: {
    marginTop: 16,
    borderRadius: 14,
    backgroundColor: SURFACE,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  primaryBtnText: { color: TEXT, fontWeight: "900" },

  profileCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: PAGE_BG,
    paddingBottom: 4
  },
  headerMidRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  headerInfo: { flex: 1, minWidth: 0 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44
  },
  avatarPressable: { borderRadius: 44 },
  avatarPreviewRoot: { flex: 1, backgroundColor: "rgba(0,0,0,0.88)" },
  avatarPreviewLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center"
  },
  avatarPreviewCircle: {
    overflow: "hidden",
    borderWidth: 3,
    borderColor: LIME
  },
  avatarPreviewClose: { position: "absolute", right: 14, zIndex: 4 },

  statsRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  statItem: { flex: 1, alignItems: "flex-start", minWidth: 0 },
  statValue: { fontWeight: "800", color: TEXT, fontSize: 16, textAlign: "left" },
  statLabel: {
    marginTop: 2,
    color: TEXT,
    opacity: 0.62,
    fontWeight: "600",
    fontSize: 12,
    lineHeight: 14,
    textAlign: "left"
  },

  bio: { marginTop: 14, color: TEXT, fontWeight: "500", fontSize: 13, lineHeight: 19 },

  profileActionsRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  profileActionBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 8,
    backgroundColor: SURFACE,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  profileActionBtnText: { color: TEXT, fontWeight: "700", fontSize: 14 },

  studioBtn: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: SURFACE_ALT
  },
  studioText: { flex: 1, fontWeight: "900", color: TEXT, fontSize: 14 },
  logoutLink: { marginTop: 10, alignSelf: "center", paddingVertical: 6 },
  logoutLinkText: { color: TEXT, opacity: 0.62, fontWeight: "700", fontSize: 13, textDecorationLine: "underline" },

  gallerySection: { marginTop: 18, marginBottom: 16 },
  galleryLoadingWrap: { width: "100%", alignItems: "center", justifyContent: "center", paddingVertical: 48 },
  galleryEmptyWrap: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 48,
    gap: 8
  },
  galleryEmptyTitle: { color: TEXT, fontSize: 16, fontWeight: "700", textAlign: "center" },
  galleryEmptySub: { color: "#a8a8a8", fontSize: 14, textAlign: "center", lineHeight: 20 },
  iconTabsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: SURFACE_ALT,
    paddingBottom: 4,
    marginHorizontal: 16
  },
  iconTab: { alignItems: "center", minWidth: 56, paddingVertical: 8 },
  profileTabIcon: { width: PROFILE_TAB_ICON, height: PROFILE_TAB_ICON },
  iconTabUnderline: { marginTop: 8, height: 2, width: 32, backgroundColor: LIME, borderRadius: 2 },
  iconTabSpacer: { marginTop: 8, height: 2, width: 32 },

  gridList: { width: "100%" },
  gridRow: { gap: 2, marginBottom: 2 },
  gridTile: { overflow: "hidden", position: "relative" },
  gridImage: { width: "100%", height: "100%" },
  gridPlayBadge: {
    position: "absolute",
    top: 8,
    right: 8
  },
  gridVideoIcon: { width: 20, height: 20 },
  gridPlaceholder: {},
  gridVideoBg: { backgroundColor: PAGE_BG },
  gridVideoPlaceholder: { alignItems: "center", justifyContent: "center" },
  gridPastelA: { backgroundColor: SURFACE },
  gridPastelB: { backgroundColor: SURFACE_ALT },
  gridPastelC: { backgroundColor: SURFACE },

  emptyWrap: {
    width: "100%",
    alignItems: "center",
    paddingVertical: 28,
    gap: 8
  },
  emptyText: { color: TEXT, opacity: 0.62, fontWeight: "700", textAlign: "center" },
  emptySub: { color: TEXT, opacity: 0.62, fontSize: 14, textAlign: "center", marginTop: 8 },

  reelPlayerRoot: { flex: 1, backgroundColor: REEL_GRID_TILE_A },
  imageViewerRoot: { flex: 1, backgroundColor: REEL_GRID_TILE_B },
  gridGalleryBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: SURFACE_ALT,
    alignItems: "center",
    justifyContent: "center"
  },
  reelCloseBtn: {
    position: "absolute",
    top: 44,
    right: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: SURFACE,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: SURFACE_ALT,
    zIndex: 10
  },
  reelDeleteBtn: {
    position: "absolute",
    top: 44,
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: SURFACE,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: SURFACE_ALT,
    zIndex: 10
  },
  reelCaptionWrap: {
    position: "absolute",
    left: 16,
    right: 64,
    bottom: 28,
    gap: 4
  },
  reelCaptionAuthor: { color: TEXT, fontWeight: "900", fontSize: 15 },
  reelCaptionText: { color: TEXT, opacity: 0.72, fontWeight: "600", fontSize: 13 },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(38,38,38,0.72)"
  },
  /** Only the dimmed area above the sheet — does not stack under the sheet, so row buttons receive touches. */
  overlayTapAboveSheet: {
    flex: 1,
    width: "100%"
  },
  sheet: {
    backgroundColor: PAGE_BG,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: "72%",
    width: "100%",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderColor: SURFACE_ALT,
    elevation: 12
  },
  sheetScroll: {
    flexGrow: 0
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { color: TEXT, fontWeight: "900", fontSize: 17 },
  sheetBody: { paddingTop: 12, gap: 10 },
  sheetEmpty: { color: TEXT, opacity: 0.62, fontWeight: "700" },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: SURFACE_ALT,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: SURFACE
  },
  personRowMenuOpen: { zIndex: 40 },
  personListAvatar: { marginRight: 10 },
  personName: {
    color: TEXT,
    fontWeight: "800",
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    marginRight: 10
  },
  personActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
    position: "relative",
    zIndex: 4
  },
  messageBtn: { backgroundColor: SURFACE_ALT, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  messageBtnText: { color: TEXT, fontWeight: "900", fontSize: 12 },
  iconDangerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: SURFACE_ALT,
    borderWidth: 1,
    borderColor: SURFACE,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 6
  },
  iconMoreBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: SURFACE_ALT,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2
  },
  followingMenuInlineRow: {
    position: "absolute",
    right: 42,
    top: 2,
    minWidth: 132,
    borderRadius: 10,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: SURFACE_ALT,
    overflow: "hidden",
    zIndex: 20
  },
  followingMenuItem: {
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  followingMenuItemText: {
    color: TEXT,
    fontWeight: "800",
    fontSize: 12
  },
  followBackBtn: { backgroundColor: SURFACE_ALT, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  followBackBtnText: { color: TEXT, fontWeight: "900", fontSize: 12 },
  requestedPill: { backgroundColor: SURFACE, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  requestedPillText: { color: TEXT, opacity: 0.72, fontWeight: "800", fontSize: 12 },
  followingPill: { backgroundColor: SURFACE_ALT, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  followingPillText: { color: TEXT, fontWeight: "800", fontSize: 12 },
  unfollowBtn: { backgroundColor: SURFACE, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  unfollowBtnText: { color: TEXT, fontWeight: "800", fontSize: 12 },

  confirmOverlayRoot: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28
  },
  confirmBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(38,38,38,0.82)"
  },
  confirmCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: PAGE_BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: SURFACE_ALT,
    padding: 22,
    zIndex: 2,
    elevation: 16
  },
  confirmTitle: {
    color: TEXT,
    fontSize: 19,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 12
  },
  confirmBody: {
    color: TEXT,
    opacity: 0.62,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 22
  },
  confirmName: { color: LIME, fontWeight: "800" },
  confirmBodyMuted: { color: TEXT, opacity: 0.62, fontWeight: "600" },
  confirmActions: { flexDirection: "row", gap: 12, justifyContent: "center" },
  confirmBtnSecondary: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: SURFACE_ALT,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SURFACE
  },
  confirmBtnSecondaryText: { color: TEXT, fontWeight: "900", fontSize: 15 },
  confirmBtnDanger: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SURFACE_ALT,
    borderWidth: 1,
    borderColor: SURFACE
  },
  confirmBtnDangerText: { color: TEXT, fontWeight: "900", fontSize: 15 },
  confirmBtnDisabled: { opacity: 0.55 },

  profileShareHandle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: SURFACE_ALT,
    marginBottom: 10
  },
  profileShareSearchRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SURFACE_ALT,
    backgroundColor: SURFACE,
    paddingHorizontal: 10,
    gap: 8
  },
  profileShareSearchInput: { flex: 1, color: TEXT, fontSize: 13, fontWeight: "600", paddingVertical: 9 },
  profileShareSearchAction: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SURFACE_ALT
  },
  profileSharePeopleRow: {
    gap: 10,
    paddingTop: 12,
    paddingBottom: 8
  },
  profileSharePersonItem: { alignItems: "center", width: 70 },
  profileSharePersonAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SURFACE
  },
  profileSharePersonName: { marginTop: 6, color: TEXT, fontSize: 11, fontWeight: "700", textAlign: "center" },
  profileShareFooterRow: {
    marginTop: 6,
    borderTopWidth: 1,
    borderColor: SURFACE_ALT,
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10
  },
  profileShareFooterAction: { alignItems: "center", gap: 6, flex: 1 },
  profileShareFooterIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: SURFACE_ALT,
    backgroundColor: SURFACE
  },
  profileShareFooterText: { color: TEXT, opacity: 0.62, fontSize: 9, fontWeight: "700", textAlign: "center" }
});
