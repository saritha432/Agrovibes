import { Ionicons } from "@expo/vector-icons";
import { ResizeMode, Video } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Image, Modal, Pressable, StyleSheet, Text, TextStyle, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { UserAvatar } from "../../components/UserAvatar";
import type { HomePost } from "../../services/api";
import { APP_BLACK } from "../../theme/appColors";
import { useLanguage } from "../../localization/LanguageContext";
import { formatFeedText } from "../../localization/feedDisplay";
import { isActiveLiveStream, isLivePost, liveRoomName } from "./livePostUtils";
import { LiveKitRoomView } from "./LiveKitRoomView";

const BG = APP_BLACK;

function livePosterUri(post: HomePost): string | null {
  const th = post.thumbnailUrl?.trim();
  if (th) return th;
  const img = post.imageUrl?.trim();
  if (img) return img;
  const urls = post.imageUrls;
  if (Array.isArray(urls) && urls.length && typeof urls[0] === "string") return urls[0].trim();
  return null;
}

function liveRoomName(post: HomePost) {
  return post.liveRoomName || `agrovibes-live-${post.id}`;
}

function liveTitle(post: HomePost, language: import("../../localization/translations").AppLanguage, t: (k: string) => string) {
  const raw = String(post.caption || "")
    .replace(/^\[(?:POST|REEL|LIVE|STORY)\]\s*/i, "")
    .trim();
  if (raw) return formatFeedText(raw.slice(0, 48), language, t);
  const music = post.musicLabel?.trim();
  return music ? formatFeedText(music, language, t) : t("liveStream");
}

type LiveStreamViewerModalProps = {
  post: HomePost | null;
  onClose: () => void;
  canDeletePost?: (post: HomePost) => boolean;
  onDeletePost?: (post: HomePost) => void;
};

export function LiveStreamViewerModal({ post, onClose, canDeletePost, onDeletePost }: LiveStreamViewerModalProps) {
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const canDelete = !!post && !!canDeletePost?.(post);

  return (
    <Modal visible={post != null} animationType="slide" onRequestClose={onClose}>
      {post ? (
        <View style={styles.viewerRoot}>
          {isActiveLiveStream(post) ? (
            <LiveKitRoomView
              visible
              roomName={liveRoomName(post)}
              isHost={false}
              title={liveTitle(post, language, t)}
              onClose={onClose}
            />
          ) : (
            <>
              <Pressable style={[styles.viewerClose, { top: insets.top + 8 }]} onPress={onClose} hitSlop={12}>
                <Ionicons name="close" size={28} color="#fff" />
              </Pressable>
              {canDelete ? (
                <Pressable
                  style={[styles.viewerDelete, { top: insets.top + 8 }]}
                  onPress={() => {
                    onDeletePost?.(post);
                    onClose();
                  }}
                  hitSlop={12}
                >
                  <Ionicons name="trash-outline" size={24} color="#ff6b6b" />
                </Pressable>
              ) : null}
              {post.videoUrl ? (
                <Video
                  source={{ uri: post.videoUrl }}
                  style={styles.viewerVideo}
                  resizeMode={ResizeMode.CONTAIN}
                  shouldPlay
                  isLooping={false}
                  isMuted={false}
                  useNativeControls
                />
              ) : livePosterUri(post) ? (
                <Image source={{ uri: livePosterUri(post)! }} style={styles.viewerVideo} resizeMode="contain" />
              ) : (
                <View style={[styles.viewerVideo, styles.viewerVideoPlaceholder]}>
                  <Ionicons name="checkmark-done-circle-outline" size={48} color="rgba(255,255,255,0.4)" />
                  <Text style={styles.viewerVideoPlaceholderText}>{t("liveCompletedLabel")}</Text>
                  <Text style={styles.viewerVideoPlaceholderSub}>{t("noCompletedRecording")}</Text>
                </View>
              )}
              <LinearGradient colors={["transparent", "rgba(0,0,0,0.85)"]} style={styles.viewerGradient} pointerEvents="none" />
              <View style={[styles.viewerTopMeta, { top: insets.top + 52 }]}>
                <View style={styles.viewerEndedPill}>
                  <Ionicons name="checkmark-circle" size={12} color="#fff" />
                  <Text style={styles.viewerEndedText}>{t("liveEndedBadge")}</Text>
                </View>
              </View>
              <View style={[styles.viewerBottom, { paddingBottom: Math.max(20, insets.bottom + 12) }]}>
                <View style={styles.viewerHostRow}>
                  <UserAvatar uri={post.authorAvatarUrl} name={post.userName} size={40} borderRadius={20} />
                  <View style={styles.viewerHostText}>
                    <Text style={styles.viewerHostName}>{post.userName}</Text>
                    <Text style={styles.viewerHostTitle} numberOfLines={2}>
                      {liveTitle(post, language, t)}
                    </Text>
                  </View>
                </View>
              </View>
            </>
          )}
        </View>
      ) : null}
    </Modal>
  );
}

export function LiveStoryRing({
  post,
  onPress,
  nameStyle
}: {
  post: HomePost;
  onPress: () => void;
  nameStyle?: TextStyle;
}) {
  if (!isLivePost(post)) return null;
  return (
    <Pressable style={ringStyles.ringItem} onPress={onPress}>
      <View style={ringStyles.ringOuter}>
        <UserAvatar
          uri={post.authorAvatarUrl}
          name={post.userName}
          size={56}
          borderRadius={28}
          fallbackBackgroundColor="#333"
          initialsColor="#fff"
        />
        <View style={ringStyles.ringLiveBadge}>
          <Text style={ringStyles.ringLiveBadgeText}>LIVE</Text>
        </View>
      </View>
      <Text style={[ringStyles.ringName, nameStyle]} numberOfLines={1}>
        {post.userName.split(" ")[0]}
      </Text>
    </Pressable>
  );
}

const RED_LIVE = "#FF3040";

const ringStyles = StyleSheet.create({
  ringItem: { width: 70, alignItems: "center" },
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
  ringName: { marginTop: 6, fontSize: 11, fontWeight: "600", maxWidth: 70, textAlign: "center" }
});

const styles = StyleSheet.create({
  viewerRoot: { flex: 1, backgroundColor: "#000" },
  viewerClose: { position: "absolute", right: 14, zIndex: 20 },
  viewerDelete: { position: "absolute", left: 14, zIndex: 20 },
  viewerVideo: { flex: 1, width: "100%" },
  viewerVideoPlaceholder: { alignItems: "center", justifyContent: "center", gap: 8 },
  viewerVideoPlaceholderText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  viewerVideoPlaceholderSub: { color: "rgba(255,255,255,0.5)", fontSize: 13 },
  viewerGradient: { ...StyleSheet.absoluteFillObject },
  viewerTopMeta: { position: "absolute", left: 14, zIndex: 10 },
  viewerEndedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999
  },
  viewerEndedText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  viewerBottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 14 },
  viewerHostRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  viewerHostText: { flex: 1 },
  viewerHostName: { color: "#fff", fontWeight: "800", fontSize: 15 },
  viewerHostTitle: { color: "rgba(255,255,255,0.75)", fontSize: 13, marginTop: 2 }
});
