import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../auth/AuthContext";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { fetchHomePosts, fetchProfileStats, sendFollowRequest, type HomePost } from "../services/api";
import { sendLocalFollowRequestByIdentity } from "../social/localFollowStore";

const BG = "#ffffff";
const TEXT = "#111111";
const MUTED = "#7f7f7f";
const BORDER = "#ececec";

function normalizeName(value: string) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function PublicProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { token, user } = useAuth();
  const route = useRoute<RouteProp<RootStackParamList, "PublicProfile">>();
  const { userId, userName, userKey } = route.params;
  const [posts, setPosts] = useState<HomePost[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const { width } = useWindowDimensions();
  const tile = (width - 4) / 3;

  useEffect(() => {
    navigation.setOptions({ title: userName });
  }, [navigation, userName]);

  useEffect(() => {
    let mounted = true;
    fetchHomePosts()
      .then((res) => {
        if (!mounted) return;
        setPosts(res.posts || []);
      })
      .catch(() => {
        if (!mounted) return;
        setPosts([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    if (!(token && userId)) return;
    fetchProfileStats(token, userId)
      .then((stats) => {
        if (!mounted) return;
        setFollowersCount(Number(stats.followersCount || 0));
        setFollowingCount(Number(stats.followingCount || 0));
        setIsFollowing(stats.viewerStatus === "accepted" || stats.viewerStatus === "pending");
      })
      .catch(() => {
        if (!mounted) return;
        setFollowersCount(0);
        setFollowingCount(0);
      });
    return () => {
      mounted = false;
    };
  }, [token, userId]);

  const visible = useMemo(() => {
    const byName = normalizeName(userName);
    return posts.filter((p) => (userId ? p.userId === userId : normalizeName(p.userName) === byName));
  }, [posts, userId, userName]);

  const followTarget = async () => {
    if (!user?.fullName || isFollowing || followBusy) return;
    setFollowBusy(true);
    try {
      if (token && userId) {
        await sendFollowRequest(token, userId);
      } else {
        await sendLocalFollowRequestByIdentity(
          { name: user.fullName, key: user.email || String(user.id || "") },
          { name: userName, key: userKey || (userId ? String(userId) : undefined) }
        );
      }
      setIsFollowing(true);
      setFollowersCount((v) => v + 1);
    } catch {
      Alert.alert("Follow failed", "Try again in a moment.");
    } finally {
      setFollowBusy(false);
    }
  };

  const openMessage = async () => {
    if (!userId) {
      Alert.alert("Unavailable", "Cannot open chat for this user yet.");
      return;
    }
    navigation.navigate("DirectChat", {
      peerUserId: userId,
      peerName: userName,
      peerKey: userKey || (userId ? String(userId) : undefined)
    });
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{userName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{visible.length}</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{followersCount}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{followingCount}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
        </View>
      </View>
      <Text style={styles.name}>{userName}</Text>
      <Text style={styles.sub}>Public account</Text>

      <View style={styles.actionsRow}>
        <Pressable
          style={[styles.actionBtn, isFollowing ? styles.actionBtnMuted : styles.actionBtnPrimary]}
          onPress={followTarget}
          disabled={isFollowing || followBusy}
        >
          <Text style={[styles.actionText, isFollowing ? styles.actionTextMuted : styles.actionTextPrimary]}>
            {isFollowing ? "Following" : followBusy ? "..." : "Follow"}
          </Text>
        </Pressable>
        <Pressable style={[styles.actionBtn, styles.actionBtnMuted]} onPress={openMessage}>
          <Text style={[styles.actionText, styles.actionTextMuted]}>Message</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        {visible.length ? (
          visible.map((p) => (
            <Pressable key={p.id} style={[styles.tile, { width: tile, height: tile }]}>
              {p.imageUrl ? (
                <Image source={{ uri: p.imageUrl }} style={styles.media} resizeMode="cover" />
              ) : p.videoUrl ? (
                <View style={[styles.placeholder, styles.videoBg]}>
                  <Ionicons name="play-circle" size={28} color="#fff" />
                </View>
              ) : (
                <View style={[styles.placeholder, styles.emptyBg]}>
                  <Ionicons name="leaf-outline" size={24} color="#85783e" />
                </View>
              )}
            </Pressable>
          ))
        ) : (
          <View style={styles.emptyWrap}>
            <Ionicons name="images-outline" size={30} color={MUTED} />
            <Text style={styles.emptyText}>No public posts yet.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  content: { paddingBottom: 20 },
  header: { flexDirection: "row", alignItems: "center", gap: 22, paddingHorizontal: 16, paddingTop: 14 },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: "#edf3f2",
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: { fontSize: 30, fontWeight: "800", color: "#0f9b8e" },
  statsRow: { flex: 1, flexDirection: "row", justifyContent: "space-between", paddingRight: 6 },
  stat: { alignItems: "center" },
  statValue: { fontSize: 20, fontWeight: "900", color: TEXT },
  statLabel: { marginTop: 2, fontSize: 12, color: MUTED, fontWeight: "700" },
  name: { marginTop: 14, paddingHorizontal: 16, fontSize: 16, color: TEXT, fontWeight: "800" },
  sub: { marginTop: 4, paddingHorizontal: 16, fontSize: 13, color: MUTED, fontWeight: "600" },
  actionsRow: { marginTop: 12, paddingHorizontal: 16, flexDirection: "row", gap: 8 },
  actionBtn: { flex: 1, borderRadius: 8, height: 34, alignItems: "center", justifyContent: "center" },
  actionBtnPrimary: { backgroundColor: "#3797ef" },
  actionBtnMuted: { backgroundColor: "#efefef", borderWidth: StyleSheet.hairlineWidth, borderColor: BORDER },
  actionText: { fontSize: 13, fontWeight: "800" },
  actionTextPrimary: { color: "#fff" },
  actionTextMuted: { color: TEXT },
  grid: {
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2
  },
  tile: { backgroundColor: "#f0f0f0" },
  media: { width: "100%", height: "100%" },
  placeholder: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  videoBg: { backgroundColor: "#3e4a53" },
  emptyBg: { backgroundColor: "#f0eadf" },
  emptyWrap: { width: "100%", alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 8 },
  emptyText: { color: MUTED, fontSize: 14, fontWeight: "600" }
});
