import { Ionicons } from "@expo/vector-icons";
import { Audio, InterruptionModeAndroid, InterruptionModeIOS, ResizeMode, Video } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import { ensureMediaLibraryAccess } from "../../utils/mediaLibraryPermission";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type KeyboardEvent
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFloatingTopChromeInset, useTopChromeInset } from "../../theme/topChromeInset";
import { RouteProp, useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../auth/AuthContext";
import { CallHistoryBubble } from "../../components/CallHistoryBubble";
import { ChatMediaAlbumBubble } from "../../components/ChatMediaAlbumBubble";
import { ChatMediaBubble } from "../../components/ChatMediaBubble";
import { ChatVoiceNoteBubble } from "../../components/ChatVoiceNoteBubble";
import { PostsReelViewerModal } from "../../components/PostsReelViewerModal";
import { SharedReelChatCard } from "../../components/SharedReelChatCard";
import { StoryReplyThumb } from "../../components/StoryReplyThumb";
import { StoryViewerModal } from "../../components/StoryViewerModal";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import { UserAvatar } from "../../components/UserAvatar";
import { SvgAssetIcon } from "../../components/SvgAssetIcon";
import { fetchHomePost, fetchHomePosts, fetchHomeStoriesForUser, fetchMessageThread, fetchMyHomePosts, fetchProfileStats, ringDirectCall, cancelDirectCall, deleteDirectMessage, sendDirectMessage, uploadAudioFile, uploadPickedMedia, type DirectMessageItem, type HomePost, type HomeStory } from "../../services/api";
import { clearDmNotificationThread } from "../../push/dmNotificationThread";
import {
  joinDirectThread,
  leaveDirectThread,
  onDirectMessage,
  onDirectMessageDeleted,
  onSocketConnectionChange,
  isSocketChatConnected
} from "../../services/socketChat";
import { queueJoinLive } from "../../navigation/liveJoinBridge";
import { publishActiveStories } from "../../navigation/storyActivityBridge";
import { presentIncomingCallFromPush } from "../../push/GlobalIncomingCallHost";
import { dismissIncomingCallRinging } from "../../push/incomingCallSignal";
import {
  hydrateLiveShareFromFeed,
  isJoinableLiveShare,
  parseLiveShareContent,
  type LiveSharePayload
} from "./liveShareMessage";
import { APP_LIME } from "../../theme/appColors";
import { videoPlaybackUrl } from "../../utils/videoPlaybackUrl";
import { useLanguage } from "../../localization/LanguageContext";
import { DirectCallView, type CallDirection, type CallEndResult, type DirectCallMode } from "./DirectCallView";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ChatMessageActionSheet } from "./ChatMessageActionSheet";
import { ForwardMessageModal } from "./ForwardMessageModal";
import { SwipeReplyMessageRow } from "./SwipeReplyMessageRow";
import {
  buildDmCallMessage,
  buildDmMediaAlbumMessage,
  buildDmMediaMessage,
  buildDmReactMessage,
  buildDmReplyMessage,
  buildDmVoiceMessage,
  dmMessageCopyText,
  dmMediaIsAlbum,
  dmMediaItems,
  dmMediaPrimaryItem,
  dmReplyPreviewForMessage,
  formatDmInboxPreview,
  formatVoiceDuration,
  parseDmCallMessage,
  parseDmMediaMessage,
  parseDmReactMessage,
  parseDmReplyMessage,
  parseDmVoiceMessage,
  isPeerCallEndSignal,
  isCalleeRingCancelledSignal,
  type DmMediaItem
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

function dmReplyQuoteThumbUri(body: string, hydratedPost?: HomePost | null): string | undefined {
  const media = parseDmMediaMessage(body);
  if (media) return dmMediaPrimaryItem(media).url;
  if (hydratedPost) {
    return (
      hydratedPost.thumbnailUrl ||
      hydratedPost.imageUrl ||
      (hydratedPost.imageUrls && hydratedPost.imageUrls.length > 0 ? hydratedPost.imageUrls[0] : undefined)
    );
  }
  const post = parseSharedCropvibeContent(body);
  if (post) {
    return post.thumbnailUrl || post.imageUrl || (post.imageUrls && post.imageUrls[0]) || undefined;
  }
  return undefined;
}

function parseSharedCropvibeContent(body: string): HomePost | null {
  const prefixes = ["[Cropvibe Reel]", "[AgroVibe Reel]", "[Cropvibe Post]"];
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
  const link = lines.find((line) => /\/(reel|watch)\//i.test(line)) || "";
  const idMatch = link.match(/\/(?:reel|watch)\/(\d+)/i);
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

function parseStoryReplyContent(
  body: string
): {
  storyId: number;
  ownerId?: number;
  text: string;
  previewUrl?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  userName?: string;
  kind: "reply" | "like";
} | null {
  const prefix = "[Cropvibe Story]";
  if (!String(body || "").startsWith(prefix)) return null;
  const jsonText = String(body || "").slice(prefix.length).trim();
  if (!jsonText.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    const storyId = Number(parsed.storyId);
    const text = String(parsed.text || "").trim();
    if (!Number.isFinite(storyId) || storyId <= 0 || !text) return null;
    const ownerIdRaw = Number(parsed.ownerId);
    return {
      storyId,
      ownerId: Number.isFinite(ownerIdRaw) && ownerIdRaw > 0 ? ownerIdRaw : undefined,
      text,
      previewUrl: parsed.previewUrl ? String(parsed.previewUrl).trim() || null : null,
      imageUrl: parsed.imageUrl ? String(parsed.imageUrl).trim() || null : null,
      videoUrl: parsed.videoUrl ? String(parsed.videoUrl).trim() || null : null,
      userName: String(parsed.userName || "").trim() || undefined,
      kind: parsed.kind === "like" ? "like" : "reply"
    };
  } catch {
    return null;
  }
}

function sortStoriesForPlayback(rows: HomeStory[]) {
  return [...rows].sort((a, b) => {
    const ta = Date.parse(String(a.createdAt || "")) || 0;
    const tb = Date.parse(String(b.createdAt || "")) || 0;
    return ta - tb || a.id - b.id;
  });
}

const STORY_TTL_MS = 24 * 60 * 60 * 1000;

function isStoryFresh(story: Pick<HomeStory, "createdAt">) {
  if (!story.createdAt) return false;
  const created = Date.parse(String(story.createdAt));
  return Number.isFinite(created) && Date.now() - created <= STORY_TTL_MS;
}

function hasPlayableStoryMedia(story: HomeStory) {
  return !!(story.videoUrl || story.imageUrl);
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
  const topChromeInset = useTopChromeInset();
  const floatingTopInset = useFloatingTopChromeInset();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  /** Extra bottom space when Android does not resize the window for the keyboard. */
  const [androidKeyboardInset, setAndroidKeyboardInset] = useState(0);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "DirectChat">>();
  const { peerUserId, peerName, peerKey, peerUsername: peerUsernameParam, peerAvatarUrl, incomingCall, autoStartCall } =
    route.params;
  const { t, language } = useLanguage();
  const { token, user } = useAuth();
  const [messages, setMessages] = useState<DirectMessageItem[]>([]);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [peerUsername, setPeerUsername] = useState(peerUsernameParam || "");
  const peerHandle = formatPeerHandle(peerUsername, peerKey);
  const threadItems = useMemo(() => [...buildThreadListItems(messages)].reverse(), [messages]);
  const messagesById = useMemo(() => {
    const map = new Map<number, DirectMessageItem>();
    for (const message of messages) map.set(message.id, message);
    return map;
  }, [messages]);
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
    startedAt: number;
  } | null>(null);
  const callHistorySentRef = useRef(false);
  const callSessionRef = useRef(callSession);
  callSessionRef.current = callSession;

  const closeCall = useCallback(() => {
    setCallSession(null);
    navigation.setParams({ incomingCall: undefined });
  }, [navigation]);

  const endCallForPeerSignal = useCallback(() => {
    if (!callSessionRef.current || callSessionRef.current.direction !== "outgoing") return;
    callHistorySentRef.current = true;
    closeCall();
  }, [closeCall]);

  const peerEndsOutgoingCall = useCallback(
    (message: DirectMessageItem) => {
      const session = callSessionRef.current;
      if (!session || session.direction !== "outgoing") return false;
      if (Number(message.senderId) !== peerUserId) return false;
      if (!isPeerCallEndSignal(message.body)) return false;
      const msgTime = new Date(message.createdAt).getTime();
      if (Number.isFinite(msgTime) && msgTime < session.startedAt - 1000) return false;
      return true;
    },
    [peerUserId]
  );

  const [sharedReelViewer, setSharedReelViewer] = useState<{ posts: HomePost[]; initialIndex: number } | null>(null);
  const [chatStoryViewer, setChatStoryViewer] = useState<{ stories: HomeStory[]; initialIndex: number } | null>(null);
  const [chatMediaViewer, setChatMediaViewer] = useState<{ items: DmMediaItem[]; index: number } | null>(null);
  const [hydratedPostsById, setHydratedPostsById] = useState<Record<number, HomePost>>({});
  const [attachBusy, setAttachBusy] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceRecordingMs, setVoiceRecordingMs] = useState(0);
  const listRef = useRef<FlatList<ThreadListItem>>(null);
  const composerInputRef = useRef<TextInput>(null);
  const composerAnchorRef = useRef<View>(null);
  const androidKeyboardInsetRef = useRef(0);
  const threadItemCountRef = useRef(0);
  const voiceRecordingRef = useRef<Audio.Recording | null>(null);
  const voiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceStartedAtRef = useRef(0);
  const sendingRef = useRef(false);
  const [replyTarget, setReplyTarget] = useState<{
    messageId: number;
    preview: string;
    authorName: string;
    replyLabel: string;
  } | null>(null);
  const [actionMessage, setActionMessage] = useState<DirectMessageItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DirectMessageItem | null>(null);
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
      setHasMoreOlder(false);
      return;
    }
    const list = await fetchMessageThread(token, peerUserId, { limit: 40 });
    setMessages(list.messages || []);
    setHasMoreOlder(!!list.hasMore);
    const next = list.peer?.avatarUrl != null && String(list.peer.avatarUrl).trim() ? String(list.peer.avatarUrl).trim() : null;
    if (next) setPeerAvatar(next);
  }, [token, peerUserId]);

  const loadOlderMessages = useCallback(async () => {
    if (!token || loadingOlder || !hasMoreOlder || messages.length === 0) return;
    const oldestId = messages[0]?.id;
    if (!oldestId) return;
    setLoadingOlder(true);
    try {
      const list = await fetchMessageThread(token, peerUserId, { limit: 40, beforeId: oldestId });
      setHasMoreOlder(!!list.hasMore);
      setMessages((prev) => {
        const existing = new Set(prev.map((item) => item.id));
        const older = (list.messages || []).filter((item) => !existing.has(item.id));
        return older.length ? [...older, ...prev] : prev;
      });
    } finally {
      setLoadingOlder(false);
    }
  }, [hasMoreOlder, loadingOlder, messages, peerUserId, token]);

  useFocusEffect(
    useCallback(() => {
      void reload();
      if (!token || !peerUserId) return;
      joinDirectThread(peerUserId);
      // User opened the chat = previous messages are read; next push starts a fresh thread.
      void clearDmNotificationThread(peerUserId);
      return () => {
        Keyboard.dismiss();
        composerInputRef.current?.blur();
      };
    }, [peerUserId, reload, token])
  );

  useEffect(() => {
    if (!token || !peerUserId) return;
    joinDirectThread(peerUserId);
    return () => leaveDirectThread(peerUserId);
  }, [token, peerUserId]);

  useEffect(() => {
    return onSocketConnectionChange((connected) => {
      setSocketConnected(connected);
      if (connected && peerUserId) joinDirectThread(peerUserId);
    });
  }, [peerUserId]);

  useEffect(() => {
    return onDirectMessage((payload) => {
      if (payload.peerUserId !== peerUserId) return;
      if (peerEndsOutgoingCall(payload.message)) {
        endCallForPeerSignal();
      } else if (isCalleeRingCancelledSignal(payload.message.body)) {
        void dismissIncomingCallRinging({
          callerId: Number(payload.message.senderId)
        });
      }
      setMessages((prev) => {
        if (prev.some((item) => item.id === payload.message.id)) return prev;
        return [...prev, payload.message];
      });
    });
  }, [endCallForPeerSignal, peerEndsOutgoingCall, peerUserId]);

  useEffect(() => {
    if (!callSession || callSession.direction !== "outgoing") return;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (peerEndsOutgoingCall(messages[i])) {
        endCallForPeerSignal();
        break;
      }
    }
  }, [callSession, endCallForPeerSignal, messages, peerEndsOutgoingCall]);

  useEffect(() => {
    return onDirectMessageDeleted((payload) => {
      if (payload.peerUserId !== peerUserId) return;
      setMessages((prev) => prev.filter((item) => item.id !== payload.messageId));
    });
  }, [peerUserId]);

  useEffect(() => {
    if (socketConnected) return;
    const pollMs = callSession?.direction === "outgoing" ? 2000 : 5000;
    const timer = setInterval(() => {
      void reload();
    }, pollMs);
    return () => clearInterval(timer);
  }, [callSession?.direction, reload, socketConnected]);

  const appendSentMessage = useCallback((message: DirectMessageItem) => {
    setMessages((prev) => {
      if (prev.some((item) => item.id === message.id)) return prev;
      return [...prev, message];
    });
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
    if (!text || !token || attachBusy || sendingRef.current) return;
    sendingRef.current = true;
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
    try {
      const result = await sendDirectMessage(token, peerUserId, body);
      if (result.message) appendSentMessage(result.message);
      else await reload();
    } finally {
      sendingRef.current = false;
    }
  };

  const startReplyToMessage = useCallback(
    (item: DirectMessageItem) => {
      const isSelf = item.senderId === user?.id;
      setReplyTarget({
        messageId: item.id,
        preview: dmReplyPreviewForMessage(item.body, t) || "Message",
        authorName: isSelf ? "You" : peerName,
        replyLabel: isSelf ? "yourself" : peerName
      });
    },
    [peerName, t, user?.id]
  );

  const openChatMedia = useCallback((items: DmMediaItem[], index = 0) => {
    if (!items.length) return;
    setChatMediaViewer({ items, index: Math.max(0, Math.min(index, items.length - 1)) });
  }, []);

  const openPeerProfile = useCallback(() => {
    if (!peerUserId) return;
    navigation.navigate("PublicProfile", {
      userId: peerUserId,
      userName: peerName,
      avatarUrl: peerAvatar || undefined
    });
  }, [navigation, peerAvatar, peerName, peerUserId]);

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
      const result = await sendDirectMessage(token, peerUserId, buildDmReactMessage({ targetId: item.id, emoji }));
      if (result.message) appendSentMessage(result.message);
      else await reload();
    },
    [appendSentMessage, peerUserId, reload, token]
  );

  const isOwnMessage = useCallback(
    (item: DirectMessageItem | null | undefined) => {
      if (!item || user?.id == null) return false;
      return String(item.senderId) === String(user.id);
    },
    [user?.id]
  );

  const deleteMessage = useCallback(
    (item: DirectMessageItem) => {
      if (!token || !isOwnMessage(item)) return;
      setPendingDelete(item);
    },
    [isOwnMessage, token]
  );

  const confirmDeleteMessage = useCallback(() => {
    const item = pendingDelete;
    if (!item || !token) return;
    setPendingDelete(null);
    void (async () => {
      try {
        await deleteDirectMessage(token, item.id);
        setMessages((prev) => prev.filter((entry) => entry.id !== item.id));
      } catch (error) {
        Alert.alert(
          "Delete failed",
          error instanceof Error ? error.message : "Could not delete this message."
        );
      }
    })();
  }, [pendingDelete, token]);

  const canInteractWithMessage = useCallback((body: string) => {
    return !parseDmCallMessage(body) && !parseDmReactMessage(body);
  }, []);

  const sendPickedAssets = useCallback(
    async (assets: ImagePicker.ImagePickerAsset[]) => {
      if (!token || attachBusy || !assets.length) return;
      setAttachBusy(true);
      try {
        const uploaded: DmMediaItem[] = await Promise.all(
          assets.map(async (asset) => {
            const { url } = await uploadPickedMedia(asset.uri, asset);
            const isVideo = asset.type === "video" || /\.(mp4|mov|webm|m4v)$/i.test(asset.uri.split("?")[0]);
            return {
              kind: isVideo ? "video" : "image",
              url,
              width: asset.width,
              height: asset.height
            };
          })
        );
        const body =
          uploaded.length > 1 ? buildDmMediaAlbumMessage(uploaded) : buildDmMediaMessage(uploaded[0]);
        const result = await sendDirectMessage(token, peerUserId, body);
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

  const sendPickedAsset = useCallback(
    async (asset: ImagePicker.ImagePickerAsset) => {
      await sendPickedAssets([asset]);
    },
    [sendPickedAssets]
  );

  const openGallery = useCallback(async () => {
    if (!token || attachBusy || isRecordingVoice) return;
    const access = await ensureMediaLibraryAccess();
    if (!access.granted) {
      Alert.alert(t("permissionNeeded"), t("galleryPermissionMsg"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsMultipleSelection: true,
      selectionLimit: 10
    });
    if (result.canceled || !result.assets.length) return;
    await sendPickedAssets(result.assets);
  }, [attachBusy, isRecordingVoice, sendPickedAssets, t, token]);

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
    presentIncomingCallFromPush({
      callerId: incomingCall.callerId,
      callerName: peerName,
      callerAvatarUrl: peerAvatar,
      roomName: incomingCall.roomName,
      mode: incomingCall.mode,
      autoAccept: incomingCall.autoAccept
    });
    navigation.setParams({ incomingCall: undefined });
  }, [incomingCall, navigation, peerAvatar, peerName]);

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
        statusLabel: mode === "video" ? "Calling..." : "Calling...",
        startedAt: Date.now()
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

  useEffect(() => {
    if (!autoStartCall || !token || Platform.OS === "web") return;
    navigation.setParams({ autoStartCall: undefined });
    void startCall(autoStartCall);
  }, [autoStartCall, navigation, token]);

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

      if (session.direction === "outgoing" && callResult.status === "cancelled") {
        try {
          await cancelDirectCall(token, {
            peerUserId,
            roomName: session.roomName,
            mode: session.mode
          });
        } catch {
          // Still write chat history below.
        }
      }

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
    [appendSentMessage, callSession, closeCall, peerUserId, reload, socketConnected, token]
  );

  const openMoreAttachments = () => {
    Alert.alert("Attachments", undefined, [
      { text: "Camera", onPress: () => void openCamera() },
      { text: "Gallery", onPress: () => void openGallery() },
      { text: "Cancel", style: "cancel" }
    ]);
  };

  const openStoryFromChat = useCallback(
    async (storyReply: NonNullable<ReturnType<typeof parseStoryReplyContent>>, isSelf: boolean) => {
      const ownerId =
        Number(storyReply.ownerId) > 0
          ? Number(storyReply.ownerId)
          : isSelf
            ? Number(peerUserId)
            : Number(user?.id);
      const storyId = Number(storyReply.storyId);
      if (!Number.isFinite(ownerId) || ownerId <= 0 || !Number.isFinite(storyId) || storyId <= 0 || !token) {
        return;
      }

      // Only open when the story is still live on the server. Expired/deleted → no action.
      let stories: HomeStory[] = [];
      try {
        const data = await fetchHomeStoriesForUser(token, ownerId);
        stories = data.stories || [];
        if (stories.length) publishActiveStories(stories);
      } catch {
        // API error / offline — do not open from stale DM preview or cache.
        return;
      }

      const playable = sortStoriesForPlayback(
        stories.filter((s) => hasPlayableStoryMedia(s) && isStoryFresh(s))
      );
      const startIndex = playable.findIndex((s) => Number(s.id) === storyId);
      if (startIndex < 0) return;

      setChatStoryViewer({ stories: playable, initialIndex: startIndex });
    },
    [peerUserId, token, user?.id]
  );

  const bottomPad = Platform.OS === "ios" ? Math.max(insets.bottom, 8) : 8;

  useEffect(() => {
    androidKeyboardInsetRef.current = androidKeyboardInset;
  }, [androidKeyboardInset]);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const settleTimers: ReturnType<typeof setTimeout>[] = [];

    const applyKeyboardInset = (needed: number) => {
      const next = Math.max(0, Math.round(needed));
      if (Math.abs(next - androidKeyboardInsetRef.current) <= 1) return;
      androidKeyboardInsetRef.current = next;
      setAndroidKeyboardInset(next);
    };

    const syncComposerAboveKeyboard = (event: KeyboardEvent) => {
      const keyboardTopScreen = event.endCoordinates?.screenY;
      if (typeof keyboardTopScreen !== "number" || !Number.isFinite(keyboardTopScreen)) return;

      const statusBar = StatusBar.currentHeight ?? 0;
      const keyboardTopWindow = keyboardTopScreen - statusBar;

      const measure = () => {
        const node = composerAnchorRef.current;
        if (!node) return;

        node.measureInWindow((_x, y, _w, h) => {
          if (!Number.isFinite(y) || !Number.isFinite(h) || h <= 0) return;
          const composerBottom = y + h;
          const overlap = Math.max(0, Math.ceil(composerBottom - keyboardTopWindow));
          applyKeyboardInset(overlap > 0 ? overlap + 2 : 0);
        });
      };

      requestAnimationFrame(measure);
      for (const delay of [80, 200]) {
        settleTimers.push(setTimeout(measure, delay));
      }
    };

    const onHide = () => {
      for (const timer of settleTimers) clearTimeout(timer);
      settleTimers.length = 0;
      androidKeyboardInsetRef.current = 0;
      setAndroidKeyboardInset(0);
    };

    const showSub = Keyboard.addListener("keyboardDidShow", syncComposerAboveKeyboard);
    const frameSub = Keyboard.addListener("keyboardDidChangeFrame", syncComposerAboveKeyboard);
    const hideSub = Keyboard.addListener("keyboardDidHide", onHide);
    return () => {
      for (const timer of settleTimers) clearTimeout(timer);
      showSub.remove();
      frameSub.remove();
      hideSub.remove();
    };
  }, []);

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

  const openReplyTarget = useCallback(
    (replyToId: number) => {
      const original = messagesById.get(replyToId);
      if (original) {
        const media = parseDmMediaMessage(original.body);
        if (media) {
          openChatMedia(dmMediaItems(media), 0);
          return;
        }
        if (parseSharedCropvibeContent(original.body)) {
          void openSharedCropvibeCard(original.body);
          return;
        }
      }
      const idx = threadItems.findIndex(
        (item) => item.type === "message" && item.message.id === replyToId
      );
      if (idx >= 0) {
        listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
      }
    },
    [messagesById, openChatMedia, openSharedCropvibeCard, threadItems]
  );

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: topChromeInset }]}>
        <Pressable hitSlop={12} style={styles.headerBack} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={TEXT} />
        </Pressable>
        <Pressable style={styles.headerProfileTap} onPress={openPeerProfile}>
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
        </Pressable>
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
        style={styles.flex}
        data={threadItems}
        keyExtractor={(item) => item.id}
        inverted
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={styles.listContent}
        initialNumToRender={18}
        maxToRenderPerBatch={12}
        windowSize={9}
        removeClippedSubviews={Platform.OS === "android"}
        onEndReached={() => void loadOlderMessages()}
        onEndReachedThreshold={0.15}
        ListFooterComponent={
          loadingOlder ? (
            <View style={styles.olderLoader}>
              <ActivityIndicator color={APP_LIME} size="small" />
            </View>
          ) : null
        }
        onLayout={() => {
          threadItemCountRef.current = threadItems.length;
        }}
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
          const storyReply = parseStoryReplyContent(messageItem.body);
          const isRichCard = !!(sharedPost || sharedProfile || sharedLive || sharedMedia || sharedVoice || sharedCall);
          const repliedToMessage = sharedReply ? messagesById.get(sharedReply.replyToId) : undefined;
          const replyQuotePreview = repliedToMessage
            ? dmReplyPreviewForMessage(repliedToMessage.body, t)
            : sharedReply?.replyPreview;
          const replyQuoteParsedPost = repliedToMessage ? parseSharedCropvibeContent(repliedToMessage.body) : null;
          const replyQuoteThumb = repliedToMessage
            ? dmReplyQuoteThumbUri(
                repliedToMessage.body,
                replyQuoteParsedPost ? mergeHydratedPost(replyQuoteParsedPost) : null
              )
            : undefined;
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
                  {isSelf ? "You replied" : `${peerName} replied`}
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
                    onLongPress={() => openMessageActions(messageItem)}
                    delayLongPress={280}
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
                    onLongPress={() => openMessageActions(messageItem)}
                  />
                ) : sharedMedia ? (
                  dmMediaIsAlbum(sharedMedia) ? (
                    <ChatMediaAlbumBubble
                      items={sharedMedia.items}
                      onPress={(index) => openChatMedia(sharedMedia.items, index)}
                      onLongPress={() => openMessageActions(messageItem)}
                    />
                  ) : (
                    <ChatMediaBubble
                      media={sharedMedia}
                      isSelf={isSelf}
                      onPress={() => openChatMedia([sharedMedia], 0)}
                      onLongPress={() => openMessageActions(messageItem)}
                    />
                  )
                ) : sharedVoice ? (
                  <ChatVoiceNoteBubble voice={sharedVoice} isSelf={isSelf} />
                ) : sharedCall ? (
                  <CallHistoryBubble call={sharedCall} isSelf={isSelf} t={t} />
                ) : storyReply ? (
                  <>
                    <Pressable
                      style={[styles.replyQuote, isSelf ? styles.replyQuoteSelf : styles.replyQuotePeer]}
                      onPress={() => void openStoryFromChat(storyReply, isSelf)}
                      onLongPress={() => openMessageActions(messageItem)}
                      delayLongPress={280}
                    >
                      <StoryReplyThumb
                        imageUrl={storyReply.imageUrl}
                        videoUrl={storyReply.videoUrl}
                        previewUrl={storyReply.previewUrl}
                      />
                      <Text
                        style={[styles.replyQuoteText, isSelf ? styles.bubbleTextSelf : styles.bubbleTextPeer]}
                        numberOfLines={2}
                      >
                        {storyReply.kind === "like"
                          ? `Liked story${storyReply.userName ? ` · ${storyReply.userName}` : ""}`
                          : `Replied to story${storyReply.userName ? ` · ${storyReply.userName}` : ""}`}
                      </Text>
                    </Pressable>
                    {storyReply.kind === "like" ? (
                      <Text style={styles.storyLikeHeart}>❤️</Text>
                    ) : (
                      <Text style={[styles.bubbleText, isSelf ? styles.bubbleTextSelf : styles.bubbleTextPeer]}>
                        {storyReply.text}
                      </Text>
                    )}
                  </>
                ) : sharedReply ? (
                  <>
                    <Pressable
                      style={[styles.replyQuote, isSelf ? styles.replyQuoteSelf : styles.replyQuotePeer]}
                      onPress={() => openReplyTarget(sharedReply.replyToId)}
                    >
                      {replyQuoteThumb ? (
                        <Image source={{ uri: replyQuoteThumb }} style={styles.replyQuoteThumb} resizeMode="cover" />
                      ) : null}
                      <Text
                        style={[styles.replyQuoteText, isSelf ? styles.bubbleTextSelf : styles.bubbleTextPeer]}
                        numberOfLines={2}
                      >
                        {replyQuotePreview || sharedReply.replyPreview}
                      </Text>
                    </Pressable>
                    <Text style={[styles.bubbleText, isSelf ? styles.bubbleTextSelf : styles.bubbleTextPeer]}>
                      {sharedReply.text}
                    </Text>
                  </>
                ) : sharedProfile ? (
                  <Pressable
                    style={styles.sharedProfileCard}
                    onLongPress={() => openMessageActions(messageItem)}
                    delayLongPress={280}
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

      <KeyboardAvoidingView
        style={styles.composerKeyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        enabled={Platform.OS === "ios"}
        keyboardVerticalOffset={0}
      >
        <View
          ref={composerAnchorRef}
          collapsable={false}
          style={[
            styles.composerWrap,
            { paddingBottom: bottomPad },
            Platform.OS === "android" && androidKeyboardInset > 0
              ? { marginBottom: androidKeyboardInset }
              : null
          ]}
        >
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
                ref={composerInputRef}
                value={draft}
                onChangeText={handleDraftChange}
                placeholder="Message"
                placeholderTextColor={MUTED}
                showSoftInputOnFocus
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
      </KeyboardAvoidingView>
      <ConfirmDialog
        visible={pendingDelete != null}
        title="Delete message?"
        message="This removes the message for everyone in this chat."
        confirmLabel="DELETE"
        confirmDanger
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDeleteMessage}
      />
      <ChatMessageActionSheet
        visible={actionMessage != null}
        timestampLabel={
          actionMessage ? formatActionSheetTimestamp(new Date(actionMessage.createdAt).getTime()) : undefined
        }
        showDelete={isOwnMessage(actionMessage)}
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
        onDelete={() => {
          if (actionMessage) deleteMessage(actionMessage);
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

      <StoryViewerModal
        visible={chatStoryViewer != null}
        stories={chatStoryViewer?.stories ?? []}
        initialIndex={chatStoryViewer?.initialIndex ?? 0}
        onClose={() => setChatStoryViewer(null)}
      />

      <Modal
        visible={chatMediaViewer != null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setChatMediaViewer(null)}
      >
        <View style={styles.chatMediaViewerBackdrop}>
          <Pressable
            style={[StyleSheet.absoluteFillObject, styles.chatMediaViewerDismiss]}
            onPress={() => setChatMediaViewer(null)}
          />
          <Pressable
            style={[styles.chatMediaViewerClose, { top: floatingTopInset }]}
            onPress={() => setChatMediaViewer(null)}
            hitSlop={12}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
          <View style={styles.chatMediaViewerStage} pointerEvents="box-none">
            {chatMediaViewer && chatMediaViewer.items.length > 1 ? (
              <FlatList
                style={styles.chatMediaViewerList}
                data={chatMediaViewer.items}
                horizontal
                pagingEnabled
                initialScrollIndex={chatMediaViewer.index}
                getItemLayout={(_data, index) => ({
                  length: windowWidth,
                  offset: windowWidth * index,
                  index
                })}
                keyExtractor={(item, index) => `${item.url}-${index}`}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => (
                  <View style={[styles.chatMediaViewerPage, { width: windowWidth, height: windowHeight }]}>
                    {item.kind === "image" ? (
                      <Image
                        source={{ uri: item.url }}
                        style={styles.chatMediaViewerMedia}
                        resizeMode="contain"
                      />
                    ) : (
                      <Video
                        source={{ uri: videoPlaybackUrl(item.url) }}
                        style={styles.chatMediaViewerMedia}
                        resizeMode={ResizeMode.CONTAIN}
                        shouldPlay
                        useNativeControls
                      />
                    )}
                  </View>
                )}
                onScrollToIndexFailed={() => {
                  // no-op
                }}
              />
            ) : chatMediaViewer?.items[0]?.kind === "image" ? (
              <Image
                source={{ uri: chatMediaViewer.items[0].url }}
                style={[styles.chatMediaViewerMedia, { width: windowWidth, height: windowHeight }]}
                resizeMode="contain"
              />
            ) : chatMediaViewer?.items[0]?.kind === "video" ? (
              <Video
                source={{ uri: videoPlaybackUrl(chatMediaViewer.items[0].url) }}
                style={[styles.chatMediaViewerMedia, { width: windowWidth, height: windowHeight }]}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay
                useNativeControls
              />
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
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
  headerProfileTap: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
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
  olderLoader: { paddingVertical: 12, alignItems: "center" },
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
  composerKeyboardWrap: {
    width: "100%",
    backgroundColor: BG
  },
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
    opacity: 0.9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  replyQuoteSelf: { borderLeftColor: YELLOW },
  replyQuotePeer: { borderLeftColor: "rgba(255,255,255,0.45)" },
  replyQuoteThumb: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: "#1a1a1a"
  },
  replyQuoteText: { flex: 1, minWidth: 0, fontSize: 13, lineHeight: 18, fontWeight: "600" },
  storyReplyCard: { gap: 6, minWidth: 200 },
  storyReplyQuote: {
    borderLeftWidth: 2,
    paddingLeft: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    opacity: 0.9
  },
  storyReplyThumbFallback: { alignItems: "center", justifyContent: "center" },
  storyLikeHeart: { fontSize: 28, lineHeight: 34, marginTop: 2 },
  chatMediaViewerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.94)"
  },
  chatMediaViewerDismiss: {
    zIndex: 0
  },
  chatMediaViewerStage: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  chatMediaViewerList: {
    flex: 1,
    width: "100%"
  },
  chatMediaViewerPage: {
    alignItems: "center",
    justifyContent: "center"
  },
  chatMediaViewerClose: {
    position: "absolute",
    right: 16,
    zIndex: 2,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center"
  },
  chatMediaViewerMedia: {
    width: "100%",
    height: "100%"
  },
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
