import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { navigateToDirectInbox, navigateToEditProfile, navigateToUserSearch } from "../navigation/navigationRef";
import { useAuth } from "../auth/AuthContext";
import {
  fetchHomePosts,
  fetchProfileStats,
  HomePost,
  sendFollowRequest,
  unfollowUser
} from "../services/api";
import {
  getLocalFollowCountsByIdentity,
  getLocalFollowEdgesForServerSync,
  getLocalFollowNetworkByIdentity,
  removeLocalFollowByIdentity,
  removeLocalFollowRecordsByIds,
  sendLocalFollowRequestByIdentity
} from "../social/localFollowStore";

const TEAL = "#0f9b8e";
const CREAM = "#f5f3ee";
const CARD = "#ffffff";
const TEXT = "#1a2e2a";
const MUTED = "#5c6b66";
const BEIGE_FOLLOW = "#ebe4d8";
const LIME = "#d4e157";

function safeHandle(name: string) {
  const base = String(name || "user")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `@${base || "user_farmer"}`;
}

/* Profile highlight rings (Harvest, Products, Tips, Market) — re-enable when needed
const HIGHLIGHTS = [
  { key: "harvest", label: "Harvest", icon: "leaf-outline" as const, border: "#c9b458" },
  { key: "products", label: "Products", icon: "nutrition-outline" as const, border: "#e07a8a" },
  { key: "tips", label: "Tips", icon: "bulb-outline" as const, border: "#7ec8c3" },
  { key: "market", label: "Market", icon: "storefront-outline" as const, border: "#5a9e8f" }
];
*/

type GalleryTab = "Posts" | "Reels" | "Tagged";

