import { Ionicons } from "@expo/vector-icons";
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../auth/AuthContext";
import { CallHistoryBubble } from "../../components/CallHistoryBubble";
import { ChatMediaBubble } from "../../components/ChatMediaBubble";
import { ChatVoiceNoteBubble } from "../../components/ChatVoiceNoteBubble";
import { PostsReelViewerModal } from "../../components/PostsReelViewerModal";
import { SharedReelChatCard } from "../../components/SharedReelChatCard";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import { UserAvatar } from "../../components/UserAvatar";
import { SvgAssetIcon } from "../../components/SvgAssetIcon";
import { fetchHomePost, fetchHomePosts, fetchMessageThread, fetchMyHomePosts, fetchProfileStats, ringDirectCall, sendDirectMessage, uploadAudioFile, uploadPickedMedia, type DirectMessageItem, type HomePost } from "../../services/api";
import {
  joinDirectThread,
  leaveDirectThread,
  onDirectMessage,
  onSocketConnectionChange,
  isSocketChatConnected
} from "../../services/socketChat";
import { queueJoinLive } from "../../navigation/liveJoinBridge";
import {
  hydrateLiveShareFromFeed,
  isJoinableLiveShare,
  parseLiveShareContent,
  type LiveSharePayload
} from "./liveShareMessage";
import { APP_LIME } from "../../theme/appColors";
import { useLanguage } from "../../localization/LanguageContext";
import { DirectCallView, type CallDirection, type CallEndResult, type DirectCallMode } from "./DirectCallView";
import { ChatMessageActionSheet } from "./ChatMessageActionSheet";
import { ForwardMessageModal } from "./ForwardMessageModal";
import { SwipeReplyMessageRow } from "./SwipeReplyMessageRow";
import {
  buildDmCallMessage,
  buildDmMediaMessage,
  buildDmReactMessage,
  buildDmReplyMessage,
  buildDmVoiceMessage,
  dmMessageCopyText,
  formatDmInboxPreview,
  formatVoiceDuration,
  parseDmCallMessage,
  parseDmMediaMessage,
  parseDmReactMessage,
  parseDmReplyMessage,
  parseDmVoiceMessage
} from "./dmMessageFormats";

const BG = "#262626";
const TEXT = "#f8fafc";
const MUTED = "#97a0a8";
const BORDER = "#303842";
const YELLOW = APP_LIME;
const BUBBLE_PEER = "#3a3f46";
const COMPOSER_BG = "#303132";
const COMPOSER_HEIGHT = 59;
const COMPOSER_PADDING = 12;
const COMPOSER_GAP = 12;
const COMPOSER_RADIUS = 8;
const COMPOSER_INPUT_MIN_HEIGHT = COMPOSER_HEIGHT - COMPOSER_PADDING * 2;
const COMPOSER_LINE_HEIGHT = 20;
const COMPOSER_INPUT_MAX_HEIGHT = 120;
const CAMERA_ICON_SIZE = 35;
const COMPOSER_ICON = 24;

const CHAT_ASSETS = {
  camera: require("../../../assets/camera.svg"),
  mic: require("../../../assets/mic-icon.svg"),
  gallery: require("../../../assets/gallery-icon.svg"),
  sticker: require("../../../assets/sticker-icon.svg"),
  plus: require("../../../assets/plus-icon.svg"),
  voiceCall: require("../../../assets/voicecal-icon.svg"),
  videoCall: require("../../../assets/videocal-icon.svg")
} as const;

const HEADER_CALL_ICON = 22;

type ChatIconKey = keyof typeof CHAT_ASSETS;

const CHAT_ICON_NAMES: Record<ChatIconKey, keyof typeof Ionicons.glyphMap> = {
  camera: "camera-outline",
  mic: "mic-outline",
  gallery: "image-outline",
  sticker: "happy-outline",
  plus: "add-circle-outline",
  voiceCall: "call-outline",
  videoCall: "videocam-outline"
};

function ChatAssetIcon({ icon, size = COMPOSER_ICON, color = TEXT }: { icon: ChatIconKey; size?: number; color?: string }) {
  return (
    <SvgAssetIcon module={CHAT_ASSETS[icon]} size={size} color={color} fallbackName={CHAT_ICON_NAMES[icon]} />
  );
}

function formatDateSeparator(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const time = d
    .toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true })
    .replace(/\s/g, "")
    .toUpperCase();
  const sameDay = (a: Date, b: Date) =>
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  if (sameDay(d, now)) return `TODAY AT ${time}`;
  if (sameDay(d, yesterday)) return `YESTERDAY AT ${time}`;
  const datePart = d
    .toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    .toUpperCase();
  return `${datePart} AT ${time}`;
}

type ThreadListItem =
  | { type: "date"; id: string; label: string }
  | { type: "message"; id: string; message: DirectMessageItem; reactions: string[] };

function buildThreadListItems(messages: DirectMessageItem[]): ThreadListItem[] {
  const reactionsByTarget = new Map<number, string[]>();
  for (const message of messages) {
    const react = parseDmReactMessage(message.body);
    if (!react) continue;
    const list = reactionsByTarget.get(react.targetId) || [];
    list.push(react.emoji);
    reactionsByTarget.set(react.targetId, list);
  }

  const items: ThreadListItem[] = [];
  let lastDayKey = "";
  for (const message of messages) {
    if (parseDmReactMessage(message.body)) continue;

    const d = new Date(message.createdAt);
    const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (dayKey !== lastDayKey) {
      items.push({ type: "date", id: `date-${dayKey}`, label: formatDateSeparator(d.getTime()) });
      lastDayKey = dayKey;
    }
    items.push({
      type: "message",
      id: String(message.id),
      message,
      reactions: reactionsByTarget.get(message.id) || []
    });
  }
  return items;
}

