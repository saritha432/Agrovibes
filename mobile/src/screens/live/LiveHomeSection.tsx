import { Ionicons } from "@expo/vector-icons";
import { ResizeMode, Video } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { UserAvatar } from "../../components/UserAvatar";
import type { HomePost } from "../../services/api";
import { APP_BLACK, APP_LIME, APP_SURFACE } from "../../theme/appColors";
import { useLanguage } from "../../localization/LanguageContext";
import { formatFeedText } from "../../localization/feedDisplay";

const LIME = APP_LIME;
const RED_LIVE = "#FF3040";
const BG = APP_BLACK;
const CARD = APP_SURFACE;

export function isLivePost(post: HomePost) {
  return /^\[LIVE\]/i.test(String(post.caption || "").trim());
}

function isReelPost(post: HomePost) {
  return /^\[REEL\]/i.test(String(post.caption || "").trim());
}

function livePosterUri(post: HomePost): string | null {
  const th = post.thumbnailUrl?.trim();
  if (th) return th;
  const img = post.imageUrl?.trim();
  if (img) return img;
  const c0 = post.imageUrls?.find((u) => typeof u === "string" && u.trim())?.trim();
  return c0 || null;
}

function liveTitle(post: HomePost, language: import("../../localization/translations").AppLanguage, t: (k: string) => string) {
  const raw = String(post.caption || "")
    .replace(/^\[(?:POST|REEL|LIVE|STORY)\]\s*/i, "")
    .trim();
  if (raw) return formatFeedText(raw.slice(0, 48), language, t);
  const music = post.musicLabel?.trim();
  return music ? formatFeedText(music, language, t) : t("liveStream");
}

function viewerCount(post: HomePost) {
  const base = 180 + ((post.id * 97) % 4200);
  return base + Math.max(0, post.likesCount) * 4;
}