export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { width } = useWindowDimensions();
  const { user, token, signOut } = useAuth();
  const [allPosts, setAllPosts] = useState<HomePost[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followersList, setFollowersList] = useState<
    Array<{ name: string; key?: string; viewerStatus: "none" | "pending" | "accepted"; canFollowBack: boolean }>
  >([]);
  const [followingList, setFollowingList] = useState<Array<{ name: string; key?: string; viewerStatus: "accepted"; canFollowBack: false }>>([]);
  const [activeListType, setActiveListType] = useState<"followers" | "following" | null>(null);
  const [activeGalleryTab, setActiveGalleryTab] = useState<GalleryTab>("Posts");
  const [isFollowing, setFollowing] = useState(false);
  const isMountedRef = useRef(true);

  const gridGap = 6;
  const gridTileSize = (width - 24 - gridGap * 2) / 3;

  const normalizeName = (v: string) =>
    String(v || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  useEffect(() => {
    let mounted = true;
    fetchHomePosts(token || null)
      .then((data) => {
        if (!mounted) return;
        setAllPosts(data.posts);
      })
      .catch(() => {
        if (!mounted) return;
        setAllPosts([]);
      });
    return () => {
      mounted = false;
    };
  }, [token]);

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
        const stats = await fetchProfileStats(token, user.id);
        const localCounts = await getLocalFollowCountsByIdentity({
          name: user.fullName,
          key: user.email || String(user.id)
        });
        const localNetwork = await getLocalFollowNetworkByIdentity({
          name: user.fullName,
          key: user.email || String(user.id)
        });
        if (!isMountedRef.current) return;
        setFollowersCount(Number(stats.followersCount || 0) + Number(localCounts.followersCount || 0));
        setFollowingCount(Number(stats.followingCount || 0) + Number(localCounts.followingCount || 0));
        setFollowersList(localNetwork.followers);
        setFollowingList(localNetwork.following);
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
    const nameA = normalizeName(user.fullName || "");
    const nameB = normalizeName(String(user.email || "").split("@")[0] || "");
    return allPosts.filter((p) => {
      const postName = normalizeName(p.userName || "");
      return postName === nameA || postName === nameB;
    });
  }, [allPosts, user]);

  const visiblePosts = useMemo(() => {
    if (activeGalleryTab === "Reels") return userPosts.filter((p) => !!p.videoUrl);
    if (activeGalleryTab === "Tagged") return [];
    return userPosts.filter((p) => !p.videoUrl);
  }, [activeGalleryTab, userPosts]);

  const profileModel = useMemo(() => {
    if (!user) return null;
    const handle = safeHandle(user.fullName || user.email);
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
    if (user.locationLabel && user.locationLabel.length > 24) return user.locationLabel;
    return `${user.fullName} — growing and trading fresh produce. Share tips and connect with the community.`;
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

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.scrollBottom}>
        {/* Profile-specific top bar (matches reference layout) */}
        <View style={styles.topBar}>
          <View style={styles.topBarLeft}>
            <Image source={require("../../assets/crop vibe.png")} style={styles.logoImage} resizeMode="contain" />
            <Pressable style={styles.locationPill} onPress={() => Alert.alert("Location", "Location picker can be wired next.")}>
              <Ionicons name="location-outline" size={14} color={LIME} />
              <Text style={styles.locationPillText} numberOfLines={1}>
                Nashik, MH
              </Text>
              <Ionicons name="chevron-down" size={12} color="#c8d4cf" />
            </Pressable>
          </View>
          <View style={styles.topBarIcons}>
            <Pressable hitSlop={8} onPress={navigateToUserSearch}>
              <Ionicons name="search-outline" size={18} color="#e8f0ec" />
            </Pressable>
            <Pressable hitSlop={8} onPress={() => Alert.alert("Messages", "Messaging coming soon.")}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color="#e8f0ec" />
            </Pressable>
            {/*
            <Pressable hitSlop={8} style={styles.iconWithBadge} onPress={() => Alert.alert("Cart", "Cart coming soon.")}>
              <Ionicons name="cart-outline" size={18} color="#e8f0ec" />
              <View style={[styles.miniBadge, styles.miniBadgeTeal]}>
                <Text style={styles.miniBadgeText}>6</Text>
              </View>
            </Pressable>
            */}
            <Pressable hitSlop={8} style={styles.iconWithBadge} onPress={() => {}}>
              <Ionicons name="notifications-outline" size={18} color="#e8f0ec" />
              <View style={[styles.miniBadge, styles.miniBadgeRed]}>
                <Text style={styles.miniBadgeText}>5</Text>
              </View>
            </Pressable>
            {/*
            <Pressable hitSlop={8} onPress={() => {}}>
              <Ionicons name="person-circle-outline" size={22} color="#e8f0ec" />
            </Pressable>
            */}
          </View>
        </View>

        {!user ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome</Text>
            <Text style={styles.cardSub}>Start from the launch screens to create your account.</Text>
            <Pressable style={styles.primaryBtn} onPress={() => navigation.reset({ index: 0, routes: [{ name: "InitialSetup" }] })}>
              <Ionicons name="log-in-outline" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Get Started</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.profileCard}>
              <View style={styles.handleRow}>
                <Text style={styles.handleText}>{profileModel?.handle}</Text>
                <Pressable hitSlop={10} onPress={() => Alert.alert("Share", "Share profile coming soon.")}>
                  <Ionicons name="share-outline" size={20} color={TEXT} />
                </Pressable>
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
              <View style={styles.locRow}>
                <Ionicons name="location-outline" size={14} color={MUTED} />
                <Text style={styles.locText}>{locationDisplay}</Text>
              </View>
              <View style={styles.ratingRow}>
                <View style={styles.starsRow}>
                  {([0, 1, 2, 3] as const).map((i) => (
                    <Ionicons key={i} name="star" size={17} color="#ca8a04" style={styles.starIcon} />
                  ))}
                  <Ionicons name="star-outline" size={17} color={TEXT} style={[styles.starIcon, styles.starOutline]} />
                </View>
                <Text style={styles.ratingNum}>4.8</Text>
              </View>

              <View style={styles.profileActionsRow}>
                <Pressable style={styles.editProfileBtnCompact} onPress={navigateToEditProfile}>
                  <Ionicons name="create-outline" size={18} color="#fff" />
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
                <Pressable style={styles.iconActionSquare} onPress={navigateToDirectInbox}>
                  <Ionicons name="chatbubble-outline" size={20} color={TEXT} />
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

            {/*
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.highlightsScroll}>
              {HIGHLIGHTS.map((h) => (
                <Pressable key={h.key} style={styles.highlightItem} onPress={() => Alert.alert(h.label, "Highlights coming soon.")}>
                  <View style={[styles.highlightRing, { borderColor: h.border }]}>
                    <View style={styles.highlightInner}>
                      <Ionicons name={h.icon} size={22} color={TEXT} />
                    </View>
                  </View>
                  <Text style={styles.highlightLabel}>{h.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            */}

            <View style={styles.gallerySection}>
              <View style={styles.iconTabsRow}>
                {(
                  [
                    { key: "Posts" as const, icon: "grid-outline" as const },
                    { key: "Reels" as const, icon: "play-circle-outline" as const },
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
                {activeGalleryTab === "Tagged" ? (
                  <View style={styles.emptyWrap}>
                    <Ionicons name="pricetag-outline" size={22} color={MUTED} />
                    <Text style={styles.emptyText}>No tagged posts yet.</Text>
                  </View>
                ) : visiblePosts.length ? (
                  visiblePosts.map((post) => (
                    <View key={post.id} style={[styles.gridTile, { width: gridTileSize, height: gridTileSize }]}>
                      {post.imageUrl ? (
                        <Image source={{ uri: post.imageUrl }} style={styles.gridImage} resizeMode="cover" />
                      ) : post.videoUrl ? (
                        <View style={[styles.gridPlaceholder, styles.gridVideoBg]}>
                          <Ionicons name="play-circle" size={28} color="#fff" />
                        </View>
                      ) : (
                        <View style={[styles.gridPlaceholder, styles.gridPastelA]}>
                          <Ionicons name="leaf-outline" size={28} color="#7a6b2e" />
                        </View>
                      )}
                    </View>
                  ))
                ) : (
                  <View style={styles.placeholderGridRow}>
                    <View style={[styles.gridPlaceholder, styles.gridPastelA, { width: gridTileSize, height: gridTileSize }]}>
                      <Ionicons name="leaf-outline" size={32} color="#7a6b2e" />
                    </View>
                    <View style={[styles.gridPlaceholder, styles.gridPastelB, { width: gridTileSize, height: gridTileSize }]}>
                      <Ionicons name="nutrition-outline" size={32} color="#8b3d4a" />
                    </View>
                    <View style={[styles.gridPlaceholder, styles.gridPastelC, { width: gridTileSize, height: gridTileSize }]}>
                      <Ionicons name="rose-outline" size={32} color="#2d6b4a" />
                    </View>
                  </View>
                )}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={!!activeListType} transparent animationType="slide" onRequestClose={() => setActiveListType(null)}>
        <Pressable style={styles.overlay} onPress={() => setActiveListType(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation?.()}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{activeListType === "followers" ? "Followers" : "Following"}</Text>
              <Pressable onPress={() => setActiveListType(null)}>
                <Ionicons name="close" size={22} color={TEAL} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.sheetBody}>
              {(activeListType === "followers" ? followersList : followingList).length === 0 ? (
                <Text style={styles.sheetEmpty}>No users found.</Text>
              ) : (
                (activeListType === "followers" ? followersList : followingList).map((person, idx) => (
                  <View key={`${person.key || person.name}-${idx}`} style={styles.personRow}>
                    <Text style={styles.personName}>{person.name}</Text>
                    {activeListType === "followers" ? (
                      person.viewerStatus === "accepted" ? (
                        <View style={styles.followingPill}>
                          <Text style={styles.followingPillText}>Following</Text>
                        </View>
                      ) : person.viewerStatus === "pending" ? (
                        <View style={styles.requestedPill}>
                          <Text style={styles.requestedPillText}>Requested</Text>
                        </View>
                      ) : (
                        <Pressable style={styles.followBackBtn} onPress={() => followBackFromFollowersList(person)}>
                          <Text style={styles.followBackBtnText}>Follow Back</Text>
                        </Pressable>
                      )
                    ) : (
                      <Pressable style={styles.unfollowBtn} onPress={() => unfollowFromFollowingList(person)}>
                        <Text style={styles.unfollowBtnText}>Unfollow</Text>
                      </Pressable>
                    )}
                  </View>
                ))
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
    justifyContent: "space-between",
    backgroundColor: "#262626",
    paddingHorizontal: 10,
    paddingVertical: 8,
    paddingTop: 10,
    gap: 6
  },
  topBarLeft: { flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0, gap: 6 },
  logoImage: { width: 72, height: 18 },
  locationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#333333",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    maxWidth: 120,
    minWidth: 0
  },
  locationPillText: { flex: 1, color: "#e8f0ec", fontSize: 11, fontWeight: "700" },
  topBarIcons: { flexDirection: "row", alignItems: "center", gap: 10, marginLeft: 8 },
  iconWithBadge: { position: "relative" },
  miniBadge: {
    position: "absolute",
    right: -6,
    top: -5,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3
  },
  miniBadgeTeal: { backgroundColor: "#2dd4bf" },
  miniBadgeRed: { backgroundColor: "#f87171" },
  miniBadgeText: { color: "#111", fontSize: 9, fontWeight: "900" },

  card: { margin: 12, borderRadius: 16, backgroundColor: CARD, borderWidth: 1, borderColor: "#e5e2dc", padding: 16 },
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
  primaryBtnText: { color: "#fff", fontWeight: "900" },

  profileCard: {
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 18,
    backgroundColor: CARD,
    padding: 14,
    borderWidth: 1,
    borderColor: "#ebe6df",
    shadowColor: "#000",
    shadowOpacity: 0.04,
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
    backgroundColor: "#e8f4f1",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#d4ebe6"
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
    backgroundColor: "#e6f7f4",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999
  },
  kycText: { color: TEAL, fontWeight: "800", fontSize: 11 },
  roleLine: { marginTop: 6, color: MUTED, fontWeight: "700", fontSize: 13 },
  wheatEmoji: { fontSize: 13 },
  bio: { marginTop: 8, color: TEXT, fontWeight: "600", fontSize: 13, lineHeight: 19 },
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
  editProfileBtnText: { color: "#fff", fontWeight: "900", fontSize: 14 },
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
    borderColor: "#dcd3c8"
  },
  followWideBtnActive: { backgroundColor: "#dce8e4", borderColor: TEAL },
  followCompactBtnText: { color: TEXT, fontWeight: "900", fontSize: 14 },
  iconActionSquare: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: BEIGE_FOLLOW,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#dcd3c8"
  },

  studioBtn: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: "#ebe6df"
  },
  studioText: { flex: 1, fontWeight: "900", color: TEAL, fontSize: 14 },
  logoutLink: { marginTop: 10, alignSelf: "center", paddingVertical: 6 },
  logoutLinkText: { color: MUTED, fontWeight: "700", fontSize: 13, textDecorationLine: "underline" },

  highlightsScroll: { paddingHorizontal: 12, paddingVertical: 14, gap: 16, flexDirection: "row", alignItems: "flex-start" },
  highlightItem: { alignItems: "center", marginRight: 4 },
  highlightRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    padding: 3
  },
  highlightInner: {
    flex: 1,
    width: "100%",
    borderRadius: 30,
    backgroundColor: "#f0ebe4",
    alignItems: "center",
    justifyContent: "center"
  },
  highlightLabel: { marginTop: 6, fontSize: 12, fontWeight: "800", color: TEXT },

  gallerySection: { marginHorizontal: 12, marginBottom: 16 },
  iconTabsRow: { flexDirection: "row", justifyContent: "space-around", borderBottomWidth: 1, borderColor: "#e5e2dc", paddingBottom: 4 },
  iconTab: { alignItems: "center", minWidth: 56, paddingVertical: 6 },
  iconTabUnderline: { marginTop: 6, height: 2, width: 28, backgroundColor: TEXT, borderRadius: 2 },
  iconTabSpacer: { marginTop: 6, height: 2, width: 28 },

  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 10 },
  gridTile: { borderRadius: 12, overflow: "hidden", backgroundColor: "#eee" },
  gridImage: { width: "100%", height: "100%" },
  gridPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  gridVideoBg: { backgroundColor: "#2d3b38" },
  gridPastelA: { backgroundColor: "#f5ebc4" },
  gridPastelB: { backgroundColor: "#f5d4d9" },
  gridPastelC: { backgroundColor: "#d4ebd4" },
  placeholderGridRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, width: "100%" },

  emptyWrap: {
    width: "100%",
    alignItems: "center",
    paddingVertical: 28,
    gap: 8
  },
  emptyText: { color: MUTED, fontWeight: "700", textAlign: "center" },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: CARD,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: "72%",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 16
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
    borderColor: "#e5e2dc",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: CREAM
  },
  personName: { color: TEXT, fontWeight: "800" },
  followBackBtn: { backgroundColor: TEAL, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  followBackBtnText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  requestedPill: { backgroundColor: "#323a44", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  requestedPillText: { color: "#d8dde3", fontWeight: "800", fontSize: 12 },
  followingPill: { backgroundColor: "#1f6f43", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  followingPillText: { color: "#e8fff2", fontWeight: "800", fontSize: 12 },
  unfollowBtn: { backgroundColor: "#111827", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  unfollowBtnText: { color: "#fff", fontWeight: "800", fontSize: 12 }
});
