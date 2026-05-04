import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppTopBar } from "../components/AppTopBar";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../auth/AuthContext";
import {
  fetchHomePosts,
  fetchProfileStats,
  fetchSocialNetwork,
  HomePost,
  sendFollowRequest,
  syncLocalFollowEdgesToServer,
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

function safeHandle(name: string) {
  const base = String(name || "user")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `@${base || "user_farmer"}`;
}

export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { user, token, signOut } = useAuth();
  const [allPosts, setAllPosts] = useState<HomePost[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followersList, setFollowersList] = useState<Array<{ name: string; key?: string; viewerStatus: "none" | "pending" | "accepted"; canFollowBack: boolean }>>([]);
  const [followingList, setFollowingList] = useState<Array<{ name: string; key?: string; viewerStatus: "accepted"; canFollowBack: false }>>([]);
  const [activeListType, setActiveListType] = useState<"followers" | "following" | null>(null);
  const [activeGalleryTab, setActiveGalleryTab] = useState<"Posts" | "Reels">("Posts");

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

  const refreshMergedFollowStats = useCallback(async () => {
    if (!user?.fullName) {
      setFollowersCount(0);
      setFollowingCount(0);
      setFollowersList([]);
      setFollowingList([]);
      return;
    }
    const identity = { name: user.fullName, key: user.email || String(user.id || "") };

    if (token && user?.id) {
      try {
        const edges = await getLocalFollowEdgesForServerSync(identity);
        if (edges.length) {
          try {
            const syncRes = await syncLocalFollowEdgesToServer(token, {
              edges: edges.map((e) => ({ peerFullName: e.peerFullName, relation: e.relation, status: e.status }))
            });
            const synced = syncRes.synced || [];
            const syncedKey = new Set(synced.map((s) => `${String(s.relation)}:${String(s.status)}:${String(s.peerFullName || "").trim().toLowerCase()}`));
            const toRemove = edges.filter((e) =>
              syncedKey.has(`${e.relation}:${e.status}:${String(e.peerFullName || "").trim().toLowerCase()}`)
            );
            await removeLocalFollowRecordsByIds(toRemove.map((e) => e.localId));
          } catch {
            // Old server without sync route, or offline — keep AsyncStorage copy.
          }
        }
      } catch {
        /* ignore */
      }
    }

    const localCounts = await getLocalFollowCountsByIdentity(identity);
    let apiFollowers = 0;
    let apiFollowing = 0;
    let followersListData: Array<{ name: string; key?: string; viewerStatus: "none" | "pending" | "accepted"; canFollowBack: boolean }> = [];
    let followingListData: Array<{ name: string; key?: string; viewerStatus: "accepted"; canFollowBack: false }> = [];

    if (token && user?.id) {
      try {
        const stats = await fetchProfileStats(token, user.id);
        apiFollowers = Number(stats.followersCount || 0);
        apiFollowing = Number(stats.followingCount || 0);
      } catch {
        /* keep zeros; local still merges below */
      }
      try {
        const network = await fetchSocialNetwork(token, user.id);
        followersListData = network.followers || [];
        followingListData = network.following || [];
      } catch {
        const localNetwork = await getLocalFollowNetworkByIdentity(identity);
        followersListData = localNetwork.followers;
        followingListData = localNetwork.following;
      }
    } else {
      const localNetwork = await getLocalFollowNetworkByIdentity(identity);
      followersListData = localNetwork.followers;
      followingListData = localNetwork.following;
    }

    setFollowersCount(apiFollowers + Number(localCounts.followersCount || 0));
    setFollowingCount(apiFollowing + Number(localCounts.followingCount || 0));
    setFollowersList(followersListData);
    setFollowingList(followingListData);
  }, [token, user?.email, user?.fullName, user?.id]);

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
      <AppTopBar />
      {!user ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome to AgroGram</Text>
          <Text style={styles.cardSub}>Start from the launch screens to create your account with OTP.</Text>
          <Pressable style={styles.primaryBtn} onPress={() => navigation.reset({ index: 0, routes: [{ name: "InitialSetup" }] })}>
            <Ionicons name="log-in-outline" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>Get Started</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.profileHeader}>
            <View style={styles.headerTopRow}>
              <Text style={styles.handleText}>{profileModel?.handle}</Text>
              <Pressable style={styles.iconChip} accessibilityRole="button" onPress={() => {}}>
                <Ionicons name="ellipsis-horizontal" size={18} color="#22312d" />
              </Pressable>
            </View>

            <View style={styles.headerMidRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{profileModel?.initials}</Text>
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

            <Text style={styles.fullName}>{user.fullName}</Text>
            <Text style={styles.roleLine}>
              {isInstructor ? "Instructor" : "Farmer"} • {user.email}
            </Text>
            <View style={styles.savedAddressCard}>
              <Text style={styles.savedAddressTitle}>Saved Address</Text>
              <Text style={styles.savedAddressText}>{user.locationLabel || "No saved address yet"}</Text>
            </View>

            <View style={styles.actionsRow}>
              <Pressable
                style={styles.msgBtn}
                accessibilityRole="button"
                onPress={() => Alert.alert("Message", "Messaging UI will be wired next.")}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={18} color="#0f7d3d" />
                <Text style={styles.msgBtnText}>Message</Text>
              </Pressable>
              <Pressable
                style={styles.editBtn}
                accessibilityRole="button"
                onPress={() => Alert.alert("Edit profile", "Profile editing flow can be added in next step.")}
              >
                <Ionicons name="create-outline" size={18} color="#0a9f46" />
                <Text style={styles.editBtnText}>Edit</Text>
              </Pressable>
            </View>

            {isInstructor ? (
              <Pressable style={styles.studioBtn} accessibilityRole="button" onPress={() => navigation.navigate("InstructorStudio")}>
                <Ionicons name="school-outline" size={18} color="#0a9f46" />
                <Text style={styles.studioText}>Instructor Studio</Text>
                <Text style={styles.studioMeta}>Upload courses & lessons</Text>
                <Ionicons name="chevron-forward" size={18} color="#6b7b77" />
              </Pressable>
            ) : null}
            <Pressable style={[styles.actionBtn, styles.actionBtnSecondary]} accessibilityRole="button" onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Logout</Text>
            </Pressable>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Gallery</Text>
              <Pressable style={styles.smallLink} onPress={() => {}}>
                <Text style={styles.smallLinkText}>View all</Text>
              </Pressable>
            </View>

            <View style={styles.galleryTabs}>
              {[
                { icon: "grid-outline", label: "Posts" as const },
                { icon: "play-outline", label: "Reels" as const }
              ].map((t) => (
                <Pressable
                  key={t.label}
                  style={[styles.galleryTab, activeGalleryTab === t.label ? styles.galleryTabActive : null]}
                  onPress={() => setActiveGalleryTab(t.label)}
                >
                  <Ionicons
                    name={t.icon as any}
                    size={18}
                    color={activeGalleryTab === t.label ? "#fff" : "#0f7d3d"}
                  />
                  <Text style={[styles.galleryTabText, activeGalleryTab === t.label ? styles.galleryTabTextActive : null]}>
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.grid}>
              {visiblePosts.length ? (
                visiblePosts.map((post) => (
                  <View key={post.id} style={styles.gridTile}>
                    {post.imageUrl ? (
                      <Image source={{ uri: post.imageUrl }} style={styles.gridImage} resizeMode="cover" />
                    ) : post.videoUrl ? (
                      <View style={styles.gridVideoTile}>
                        <Ionicons name="play-circle" size={24} color="#fff" />
                      </View>
                    ) : (
                      <View style={styles.gridVideoTile}>
                        <Ionicons name="leaf-outline" size={20} color="#fff" />
                      </View>
                    )}
                  </View>
                ))
              ) : (
                <View style={styles.emptyWrap}>
                  <Ionicons name="images-outline" size={20} color="#6b7874" />
                  <Text style={styles.emptyText}>
                    {activeGalleryTab === "Reels"
                      ? "Your reels will appear here after sharing."
                      : "Your posts will appear here after sharing."}
                  </Text>
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
              <Ionicons name="close" size={20} color="#0f7d3d" />
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
  screen: { flex: 1, backgroundColor: "#f2f5f4" },
  scrollBottom: { paddingBottom: 90 },

  card: { margin: 12, borderRadius: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dce4e1", padding: 16 },
  cardTitle: { fontSize: 20, fontWeight: "900", color: "#111616" },
  cardSub: { marginTop: 6, color: "#5b6965", fontWeight: "600", lineHeight: 18 },

  primaryBtn: { marginTop: 16, borderRadius: 14, backgroundColor: "#0a9f46", paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryBtnText: { color: "#fff", fontWeight: "900" },

  profileHeader: { margin: 12, borderRadius: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dce4e1", padding: 14 },

  headerTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  handleText: { fontWeight: "900", color: "#22312d" },
  iconChip: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: "#e3e7e6", alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },

  headerMidRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10 },
  avatar: { width: 66, height: 66, borderRadius: 33, backgroundColor: "#e8f7ee", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#cde9d9" },
  avatarText: { color: "#0a9f46", fontSize: 22, fontWeight: "900" },

  statsRow: { flex: 1, flexDirection: "row", justifyContent: "space-around" },
  statItem: { alignItems: "center" },
  statValue: { fontWeight: "900", color: "#22312d" },
  statLabel: { marginTop: 1, color: "#5b6965", fontWeight: "700", fontSize: 12 },

  fullName: { marginTop: 10, fontSize: 16, fontWeight: "900", color: "#22312d" },
  roleLine: { marginTop: 2, color: "#5b6965", fontWeight: "700" },
  savedAddressCard: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#dce4e1",
    borderRadius: 12,
    backgroundColor: "#f7faf8",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  savedAddressTitle: { color: "#1e2b27", fontWeight: "900", fontSize: 12 },
  savedAddressText: { marginTop: 4, color: "#4c5b57", fontWeight: "700", fontSize: 12, lineHeight: 16 },

  actionsRow: { marginTop: 10, flexDirection: "row", gap: 8 },
  msgBtn: { flex: 1, backgroundColor: "#eef8f1", borderRadius: 14, paddingVertical: 10, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#cde9d9" },
  msgBtnText: { color: "#0f7d3d", fontWeight: "900" },
  editBtn: { width: 84, backgroundColor: "#fff", borderRadius: 14, paddingVertical: 10, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#dce4e1" },
  editBtnText: { marginTop: 2, color: "#0a9f46", fontWeight: "900", fontSize: 12 },

  studioBtn: {
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: "#eef8f1",
    borderWidth: 1,
    borderColor: "#cde9d9",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  studioText: { fontWeight: "900", color: "#0a9f46" },
  studioMeta: { flex: 1, color: "#5b6965", fontWeight: "700", fontSize: 12 },

  actionBtn: { marginTop: 12, borderRadius: 14, backgroundColor: "#0a9f46", paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  actionBtnSecondary: { backgroundColor: "#111827" },
  actionBtnText: { color: "#fff", fontWeight: "900" },
  sectionCard: { margin: 12, borderRadius: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dce4e1", padding: 14 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontWeight: "900", color: "#22312d", fontSize: 16 },
  smallLink: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: "#f2f5f4", borderWidth: 1, borderColor: "#dce4e1" },
  smallLinkText: { color: "#0f7d3d", fontWeight: "800" },

  galleryTabs: { flexDirection: "row", gap: 10, marginTop: 12 },
  galleryTab: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: 14, backgroundColor: "#f2f5f4", borderWidth: 1, borderColor: "#dce4e1" },
  galleryTabActive: { backgroundColor: "#0f7d3d", borderColor: "#0f7d3d" },
  galleryTabText: { marginTop: 6, color: "#0f7d3d", fontWeight: "900", fontSize: 12 },
  galleryTabTextActive: { color: "#fff" },

  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 14, gap: 10 },
  gridTile: {
    width: "30%",
    aspectRatio: 1,
    borderRadius: 14,
    backgroundColor: "#eef8f1",
    borderWidth: 1,
    borderColor: "#cde9d9",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  gridImage: { width: "100%", height: "100%" },
  gridVideoTile: { flex: 1, width: "100%", backgroundColor: "#22312d", alignItems: "center", justifyContent: "center" },
  emptyWrap: {
    width: "100%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dce4e1",
    backgroundColor: "#f7faf8",
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: "center",
    gap: 8
  },
  emptyText: { color: "#6b7874", fontWeight: "700", textAlign: "center" }
  ,
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "70%",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 14
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { color: "#22312d", fontWeight: "900", fontSize: 16 },
  sheetBody: { paddingTop: 10, gap: 10 },
  sheetEmpty: { color: "#5b6965", fontWeight: "700" },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#dce4e1",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: "#f7faf8"
  },
  personName: { color: "#22312d", fontWeight: "800" },
  followBackBtn: { backgroundColor: "#0a9f46", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  followBackBtnText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  requestedPill: { backgroundColor: "#323a44", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  requestedPillText: { color: "#d8dde3", fontWeight: "800", fontSize: 12 },
  followingPill: { backgroundColor: "#1f6f43", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  followingPillText: { color: "#e8fff2", fontWeight: "800", fontSize: 12 },
  unfollowBtn: { backgroundColor: "#111827", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  unfollowBtnText: { color: "#fff", fontWeight: "800", fontSize: 12 }
});
