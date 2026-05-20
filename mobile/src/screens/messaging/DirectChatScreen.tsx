import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../auth/AuthContext";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import { queueOpenSharedPostViewer } from "../../navigation/sharedPostViewerBridge";
import { UserAvatar } from "../../components/UserAvatar";
import { fetchHomePosts, fetchMessageThread, sendDirectMessage, type DirectMessageItem, type HomePost } from "../../services/api";

const BG = "#262626";
const TEXT = "#f8fafc";
const MUTED = "#97a0a8";
const BORDER = "#303842";
const YELLOW = "#d8ff37";
const BUBBLE_PEER = "#1d2126";
const INPUT_BG = "#111418";

function formatMsgTime(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function parseSharedCropvibeContent(body: string): HomePost | null {
  const prefixes = ["[Cropvibe Reel]", "[AgroVibe Reel]"];
  let jsonText = "";
  let matched = false;
  for (const p of prefixes) {
    if (body.startsWith(p)) {
      jsonText = body.slice(p.length).trim();
      matched = true;
      break;
    }
  }
  if (!matched) return null;
  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (jsonText.startsWith("{")) {
    try {
      const parsed = JSON.parse(jsonText) as Record<string, unknown>;
      const id = Number(parsed.id);
      if (!Number.isFinite(id) || id <= 0) return null;
      const urlsRaw = parsed.imageUrls;
      const imageUrls =
        Array.isArray(urlsRaw)
          ? urlsRaw.map((u) => String(u || "").trim()).filter(Boolean)
          : undefined;
      const vid = parsed.videoUrl != null && String(parsed.videoUrl).trim() ? String(parsed.videoUrl).trim() : null;
      const img =
        parsed.imageUrl != null && String(parsed.imageUrl).trim()
          ? String(parsed.imageUrl).trim()
          : imageUrls && imageUrls.length
            ? imageUrls[0]
            : null;
      const thumb =
        parsed.thumbnailUrl != null && String(parsed.thumbnailUrl).trim()
          ? String(parsed.thumbnailUrl).trim()
          : null;
      const userIdRaw = parsed.userId;
      const uid =
        userIdRaw != null && String(userIdRaw).trim() !== "" && Number.isFinite(Number(userIdRaw))
          ? Number(userIdRaw)
          : null;
      const userName = String(parsed.userName || parsed.author || "User").trim() || "User";
      return {
        id,
        userId: uid,
        userName,
        location: String(parsed.location || ""),
        caption: String(parsed.caption || ""),
        likesCount: Number(parsed.likesCount ?? 0) || 0,
        commentsCount: Number(parsed.commentsCount ?? 0) || 0,
        videoUrl: vid,
        imageUrl: img,
        imageUrls: imageUrls && imageUrls.length > 0 ? imageUrls : undefined,
        thumbnailUrl: thumb || undefined,
        musicLabel: (parsed.musicLabel as string) ?? null,
        musicAudioUrl: (parsed.musicAudioUrl as string) ?? null,
        creativeMeta: parsed.creativeMeta as HomePost["creativeMeta"],
        authorAvatarUrl: (parsed.authorAvatarUrl as string) ?? null,
        createdAt: String(parsed.createdAt || new Date().toISOString()),
        viewerHasLiked: Boolean(parsed.viewerHasLiked),
        viewerHasSaved: Boolean(parsed.viewerHasSaved)
      };
    } catch {
      // fall through
    }
  }
  const link = lines.find((line) => line.includes("/reel/")) || "";
  const idMatch = link.match(/\/reel\/(\d+)/i);
  const legacyId = idMatch ? Number(idMatch[1]) : NaN;
  if (!Number.isFinite(legacyId) || legacyId <= 0) return null;
  return {
    id: legacyId,
    userId: null,
    userName: String(lines[1] || "User"),
    location: "",
    caption: lines.slice(2).filter((line) => line !== link).join("\n"),
    likesCount: 0,
    commentsCount: 0,
    videoUrl: null,
    imageUrl: null,
    createdAt: new Date().toISOString()
  };
}

function sharedChatCardThumb(post: HomePost): { uri: string | null; showPlayBadge: boolean } {
  const v = String(post.videoUrl || "").trim();
  if (v) {
    const thumb = String(post.thumbnailUrl || post.imageUrl || post.imageUrls?.[0] || "").trim();
    return { uri: thumb || null, showPlayBadge: true };
  }
  const first =
    String(post.imageUrl || "").trim() || String(post.imageUrls?.[0] || "").trim() || String(post.thumbnailUrl || "").trim() || null;
  return { uri: first, showPlayBadge: false };
}

function hasRenderableMedia(post: HomePost) {
  return !!(
    String(post.videoUrl || "").trim() ||
    String(post.imageUrl || "").trim() ||
    (post.imageUrls && post.imageUrls.length > 0)
  );
}

async function hydrateSharedPostFromFeed(post: HomePost, token: string | null): Promise<HomePost> {
  if (!token) return post;
  try {
    const res = await fetchHomePosts(token);
    const found = res.posts.find((p) => p.id === post.id);
    if (found) return { ...post, ...found };
  } catch {
    // ignore
  }
  return post;
}

export function DirectChatScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "DirectChat">>();
  const { peerUserId, peerName, peerAvatarUrl } = route.params;
  const { token, user } = useAuth();
  const [messages, setMessages] = useState<DirectMessageItem[]>([]);
  const [peerAvatar, setPeerAvatar] = useState<string | null>(() =>
    peerAvatarUrl != null && String(peerAvatarUrl).trim() ? String(peerAvatarUrl).trim() : null
  );
  const [draft, setDraft] = useState("");
  const [activeCall, setActiveCall] = useState<"voice" | "video" | null>(null);
  const [isMuted, setMuted] = useState(false);
  const [isCameraOff, setCameraOff] = useState(false);
  const listRef = useRef<FlatList<DirectMessageItem>>(null);

  const reload = useCallback(async () => {
    if (!token) {
      setMessages([]);
      return;
    }
    const list = await fetchMessageThread(token, peerUserId);
    setMessages(list.messages || []);
    const next = list.peer?.avatarUrl != null && String(list.peer.avatarUrl).trim() ? String(list.peer.avatarUrl).trim() : null;
    if (next) setPeerAvatar(next);
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }));
  }, [token, peerUserId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const timer = setInterval(() => {
      void reload();
    }, 2500);
    return () => clearInterval(timer);
  }, [reload]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !token) return;
    setDraft("");
    await sendDirectMessage(token, peerUserId, text);
    await reload();
  };

  const openVoiceCall = () => {
    setMuted(false);
    setCameraOff(false);
    setActiveCall("voice");
  };

  const openVideoCall = () => {
    setMuted(false);
    setCameraOff(false);
    setActiveCall("video");
  };

  const bottomPad = Platform.OS === "ios" ? Math.max(insets.bottom, 8) : 8;

  const openSharedCropvibeCard = useCallback(
    async (body: string) => {
      let post = parseSharedCropvibeContent(body);
      if (!post) return;
      post = await hydrateSharedPostFromFeed(post, token ?? null);
      if (!hasRenderableMedia(post)) {
        Alert.alert("Can't open this share", "This post isn't available. Try again after refreshing your feed.");
        return;
      }
      queueOpenSharedPostViewer(post, true);
      navigation.navigate("Main", { screen: "Home" });
    },
    [navigation, token]
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <Pressable hitSlop={12} style={styles.headerIcon} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={YELLOW} />
        </Pressable>
        <View style={styles.headerCenter}>
          <UserAvatar
            uri={peerAvatar}
            name={peerName}
            size={32}
            borderRadius={16}
            style={styles.headerAvatar}
            fallbackBackgroundColor="#111418"
            initialsColor={YELLOW}
          />
          <Text style={styles.headerTitle} numberOfLines={1}>
            {peerName}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable hitSlop={8} onPress={openVoiceCall}>
            <Ionicons name="call-outline" size={22} color={YELLOW} />
          </Pressable>
          <Pressable hitSlop={8} onPress={openVideoCall}>
            <Ionicons name="videocam-outline" size={24} color={YELLOW} />
          </Pressable>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const isSelf = Number(item.senderId) === Number(user?.id);
          const sharedPost = parseSharedCropvibeContent(item.body);
          const thumb = sharedPost ? sharedChatCardThumb(sharedPost) : { uri: null as string | null, showPlayBadge: false };
          return (
            <View style={[styles.bubbleRow, isSelf ? styles.bubbleRowSelf : styles.bubbleRowPeer]}>
              <View style={sharedPost ? styles.reelBubbleWrap : [styles.bubble, isSelf ? styles.bubbleSelf : styles.bubblePeer]}>
                {sharedPost ? (
                  <Pressable style={styles.sharedReelCard} onPress={() => void openSharedCropvibeCard(item.body)}>
                    <View style={styles.sharedReelThumb}>
                      {thumb.uri ? (
                        <Image source={{ uri: thumb.uri }} style={styles.sharedReelMedia} resizeMode="cover" />
                      ) : (
                        <View style={[styles.sharedReelMedia, styles.sharedReelThumbPlaceholder]}>
                          <Ionicons name="image-outline" size={22} color="#fff" />
                        </View>
                      )}
                      {thumb.showPlayBadge ? (
                        <View style={styles.sharedReelPlayBadge}>
                          <Ionicons name="play" size={18} color="#111" />
                        </View>
                      ) : null}
                      <View style={styles.sharedReelOverlay}>
                        <Text style={styles.sharedReelAuthor} numberOfLines={1}>
                          {sharedPost.userName}
                        </Text>
                        {sharedPost.caption ? (
                          <Text style={styles.sharedReelCaption} numberOfLines={1}>
                            {sharedPost.caption}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </Pressable>
                ) : (
                  <Text style={[styles.bubbleText, isSelf ? styles.bubbleTextSelf : styles.bubbleTextPeer]}>{item.body}</Text>
                )}
                <Text style={[styles.bubbleMeta, isSelf ? styles.bubbleMetaSelf : styles.bubbleMetaPeer, sharedPost ? styles.reelMeta : null]}>
                  {formatMsgTime(new Date(item.createdAt).getTime())}
                </Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.threadEmpty}>
            <Text style={styles.threadEmptyText}>
              Say hi to <Text style={styles.threadEmptyBold}>{peerName}</Text>
            </Text>
          </View>
        }
      />

      <View style={[styles.composer, { paddingBottom: bottomPad }]}>
        <Pressable style={styles.composerIcon} onPress={() => {}}>
          <Ionicons name="camera-outline" size={26} color={YELLOW} />
        </Pressable>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Message..."
          placeholderTextColor={MUTED}
          style={styles.input}
          multiline
          maxLength={2000}
          onSubmitEditing={send}
        />
        <Pressable
          style={[styles.sendBtn, draft.trim() ? styles.sendBtnActive : null]}
          onPress={send}
          disabled={!draft.trim()}
        >
          <Ionicons name="send" size={18} color={draft.trim() ? "#111" : MUTED} />
        </Pressable>
      </View>
      <Modal visible={!!activeCall} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setActiveCall(null)}>
        <View style={[styles.callScreen, activeCall === "video" ? styles.videoCallScreen : null, { paddingTop: Math.max(insets.top, 18) }]}>
          {activeCall === "video" ? (
            <View style={styles.videoPreview}>
              {isCameraOff ? (
                <View style={styles.videoCameraOff}>
                  <Ionicons name="videocam-off-outline" size={34} color="#fff" />
                  <Text style={styles.videoCameraOffText}>Camera off</Text>
                </View>
              ) : (
                <View style={styles.videoAvatarLarge}>
                  <UserAvatar
                    uri={peerAvatar}
                    name={peerName}
                    size={120}
                    borderRadius={60}
                    fallbackBackgroundColor="#1d2126"
                    initialsColor="#fff"
                  />
                </View>
              )}
            </View>
          ) : null}
          <View style={styles.callTopBar}>
            <Pressable style={styles.callTopIcon} onPress={() => setActiveCall(null)}>
              <Ionicons name="chevron-down" size={28} color="#fff" />
            </Pressable>
          </View>
          <View style={styles.callIdentity}>
            <UserAvatar
              uri={peerAvatar}
              name={peerName}
              size={activeCall === "video" ? 82 : 118}
              borderRadius={activeCall === "video" ? 41 : 59}
              style={[styles.callAvatar, activeCall === "video" ? styles.callAvatarVideo : null]}
              fallbackBackgroundColor="#d8ff37"
              initialsColor="#111"
            />
            <Text style={styles.callName}>{peerName}</Text>
            <Text style={styles.callStatus}>{activeCall === "video" ? "Video calling..." : "Calling..."}</Text>
          </View>
          <View style={[styles.callControls, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <Pressable style={styles.callControlBtn} onPress={() => setMuted((v) => !v)}>
              <Ionicons name={isMuted ? "mic-off" : "mic"} size={24} color="#fff" />
            </Pressable>
            {activeCall === "video" ? (
              <Pressable style={styles.callControlBtn} onPress={() => setCameraOff((v) => !v)}>
                <Ionicons name={isCameraOff ? "videocam-off" : "videocam"} size={24} color="#fff" />
              </Pressable>
            ) : (
              <Pressable style={styles.callControlBtn} onPress={openVideoCall}>
                <Ionicons name="videocam" size={24} color="#fff" />
              </Pressable>
            )}
            <Pressable style={[styles.callControlBtn, styles.endCallBtn]} onPress={() => setActiveCall(null)}>
              <Ionicons name="call" size={25} color="#fff" />
            </Pressable>
            <Pressable style={styles.callControlBtn}>
              <Ionicons name={activeCall === "video" ? "camera-reverse" : "volume-high"} size={24} color="#fff" />
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
    backgroundColor: BG
  },
  headerIcon: { width: 40, alignItems: "flex-start" },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#111418",
    alignItems: "center",
    justifyContent: "center"
  },
  headerAvatarText: { fontSize: 14, fontWeight: "800", color: YELLOW },
  headerTitle: { fontSize: 16, fontWeight: "800", color: TEXT, maxWidth: 180 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 14, width: 80, justifyContent: "flex-end" },
  listContent: { paddingHorizontal: 12, paddingVertical: 16, flexGrow: 1 },
  bubbleRow: { marginBottom: 10, flexDirection: "row" },
  bubbleRowSelf: { justifyContent: "flex-end" },
  bubbleRowPeer: { justifyContent: "flex-start" },
  bubble: { maxWidth: "78%", borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleSelf: { backgroundColor: YELLOW },
  bubblePeer: { backgroundColor: BUBBLE_PEER },
  reelBubbleWrap: { maxWidth: "84%", alignItems: "flex-end" },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  bubbleTextSelf: { color: "#111" },
  bubbleTextPeer: { color: TEXT },
  bubbleMeta: { marginTop: 4, fontSize: 11, alignSelf: "flex-end" },
  bubbleMetaSelf: { color: "rgba(0,0,0,0.62)" },
  bubbleMetaPeer: { color: MUTED },
  reelMeta: { color: MUTED, marginTop: 3, marginRight: 4 },
  sharedReelCard: {
    width: 176,
    height: 248,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#111418",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)"
  },
  sharedReelThumb: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1d2126"
  },
  sharedReelThumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2a3038"
  },
  sharedReelMedia: { width: "100%", height: "100%" },
  sharedReelPlayBadge: {
    position: "absolute",
    left: 10,
    bottom: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: YELLOW
  },
  sharedReelOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 18,
    backgroundColor: "rgba(0,0,0,0.18)"
  },
  sharedReelAuthor: { color: "#fff", fontSize: 12, fontWeight: "900" },
  sharedReelCaption: { marginTop: 2, color: "rgba(255,255,255,0.84)", fontSize: 11, fontWeight: "700" },
  threadEmpty: { paddingVertical: 48, alignItems: "center" },
  threadEmptyText: { fontSize: 15, color: MUTED },
  threadEmptyBold: { fontWeight: "800", color: TEXT },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
    backgroundColor: BG,
    gap: 8
  },
  composerIcon: { paddingBottom: 10 },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: INPUT_BG,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    fontSize: 15,
    color: TEXT
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1d2126",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2
  },
  sendBtnActive: { backgroundColor: YELLOW },
  callScreen: {
    flex: 1,
    backgroundColor: "#121212",
    justifyContent: "space-between"
  },
  videoCallScreen: {
    backgroundColor: "#050505"
  },
  videoPreview: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111"
  },
  videoCameraOff: {
    alignItems: "center",
    gap: 10
  },
  videoCameraOffText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  videoAvatarLarge: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: YELLOW,
    alignItems: "center",
    justifyContent: "center"
  },
  callTopBar: {
    zIndex: 2,
    flexDirection: "row",
    justifyContent: "flex-start",
    paddingHorizontal: 18
  },
  callTopIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)"
  },
  callIdentity: {
    zIndex: 2,
    alignItems: "center",
    paddingHorizontal: 24
  },
  callAvatar: {
    width: 118,
    height: 118,
    borderRadius: 59,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: YELLOW,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.28)"
  },
  callAvatarVideo: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "rgba(216,255,55,0.85)"
  },
  callAvatarText: { color: "#111", fontSize: 42, fontWeight: "900" },
  callName: { marginTop: 18, color: "#fff", fontSize: 25, fontWeight: "900", textAlign: "center" },
  callStatus: { marginTop: 8, color: "rgba(255,255,255,0.72)", fontSize: 15, fontWeight: "700" },
  callControls: {
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 24,
    paddingTop: 24,
    backgroundColor: "rgba(0,0,0,0.22)"
  },
  callControlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)"
  },
  endCallBtn: {
    backgroundColor: "#ef4444",
    transform: [{ rotate: "135deg" }]
  }
});
