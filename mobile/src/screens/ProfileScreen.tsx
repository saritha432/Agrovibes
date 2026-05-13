import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewToken,
  useWindowDimensions
} from "react-native";
import { ResizeMode, Video } from "expo-av";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../auth/AuthContext";
import {
  fetchSavedHomePosts,
  fetchHomePosts,
  fetchProfileStats,
  fetchSocialNetwork,
  fetchTaggedHomePosts,
  HomePost,
  removeFollower,
  sendFollowRequest,
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
import { navigateToEditProfile, navigateToUserSearch } from "../navigation/navigationRef";

const TEAL = "#d8ff37";
const CREAM = "#000000";
const CARD = "#111418";
const TEXT = "#f8fafc";
const MUTED = "#97a0a8";
const BEIGE_FOLLOW = "#1d2126";
const LIME = "#d8ff37";

function safeHandle(name: string) {
  const base = String(name || "user")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `@${base || "user_farmer"}`;
}

/** Prefer a still image in the profile reel grid — many tiny playing videos cause GPU decode noise ("dots") especially on web. */
function reelGridStillUri(post: HomePost): string | null {
  const th = post.thumbnailUrl?.trim();
  if (th) return th;
  const img = post.imageUrl?.trim();
  if (img) return img;
  const carousel0 = post.imageUrls?.find((u) => typeof u === "string" && u.trim())?.trim();
  if (carousel0) return carousel0;
  return null;
}

type GalleryTab = "Posts" | "Reels" | "Saved" | "Tagged";

export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { width, height: windowHeight } = useWindowDimensions();
  const { user, token, signOut } = useAuth();
  const [allPosts, setAllPosts] = useState<HomePost[]>([]);
  const [savedPosts, setSavedPosts] = useState<HomePost[]>([]);
  const [taggedPosts, setTaggedPosts] = useState<HomePost[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followersList, setFollowersList] = useState<Array<{ name: string; key?: string; viewerStatus: "none" | "pending" | "accepted"; canFollowBack: boolean }>>(
    []
  );
  const [followingList, setFollowingList] = useState<Array<{ name: string; key?: string; viewerStatus: "accepted"; canFollowBack: false }>>([]);
  const [activeListType, setActiveListType] = useState<"followers" | "following" | null>(null);
  const [followingActionMenuFor, setFollowingActionMenuFor] = useState<string | null>(null);
  const [activeGalleryTab, setActiveGalleryTab] = useState<GalleryTab>("Reels");
  const [activeReelIndex, setActiveReelIndex] = useState<number | null>(null);
  const [playingReelId, setPlayingReelId] = useState<number | null>(null);
  const [activeImagePost, setActiveImagePost] = useState<HomePost | null>(null);
  const [isFollowing, setFollowing] = useState(false);
  const isMountedRef = useRef(true);

  const gridGap = 6;
  const gridTileSize = (width - 24 - gridGap * 2) / 3;
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

  const loadPosts = useCallback(async () => {
    try {
      const [homeData, savedData, taggedData] = await Promise.all([
        fetchHomePosts(token || null),
        token ? fetchSavedHomePosts(token) : Promise.resolve({ posts: [] as HomePost[] }),
        token ? fetchTaggedHomePosts(token) : Promise.resolve({ posts: [] as HomePost[] })
      ]);
      if (!isMountedRef.current) return;
      setAllPosts(homeData.posts);
      setSavedPosts(savedData.posts);
      setTaggedPosts(taggedData.posts);
    } catch {
      if (!isMountedRef.current) return;
      setAllPosts([]);
      setSavedPosts([]);
      setTaggedPosts([]);
    }
  }, [token]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  useFocusEffect(
    useCallback(() => {
      void loadPosts();
    }, [loadPosts])
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
        const followersDedup = new Map<string, { name: string; key?: string; viewerStatus: "none" | "pending" | "accepted"; canFollowBack: boolean }>();
        const followingDedup = new Map<string, { name: string; key?: string; viewerStatus: "accepted"; canFollowBack: false }>();
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

  const userPosts = useMemo(() => {
    if (!user) return [];
    const myId = Number(user.id);
    const nameA = normalizeName(user.fullName || "");
    const nameB = normalizeName(String(user.email || "").split("@")[0] || "");
    const nameC = normalizeName(user.username || "");
    return allPosts.filter((p) => {
      if (Number.isFinite(myId) && myId > 0 && Number(p.userId) === myId) return true;
      const postName = normalizeName(p.userName || "");
      return postName === nameA || postName === nameB || postName === nameC;
    });
  }, [allPosts, user]);

  const visiblePosts = useMemo(() => {
    if (activeGalleryTab === "Reels") return userPosts.filter((p) => !!p.videoUrl);
    if (activeGalleryTab === "Saved") return savedPosts.filter((p) => !!p.videoUrl);
    if (activeGalleryTab === "Tagged") return taggedPosts.filter((p) => !!p.videoUrl);
    return userPosts.filter((p) => !p.videoUrl);
  }, [activeGalleryTab, savedPosts, taggedPosts, userPosts]);

  /** At most one live decode in the reel grid when a post has no still — avoids parallel tiny decoders (speckled "dots"). */
  const singleGridVideoPreviewId = useMemo(() => {
    if (activeGalleryTab !== "Reels" && activeGalleryTab !== "Saved" && activeGalleryTab !== "Tagged") return null;
    for (const p of visiblePosts) {
      if (!p.videoUrl || reelGridStillUri(p)) continue;
      return p.id;
    }
    return null;
  }, [activeGalleryTab, visiblePosts]);
  const reelViewerListRef = useRef<FlatList<HomePost> | null>(null);

  const onReelViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const ordered = viewableItems
      .filter((v) => v.isViewable && v.item != null)
      .map((v) => ({ post: v.item as HomePost, index: v.index ?? 0 }))
      .sort((a, b) => a.index - b.index);
    const focus = ordered[0];
    setPlayingReelId(focus?.post?.id ?? null);
    if (focus) setActiveReelIndex(focus.index);
  }, []);

  const onReelViewableItemsChangedRef = useRef(onReelViewableItemsChanged);
  onReelViewableItemsChangedRef.current = onReelViewableItemsChanged;

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

  const openPersonChat = (person: { name: string; key?: string }) => {
    const peerUserId = parsePersonUserId(person);
    if (!peerUserId) {
      Alert.alert("Unavailable", "Chat is available only for synced users.");
      return;
    }
    navigation.navigate("DirectChat", { peerUserId, peerName: person.name, peerKey: person.key || String(peerUserId) });
    setActiveListType(null);
  };

  const toggleFollowingActions = (person: { name: string; key?: string }) => {
    const rowId = personUniqueId(person);
    setFollowingActionMenuFor((prev) => (prev === rowId ? null : rowId));
  };

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.scrollBottom}>
        <View style={styles.topBar}>
          <View style={styles.topBarIcons}>
            <Pressable hitSlop={8} onPress={navigateToUserSearch}>
              <Ionicons name="search-outline" size={18} color={LIME} />
            </Pressable>
            <Pressable hitSlop={8} onPress={() => Alert.alert("Notifications", "Notifications are available from the home top bar.")}>
              <Ionicons name="notifications-outline" size={18} color={LIME} />
            </Pressable>
          </View>
        </View>

        {!user ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome</Text>
            <Text style={styles.cardSub}>Start from the launch screens to create your account.</Text>
            <Pressable style={styles.primaryBtn} onPress={() => navigation.reset({ index: 0, routes: [{ name: "InitialSetup" }] })}>
              <Ionicons name="log-in-outline" size={18} color="#111" />
              <Text style={styles.primaryBtnText}>Get Started</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.profileCard}>
              <View style={styles.handleRow}>
                <Text style={styles.handleText}>{profileModel?.handle}</Text>
              </View>

              <View style={styles.headerMidRow}>
                <View style={styles.avatarWrap}>
                  <View style={styles.avatar}>
                    {user.avatarUrl ? (
                      <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} resizeMode="cover" />
                    ) : (
                      <Text style={styles.avatarText}>{profileModel?.initials}</Text>
                    )}
                  </View>
                  <View style={styles.shieldBadge}>
                    <Ionicons name="shield-checkmark" size={12} color="#1a1a1a" />
                  </View>
                </View>

                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{profileModel?.posts}</Text>
                    <Text style={styles.statLabel}>Posts</Text>
                  </View>
                  <Pressable style={styles.statItem} onPress={() => setActiveListType("followers")}>
                    <Text style={styles.statValue}>{profileModel?.followers}</Text>
                    <Text style={styles.statLabel}>Followers</Text>
                  </Pressable>
                  <Pressable style={styles.statItem} onPress={() => setActiveListType("following")}>
                    <Text style={styles.statValue}>{profileModel?.following}</Text>
                    <Text style={styles.statLabel}>Following</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.nameRow}>
                <Text style={styles.fullName}>{user.fullName}</Text>
                <View style={styles.kycPill}>
                  <Ionicons name="checkmark-circle" size={14} color={TEAL} />
                  <Text style={styles.kycText}>KYC Verified</Text>
                </View>
              </View>

              <Text style={styles.roleLine}>
                {roleLabel} <Text style={styles.wheatEmoji}>🌾</Text>
              </Text>
              <Text style={styles.bio}>{bioText}</Text>
              {user.website ? <Text style={styles.websiteText}>{user.website}</Text> : null}
              <View style={styles.locRow}>
                <Ionicons name="location-outline" size={14} color={MUTED} />
                <Text style={styles.locText}>{locationDisplay}</Text>
              </View>
              <View style={styles.ratingRow}>
                <View style={styles.starsRow}>
                  {([0, 1, 2, 3] as const).map((i) => (
                    <Ionicons key={i} name="star" size={17} color={LIME} style={styles.starIcon} />
                  ))}
                  <Ionicons name="star-outline" size={17} color={TEXT} style={[styles.starIcon, styles.starOutline]} />
                </View>
                <Text style={styles.ratingNum}>4.8</Text>
              </View>

              <View style={styles.profileActionsRow}>
                <Pressable style={styles.editProfileBtnCompact} onPress={navigateToEditProfile}>
                  <Ionicons name="create-outline" size={18} color="#111" />
                  <Text style={styles.editProfileBtnText} numberOfLines={1}>
                    Edit Profile
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.followCompactBtn, isFollowing ? styles.followWideBtnActive : null]}
                  onPress={() => setFollowing((v) => !v)}
                >
                  <Ionicons name={isFollowing ? "checkmark" : "person-add-outline"} size={18} color={TEXT} />
                  <Text style={styles.followCompactBtnText} numberOfLines={1}>
                    {isFollowing ? "Following" : "Follow"}
                  </Text>
                </Pressable>
                <Pressable style={styles.iconActionSquare} onPress={() => Alert.alert("Share", "Share coming soon.")}>
                  <Ionicons name="share-outline" size={20} color={TEXT} />
                </Pressable>
              </View>

              {isInstructor ? (
                <Pressable style={styles.studioBtn} onPress={() => navigation.navigate("InstructorStudio")}>
                  <Ionicons name="school-outline" size={18} color={TEAL} />
                  <Text style={styles.studioText}>Instructor Studio</Text>
                  <Ionicons name="chevron-forward" size={18} color={MUTED} />
                </Pressable>
              ) : null}

              <Pressable onPress={handleLogout} style={styles.logoutLink}>
                <Text style={styles.logoutLinkText}>Log out</Text>
              </Pressable>
            </View>

            <View style={styles.gallerySection}>
              <View style={styles.iconTabsRow}>
                {(
                  [
                    { key: "Posts" as const, icon: "grid-outline" as const },
                    { key: "Reels" as const, icon: "play-circle-outline" as const },
                    { key: "Saved" as const, icon: "bookmark-outline" as const },
                    { key: "Tagged" as const, icon: "pricetag-outline" as const }
                  ] as const
                ).map((t) => (
                  <Pressable key={t.key} style={styles.iconTab} onPress={() => setActiveGalleryTab(t.key)}>
                    <Ionicons name={t.icon} size={22} color={activeGalleryTab === t.key ? TEXT : MUTED} />
                    {activeGalleryTab === t.key ? <View style={styles.iconTabUnderline} /> : <View style={styles.iconTabSpacer} />}
                  </Pressable>
                ))}
              </View>

              <View style={[styles.grid, { gap: gridGap }]}>
                {visiblePosts.length ? (
                  visiblePosts.map((post) => {
                    const tileHeight = isReelTab ? reelTileHeight : gridTileSize;
                    const tileStyle = [styles.gridTile, { width: gridTileSize, height: tileHeight }];
                    if (post.videoUrl) {
                      const stillUri = reelGridStillUri(post);
                      if (stillUri) {
                        return (
                          <Pressable
                            key={post.id}
                            style={tileStyle}
                            onPress={() => {
                              const ix = visiblePosts.findIndex((p) => p.id === post.id);
                              setActiveReelIndex(ix >= 0 ? ix : 0);
                              setPlayingReelId(post.id);
                            }}
                          >
                            <Image source={{ uri: stillUri }} style={styles.gridImage} resizeMode="cover" />
                            <View style={styles.gridPlayBadge} pointerEvents="none">
                              <Ionicons name="play" size={12} color="#111" />
                            </View>
                          </Pressable>
                        );
                      }
                      /** On native, paused grid decoders often show black; web keeps a single live tile to reduce GPU speckle. */
                      const shouldPlayTile = activeReelIndex == null && post.id === singleGridVideoPreviewId;
                      return (
                        <Pressable
                          key={post.id}
                          style={tileStyle}
                          onPress={() => {
                            const ix = visiblePosts.findIndex((p) => p.id === post.id);
                            setActiveReelIndex(ix >= 0 ? ix : 0);
                            setPlayingReelId(post.id);
                          }}
                        >
                          <Video
                            style={styles.gridImage}
                            source={{ uri: post.videoUrl }}
                            resizeMode={ResizeMode.COVER}
                            shouldPlay={shouldPlayTile}
                            isLooping
                            isMuted
                            useNativeControls={false}
                            progressUpdateIntervalMillis={2000}
                            {...(Platform.OS === "web"
                              ? ({ videoStyle: { width: "100%", height: "100%", objectFit: "cover" } } as any)
                              : {})}
                          />
                          <View style={styles.gridPlayBadge} pointerEvents="none">
                            <Ionicons name="play" size={12} color="#111" />
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
                        onPress={() => (canOpen ? setActiveImagePost(post) : undefined)}
                      >
                        {cover ? (
                          <Image source={{ uri: cover }} style={styles.gridImage} resizeMode="cover" />
                        ) : (
                          <View style={[styles.gridPlaceholder, styles.gridPastelA]}>
                            <Ionicons name="leaf-outline" size={28} color={LIME} />
                          </View>
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
                        <Text style={styles.emptyText}>No tagged posts yet.</Text>
                      </View>
                    ) : activeGalleryTab === "Saved" ? (
                      <View style={styles.emptyWrap}>
                        <Ionicons name="bookmark-outline" size={22} color={MUTED} />
                        <Text style={styles.emptyText}>Saved reels will appear here.</Text>
                      </View>
                    ) : (
                      <>
                        <View style={[styles.gridPlaceholder, styles.gridPastelA, { width: gridTileSize, height: gridTileSize }]}>
                          <Ionicons name="leaf-outline" size={32} color={LIME} />
                        </View>
                        <View style={[styles.gridPlaceholder, styles.gridPastelB, { width: gridTileSize, height: gridTileSize }]}>
                          <Ionicons name="nutrition-outline" size={32} color={LIME} />
                        </View>
                        <View style={[styles.gridPlaceholder, styles.gridPastelC, { width: gridTileSize, height: gridTileSize }]}>
                          <Ionicons name="rose-outline" size={32} color={LIME} />
                        </View>
                      </>
                    )}
                  </View>
                )}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <Modal
        visible={!!activeImagePost}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveImagePost(null)}
        statusBarTranslucent
      >
        <View style={[styles.imageViewerRoot, { width, height: windowHeight }]}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={{ width, height: windowHeight }}
          >
            {(() => {
              const post = activeImagePost;
              if (!post) return null;
              const list: string[] = post.imageUrls && post.imageUrls.length > 0
                ? post.imageUrls
                : post.imageUrl
                ? [post.imageUrl]
                : [];
              return list.map((uri, idx) => (
                <View key={`${post.id}-${idx}`} style={{ width, height: windowHeight, alignItems: "center", justifyContent: "center" }}>
                  <Image
                    source={{ uri }}
                    style={{ width, height: windowHeight }}
                    resizeMode="contain"
                  />
                </View>
              ));
            })()}
          </ScrollView>
          <Pressable
            style={styles.reelCloseBtn}
            hitSlop={12}
            onPress={() => setActiveImagePost(null)}
            accessibilityLabel="Close image"
          >
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
          {activeImagePost ? (
            <View style={styles.reelCaptionWrap} pointerEvents="none">
              <Text style={styles.reelCaptionAuthor} numberOfLines={1}>
                {activeImagePost.userName}
              </Text>
              {activeImagePost.caption ? (
                <Text style={styles.reelCaptionText} numberOfLines={3}>
                  {activeImagePost.caption}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal
        visible={activeReelIndex != null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setActiveReelIndex(null);
          setPlayingReelId(null);
        }}
        statusBarTranslucent
      >
        <View style={[styles.reelPlayerRoot, { width, height: windowHeight }]}>
          <FlatList
            ref={reelViewerListRef}
            data={visiblePosts}
            keyExtractor={(item) => String(item.id)}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            initialScrollIndex={Math.max(0, activeReelIndex ?? 0)}
            getItemLayout={(_, index) => ({ length: windowHeight, offset: windowHeight * index, index })}
            onViewableItemsChanged={(info) => onReelViewableItemsChangedRef.current(info)}
            viewabilityConfig={{ itemVisiblePercentThreshold: 70, minimumViewTime: 80 }}
            renderItem={({ item }) => (
              <View style={{ width, height: windowHeight }}>
                {item.videoUrl ? (
                  <Video
                    style={{ width, height: windowHeight, backgroundColor: "#000" }}
                    source={{ uri: item.videoUrl }}
                    resizeMode={ResizeMode.COVER}
                    shouldPlay={playingReelId === item.id}
                    isLooping
                    isMuted={false}
                    useNativeControls={false}
                    progressUpdateIntervalMillis={1000}
                    {...(Platform.OS === "web" ? ({ videoStyle: { width: "100%", height: "100%", objectFit: "cover" } } as any) : {})}
                  />
                ) : null}
                <View style={styles.reelCaptionWrap} pointerEvents="none">
                  <Text style={styles.reelCaptionAuthor} numberOfLines={1}>
                    {item.userName}
                  </Text>
                  {item.caption ? (
                    <Text style={styles.reelCaptionText} numberOfLines={2}>
                      {item.caption}
                    </Text>
                  ) : null}
                </View>
              </View>
            )}
          />
          <Pressable
            style={styles.reelCloseBtn}
            hitSlop={12}
            onPress={() => {
              setActiveReelIndex(null);
              setPlayingReelId(null);
            }}
            accessibilityLabel="Close reel"
          >
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
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
        <Pressable
          style={styles.overlay}
          onPress={() => {
            setFollowingActionMenuFor(null);
            setActiveListType(null);
          }}
        >
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation?.()}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{activeListType === "followers" ? "Followers" : "Following"}</Text>
              <Pressable
                onPress={() => {
                  setFollowingActionMenuFor(null);
                  setActiveListType(null);
                }}
              >
                <Ionicons name="close" size={22} color={TEAL} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.sheetBody}>
              {(activeListType === "followers" ? followersList : followingList).length === 0 ? (
                <Text style={styles.sheetEmpty}>No users found.</Text>
              ) : (
                (activeListType === "followers" ? followersList : followingList).map((person, idx) => {
                  const rowId = personUniqueId(person);
                  const isFollowingMenuOpen = activeListType === "following" && followingActionMenuFor === rowId;
                  return (
                    <View key={`${person.key || person.name}-${idx}`} style={[styles.personRow, isFollowingMenuOpen ? styles.personRowMenuOpen : null]}>
                      <Text style={styles.personName}>{person.name}</Text>
                      {activeListType === "followers" ? (
                        <View style={styles.personActionsRow}>
                          <Pressable style={styles.messageBtn} onPress={() => openPersonChat(person)}>
                            <Text style={styles.messageBtnText}>Message</Text>
                          </Pressable>
                          <Pressable style={styles.iconDangerBtn} onPress={() => void removeFollowerFromList(person)}>
                            <Ionicons name="close" size={16} color="#fff" />
                          </Pressable>
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
          </Pressable>
        </Pressable>
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
    backgroundColor: "#000000",
    paddingHorizontal: 10,
    paddingVertical: 8,
    paddingTop: 10,
    gap: 6
  },
  topBarIcons: { flexDirection: "row", alignItems: "center", gap: 10 },

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
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 18,
    backgroundColor: CARD,
    padding: 14,
    borderWidth: 1,
    borderColor: "#303842",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2
  },
  handleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  handleText: { fontWeight: "900", color: TEXT, fontSize: 15 },

  headerMidRow: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 12 },
  avatarWrap: { position: "relative" },
  avatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: "#1d2126",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: LIME
  },
  avatarText: { color: TEAL, fontSize: 28, fontWeight: "900" },
  avatarImage: { width: "100%", height: "100%", borderRadius: 43 },
  shieldBadge: {
    position: "absolute",
    right: -2,
    bottom: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: LIME,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: CARD
  },

  statsRow: { flex: 1, flexDirection: "row", justifyContent: "space-around", paddingLeft: 4 },
  statItem: { alignItems: "center" },
  statValue: { fontWeight: "900", color: TEXT, fontSize: 17 },
  statLabel: { marginTop: 2, color: MUTED, fontWeight: "700", fontSize: 12 },

  nameRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 14 },
  fullName: { fontSize: 17, fontWeight: "900", color: TEXT },
  kycPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#1d2126",
    borderWidth: 1,
    borderColor: "#303842",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999
  },
  kycText: { color: TEAL, fontWeight: "800", fontSize: 11 },
  roleLine: { marginTop: 6, color: MUTED, fontWeight: "700", fontSize: 13 },
  wheatEmoji: { fontSize: 13 },
  bio: { marginTop: 8, color: TEXT, fontWeight: "600", fontSize: 13, lineHeight: 19 },
  websiteText: { marginTop: 5, color: TEAL, fontWeight: "800", fontSize: 12 },
  locRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
  locText: { color: MUTED, fontWeight: "700", fontSize: 12 },
  ratingRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  starsRow: { flexDirection: "row", alignItems: "center" },
  starIcon: { marginRight: 2 },
  starOutline: { opacity: 0.45 },
  ratingNum: { color: TEXT, fontWeight: "900", fontSize: 15 },

  profileActionsRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  editProfileBtnCompact: {
    flex: 1.35,
    minWidth: 0,
    backgroundColor: TEAL,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6
  },
  editProfileBtnText: { color: "#111", fontWeight: "900", fontSize: 14 },
  followCompactBtn: {
    flex: 1,
    minWidth: 0,
    backgroundColor: BEIGE_FOLLOW,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#303842"
  },
  followWideBtnActive: { backgroundColor: "rgba(216,255,55,0.18)", borderColor: TEAL },
  followCompactBtnText: { color: TEXT, fontWeight: "900", fontSize: 14 },
  iconActionSquare: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: BEIGE_FOLLOW,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#303842"
  },

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

  gallerySection: { marginHorizontal: 12, marginBottom: 16 },
  iconTabsRow: { flexDirection: "row", justifyContent: "space-around", borderBottomWidth: 1, borderColor: "#303842", paddingBottom: 4 },
  iconTab: { alignItems: "center", minWidth: 56, paddingVertical: 6 },
  iconTabUnderline: { marginTop: 6, height: 2, width: 28, backgroundColor: LIME, borderRadius: 2 },
  iconTabSpacer: { marginTop: 6, height: 2, width: 28 },

  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 10 },
  gridTile: { borderRadius: 12, overflow: "hidden", backgroundColor: "#1d2126", borderWidth: 1, borderColor: "#303842", position: "relative" },
  gridImage: { width: "100%", height: "100%" },
  gridPlayBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: LIME,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 }
  },
  gridPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  gridVideoBg: { backgroundColor: "#1d2126" },
  gridPastelA: { backgroundColor: "#1d2126" },
  gridPastelB: { backgroundColor: "#111418" },
  gridPastelC: { backgroundColor: "#1d2126" },
  placeholderGridRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, width: "100%" },

  emptyWrap: {
    width: "100%",
    alignItems: "center",
    paddingVertical: 28,
    gap: 8
  },
  emptyText: { color: MUTED, fontWeight: "700", textAlign: "center" },

  reelPlayerRoot: { flex: 1, backgroundColor: "#000" },
  imageViewerRoot: { flex: 1, backgroundColor: "#000" },
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
  reelCaptionWrap: {
    position: "absolute",
    left: 16,
    right: 64,
    bottom: 28,
    gap: 4
  },
  reelCaptionAuthor: { color: "#fff", fontWeight: "900", fontSize: 15 },
  reelCaptionText: { color: "#e5e7eb", fontWeight: "600", fontSize: 13 },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: CARD,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: "72%",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderColor: "#303842"
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
    backgroundColor: "#1d2126"
  },
  personRowMenuOpen: { zIndex: 40 },
  personName: { color: TEXT, fontWeight: "800", flex: 1, marginRight: 10 },
  personActionsRow: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0, position: "relative" },
  messageBtn: { backgroundColor: TEAL, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  messageBtnText: { color: "#111", fontWeight: "900", fontSize: 12 },
  iconDangerBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#6b1f1f",
    borderWidth: 1,
    borderColor: "#a93838",
    alignItems: "center",
    justifyContent: "center"
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
  followingPill: { backgroundColor: "rgba(216,255,55,0.18)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  followingPillText: { color: LIME, fontWeight: "800", fontSize: 12 },
  unfollowBtn: { backgroundColor: "#111827", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  unfollowBtnText: { color: "#fff", fontWeight: "800", fontSize: 12 }
});