function formatActionSheetTimestamp(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }).toUpperCase();
  if (isToday) return `TODAY ${time}`;
  if (isYesterday) return `YESTERDAY ${time}`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }).toUpperCase() + ` ${time}`;
}

function formatPeerHandle(username?: string | null, peerKey?: string) {
  const normalizedUsername = String(username || "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();
  if (normalizedUsername && !normalizedUsername.includes("@")) {
    return `@${normalizedUsername}`;
  }

  const raw = String(peerKey || "").trim();
  if (!raw) return "";
  if (raw.includes("@")) return "";
  if (/^\d+$/.test(raw)) return "";
  return raw.startsWith("@") ? raw.toLowerCase() : `@${raw.toLowerCase()}`;
}

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

function parseSharedProfileContent(body: string): { userId?: number; userName: string; handle?: string; bio?: string; avatarUrl?: string | null } | null {
  const prefix = "[Cropvibe Profile]";
  if (!String(body || "").startsWith(prefix)) return null;
  const jsonText = String(body || "").slice(prefix.length).trim();
  if (!jsonText.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    const userName = String(parsed.userName || parsed.fullName || "User").trim() || "User";
    const rawId = Number(parsed.userId);
    const userId = Number.isFinite(rawId) && rawId > 0 ? rawId : undefined;
    return {
      userId,
      userName,
      handle: String(parsed.handle || "").trim() || undefined,
      bio: String(parsed.bio || "").trim() || undefined,
      avatarUrl: parsed.avatarUrl ? String(parsed.avatarUrl) : undefined
    };
  } catch {
    return null;
  }
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
    const { post: found } = await fetchHomePost(token, post.id);
    return { ...post, ...found };
  } catch {
    // fall through
  }
  try {
    const feed = await fetchHomePosts(token);
    const found = feed.posts.find((p) => p.id === post.id);
    if (found) return { ...post, ...found };
  } catch {
    // ignore
  }
  try {
    const mine = await fetchMyHomePosts(token);
    const found = mine.posts.find((p) => p.id === post.id);
    if (found) return { ...post, ...found };
  } catch {
    // ignore
  }
  return post;
}

async function hydrateSharedPostsById(postIds: number[], token: string): Promise<Record<number, HomePost>> {
  const map: Record<number, HomePost> = {};
  if (!postIds.length) return map;
  const wanted = new Set(postIds);
  try {
    const feed = await fetchHomePosts(token);
    for (const p of feed.posts) {
      if (wanted.has(p.id)) map[p.id] = p;
    }
  } catch {
    // ignore
  }
  const missing = postIds.filter((id) => !map[id]);
  if (missing.length) {
    try {
      const mine = await fetchMyHomePosts(token);
      for (const p of mine.posts) {
        if (missing.includes(p.id)) map[p.id] = p;
      }
    } catch {
      // ignore
    }
  }
  const stillMissing = postIds.filter((id) => !map[id]);
  await Promise.all(
    stillMissing.map(async (id) => {
      try {
        const { post } = await fetchHomePost(token, id);
        map[id] = post;
      } catch {
        // ignore
      }
    })
  );
  return map;
}