function formatViewers(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

/** Prefer explicit [LIVE] posts; otherwise surface recent video posts for discovery. */
export function buildLiveFeed(posts: HomePost[]): HomePost[] {
  const dismissed = new Set<number>();
  const liveTagged = posts.filter((p) => isLivePost(p) && (p.videoUrl || livePosterUri(p)));
  if (liveTagged.length) return liveTagged;
  return posts.filter((p) => p.videoUrl && !isReelPost(p)).slice(0, 12);
}

type LiveHomeSectionProps = {
  posts: HomePost[];
  onOpenCreate?: () => void;
};

export function LiveHomeSection({ posts, onOpenCreate }: LiveHomeSectionProps) {
  const { t, language } = useLanguage();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [watching, setWatching] = React.useState<HomePost | null>(null);

  const livePosts = React.useMemo(() => buildLiveFeed(posts), [posts]);
  const gridGap = 10;
  const gridPad = 12;
  const cardWidth = (width - gridPad * 2 - gridGap) / 2;

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 88 }]}
      >
        <View style={styles.sectionHeadRow}>
          <Text style={styles.sectionTitle}>{t("liveNow")}</Text>
          {onOpenCreate ? (
            <Pressable style={styles.goLiveBtn} onPress={onOpenCreate}>
              <Ionicons name="videocam" size={16} color="#111" />
              <Text style={styles.goLiveBtnText}>{t("goLive")}</Text>
            </Pressable>
          ) : null}
        </View>

        {livePosts.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ringsRow}>
            {livePosts.map((post) => (
              <Pressable key={`ring-${post.id}`} style={styles.ringItem} onPress={() => setWatching(post)}>
                <View style={styles.ringOuter}>
                  <UserAvatar
                    uri={post.authorAvatarUrl}
                    name={post.userName}
                    size={58}
                    borderRadius={29}
                    fallbackBackgroundColor="#333"
                    initialsColor="#fff"
                  />
                  <View style={styles.ringLiveBadge}>
                    <Text style={styles.ringLiveBadgeText}>LIVE</Text>
                  </View>
                </View>
                <Text style={styles.ringName} numberOfLines={1}>
                  {post.userName.split(" ")[0]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyRings}>
            <Text style={styles.emptyRingsText}>{t("noOneLive")}</Text>
          </View>
        )}

        <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>{t("popularLive")}</Text>
        {livePosts.length ? (
          <View style={[styles.grid, { paddingHorizontal: gridPad, gap: gridGap }]}>
            {livePosts.map((post) => {
              const poster = livePosterUri(post);
              return (
                <Pressable
                  key={`card-${post.id}`}
                  style={[styles.gridCard, { width: cardWidth }]}
                  onPress={() => setWatching(post)}
                >
                  <View style={styles.gridThumb}>
                    {poster ? (
                      <Image source={{ uri: poster }} style={styles.gridThumbImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.gridThumbPlaceholder}>
                        <Ionicons name="videocam" size={32} color="rgba(255,255,255,0.35)" />
                      </View>
                    )}
                    <LinearGradient colors={["transparent", "rgba(0,0,0,0.75)"]} style={styles.gridThumbGradient} />
                    <View style={styles.gridLivePill}>
                      <View style={styles.gridLiveDot} />
                      <Text style={styles.gridLivePillText}>LIVE</Text>
                    </View>
                    <View style={styles.gridViewersPill}>
                      <Ionicons name="eye-outline" size={12} color="#fff" />
                      <Text style={styles.gridViewersText}>{formatViewers(viewerCount(post))}</Text>
                    </View>
                  </View>
                  <Text style={styles.gridTitle} numberOfLines={2}>
                    {liveTitle(post, language, t)}
                  </Text>
                  <View style={styles.gridHostRow}>
                    <UserAvatar uri={post.authorAvatarUrl} name={post.userName} size={18} borderRadius={9} />
                    <Text style={styles.gridHostName} numberOfLines={1}>
                      {post.userName}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyGrid}>
            <Ionicons name="radio-outline" size={40} color="rgba(255,255,255,0.25)" />
            <Text style={styles.emptyGridTitle}>{t("noLiveStreamsYet")}</Text>
            <Text style={styles.emptyGridSub}>{t("noLiveStreamsSub")}</Text>
            {onOpenCreate ? (
              <Pressable style={styles.goLiveBtnLarge} onPress={onOpenCreate}>
                <Text style={styles.goLiveBtnLargeText}>{t("startLive")}</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>

      <Modal visible={watching != null} animationType="slide" onRequestClose={() => setWatching(null)}>
        {watching ? (
          <View style={styles.viewerRoot}>
            <Pressable style={[styles.viewerClose, { top: insets.top + 8 }]} onPress={() => setWatching(null)} hitSlop={12}>
              <Ionicons name="close" size={28} color="#fff" />
            </Pressable>
            {watching.videoUrl ? (
              <Video
                source={{ uri: watching.videoUrl }}
                style={styles.viewerVideo}
                resizeMode={ResizeMode.COVER}
                shouldPlay
                isLooping
                isMuted={false}
                useNativeControls={false}
              />
            ) : livePosterUri(watching) ? (
              <Image source={{ uri: livePosterUri(watching)! }} style={styles.viewerVideo} resizeMode="cover" />
            ) : (
              <View style={[styles.viewerVideo, styles.viewerVideoPlaceholder]}>
                <Ionicons name="videocam-outline" size={48} color="rgba(255,255,255,0.4)" />
              </View>
            )}
            <LinearGradient colors={["transparent", "rgba(0,0,0,0.85)"]} style={styles.viewerGradient} pointerEvents="none" />
            <View style={[styles.viewerTopMeta, { top: insets.top + 52 }]}>
              <View style={styles.viewerLivePill}>
                <View style={styles.gridLiveDot} />
                <Text style={styles.viewerLiveText}>LIVE</Text>
              </View>
              <Text style={styles.viewerViewers}>{formatViewers(viewerCount(watching))} watching</Text>
            </View>
            <View style={[styles.viewerBottom, { paddingBottom: Math.max(20, insets.bottom + 12) }]}>
              <View style={styles.viewerHostRow}>
                <UserAvatar uri={watching.authorAvatarUrl} name={watching.userName} size={40} borderRadius={20} />
                <View style={styles.viewerHostText}>
                  <Text style={styles.viewerHostName}>{watching.userName}</Text>
                  <Text style={styles.viewerHostTitle} numberOfLines={2}>
                    {liveTitle(watching, language, t)}
                  </Text>
                </View>
              </View>
              <View style={styles.viewerActions}>
                <Pressable style={styles.viewerActionBtn}>
                  <Ionicons name="heart-outline" size={26} color="#fff" />
                </Pressable>
                <Pressable style={styles.viewerActionBtn}>
                  <Ionicons name="chatbubble-outline" size={24} color="#fff" />
                </Pressable>
                <Pressable style={styles.viewerActionBtn}>
                  <Ionicons name="share-social-outline" size={24} color="#fff" />
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scrollContent: { paddingTop: 8 },
  sectionHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    marginBottom: 10
  },
  sectionTitle: { color: "#fff", fontSize: 17, fontWeight: "800" },
  sectionTitleSpaced: { paddingHorizontal: 14, marginTop: 18, marginBottom: 10 },
  goLiveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: LIME,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999
  },
  goLiveBtnText: { color: "#111", fontWeight: "800", fontSize: 12 },
  ringsRow: { paddingHorizontal: 12, gap: 14, paddingBottom: 4 },
  ringItem: { width: 72, alignItems: "center" },
  ringOuter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2.5,
    borderColor: RED_LIVE,
    alignItems: "center",
    justifyContent: "center",
    padding: 2
  },
  ringLiveBadge: {
    position: "absolute",
    bottom: -2,
    backgroundColor: RED_LIVE,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: BG
  },
  ringLiveBadgeText: { color: "#fff", fontSize: 9, fontWeight: "900" },
  ringName: { marginTop: 6, color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "600", maxWidth: 72 },
  emptyRings: { paddingHorizontal: 14, paddingVertical: 12 },
  emptyRingsText: { color: "rgba(255,255,255,0.45)", fontSize: 13 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  gridCard: { marginBottom: 4 },
  gridThumb: {
    width: "100%",
    aspectRatio: 9 / 14,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: CARD
  },
  gridThumbImage: { width: "100%", height: "100%" },
  gridThumbPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#252525" },
  gridThumbGradient: { ...StyleSheet.absoluteFillObject },
  gridLivePill: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: RED_LIVE,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4
  },
  gridLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" },
  gridLivePillText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  gridViewersPill: {
    position: "absolute",
    bottom: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6
  },
  gridViewersText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  gridTitle: { marginTop: 8, color: "#fff", fontSize: 13, fontWeight: "700", lineHeight: 17 },
  gridHostRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  gridHostName: { flex: 1, color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "600" },
  emptyGrid: { alignItems: "center", paddingHorizontal: 24, paddingTop: 40, paddingBottom: 24 },
  emptyGridTitle: { marginTop: 14, color: "#fff", fontSize: 16, fontWeight: "800" },
  emptyGridSub: { marginTop: 6, color: "rgba(255,255,255,0.5)", fontSize: 13, textAlign: "center" },
  goLiveBtnLarge: {
    marginTop: 20,
    backgroundColor: LIME,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10
  },
  goLiveBtnLargeText: { color: "#111", fontWeight: "800", fontSize: 14 },
  viewerRoot: { flex: 1, backgroundColor: "#000" },
  viewerVideo: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  viewerVideoPlaceholder: { alignItems: "center", justifyContent: "center", backgroundColor: "#111" },
  viewerGradient: { position: "absolute", left: 0, right: 0, bottom: 0, height: "42%" },
  viewerClose: { position: "absolute", left: 12, zIndex: 4 },
  viewerTopMeta: { position: "absolute", left: 14, right: 14, flexDirection: "row", alignItems: "center", gap: 10, zIndex: 3 },
  viewerLivePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: RED_LIVE,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5
  },
  viewerLiveText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  viewerViewers: { color: "#fff", fontSize: 13, fontWeight: "700" },
  viewerBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 14,
    zIndex: 3
  },
  viewerHostRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  viewerHostText: { flex: 1, minWidth: 0 },
  viewerHostName: { color: "#fff", fontSize: 15, fontWeight: "800" },
  viewerHostTitle: { marginTop: 2, color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: "600" },
  viewerActions: { alignItems: "center", gap: 14, marginLeft: 8 },
  viewerActionBtn: { padding: 4 }
});
