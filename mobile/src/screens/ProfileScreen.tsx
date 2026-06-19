import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  ActivityIndicator,
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
import { ResizeMode, Video } from "expo-av";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../auth/AuthContext";
import { videoPlaybackUrl } from "../utils/videoPlaybackUrl";
import { UserAvatar } from "../components/UserAvatar";
import { useLanguage } from "../localization/LanguageContext";
import {
  fetchSavedHomePosts,
  fetchMyHomePosts,
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
import { reelGridStillUri, reelGridTileBackground, REEL_GRID_TILE_A } from "../utils/reelGrid";

const TEAL = APP_LIME;
const CREAM = "#121212";
const CARD = "#121212";
const TEXT = "#ffffff";
const MUTED = "#9e9e9e";
const BEIGE_FOLLOW = "#303132";
const LIME = APP_LIME;
const PROFILE_TAB_ICON = 32;

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

function profileTileBackground(index: number) {
  return reelGridTileBackground(index, 3);
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

type GalleryTab = "Posts" | "Reels" | "Saved" | "Tagged";

export function ProfileScreen({ route }: { route?: any }) {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { width, height: windowHeight } = useWindowDimensions();
  const { user, token, signOut } = useAuth();
  const { t } = useLanguage();
  const [userPosts, setUserPosts] = useState<HomePost[]>([]);
  const [savedPosts, setSavedPosts] = useState<HomePost[]>([]);
  const [taggedPosts, setTaggedPosts] = useState<HomePost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
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
  const isMountedRef = useRef(true);

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
    if (!token || !user?.id) {
      setUserPosts([]);
      return;
    }
    setPostsLoading(true);
    try {
      const data = await fetchMyHomePosts(token);
      if (!isMountedRef.current) return;
      const posts = data.posts || [];
      setUserPosts(posts);
      writeProfilePostsCache({ userId: Number(user.id), userPosts: posts, fetchedAt: Date.now() });
    } catch {
      if (!isMountedRef.current) return;
      setUserPosts([]);
    } finally {
      if (isMountedRef.current) setPostsLoading(false);
    }
  }, [token, user?.id]);

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
      if (route?.params?.initialTab === "Saved") {
        setActiveGalleryTab("Saved");
      }
    }, [route?.params?.initialTab])
  );

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      const hadCache = hydrateProfilePostsFromCache();
      void loadUserPosts();
      if (savedLoadedRef.current) void loadSavedPosts();
      if (taggedLoadedRef.current) void loadTaggedPosts();
      if (!hadCache && !savedLoadedRef.current && !taggedLoadedRef.current) {
        // Preload saved in background — common profile tab after reels.
        void loadSavedPosts();
      }
    }, [hydrateProfilePostsFromCache, loadSavedPosts, loadTaggedPosts, loadUserPosts, user?.id])
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
    void refreshMergedFollowStats();
  }, [refreshMergedFollowStats]);

  const visiblePosts = useMemo(() => {
    if (activeGalleryTab === "Reels") return userPosts.filter((p) => !!p.videoUrl);
    if (activeGalleryTab === "Saved") return savedPosts.filter((p) => !!p.videoUrl);
    if (activeGalleryTab === "Tagged") return taggedPosts.filter((p) => !!p.videoUrl);
    return userPosts.filter((p) => !p.videoUrl);
  }, [activeGalleryTab, savedPosts, taggedPosts, userPosts]);

  const galleryLoading = useMemo(() => {
    if (activeGalleryTab === "Saved") return savedLoading && savedPosts.length === 0;
    if (activeGalleryTab === "Tagged") return taggedLoading && taggedPosts.length === 0;
    return postsLoading && userPosts.length === 0;
  }, [activeGalleryTab, postsLoading, savedLoading, savedPosts.length, taggedLoading, taggedPosts.length, userPosts.length]);

  /** Web only: at most one live grid preview when a reel has no still image. */
  const singleGridVideoPreviewId = useMemo(() => {
    if (activeGalleryTab !== "Reels" && activeGalleryTab !== "Saved" && activeGalleryTab !== "Tagged") return null;
    for (const p of visiblePosts) {
      if (!p.videoUrl || reelGridStillUri(p)) continue;
      return p.id;
    }
    return null;
  }, [activeGalleryTab, visiblePosts]);

  const canDeleteFromProfileGallery = activeGalleryTab === "Posts" || activeGalleryTab === "Reels";

  const openProfilePostsViewer = useCallback(
    (post: HomePost) => {
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

  const profileModel = useMemo(() => {
    if (!user) return null;
    const handle = user.username ? `@${user.username.replace(/^@+/, "")}` : safeHandle(user.fullName || user.email);
    const initials = String(user.fullName || user.email || "U")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("");
    return { posts: userPosts.length, followers: followersCount, following: followingCount, handle, initials: initials || "U" };
  }, [followersCount, followingCount, user, userPosts.length]);

  const roleLabel = useMemo(() => {
    if (!user) return "";
    if (user.role === "instructor" || user.role === "admin") return "Instructor · Seller";
    return "Farmer · Buyer";
  }, [user]);

  const bioText = useMemo(() => {
    if (!user) return "";
    return user.bio?.trim() || `${user.fullName} — growing and trading fresh produce. Share tips and connect with the community.`;
  }, [user]);

  const locationDisplay = useMemo(() => {
    if (!user?.locationLabel) return "Add your district";
    const parts = user.locationLabel.split(",").map((s) => s.trim());
    if (parts.length >= 2) return `${parts[0]}, ${parts[1]}`;
    return user.locationLabel;
  }, [user]);

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

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.scrollBottom}>
        {!user ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("welcome")}</Text>
            <Text style={styles.cardSub}>{t("welcomeSub")}</Text>
            <Pressable style={styles.primaryBtn} onPress={() => navigation.reset({ index: 0, routes: [{ name: "InitialSetup" }] })}>
              <Ionicons name="log-in-outline" size={18} color="#111" />
              <Text style={styles.primaryBtnText}>{t("getStarted")}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.profileCard}>
              <View style={styles.headerMidRow}>
                <UserAvatar
                  uri={user.avatarUrl}
                  name={user.fullName || user.username || user.email || "U"}
                  size={88}
                  borderRadius={44}
                  fallbackBackgroundColor={REEL_GRID_TILE_A}
                  initialsColor={MUTED}
                  style={styles.avatar}
                />

                <View style={styles.headerInfo}>
                  <Text style={styles.usernameTitle} numberOfLines={1}>
                    {user.username || user.fullName}
                  </Text>
                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{formatStatCount(profileModel?.posts ?? 0)}</Text>
                      <Text style={styles.statLabel}>{t("posts")}</Text>
                    </View>
                    <Pressable style={styles.statItem} onPress={() => setActiveListType("followers")}>
                      <Text style={styles.statValue}>{formatStatCount(profileModel?.followers ?? 0)}</Text>
                      <Text style={styles.statLabel}>{t("followers")}</Text>
                    </Pressable>
                    <Pressable style={styles.statItem} onPress={() => setActiveListType("following")}>
                      <Text style={styles.statValue}>{formatStatCount(profileModel?.following ?? 0)}</Text>
                      <Text style={styles.statLabel}>{t("profileFollowing")}</Text>
                    </Pressable>
                  </View>
                </View>
              </View>

              <Text style={styles.bio}>{bioText}</Text>

              <View style={styles.profileActionsRow}>
                <Pressable style={styles.profileActionBtn} onPress={navigateToEditProfile}>
                  <Text style={styles.profileActionBtnText}>{t("editProfile")}</Text>
                </Pressable>
                <Pressable style={styles.profileActionBtn} onPress={handleShareProfile}>
                  <Text style={styles.profileActionBtnText}>Share Profile</Text>
                </Pressable>
              </View>

              {isInstructor ? (
                <Pressable style={styles.studioBtn} onPress={() => navigation.navigate("InstructorStudio")}>
                  <Ionicons name="school-outline" size={18} color={TEAL} />
                  <Text style={styles.studioText}>Instructor Studio</Text>
                  <Ionicons name="chevron-forward" size={18} color={MUTED} />
                </Pressable>
              ) : null}

            </View>

            <View style={styles.gallerySection}>
              <View style={styles.iconTabsRow}>
                {(["Posts", "Reels", "Saved", "Tagged"] as const).map((tabKey) => {
                  const icons = PROFILE_TAB_ICONS[tabKey];
                  const active = activeGalleryTab === tabKey;
                  return (
                    <Pressable key={tabKey} style={styles.iconTab} onPress={() => setActiveGalleryTab(tabKey)}>
                      <Image
                        source={active ? icons.active : icons.inactive}
                        style={styles.profileTabIcon}
                        resizeMode="contain"
                      />
                      {active ? <View style={styles.iconTabUnderline} /> : <View style={styles.iconTabSpacer} />}
                    </Pressable>
                  );
                })}
              </View>

              <View style={[styles.grid, { gap: gridGap }]}>
                {galleryLoading ? (
                  <View style={styles.galleryLoadingWrap}>
                    <ActivityIndicator size="small" color={LIME} />
                  </View>
                ) : visiblePosts.length ? (
                  visiblePosts.map((post, index) => {
                    const tileHeight = isReelTab ? reelTileHeight : gridTileSize;
                    const tileStyle = [
                      styles.gridTile,
                      { width: gridTileSize, height: tileHeight, backgroundColor: profileTileBackground(index) }
                    ];
                    if (post.videoUrl) {
                      const stillUri = reelGridStillUri(post);
                      if (stillUri) {
                        return (
                          <Pressable
                            key={post.id}
                            style={tileStyle}
                            onPress={() => openProfilePostsViewer(post)}
                            onLongPress={canDeleteFromProfileGallery ? () => confirmDeleteProfilePost(post) : undefined}
                          >
                            <Image source={{ uri: stillUri }} style={styles.gridImage} resizeMode="cover" />
                            <View style={styles.gridPlayBadge} pointerEvents="none">
                              <Image source={require("../../assets/video-icon.svg")} style={styles.gridVideoIcon} resizeMode="contain" />
                            </View>
                          </Pressable>
                        );
                      }
                      /** One muted grid preview when no still image (web + native). */
                      const shouldPlayTile = post.id === singleGridVideoPreviewId;
                      return (
                        <Pressable
                          key={post.id}
                          style={tileStyle}
                          onPress={() => openProfilePostsViewer(post)}
                          onLongPress={canDeleteFromProfileGallery ? () => confirmDeleteProfilePost(post) : undefined}
                        >
                          <Video
                            style={styles.gridImage}
                            source={{ uri: videoPlaybackUrl(post.videoUrl) }}
                            resizeMode={ResizeMode.COVER}
                            shouldPlay={shouldPlayTile}
                            isLooping
                            isMuted
                            useNativeControls={false}
                            progressUpdateIntervalMillis={2000}
                          />
                          <View style={styles.gridPlayBadge} pointerEvents="none">
                            <Image source={require("../../assets/video-icon.svg")} style={styles.gridVideoIcon} resizeMode="contain" />
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
                            <Ionicons name="copy" size={12} color="#fff" />
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })
                ) : (
                  <View style={styles.placeholderGridRow}>
                    {activeGalleryTab === "Tagged" ? (
                      <View style={styles.emptyWrap}>
                        <Ionicons name="pricetag-outline" size={22} color={MUTED} />
                        <Text style={styles.emptyText}>{t("noTaggedPosts")}</Text>
                      </View>
                    ) : activeGalleryTab === "Saved" ? (
                      <View style={styles.emptyWrap}>
                        <Ionicons name="bookmark-outline" size={22} color={MUTED} />
                        <Text style={styles.emptyText}>{t("savedReelsEmpty")}</Text>
                      </View>
                    ) : (
                      <>
                        {Array.from({ length: 9 }).map((_, index) => (
                          <View
                            key={`placeholder-${index}`}
                            style={[
                              styles.gridPlaceholder,
                              {
                                width: gridTileSize,
                                height: gridTileSize,
                                backgroundColor: profileTileBackground(index)
                              }
                            ]}
                          />
                        ))}
                      </>
                    )}
                  </View>
                )}
              </View>
            </View>
          </>
        )}
      </ScrollView>

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
                placeholderTextColor={MUTED}
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
                          fallbackBackgroundColor="#29303a"
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
                <Ionicons name="close" size={22} color={TEAL} />
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
                        fallbackBackgroundColor="#29303a"
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
                            <Ionicons name="close" size={16} color="#fff" />
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

    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: CREAM },
  scrollBottom: { paddingBottom: 100 },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    backgroundColor: "#262626",
    paddingHorizontal: 10,
    paddingVertical: 8,
    paddingTop: 10,
    gap: 6
  },
  topBarIcons: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBadgeWrap: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    position: "relative"
  },
  notificationBadge: {
    position: "absolute",
    right: -6,
    top: -4,
    backgroundColor: LIME,
    borderRadius: 8,
    minWidth: 14,
    height: 14,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center"
  },
  notificationBadgeText: { color: "#1f2b28", fontSize: 8, fontWeight: "800" },

  card: { margin: 12, borderRadius: 16, backgroundColor: CARD, borderWidth: 1, borderColor: "#303842", padding: 16 },
  cardTitle: { fontSize: 20, fontWeight: "900", color: TEXT },
  cardSub: { marginTop: 6, color: MUTED, fontWeight: "600", lineHeight: 18 },
  primaryBtn: {
    marginTop: 16,
    borderRadius: 14,
    backgroundColor: TEAL,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  primaryBtnText: { color: "#111", fontWeight: "900" },

  profileCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: CREAM,
    paddingBottom: 4
  },
  headerMidRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  headerInfo: { flex: 1, minWidth: 0 },
  usernameTitle: { fontSize: 16, fontWeight: "800", color: TEXT, marginBottom: 10 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44
  },

  statsRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  statItem: { flex: 1, alignItems: "flex-start", minWidth: 0 },
  statValue: { fontWeight: "800", color: TEXT, fontSize: 16, textAlign: "left" },
  statLabel: {
    marginTop: 2,
    color: MUTED,
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
    backgroundColor: BEIGE_FOLLOW,
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
    borderColor: "#303842"
  },
  studioText: { flex: 1, fontWeight: "900", color: TEAL, fontSize: 14 },
  logoutLink: { marginTop: 10, alignSelf: "center", paddingVertical: 6 },
  logoutLinkText: { color: MUTED, fontWeight: "700", fontSize: 13, textDecorationLine: "underline" },

  gallerySection: { marginTop: 18, marginBottom: 16 },
  galleryLoadingWrap: { width: "100%", alignItems: "center", justifyContent: "center", paddingVertical: 48 },
  iconTabsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#2a2a2a",
    paddingBottom: 4,
    marginHorizontal: 16
  },
  iconTab: { alignItems: "center", minWidth: 56, paddingVertical: 8 },
  profileTabIcon: { width: PROFILE_TAB_ICON, height: PROFILE_TAB_ICON },
  iconTabUnderline: { marginTop: 8, height: 2, width: 32, backgroundColor: LIME, borderRadius: 2 },
  iconTabSpacer: { marginTop: 8, height: 2, width: 32 },

  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 2, paddingHorizontal: 0 },
  gridTile: { overflow: "hidden", position: "relative" },
  gridImage: { width: "100%", height: "100%" },
  gridPlayBadge: {
    position: "absolute",
    top: 8,
    right: 8
  },
  gridVideoIcon: { width: 20, height: 20 },
  gridPlaceholder: {},
  gridVideoBg: { backgroundColor: "#262626" },
  gridVideoPlaceholder: { alignItems: "center", justifyContent: "center" },
  gridPastelA: { backgroundColor: "#262626" },
  gridPastelB: { backgroundColor: "#262626" },
  gridPastelC: { backgroundColor: "#262626" },
  placeholderGridRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, width: "100%" },

  emptyWrap: {
    width: "100%",
    alignItems: "center",
    paddingVertical: 28,
    gap: 8
  },
  emptyText: { color: MUTED, fontWeight: "700", textAlign: "center" },

  reelPlayerRoot: { flex: 1, backgroundColor: REEL_GRID_TILE_A },
  imageViewerRoot: { flex: 1, backgroundColor: REEL_GRID_TILE_A },
  gridGalleryBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
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
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    zIndex: 10
  },
  reelDeleteBtn: {
    position: "absolute",
    top: 44,
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    zIndex: 10
  },
  reelCaptionWrap: {
    position: "absolute",
    left: 16,
    right: 64,
    bottom: 28,
    gap: 4
  },
  reelCaptionAuthor: { color: "#fff", fontWeight: "900", fontSize: 15 },
  reelCaptionText: { color: "#e5e7eb", fontWeight: "600", fontSize: 13 },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)"
  },
  /** Only the dimmed area above the sheet — does not stack under the sheet, so row buttons receive touches. */
  overlayTapAboveSheet: {
    flex: 1,
    width: "100%"
  },
  sheet: {
    backgroundColor: CARD,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: "72%",
    width: "100%",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderColor: "#303842",
    elevation: 12
  },
  sheetScroll: {
    flexGrow: 0
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { color: TEXT, fontWeight: "900", fontSize: 17 },
  sheetBody: { paddingTop: 12, gap: 10 },
  sheetEmpty: { color: MUTED, fontWeight: "700" },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#303842",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#262626"
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
  messageBtn: { backgroundColor: TEAL, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  messageBtnText: { color: "#111", fontWeight: "900", fontSize: 12 },
  iconDangerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#6b1f1f",
    borderWidth: 1,
    borderColor: "#a93838",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 6
  },
  iconMoreBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#374151",
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
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
    overflow: "hidden",
    zIndex: 20
  },
  followingMenuItem: {
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  followingMenuItemText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 12
  },
  followBackBtn: { backgroundColor: TEAL, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  followBackBtnText: { color: "#111", fontWeight: "900", fontSize: 12 },
  requestedPill: { backgroundColor: "#323a44", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  requestedPillText: { color: "#d8dde3", fontWeight: "800", fontSize: 12 },
  followingPill: { backgroundColor: "rgba(201,255,53,0.18)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  followingPillText: { color: LIME, fontWeight: "800", fontSize: 12 },
  unfollowBtn: { backgroundColor: "#111827", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  unfollowBtnText: { color: "#fff", fontWeight: "800", fontSize: 12 },

  confirmOverlayRoot: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28
  },
  confirmBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.62)"
  },
  confirmCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: CARD,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#303842",
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
    color: MUTED,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 22
  },
  confirmName: { color: LIME, fontWeight: "800" },
  confirmBodyMuted: { color: MUTED, fontWeight: "600" },
  confirmActions: { flexDirection: "row", gap: 12, justifyContent: "center" },
  confirmBtnSecondary: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: LIME,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent"
  },
  confirmBtnSecondaryText: { color: LIME, fontWeight: "900", fontSize: 15 },
  confirmBtnDanger: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#7f1d1d",
    borderWidth: 1,
    borderColor: "#b91c1c"
  },
  confirmBtnDangerText: { color: "#fff", fontWeight: "900", fontSize: 15 },
  confirmBtnDisabled: { opacity: 0.55 },

  profileShareHandle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#3a434f",
    marginBottom: 10
  },
  profileShareSearchRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#303842",
    backgroundColor: "#1f2937",
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
    backgroundColor: "#111827"
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
    backgroundColor: "#2f3741"
  },
  profileSharePersonName: { marginTop: 6, color: "#e5edf5", fontSize: 11, fontWeight: "700", textAlign: "center" },
  profileShareFooterRow: {
    marginTop: 6,
    borderTopWidth: 1,
    borderColor: "#303842",
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
    borderColor: "#374151",
    backgroundColor: "#1f2937"
  },
  profileShareFooterText: { color: MUTED, fontSize: 9, fontWeight: "700", textAlign: "center" }
});