export function DirectChatScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "DirectChat">>();
  const { peerUserId, peerName, peerKey, peerUsername: peerUsernameParam, peerAvatarUrl, incomingCall } = route.params;
  const { t, language } = useLanguage();
  const { token, user } = useAuth();
  const [messages, setMessages] = useState<DirectMessageItem[]>([]);
  const [peerUsername, setPeerUsername] = useState(peerUsernameParam || "");
  const peerHandle = formatPeerHandle(peerUsername, peerKey);
  const threadItems = useMemo(() => buildThreadListItems(messages), [messages]);
  const [peerAvatar, setPeerAvatar] = useState<string | null>(() =>
    peerAvatarUrl != null && String(peerAvatarUrl).trim() ? String(peerAvatarUrl).trim() : null
  );
  const [draft, setDraft] = useState("");
  const [callSession, setCallSession] = useState<{
    roomName: string;
    mode: DirectCallMode;
    connectEnabled: boolean;
    direction: CallDirection;
    statusLabel?: string;
  } | null>(null);
  const callHistorySentRef = useRef(false);
  const [sharedReelViewer, setSharedReelViewer] = useState<{ posts: HomePost[]; initialIndex: number } | null>(null);
  const [hydratedPostsById, setHydratedPostsById] = useState<Record<number, HomePost>>({});
  const [attachBusy, setAttachBusy] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceRecordingMs, setVoiceRecordingMs] = useState(0);
  const listRef = useRef<FlatList<ThreadListItem>>(null);
  const voiceRecordingRef = useRef<Audio.Recording | null>(null);
  const voiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceStartedAtRef = useRef(0);
  const [replyTarget, setReplyTarget] = useState<{
    messageId: number;
    preview: string;
    authorName: string;
    replyLabel: string;
  } | null>(null);
  const [actionMessage, setActionMessage] = useState<DirectMessageItem | null>(null);
  const [forwardBody, setForwardBody] = useState<string | null>(null);
  const [composerInputHeight, setComposerInputHeight] = useState(COMPOSER_INPUT_MIN_HEIGHT);
  const [socketConnected, setSocketConnected] = useState(isSocketChatConnected());

  useEffect(() => {
    if (peerUsernameParam) {
      setPeerUsername(peerUsernameParam);
      return;
    }
    if (!token || !peerUserId) return;
    let mounted = true;
    fetchProfileStats(token, peerUserId)
      .then((stats) => {
        if (!mounted) return;
        setPeerUsername(String(stats.username || "").trim());
      })
      .catch(() => {
        if (!mounted) return;
        setPeerUsername("");
      });
    return () => {
      mounted = false;
    };
  }, [peerUserId, peerUsernameParam, token]);

  useEffect(() => {
    if (!token || !messages.length) return;
    const ids = Array.from(
      new Set(
        messages
          .map((m) => parseSharedCropvibeContent(m.body)?.id)
          .filter((id): id is number => typeof id === "number" && id > 0)
      )
    );
    if (!ids.length) return;
    let cancelled = false;
    void hydrateSharedPostsById(ids, token).then((map) => {
      if (!cancelled && Object.keys(map).length) {
        setHydratedPostsById((prev) => ({ ...prev, ...map }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [messages, token]);

  const mergeHydratedPost = useCallback(
    (post: HomePost) => {
      const hydrated = hydratedPostsById[post.id];
      return hydrated ? { ...post, ...hydrated } : post;
    },
    [hydratedPostsById]
  );

  useEffect(() => {
    return () => {
      if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
      void voiceRecordingRef.current?.stopAndUnloadAsync();
      voiceRecordingRef.current = null;
    };
  }, []);

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
    if (!token || !peerUserId) return;
    joinDirectThread(peerUserId);
    return () => leaveDirectThread(peerUserId);
  }, [token, peerUserId]);

  useEffect(() => {
    return onSocketConnectionChange(setSocketConnected);
  }, []);

  useEffect(() => {
    return onDirectMessage((payload) => {
      if (payload.peerUserId !== peerUserId) return;
      setMessages((prev) => {
        if (prev.some((item) => item.id === payload.message.id)) return prev;
        return [...prev, payload.message];
      });
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    });
  }, [peerUserId]);

  useEffect(() => {
    if (socketConnected) return;
    const timer = setInterval(() => {
      void reload();
    }, 15000);
    return () => clearInterval(timer);
  }, [reload, socketConnected]);

  const appendSentMessage = useCallback((message: DirectMessageItem) => {
    setMessages((prev) => {
      if (prev.some((item) => item.id === message.id)) return prev;
      return [...prev, message];
    });
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const isComposerSingleLine = !draft.includes("\n") && composerInputHeight <= COMPOSER_INPUT_MIN_HEIGHT + 2;

  const handleDraftChange = useCallback((text: string) => {
    setDraft(text);
    if (!text.trim()) {
      setComposerInputHeight(COMPOSER_INPUT_MIN_HEIGHT);
      return;
    }
    if (!text.includes("\n") && text.length > 42 && composerInputHeight <= COMPOSER_INPUT_MIN_HEIGHT) {
      setComposerInputHeight(COMPOSER_INPUT_MIN_HEIGHT + COMPOSER_LINE_HEIGHT);
    }
  }, [composerInputHeight]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !token || attachBusy) return;
    setDraft("");
    setComposerInputHeight(COMPOSER_INPUT_MIN_HEIGHT);
    const reply = replyTarget;
    setReplyTarget(null);
    const body = reply
      ? buildDmReplyMessage({
          replyToId: reply.messageId,
          replyPreview: reply.preview,
          replyAuthor: reply.authorName,
          text
        })
      : text;
    await sendDirectMessage(token, peerUserId, body);
    await reload();
    const result = await sendDirectMessage(token, peerUserId, text);
    if (result.message) appendSentMessage(result.message);
  };

  const startReplyToMessage = useCallback(
    (item: DirectMessageItem) => {
      const isSelf = item.senderId === user?.id;
      setReplyTarget({
        messageId: item.id,
        preview: formatDmInboxPreview(item.body, t) || "Message",
        authorName: isSelf ? "You" : peerName,
        replyLabel: isSelf ? "yourself" : peerName
      });
    },
    [peerName, t, user?.id]
  );

  const openMessageActions = useCallback((item: DirectMessageItem) => {
    if (parseDmCallMessage(item.body) || parseDmReactMessage(item.body)) return;
    setActionMessage(item);
  }, []);

  const copyMessage = useCallback(
    async (item: DirectMessageItem) => {
      const text = dmMessageCopyText(item.body, t);
      if (!text.trim()) {
        Alert.alert("Copy", "This message cannot be copied as text.");
        return;
      }
      await Clipboard.setStringAsync(text);
    },
    [t]
  );

  const reactToMessage = useCallback(
    async (item: DirectMessageItem, emoji: string) => {
      if (!token) return;
      await sendDirectMessage(token, peerUserId, buildDmReactMessage({ targetId: item.id, emoji }));
      await reload();
    },
    [peerUserId, reload, token]
  );

  const canInteractWithMessage = useCallback((body: string) => {
    return !parseDmCallMessage(body) && !parseDmReactMessage(body);
  }, []);

  const sendPickedAsset = useCallback(
    async (asset: ImagePicker.ImagePickerAsset) => {
      if (!token || attachBusy) return;
      setAttachBusy(true);
      try {
        const { url } = await uploadPickedMedia(asset.uri, asset);
        const isVideo = asset.type === "video" || /\.(mp4|mov|webm|m4v)$/i.test(asset.uri.split("?")[0]);
        const result = await sendDirectMessage(
          token,
          peerUserId,
          buildDmMediaMessage({
            kind: isVideo ? "video" : "image",
            url,
            width: asset.width,
            height: asset.height
          })
        );
        if (result.message) appendSentMessage(result.message);
        else if (!socketConnected) await reload();
      } catch (error) {
        Alert.alert(t("sendFailed"), error instanceof Error ? error.message : t("sendFailedReel"));
      } finally {
        setAttachBusy(false);
      }
    },
    [attachBusy, appendSentMessage, peerUserId, reload, socketConnected, t, token]
  );

  const openGallery = useCallback(async () => {
    if (!token || attachBusy || isRecordingVoice) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t("permissionNeeded"), t("galleryPermissionMsg"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.85,
      allowsMultipleSelection: false
    });
    if (result.canceled || !result.assets[0]) return;
    await sendPickedAsset(result.assets[0]);
  }, [attachBusy, isRecordingVoice, sendPickedAsset, t, token]);

  const openCamera = useCallback(async () => {
    if (!token || attachBusy || isRecordingVoice) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t("permissionNeeded"), t("cameraPermissionMsg"));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.85
    });
    if (result.canceled || !result.assets[0]) return;
    await sendPickedAsset(result.assets[0]);
  }, [attachBusy, isRecordingVoice, sendPickedAsset, t, token]);

  const startVoiceRecording = useCallback(async () => {
    if (!token || attachBusy || isRecordingVoice || Platform.OS === "web") {
      if (Platform.OS === "web") {
        Alert.alert(t("unavailable"), t("voiceNoteWebUnavailable"));
      }
      return;
    }
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t("permissionNeeded"), t("micPermissionMsg"));
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        shouldDuckAndroid: true,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        playThroughEarpieceAndroid: false
      });
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      voiceRecordingRef.current = recording;
      voiceStartedAtRef.current = Date.now();
      setVoiceRecordingMs(0);
      setIsRecordingVoice(true);
      if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = setInterval(() => {
        setVoiceRecordingMs(Date.now() - voiceStartedAtRef.current);
      }, 200);
    } catch {
      Alert.alert(t("sendFailed"), t("voiceRecordFailed"));
    }
  }, [attachBusy, isRecordingVoice, t, token]);

  const stopVoiceRecordingAndSend = useCallback(async () => {
    const recording = voiceRecordingRef.current;
    if (!recording || !token) return;
    if (voiceTimerRef.current) {
      clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
    setIsRecordingVoice(false);
    voiceRecordingRef.current = null;
    setAttachBusy(true);
    try {
      const statusBefore = await recording.getStatusAsync();
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      const durationMs = statusBefore.isRecording
        ? statusBefore.durationMillis
        : Math.max(0, Date.now() - voiceStartedAtRef.current);
      if (!uri || durationMs < 400) return;
      const { url } = await uploadAudioFile(uri);
      const result = await sendDirectMessage(token, peerUserId, buildDmVoiceMessage({ url, durationMs }));
      if (result.message) appendSentMessage(result.message);
      else if (!socketConnected) await reload();
    } catch (error) {
      Alert.alert(t("sendFailed"), error instanceof Error ? error.message : t("voiceRecordFailed"));
    } finally {
      setAttachBusy(false);
      setVoiceRecordingMs(0);
      void Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
        shouldDuckAndroid: true,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
        playThroughEarpieceAndroid: false
      });
    }
  }, [appendSentMessage, peerUserId, reload, socketConnected, t, token]);

  const cancelVoiceRecording = useCallback(async () => {
    const recording = voiceRecordingRef.current;
    if (!recording) return;
    if (voiceTimerRef.current) {
      clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
    setIsRecordingVoice(false);
    voiceRecordingRef.current = null;
    setVoiceRecordingMs(0);
    try {
      await recording.stopAndUnloadAsync();
    } catch {
      // no-op
    }
  }, []);

  useEffect(() => {
    if (!incomingCall?.roomName) return;
    callHistorySentRef.current = false;
    setCallSession({
      roomName: incomingCall.roomName,
      mode: incomingCall.mode,
      connectEnabled: false,
      direction: "incoming",
      statusLabel: incomingCall.mode === "video" ? "Incoming video call" : "Incoming voice call"
    });
  }, [incomingCall?.mode, incomingCall?.roomName]);

  const startCall = async (mode: DirectCallMode) => {
    if (!token || Platform.OS === "web") {
      Alert.alert("Unavailable", "Voice and video calls are available in the mobile app.");
      return;
    }
    try {
      callHistorySentRef.current = false;
      const result = await ringDirectCall(token, { peerUserId, mode });
      setCallSession({
        roomName: result.roomName,
        mode: result.mode,
        connectEnabled: true,
        direction: "outgoing",
        statusLabel: mode === "video" ? "Calling..." : "Calling..."
      });
    } catch (error) {
      Alert.alert("Call failed", error instanceof Error ? error.message : "Could not start call.");
    }
  };

  const joinSharedLive = useCallback(
    async (payload: LiveSharePayload) => {
      let live = payload;
      if (token) {
        try {
          const feed = await fetchHomePosts(token);
          live = await hydrateLiveShareFromFeed(payload, feed.posts);
        } catch {
          // Use payload as-is.
        }
      }
      if (!isJoinableLiveShare(live)) {
        Alert.alert("Live ended", "This live stream has already ended.");
        return;
      }
      queueJoinLive(live.postId);
      navigation.navigate("Main", { screen: "Home" });
    },
    [navigation, token]
  );

  const openVoiceCall = () => {
    void startCall("voice");
  };

  const openVideoCall = () => {
    void startCall("video");
  };

  const closeCall = () => {
    setCallSession(null);
    navigation.setParams({ incomingCall: undefined });
  };

  const handleCallEnded = useCallback(
    async (callResult: CallEndResult) => {
      if (callHistorySentRef.current) {
        closeCall();
        return;
      }
      const session = callSession;
      closeCall();
      if (!token || !session) return;
      callHistorySentRef.current = true;
      try {
        const sent = await sendDirectMessage(
          token,
          peerUserId,
          buildDmCallMessage({
            mode: session.mode,
            status: callResult.status,
            durationSec: callResult.durationSec,
            direction: session.direction
          })
        );
        if (sent.message) appendSentMessage(sent.message);
        else if (!socketConnected) await reload();
      } catch {
        // keep chat usable even if history message fails
      }
    },
    [appendSentMessage, callSession, peerUserId, reload, socketConnected, token]
  );

  const openMoreAttachments = () => {
    Alert.alert("Attachments", undefined, [
      { text: "Camera", onPress: () => void openCamera() },
      { text: "Gallery", onPress: () => void openGallery() },
      { text: "Cancel", style: "cancel" }
    ]);
  };

  const bottomPad = Platform.OS === "ios" ? Math.max(insets.bottom, 8) : 8;

  const openSharedCropvibeCard = useCallback(
    async (body: string) => {
      let post = parseSharedCropvibeContent(body);
      if (!post) return;
      post = mergeHydratedPost(post);
      post = await hydrateSharedPostFromFeed(post, token ?? null);
      if (!hasRenderableMedia(post)) {
        Alert.alert("Can't open this share", "This post isn't available. Try again after refreshing your feed.");
        return;
      }
      setSharedReelViewer({ posts: [post], initialIndex: 0 });
    },
    [mergeHydratedPost, token]
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <Pressable hitSlop={12} style={styles.headerBack} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={TEXT} />
        </Pressable>
        <UserAvatar
          uri={peerAvatar}
          name={peerName}
          size={40}
          borderRadius={20}
          style={styles.headerAvatar}
          fallbackBackgroundColor="#3a3f46"
          initialsColor={TEXT}
        />
        <View style={styles.headerMeta}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {peerName}
          </Text>
          {peerHandle ? (
            <Text style={styles.headerHandle} numberOfLines={1}>
              {peerHandle}
            </Text>
          ) : null}
        </View>
        <View style={styles.headerRight}>
          <Pressable hitSlop={8} onPress={openVoiceCall} style={styles.headerAction}>
            <ChatAssetIcon icon="voiceCall" size={HEADER_CALL_ICON} />
          </Pressable>
          <Pressable hitSlop={8} onPress={openVideoCall} style={styles.headerAction}>
            <ChatAssetIcon icon="videoCall" size={HEADER_CALL_ICON} />
          </Pressable>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={threadItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          if (item.type === "date") {
            return (
              <View style={styles.dateSeparatorWrap}>
                <Text style={styles.dateSeparatorText}>{item.label}</Text>
              </View>
            );
          }

          const messageItem = item.message;
          const messageReactions = item.reactions;
          const isSelf = Number(messageItem.senderId) === Number(user?.id);
          const interactable = canInteractWithMessage(messageItem.body);
          const parsedPost = parseSharedCropvibeContent(messageItem.body);
          const sharedPost = parsedPost ? mergeHydratedPost(parsedPost) : null;
          const sharedProfile = parseSharedProfileContent(messageItem.body);
          const sharedLive = parseLiveShareContent(messageItem.body);
          const sharedMedia = parseDmMediaMessage(messageItem.body);
          const sharedVoice = parseDmVoiceMessage(messageItem.body);
          const sharedCall = parseDmCallMessage(messageItem.body);
          const sharedReply = parseDmReplyMessage(messageItem.body);
          const isRichCard = !!(sharedPost || sharedProfile || sharedLive || sharedMedia || sharedVoice || sharedCall);
          return (
            <SwipeReplyMessageRow
              rowStyle={[styles.bubbleRow, isSelf ? styles.bubbleRowSelf : styles.bubbleRowPeer]}
              contentStyle={[
                styles.bubbleWrap,
                isSelf ? styles.bubbleWrapSelf : styles.bubbleWrapPeer
              ]}
              enabled={interactable}
              onReply={() => startReplyToMessage(messageItem)}
              onLongPress={() => openMessageActions(messageItem)}
            >
              {sharedReply ? (
                <Text style={[styles.repliedToLabel, isSelf ? styles.repliedToLabelSelf : styles.repliedToLabelPeer]}>
                  {isSelf
                    ? "You replied"
                    : `${sharedReply.replyAuthor === "You" ? peerName : sharedReply.replyAuthor} replied`}
                </Text>
              ) : null}
              <View
                style={[
                  isRichCard ? styles.reelBubbleWrap : [styles.bubble, isSelf ? styles.bubbleSelf : styles.bubblePeer],
                  isRichCard ? (isSelf ? styles.reelBubbleWrapSelf : styles.reelBubbleWrapPeer) : null
                ]}
              >
                {sharedLive ? (
                  <Pressable
                    style={styles.sharedReelCard}
                    onPress={() => void joinSharedLive(sharedLive)}
                    disabled={!isJoinableLiveShare(sharedLive)}
                  >
                    <View style={styles.sharedLiveMediaWrap}>
                      {sharedLive.thumbnailUrl || sharedLive.authorAvatarUrl ? (
                        <Image
                          source={{ uri: (sharedLive.thumbnailUrl || sharedLive.authorAvatarUrl)! }}
                          style={styles.sharedLiveMedia}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.sharedLiveMedia, styles.sharedReelThumbPlaceholder]}>
                          <Ionicons name="radio-outline" size={28} color="rgba(255,255,255,0.45)" />
                        </View>
                      )}
                      <LinearGradient
                        colors={["transparent", "rgba(0,0,0,0.82)"]}
                        style={styles.sharedLiveGradient}
                        pointerEvents="none"
                      />
                      <View style={styles.sharedLiveBadge}>
                        <Text style={styles.sharedLiveBadgeText}>LIVE</Text>
                      </View>
                      <View style={styles.sharedLiveMeta}>
                        <Text style={styles.sharedReelAuthor} numberOfLines={1}>
                          {sharedLive.userName}
                        </Text>
                        <Text style={styles.sharedReelCaption} numberOfLines={1}>
                          {isJoinableLiveShare(sharedLive) ? sharedLive.title || "Tap to join live" : "Live ended"}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                ) : sharedPost ? (
                  <SharedReelChatCard
                    post={sharedPost}
                    language={language}
                    t={t}
                    onPress={() => void openSharedCropvibeCard(messageItem.body)}
                  />
                ) : sharedMedia ? (
                  <ChatMediaBubble media={sharedMedia} isSelf={isSelf} />
                ) : sharedVoice ? (
                  <ChatVoiceNoteBubble voice={sharedVoice} isSelf={isSelf} />
                ) : sharedCall ? (
                  <CallHistoryBubble call={sharedCall} isSelf={isSelf} t={t} />
                ) : sharedReply ? (
                  <>
                    <View style={[styles.replyQuote, isSelf ? styles.replyQuoteSelf : styles.replyQuotePeer]}>
                      <Text
                        style={[styles.replyQuoteText, isSelf ? styles.bubbleTextSelf : styles.bubbleTextPeer]}
                        numberOfLines={2}
                      >
                        {sharedReply.replyPreview}
                      </Text>
                    </View>
                    <Text style={[styles.bubbleText, isSelf ? styles.bubbleTextSelf : styles.bubbleTextPeer]}>
                      {sharedReply.text}
                    </Text>
                  </>
                ) : sharedProfile ? (
                  <Pressable
                    style={styles.sharedProfileCard}
                    onPress={() => {
                      if (!sharedProfile.userId) return;
                      navigation.navigate("PublicProfile", {
                        userId: sharedProfile.userId,
                        userName: sharedProfile.userName,
                        avatarUrl: sharedProfile.avatarUrl || undefined
                      });
                    }}
                  >
                    <UserAvatar
                      uri={sharedProfile.avatarUrl}
                      name={sharedProfile.userName}
                      size={44}
                      borderRadius={22}
                      fallbackBackgroundColor="#262626"
                      initialsColor={YELLOW}
                    />
                    <View style={styles.sharedProfileMeta}>
                      <Text style={styles.sharedProfileName} numberOfLines={1}>{sharedProfile.userName}</Text>
                      {sharedProfile.handle ? <Text style={styles.sharedProfileHandle} numberOfLines={1}>{sharedProfile.handle}</Text> : null}
                      {sharedProfile.bio ? <Text style={styles.sharedProfileBio} numberOfLines={1}>{sharedProfile.bio}</Text> : null}
                    </View>
                  </Pressable>
                ) : (
                  <Text style={[styles.bubbleText, isSelf ? styles.bubbleTextSelf : styles.bubbleTextPeer]}>{messageItem.body}</Text>
                )}
                <Text style={[styles.bubbleMeta, isSelf ? styles.bubbleMetaSelf : styles.bubbleMetaPeer, isRichCard ? styles.reelMeta : null]}>
                  {formatMsgTime(new Date(messageItem.createdAt).getTime())}
                </Text>
              </View>
              {messageReactions.length ? (
                <View style={[styles.reactionRow, isSelf ? styles.reactionRowSelf : styles.reactionRowPeer]}>
                  {messageReactions.map((emoji, index) => (
                    <Text key={`${emoji}-${index}`} style={styles.reactionEmoji}>
                      {emoji}
                    </Text>
                  ))}
                </View>
              ) : null}
            </SwipeReplyMessageRow>
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

      <View style={[styles.composerWrap, { paddingBottom: bottomPad }]}>
        {replyTarget ? (
          <View style={styles.replyComposerBanner}>
            <View style={styles.replyComposerMeta}>
              <Text style={styles.replyComposerLabel}>Replying to {replyTarget.replyLabel}</Text>
              <Text style={styles.replyComposerQuote} numberOfLines={2}>
                {replyTarget.preview}
              </Text>
            </View>
            <Pressable hitSlop={8} onPress={() => setReplyTarget(null)}>
              <Ionicons name="close" size={20} color={MUTED} />
            </Pressable>
          </View>
        ) : null}
        <View style={styles.composerBar}>
          <Pressable
            style={styles.cameraBtn}
            onPress={() => void openCamera()}
            disabled={attachBusy || isRecordingVoice}
          >
            <ChatAssetIcon icon="camera" size={CAMERA_ICON_SIZE} />
          </Pressable>

          {isRecordingVoice ? (
            <View style={styles.recordingRow}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>{t("recordingVoice")}</Text>
              <Text style={styles.recordingTimer}>{formatVoiceDuration(voiceRecordingMs)}</Text>
              <Pressable hitSlop={10} onPress={() => void cancelVoiceRecording()} style={styles.recordingActionBtn}>
                <Ionicons name="trash-outline" size={20} color={MUTED} />
              </Pressable>
              <Pressable
                hitSlop={10}
                onPress={() => void stopVoiceRecordingAndSend()}
                style={[styles.recordingActionBtn, styles.recordingSendBtn]}
              >
                <Ionicons name="send" size={20} color={YELLOW} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.inputArea}>
              <TextInput
                value={draft}
                onChangeText={handleDraftChange}
                placeholder="Message"
                placeholderTextColor={MUTED}
                style={[
                  styles.input,
                  {
                    height: composerInputHeight,
                    lineHeight: COMPOSER_LINE_HEIGHT,
                    paddingTop: isComposerSingleLine ? 0 : 6,
                    paddingBottom: isComposerSingleLine ? 0 : 6,
                    textAlignVertical: isComposerSingleLine ? "center" : "top"
                  }
                ]}
                multiline={!isComposerSingleLine}
                scrollEnabled={!isComposerSingleLine && composerInputHeight >= COMPOSER_INPUT_MAX_HEIGHT}
                onContentSizeChange={
                  isComposerSingleLine
                    ? undefined
                    : (event) => {
                        const next = Math.min(
                          COMPOSER_INPUT_MAX_HEIGHT,
                          Math.max(COMPOSER_INPUT_MIN_HEIGHT, Math.ceil(event.nativeEvent.contentSize.height))
                        );
                        setComposerInputHeight(next);
                      }
                }
                maxLength={2000}
                onSubmitEditing={send}
                editable={!attachBusy}
              />
              {draft.trim() ? (
                <Pressable style={styles.inputTrailingBtn} onPress={send} disabled={attachBusy}>
                  <Ionicons name="send" size={20} color={YELLOW} />
                </Pressable>
              ) : (
                <View style={styles.inputTrailing}>
                  <Pressable
                    style={styles.inputTrailingBtn}
                    disabled={attachBusy}
                    onPress={() => void startVoiceRecording()}
                  >
                    <ChatAssetIcon icon="mic" size={COMPOSER_ICON} />
                  </Pressable>
                  <Pressable style={styles.inputTrailingBtn} onPress={() => void openGallery()} disabled={attachBusy}>
                    <ChatAssetIcon icon="gallery" size={COMPOSER_ICON} />
                  </Pressable>
                  <Pressable style={styles.inputTrailingBtn} disabled={attachBusy}>
                    <ChatAssetIcon icon="sticker" size={COMPOSER_ICON} />
                  </Pressable>
                  <Pressable style={styles.inputTrailingBtn} onPress={openMoreAttachments} disabled={attachBusy}>
                    <ChatAssetIcon icon="plus" size={COMPOSER_ICON} />
                  </Pressable>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
      <ChatMessageActionSheet
        visible={actionMessage != null}
        timestampLabel={
          actionMessage ? formatActionSheetTimestamp(new Date(actionMessage.createdAt).getTime()) : undefined
        }
        onClose={() => setActionMessage(null)}
        onReply={() => {
          if (actionMessage) startReplyToMessage(actionMessage);
        }}
        onCopy={() => {
          if (actionMessage) void copyMessage(actionMessage);
        }}
        onForward={() => {
          if (actionMessage) setForwardBody(actionMessage.body);
        }}
        onReact={(emoji) => {
          if (actionMessage) void reactToMessage(actionMessage, emoji);
        }}
      />

      <ForwardMessageModal
        visible={forwardBody != null}
        messageBody={forwardBody || ""}
        excludeUserId={peerUserId}
        onClose={() => setForwardBody(null)}
        onSent={() => Alert.alert("Forwarded", "Message sent.")}
      />

      <DirectCallView
        visible={!!callSession}
        roomName={callSession?.roomName || ""}
        mode={callSession?.mode || "voice"}
        direction={callSession?.direction || "outgoing"}
        peerName={peerName}
        peerAvatarUrl={peerAvatar}
        connectEnabled={callSession?.connectEnabled ?? false}
        statusLabel={callSession?.statusLabel}
        onAccept={() => {
          if (!callSession) return;
          setCallSession({
            ...callSession,
            connectEnabled: true,
            statusLabel: callSession.mode === "video" ? "Connecting video..." : "Connecting..."
          });
        }}
        onCallEnded={(result) => {
          void handleCallEnded(result);
        }}
        onClose={closeCall}
      />

      <PostsReelViewerModal
        visible={sharedReelViewer != null}
        posts={sharedReelViewer?.posts ?? []}
        initialIndex={sharedReelViewer?.initialIndex ?? 0}
        onClose={() => setSharedReelViewer(null)}
        onPostsChange={(posts) => {
          setSharedReelViewer((prev) => (prev ? { ...prev, posts } : null));
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
    backgroundColor: BG,
    gap: 10
  },
  headerBack: { width: 28, alignItems: "flex-start" },
  headerMeta: { flex: 1, minWidth: 0, justifyContent: "center" },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#3a3f46",
    alignItems: "center",
    justifyContent: "center"
  },
  headerTitle: { fontSize: 16, fontWeight: "800", color: TEXT },
  headerHandle: { marginTop: 2, fontSize: 13, fontWeight: "500", color: MUTED },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerAction: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  dateSeparatorWrap: { alignItems: "center", marginVertical: 14 },
  dateSeparatorText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    color: MUTED,
    textTransform: "uppercase"
  },
  listContent: { paddingHorizontal: 12, paddingVertical: 16, flexGrow: 1 },
  bubbleRow: { marginBottom: 10, flexDirection: "row", width: "100%" },
  bubbleRowSelf: { justifyContent: "flex-end" },
  bubbleRowPeer: { justifyContent: "flex-start" },
  bubbleWrap: { maxWidth: "78%" },
  bubbleWrapSelf: { alignSelf: "flex-end" },
  bubbleWrapPeer: { alignSelf: "flex-start" },
  bubble: { borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleSelf: { backgroundColor: "#3a3f46" },
  bubblePeer: { backgroundColor: BUBBLE_PEER },
  reelBubbleWrap: { maxWidth: "84%" },
  reelBubbleWrapSelf: { alignItems: "flex-end" },
  reelBubbleWrapPeer: { alignItems: "flex-start" },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  bubbleTextSelf: { color: TEXT },
  bubbleTextPeer: { color: TEXT },
  bubbleMeta: { marginTop: 4, fontSize: 11, alignSelf: "flex-end" },
  bubbleMetaSelf: { color: MUTED },
  bubbleMetaPeer: { color: MUTED },
  reelMeta: { color: MUTED, marginTop: 3, marginRight: 4 },
  sharedReelCard: {
    width: 172,
    height: 306,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)"
  },
  sharedLiveMediaWrap: {
    flex: 1,
    position: "relative",
    backgroundColor: "#111"
  },
  sharedLiveMedia: {
    width: "100%",
    height: "100%"
  },
  sharedLiveGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "45%"
  },
  sharedLiveMeta: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 12
  },
  sharedProfileCard: {
    width: 230,
    minHeight: 88,
    borderRadius: 16,
    backgroundColor: "#262626",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  sharedProfileMeta: { flex: 1, minWidth: 0 },
  sharedProfileName: { color: "#fff", fontSize: 14, fontWeight: "900" },
  sharedProfileHandle: { marginTop: 2, color: APP_LIME, fontSize: 12, fontWeight: "700" },
  sharedProfileBio: { marginTop: 2, color: "rgba(255,255,255,0.8)", fontSize: 11 },
  sharedReelThumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#262626"
  },
  sharedLiveBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#e53935"
  },
  sharedLiveBadgeText: { color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 0.6 },
  sharedReelAuthor: { color: "#fff", fontSize: 13, fontWeight: "900" },
  sharedReelCaption: { marginTop: 3, color: "rgba(255,255,255,0.88)", fontSize: 12, fontWeight: "700", lineHeight: 16 },
  threadEmpty: { paddingVertical: 48, alignItems: "center" },
  threadEmptyText: { fontSize: 15, color: MUTED },
  threadEmptyBold: { fontWeight: "800", color: TEXT },
  composerWrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: BG
  },
  replyComposerBanner: {
    width: "100%",
    maxWidth: 398,
    alignSelf: "center",
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 4,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER
  },
  replyComposerMeta: { flex: 1, minWidth: 0 },
  replyComposerLabel: { color: MUTED, fontSize: 12, fontWeight: "600" },
  replyComposerQuote: { marginTop: 4, color: TEXT, fontSize: 15, fontWeight: "800", lineHeight: 20 },
  repliedToLabel: { fontSize: 11, fontWeight: "600", marginBottom: 4, color: MUTED },
  repliedToLabelSelf: { textAlign: "right" },
  repliedToLabelPeer: { textAlign: "left" },
  replyQuote: {
    borderLeftWidth: 2,
    paddingLeft: 8,
    marginBottom: 6,
    opacity: 0.9
  },
  replyQuoteSelf: { borderLeftColor: YELLOW },
  replyQuotePeer: { borderLeftColor: "rgba(255,255,255,0.45)" },
  replyQuoteText: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  reactionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: -2,
    marginBottom: 2
  },
  reactionRowSelf: { justifyContent: "flex-end" },
  reactionRowPeer: { justifyContent: "flex-start" },
  reactionEmoji: { fontSize: 15 },
  composerBar: {
    width: "100%",
    maxWidth: 398,
    alignSelf: "center",
    minHeight: COMPOSER_HEIGHT,
    borderRadius: COMPOSER_RADIUS,
    padding: COMPOSER_PADDING,
    backgroundColor: COMPOSER_BG,
    flexDirection: "row",
    alignItems: "center",
    gap: COMPOSER_GAP,
    overflow: "hidden"
  },
  inputArea: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  cameraBtn: {
    width: CAMERA_ICON_SIZE,
    height: CAMERA_ICON_SIZE,
    alignItems: "center",
    justifyContent: "center"
  },
  input: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    maxHeight: COMPOSER_INPUT_MAX_HEIGHT,
    paddingHorizontal: 0,
    paddingVertical: 0,
    includeFontPadding: false,
    fontSize: 15,
    color: TEXT
  },
  inputTrailing: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    gap: 6
  },
  inputTrailingBtn: {
    width: COMPOSER_ICON,
    height: COMPOSER_ICON,
    alignItems: "center",
    justifyContent: "center"
  },
  recordingRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: COMPOSER_GAP,
    minHeight: COMPOSER_HEIGHT - COMPOSER_PADDING * 2
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444"
  },
  recordingText: { flex: 1, color: TEXT, fontSize: 14, fontWeight: "700" },
  recordingTimer: { color: MUTED, fontSize: 13, fontWeight: "700", marginRight: 4 },
  recordingActionBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center"
  },
  recordingSendBtn: {
    marginLeft: 2
  },
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
    backgroundColor: "rgba(201,255,53,0.85)"
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
