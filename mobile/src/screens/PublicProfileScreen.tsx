import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import { RouteProp, useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { fetchHomePosts, fetchProfileStats, sendFollowRequest, type HomePost } from "../services/api";
import { sendLocalFollowRequestByIdentity } from "../social/localFollowStore";
import { socialDiscoveryTheme as T } from "../theme/socialDiscoveryTheme";
import { useLanguage } from "../localization/LanguageContext";
import { formatDisplayName } from "../localization/feedDisplay";

function normalizeName(value: string) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function PublicProfileScreen() {
  const { t, language } = useLanguage();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { token, user } = useAuth();
  const route = useRoute<RouteProp<RootStackParamList, "PublicProfile">>();
  const { userId, userName, userKey, avatarUrl: avatarFromRoute } = route.params;
  const displayName = formatDisplayName(userName, language, t);
  const [posts, setPosts] = useState<HomePost[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null | undefined>(avatarFromRoute);
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tile = (width - 4) / 3;
  const avatarPreviewSize = Math.min(320, Math.max(200, Math.min(width, height) * 0.68));

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle("light-content");
      if (Platform.OS === "android") {
        StatusBar.setBackgroundColor(T.navBg);
      }
      return () => {
        StatusBar.setBarStyle("dark-content");
        if (Platform.OS === "android") {
          StatusBar.setBackgroundColor("#ffffff");
        }
      };
    }, [])
  );

  useEffect(() => {
    navigation.setOptions({ title: displayName });
  }, [navigation, displayName]);

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
        const fromApi =
          stats.avatarUrl != null && String(stats.avatarUrl).trim().length > 0 ? String(stats.avatarUrl).trim() : null;
        const fromRoute = avatarFromRoute != null && String(avatarFromRoute).trim().length > 0 ? String(avatarFromRoute).trim() : null;
        setAvatarUrl(fromApi ?? fromRoute);
      })
      .catch(() => {
        if (!mounted) return;
        setFollowersCount(0);
        setFollowingCount(0);
      });
    return () => {
      mounted = false;
    };
  }, [token, userId, avatarFromRoute]);

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
      Alert.alert(t("followFailed"), t("tryAgainMoment"));
    } finally {
      setFollowBusy(false);
    }
  };

  const openMessage = async () => {
    if (!userId) {
      Alert.alert(t("unavailable"), t("cannotOpenChat"));
      return;
    }
    navigation.navigate("DirectChat", {
      peerUserId: userId,
      peerName: userName,
      peerKey: userKey || (userId ? String(userId) : undefined),
      peerAvatarUrl: avatarUrl
    });
  };

  return (
    <>
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable
          onPress={() => avatarUrl && setAvatarPreviewOpen(true)}
          disabled={!avatarUrl}
          style={({ pressed }) => [styles.avatarPressable, pressed && avatarUrl ? { opacity: 0.85 } : null]}
          accessibilityRole="button"
          accessibilityLabel={t("viewProfilePhoto")}
        >
          <View style={styles.avatar}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} resizeMode="cover" />
            ) : (
              <Text style={styles.avatarText}>{userName.charAt(0).toUpperCase()}</Text>
            )}
          </View>
        </Pressable>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{visible.length}</Text>
            <Text style={styles.statLabel} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.72}>
              {t("posts")}
            </Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{followersCount}</Text>
            <Text style={styles.statLabel} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.72}>
              {t("followers")}
            </Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{followingCount}</Text>
            <Text style={styles.statLabel} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.72}>
              {t("profileFollowing")}
            </Text>
          </View>
        </View>
      </View>
      <Text style={styles.name}>{displayName}</Text>
      <Text style={styles.sub}>{t("publicAccount")}</Text>

      <View style={styles.actionsRow}>
        <Pressable
          style={[styles.actionBtn, isFollowing ? styles.actionBtnMuted : styles.actionBtnPrimary]}
          onPress={followTarget}
          disabled={isFollowing || followBusy}
        >
          <Text style={[styles.actionText, isFollowing ? styles.actionTextMuted : styles.actionTextPrimary]}>
            {isFollowing ? t("following") : followBusy ? t("followBusy") : t("follow")}
          </Text>
        </Pressable>
        <Pressable style={[styles.actionBtn, styles.actionBtnMuted]} onPress={openMessage}>
          <Text style={[styles.actionText, styles.actionTextMuted]}>{t("messageBtn")}</Text>
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
                  <Ionicons name="leaf-outline" size={24} color={T.emptyIcon} />
                </View>
              )}
            </Pressable>
          ))
        ) : (
          <View style={styles.emptyWrap}>
            <Ionicons name="images-outline" size={30} color={T.muted} />
            <Text style={styles.emptyText}>No public posts yet.</Text>
          </View>
        )}
      </View>
    </ScrollView>

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
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
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
  root: { flex: 1, backgroundColor: T.bg },
  content: { paddingBottom: 20 },
  header: { flexDirection: "row", alignItems: "center", gap: 22, paddingHorizontal: 16, paddingTop: 14 },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: T.avatarRing,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: T.border
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarText: { fontSize: 30, fontWeight: "800", color: T.accent },
  statsRow: { flex: 1, flexDirection: "row", justifyContent: "space-between", paddingRight: 2, gap: 0 },
  stat: { flex: 1, alignItems: "center", minWidth: 0, paddingHorizontal: 1 },
  statValue: { fontSize: 20, fontWeight: "900", color: T.text, textAlign: "center" },
  statLabel: {
    marginTop: 1,
    fontSize: 10,
    lineHeight: 12,
    color: T.statLabel,
    fontWeight: "700",
    textAlign: "center",
    width: "100%"
  },
  name: { marginTop: 14, paddingHorizontal: 16, fontSize: 16, color: T.text, fontWeight: "800" },
  sub: { marginTop: 4, paddingHorizontal: 16, fontSize: 13, color: T.muted, fontWeight: "600" },
  actionsRow: { marginTop: 12, paddingHorizontal: 16, flexDirection: "row", gap: 8 },
  actionBtn: { flex: 1, borderRadius: 8, height: 34, alignItems: "center", justifyContent: "center" },
  actionBtnPrimary: { backgroundColor: T.accent },
  actionBtnMuted: { backgroundColor: T.elevated, borderWidth: StyleSheet.hairlineWidth, borderColor: T.border },
  actionText: { fontSize: 13, fontWeight: "800" },
  actionTextPrimary: { color: T.accentText },
  actionTextMuted: { color: T.text },
  grid: {
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.border,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2
  },
  tile: { backgroundColor: T.gridTile },
  media: { width: "100%", height: "100%" },
  placeholder: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  videoBg: { backgroundColor: T.videoPlaceholder },
  emptyBg: { backgroundColor: T.surface },
  emptyWrap: { width: "100%", alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 8 },
  emptyText: { color: T.muted, fontSize: 14, fontWeight: "600" },
  avatarPressable: { borderRadius: 41 },
  avatarPreviewRoot: { flex: 1, backgroundColor: "rgba(0,0,0,0.88)" },
  avatarPreviewLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center"
  },
  avatarPreviewCircle: {
    overflow: "hidden",
    borderWidth: 3,
    borderColor: T.accent
  },
  avatarPreviewClose: { position: "absolute", right: 14, zIndex: 4 }
});
