import { Ionicons } from "@expo/vector-icons";
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";
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
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFloatingTopChromeInset, useTopChromeInset } from "../../theme/topChromeInset";
import { RouteProp, useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../auth/AuthContext";
import { useIsOnline } from "../../context/PresenceContext";
import { CallHistoryBubble } from "../../components/CallHistoryBubble";
import { ChatMediaAlbumBubble } from "../../components/ChatMediaAlbumBubble";
import { ChatMediaBubble } from "../../components/ChatMediaBubble";
import { AppVideo } from "../../components/AppVideo";
import { ChatVoiceNoteBubble } from "../../components/ChatVoiceNoteBubble";
import { PostsReelViewerModal } from "../../components/PostsReelViewerModal";
import { SharedReelChatCard } from "../../components/SharedReelChatCard";
import { StoryReplyThumb } from "../../components/StoryReplyThumb";
import { StoryViewerModal } from "../../components/StoryViewerModal";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import { useAndroidScreenBack } from "../../navigation/useAndroidScreenBack";
import { UserAvatar } from "../../components/UserAvatar";
import { PresenceAvatar } from "../../components/PresenceAvatar";
import { SvgAssetIcon } from "../../components/SvgAssetIcon";
import { fetchHomePost, fetchHomePosts, fetchHomeStoriesForUser, fetchMessageThread, fetchProfileStats, markDirectThreadRead, acceptMessageRequest, declineMessageRequest, ringDirectCall, cancelDirectCall, deleteDirectMessage, reportDirectCallSession, sendDirectMessage, uploadAudioFile, uploadPickedMedia, isPostUnavailableError, type DirectMessageItem, type HomePost, type HomeStory } from "../../services/api";
import { clearDmNotificationThread } from "../../push/dmNotificationThread";
import {
  joinDirectThread,
  leaveDirectThread,
  onDirectDelivered,
  onDirectMessage,
  onDirectMessageDeleted,
  onDirectRead,
  onSocketConnectionChange,
  isSocketChatConnected
} from "../../services/socketChat";
import { queueJoinLive } from "../../navigation/liveJoinBridge";
import { publishActiveStories } from "../../navigation/storyActivityBridge";
import { subscribePostDeleted } from "../../navigation/postDeletedBridge";
import { presentIncomingCallFromPush } from "../../push/GlobalIncomingCallHost";
import { setLocalCallSession } from "../../push/localCallSession";
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
import { AppEmojiPicker } from "../../components/AppEmojiPicker";
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
  isPhotoClipboardPlaceholder,
  dmMediaPrimaryItem,
  dmReplyPreviewForMessage,
  formatDmInboxPreview,
  formatVoiceDuration,
  parseDmCallMessage,
  parseDmMediaMessage,
  parseDmReactMessage,
  parseDmReplyMessage,
  parseDmVoiceMessage,
  parseStoryDmMessage,
  isStoryDmForwarded,
  storyDmChatLabel,
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

type MessageReaction = { id: number; emoji: string; senderId: number };

type ThreadListItem =
  | { type: "date"; id: string; label: string }
  | { type: "message"; id: string; message: DirectMessageItem; reactions: MessageReaction[] };

function ownReactionOn(reactions: MessageReaction[], userId: number | undefined) {
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid <= 0) return undefined;
  return reactions.find((reaction) => Number(reaction.senderId) === uid);
}

function buildThreadListItems(messages: DirectMessageItem[]): ThreadListItem[] {
  const reactionsByTarget = new Map<number, MessageReaction[]>();
  for (const message of messages) {
    const react = parseDmReactMessage(message.body);
    if (!react) continue;
    const list = reactionsByTarget.get(react.targetId) || [];
    list.push({ id: message.id, emoji: react.emoji, senderId: Number(message.senderId) });
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

/** WhatsApp-style ticks: 1 = not delivered, 2 grey = delivered, 2 lime = seen. */
function MessageDeliveryTicks({
  isDelivered,
  isRead
}: {
  isDelivered?: boolean;
  isRead?: boolean;
}) {
  if (isRead) {
    return (
      <View style={styles.tickWrap}>
        <Ionicons name="checkmark-done" size={15} color={APP_LIME} />
      </View>
    );
  }
  if (isDelivered) {
    return (
      <View style={styles.tickWrap}>
        <Ionicons name="checkmark-done" size={15} color={MUTED} />
      </View>
    );
  }
  return (
    <View style={styles.tickWrap}>
      <Ionicons name="checkmark" size={15} color={MUTED} />
    </View>
  );
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

async function hydrateSharedPostsById(
  postIds: number[],
  token: string
): Promise<{ posts: Record<number, HomePost>; unavailableIds: number[] }> {
  const posts: Record<number, HomePost> = {};
  const unavailableIds: number[] = [];
  await Promise.all(
    postIds.map(async (id) => {
      try {
        const { post } = await fetchHomePost(token, id);
        posts[id] = post;
      } catch (error) {
        if (isPostUnavailableError(error)) unavailableIds.push(id);
      }
    })
  );
  return { posts, unavailableIds };
}

export function DirectChatScreen() {
  const insets = useSafeAreaInsets();
  const topChromeInset = useTopChromeInset();
  const floatingTopInset = useFloatingTopChromeInset();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "DirectChat">>();
  useAndroidScreenBack(
    useCallback(() => {
      navigation.goBack();
      return true;
    }, [navigation])
  );
  const { peerUserId, peerName, peerKey, peerUsername: peerUsernameParam, peerAvatarUrl, incomingCall, autoStartCall, isMessageRequest: isMessageRequestParam } =
    route.params;
  const { t, language } = useLanguage();
  const { token, user } = useAuth();
  const peerOnline = useIsOnline(peerUserId);
  const [messages, setMessages] = useState<DirectMessageItem[]>([]);
  const [isMessageRequest, setIsMessageRequest] = useState(Boolean(isMessageRequestParam));
  const [requestActionBusy, setRequestActionBusy] = useState(false);
  /** Once user accepts/replies, never let a stale API reload bring the request banner back. */
  const messageRequestClearedRef = useRef(false);
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
  const [composerEmojiOpen, setComposerEmojiOpen] = useState(false);
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
    const session = callSessionRef.current;
    if (token && session?.roomName) {
      void reportDirectCallSession(token, {
        peerUserId,
        roomName: session.roomName,
        state: "ended"
      }).catch(() => undefined);
    }
    setLocalCallSession(null);
    setCallSession(null);
    navigation.setParams({ incomingCall: undefined });
  }, [navigation, peerUserId, token]);

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
  const [unavailablePostIds, setUnavailablePostIds] = useState<Record<number, true>>({});
  const [attachBusy, setAttachBusy] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceRecordingMs, setVoiceRecordingMs] = useState(0);
  const listRef = useRef<FlatList<ThreadListItem>>(null);
  const composerInputRef = useRef<TextInput>(null);
  const threadItemCountRef = useRef(0);
  const voiceRecordingRef = useRef<Audio.Recording | null>(null);
  const voiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceStartedAtRef = useRef(0);
  const sendingRef = useRef(false);
  const draftRef = useRef("");
  const pasteBusyRef = useRef(false);
  const sendClipboardImageRef = useRef<() => Promise<boolean>>(async () => false);
  draftRef.current = draft;
  const [replyTarget, setReplyTarget] = useState<{
    messageId: number;
    preview: string;
    authorName: string;
    replyLabel: string;
  } | null>(null);
  const [actionMessage, setActionMessage] = useState<DirectMessageItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    item: DirectMessageItem;
    mode: "me" | "everyone";
  } | null>(null);
  const [forwardBody, setForwardBody] = useState<string | null>(null);
  const [composerInputHeight, setComposerInputHeight] = useState(COMPOSER_INPUT_MIN_HEIGHT);
  const [socketConnected, setSocketConnected] = useState(isSocketChatConnected());
  /** Track IME open so we drop safe-area padding (Android adjustResize already sits on the keyboard). */
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvt, () => {
      setKeyboardOpen(true);
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardOpen(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

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
    void hydrateSharedPostsById(ids, token).then(({ posts, unavailableIds }) => {
      if (cancelled) return;
      if (Object.keys(posts).length) {
        setHydratedPostsById((prev) => ({ ...prev, ...posts }));
      }
      if (unavailableIds.length) {
        setUnavailablePostIds((prev) => {
          const next = { ...prev };
          for (const id of unavailableIds) next[id] = true;
          return next;
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [messages, token]);

  useEffect(() => {
    return subscribePostDeleted((postId) => {
      setUnavailablePostIds((prev) => ({ ...prev, [postId]: true }));
      setHydratedPostsById((prev) => {
        if (!prev[postId]) return prev;
        const next = { ...prev };
        delete next[postId];
        return next;
      });
      setSharedReelViewer((current) => {
        if (!current) return current;
        if (current.posts.some((post) => Number(post.id) === postId)) return null;
        return current;
      });
    });
  }, []);

  const mergeHydratedPost = useCallback(
    (post: HomePost) => {
      if (unavailablePostIds[post.id]) {
        return {
          ...post,
          videoUrl: null,
          imageUrl: null,
          imageUrls: undefined,
          thumbnailUrl: undefined,
          hlsUrl: null,
          playbackUrl: null
        };
      }
      const hydrated = hydratedPostsById[post.id];
      if (hydrated) return { ...hydrated };
      return {
        ...post,
        videoUrl: null,
        imageUrl: null,
        imageUrls: undefined,
        thumbnailUrl: undefined,
        hlsUrl: null,
        playbackUrl: null
      };
    },
    [hydratedPostsById, unavailablePostIds]
  );

  const sharedPostAccess = useCallback(
    (postId: number): "available" | "unavailable" | "pending" => {
      if (unavailablePostIds[postId]) return "unavailable";
      if (hydratedPostsById[postId]) return "available";
      return "pending";
    },
    [hydratedPostsById, unavailablePostIds]
  );

  useEffect(() => {
    return () => {
      if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
      void voiceRecordingRef.current?.stopAndUnloadAsync();
      voiceRecordingRef.current = null;
    };
  }, []);

  useEffect(() => {
    messageRequestClearedRef.current = false;
    setIsMessageRequest(Boolean(isMessageRequestParam));
  }, [peerUserId, isMessageRequestParam]);

  const clearMessageRequestUi = useCallback(() => {
    messageRequestClearedRef.current = true;
    setIsMessageRequest(false);
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
    if (typeof list.isMessageRequest === "boolean") {
      if (messageRequestClearedRef.current || list.isMessageRequest === false) {
        setIsMessageRequest(false);
        if (list.isMessageRequest === false) messageRequestClearedRef.current = true;
      } else {
        setIsMessageRequest(true);
      }
    }
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
        const existingIdx = prev.findIndex((item) => Number(item.id) === Number(payload.message.id));
        if (existingIdx >= 0) {
          const next = [...prev];
          const cur = next[existingIdx];
          next[existingIdx] = {
            ...cur,
            ...payload.message,
            isDelivered: Boolean(payload.message.isDelivered || cur.isDelivered),
            isRead: Boolean(payload.message.isRead || cur.isRead)
          };
          return next;
        }
        return [...prev, payload.message];
      });
      if (token && Number(payload.message.senderId) !== Number(user?.id)) {
        void markDirectThreadRead(token, peerUserId).catch(() => {});
      }
    });
  }, [endCallForPeerSignal, peerEndsOutgoingCall, peerUserId, token, user?.id]);

  useEffect(() => {
    return onDirectRead((payload) => {
      if (payload?.selfRead) return;
      if (Number(payload.peerUserId) !== Number(peerUserId) && Number(payload.readerId) !== Number(peerUserId)) {
        return;
      }
      setMessages((prev) =>
        prev.map((item) =>
          Number(item.senderId) === Number(user?.id)
            ? { ...item, isRead: true, isDelivered: true }
            : item
        )
      );
    });
  }, [peerUserId, user?.id]);

  useEffect(() => {
    return onDirectDelivered((payload) => {
      if (Number(payload.peerUserId) !== Number(peerUserId)) return;
      const ids = new Set((payload.messageIds || []).map((id) => Number(id)).filter((id) => Number.isFinite(id)));
      setMessages((prev) =>
        prev.map((item) => {
          if (Number(item.senderId) !== Number(user?.id)) return item;
          if (ids.size && !ids.has(Number(item.id))) return item;
          if (!ids.size) {
            // Receipt without ids → mark all my undelivered in this thread.
            return item.isDelivered ? item : { ...item, isDelivered: true };
          }
          return { ...item, isDelivered: true };
        })
      );
    });
  }, [peerUserId, user?.id]);

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
    const pollMs = callSession?.direction === "outgoing" ? 2000 : 12_000;
    const timer = setInterval(() => {
      void reload();
    }, pollMs);
    return () => clearInterval(timer);
  }, [callSession?.direction, reload, socketConnected]);

  const appendSentMessage = useCallback((message: DirectMessageItem) => {
    clearMessageRequestUi();
    setMessages((prev) => {
      if (prev.some((item) => Number(item.id) === Number(message.id))) {
        return prev.map((item) =>
          Number(item.id) === Number(message.id)
            ? {
                ...item,
                ...message,
                isDelivered: Boolean(message.isDelivered || item.isDelivered),
                isRead: Boolean(message.isRead || item.isRead)
              }
            : item
        );
      }
      return [
        ...prev,
        {
          ...message,
          isDelivered: Boolean(message.isDelivered),
          isRead: Boolean(message.isRead)
        }
      ];
    });
  }, [clearMessageRequestUi]);

  const isComposerSingleLine = !draft.includes("\n") && composerInputHeight <= COMPOSER_INPUT_MIN_HEIGHT + 2;

  const handleDraftChange = useCallback((text: string) => {
    const prev = draftRef.current;
    const inserted = text.length - prev.length;
    const looksLikePaste = inserted > 1 || (prev.trim() === "" && isPhotoClipboardPlaceholder(text, t("sharedMedia")));
    if (looksLikePaste && isPhotoClipboardPlaceholder(text, t("sharedMedia"))) {
      void (async () => {
        const sent = await sendClipboardImageRef.current();
        if (!sent) {
          draftRef.current = text;
          setDraft(text);
        }
      })();
      return;
    }
    if (looksLikePaste && parseDmMediaMessage(text)) {
      void (async () => {
        if (!token || attachBusy || sendingRef.current) {
          draftRef.current = text;
          setDraft(text);
          return;
        }
        sendingRef.current = true;
        setDraft("");
        setComposerInputHeight(COMPOSER_INPUT_MIN_HEIGHT);
        try {
          const result = await sendDirectMessage(token, peerUserId, text);
          if (result.message) appendSentMessage(result.message);
          else await reload();
        } catch {
          draftRef.current = text;
          setDraft(text);
        } finally {
          sendingRef.current = false;
        }
      })();
      return;
    }
    draftRef.current = text;
    setDraft(text);
    if (!text.trim()) {
      setComposerInputHeight(COMPOSER_INPUT_MIN_HEIGHT);
      return;
    }
    if (!text.includes("\n") && text.length > 42 && composerInputHeight <= COMPOSER_INPUT_MIN_HEIGHT) {
      setComposerInputHeight(COMPOSER_INPUT_MIN_HEIGHT + COMPOSER_LINE_HEIGHT);
    }
  }, [appendSentMessage, attachBusy, composerInputHeight, peerUserId, reload, t, token]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !token || attachBusy || sendingRef.current) return;
    if (isPhotoClipboardPlaceholder(text, t("sharedMedia"))) {
      const sent = await sendClipboardImageRef.current();
      if (sent) {
        setDraft("");
        setComposerInputHeight(COMPOSER_INPUT_MIN_HEIGHT);
        return;
      }
    }
    if (parseDmMediaMessage(text)) {
      sendingRef.current = true;
      setDraft("");
      setComposerInputHeight(COMPOSER_INPUT_MIN_HEIGHT);
      try {
        const result = await sendDirectMessage(token, peerUserId, text);
        if (result.message) appendSentMessage(result.message);
        else await reload();
      } finally {
        sendingRef.current = false;
      }
      return;
    }
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
      clearMessageRequestUi();
    } finally {
      sendingRef.current = false;
    }
  };

  const acceptIncomingRequest = useCallback(async () => {
    if (!token || requestActionBusy) return;
    setRequestActionBusy(true);
    // Hide banner immediately so a slow/stale reload can't flash it back.
    clearMessageRequestUi();
    try {
      const result = await acceptMessageRequest(token, peerUserId);
      if (result?.isMessageRequest === true) {
        messageRequestClearedRef.current = false;
        setIsMessageRequest(true);
        Alert.alert("Message request", "Could not accept this request.");
        return;
      }
      clearMessageRequestUi();
      // Refresh messages only; keep request UI cleared even if API is briefly stale.
      const list = await fetchMessageThread(token, peerUserId, { limit: 40 });
      setMessages(list.messages || []);
      setHasMoreOlder(!!list.hasMore);
    } catch {
      messageRequestClearedRef.current = false;
      setIsMessageRequest(true);
      Alert.alert("Message request", "Could not accept this request.");
    } finally {
      setRequestActionBusy(false);
    }
  }, [clearMessageRequestUi, peerUserId, requestActionBusy, token]);

  const declineIncomingRequest = useCallback(async () => {
    if (!token || requestActionBusy) return;
    setRequestActionBusy(true);
    try {
      await declineMessageRequest(token, peerUserId);
      navigation.goBack();
    } catch {
      Alert.alert("Message request", "Could not delete this request.");
      setRequestActionBusy(false);
    }
  }, [navigation, peerUserId, requestActionBusy, token]);

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
      const media = parseDmMediaMessage(item.body);
      const image = media ? dmMediaItems(media).find((entry) => entry.kind === "image") : undefined;
      if (image?.url) {
        try {
          const cacheDir = FileSystem.cacheDirectory;
          if (cacheDir) {
            const dest = `${cacheDir}cv-copy-${Date.now()}.jpg`;
            const downloaded = await FileSystem.downloadAsync(image.url, dest);
            const base64 = await FileSystem.readAsStringAsync(downloaded.uri, {
              encoding: "base64"
            });
            if (base64) {
              await Clipboard.setImageAsync(base64);
              return;
            }
          }
        } catch {
          // Fall back to the structured media payload so in-app paste still shows the image.
        }
        await Clipboard.setStringAsync(item.body);
        return;
      }
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
    async (item: DirectMessageItem, emoji: string, reactions: MessageReaction[] = []) => {
      if (!token) return;
      const mine = ownReactionOn(reactions, user?.id);
      try {
        if (mine && mine.emoji === emoji) {
          setMessages((prev) => prev.filter((row) => row.id !== mine.id));
          await deleteDirectMessage(token, mine.id, "everyone");
          return;
        }
        if (mine) {
          setMessages((prev) => prev.filter((row) => row.id !== mine.id));
          await deleteDirectMessage(token, mine.id, "everyone");
        }
        const result = await sendDirectMessage(
          token,
          peerUserId,
          buildDmReactMessage({ targetId: item.id, emoji })
        );
        if (result.message) appendSentMessage(result.message);
        else await reload();
      } catch {
        await reload();
        Alert.alert("Reaction", "Could not update reaction.");
      }
    },
    [appendSentMessage, peerUserId, reload, token, user?.id]
  );

  const isOwnMessage = useCallback(
    (item: DirectMessageItem | null | undefined) => {
      if (!item || user?.id == null) return false;
      return String(item.senderId) === String(user.id);
    },
    [user?.id]
  );

  const deleteMessage = useCallback(
    (item: DirectMessageItem, mode: "me" | "everyone") => {
      if (!token) return;
      if (mode === "everyone" && !isOwnMessage(item)) return;
      setPendingDelete({ item, mode });
    },
    [isOwnMessage, token]
  );

  const confirmDeleteMessage = useCallback(() => {
    const pending = pendingDelete;
    if (!pending || !token) return;
    setPendingDelete(null);
    void (async () => {
      try {
        await deleteDirectMessage(token, pending.item.id, pending.mode);
        setMessages((prev) => prev.filter((entry) => entry.id !== pending.item.id));
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

  const trySendClipboardImage = useCallback(async (): Promise<boolean> => {
    if (!token || attachBusy || pasteBusyRef.current) return false;
    try {
      const hasImage = await Clipboard.hasImageAsync();
      if (!hasImage) return false;
      const img = await Clipboard.getImageAsync({ format: "jpeg" });
      if (!img?.data) return false;
      const cacheDir = FileSystem.cacheDirectory;
      if (!cacheDir) return false;
      pasteBusyRef.current = true;
      const raw = img.data.includes(",") ? img.data.split(",")[1] : img.data;
      const dest = `${cacheDir}cv-paste-${Date.now()}.jpg`;
      await FileSystem.writeAsStringAsync(dest, raw, { encoding: "base64" });
      await sendPickedAssets([
        {
          uri: dest,
          width: img.size?.width ?? 0,
          height: img.size?.height ?? 0,
          type: "image",
          mimeType: "image/jpeg",
          fileName: "pasted-photo.jpg"
        } as ImagePicker.ImagePickerAsset
      ]);
      return true;
    } catch {
      return false;
    } finally {
      pasteBusyRef.current = false;
    }
  }, [attachBusy, sendPickedAssets, token]);
  sendClipboardImageRef.current = trySendClipboardImage;

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
      setLocalCallSession({ roomName: result.roomName, peerUserId });
      setCallSession({
        roomName: result.roomName,
        mode: result.mode,
        connectEnabled: true,
        direction: "outgoing",
        statusLabel: mode === "video" ? "Calling..." : "Calling...",
        startedAt: Date.now()
      });
    } catch (error) {
      const err = error as { status?: number; payload?: { code?: string }; message?: string };
      if (err.status === 409 && (err.payload?.code === "busy" || err.payload?.code === "busy_self")) {
        Alert.alert(
          "User busy",
          err.payload?.code === "busy_self"
            ? "End your current call before starting another."
            : "This person is on another call. Try again in a moment."
        );
        return;
      }
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
    async (storyReply: NonNullable<ReturnType<typeof parseStoryDmMessage>>, isSelf: boolean) => {
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

  // Nav/home-indicator only when the keyboard is closed. With Android resize, the
  // window already sits on the IME — extra padding leaves a gap above the keyboard.
  const bottomPad = keyboardOpen ? 0 : Math.min(Math.max(insets.bottom, 8), 34);

  const openSharedCropvibeCard = useCallback(
    async (body: string) => {
      const parsed = parseSharedCropvibeContent(body);
      if (!parsed) return;
      if (unavailablePostIds[parsed.id]) {
        Alert.alert(t("unavailable"), t("sharedPostGone"));
        return;
      }
      if (!token) {
        Alert.alert(t("unavailable"), t("sharedPostGone"));
        return;
      }
      try {
        const { post: found } = await fetchHomePost(token, parsed.id);
        if (!hasRenderableMedia(found)) {
          setUnavailablePostIds((prev) => ({ ...prev, [parsed.id]: true }));
          Alert.alert(t("unavailable"), t("sharedPostGone"));
          return;
        }
        setHydratedPostsById((prev) => ({ ...prev, [found.id]: found }));
        setSharedReelViewer({ posts: [found], initialIndex: 0 });
      } catch (error) {
        if (isPostUnavailableError(error)) {
          setUnavailablePostIds((prev) => ({ ...prev, [parsed.id]: true }));
          Alert.alert(t("unavailable"), t("sharedPostGone"));
          return;
        }
        Alert.alert(t("unavailable"), t("sharedPostGone"));
      }
    },
    [t, token, unavailablePostIds]
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
          <PresenceAvatar
            userId={peerUserId}
            uri={peerAvatar}
            name={peerName}
            size={40}
            borderRadius={20}
            style={styles.headerAvatar}
          />
          <View style={styles.headerMeta}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {peerName}
            </Text>
            {peerOnline ? (
              <Text style={styles.headerActive} numberOfLines={1}>
                Active now
              </Text>
            ) : peerHandle ? (
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
          const storyReply = parseStoryDmMessage(messageItem.body);
          const isRichCard = !!(
            sharedPost ||
            sharedProfile ||
            sharedLive ||
            sharedMedia ||
            sharedVoice ||
            sharedCall ||
            storyReply
          );
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
              {storyReply && isStoryDmForwarded(storyReply, messageItem) ? (
                <Text style={[styles.repliedToLabel, isSelf ? styles.repliedToLabelSelf : styles.repliedToLabelPeer]}>
                  ↪ Forwarded
                </Text>
              ) : sharedReply ? (
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
                    access={sharedPostAccess(sharedPost.id)}
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
                  <ChatVoiceNoteBubble
                    voice={sharedVoice}
                    isSelf={isSelf}
                    onLongPress={() => openMessageActions(messageItem)}
                  />
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
                        {storyDmChatLabel(storyReply, isStoryDmForwarded(storyReply, messageItem))}
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
                      onLongPress={() => openMessageActions(messageItem)}
                      delayLongPress={280}
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
                    <Pressable onLongPress={() => openMessageActions(messageItem)} delayLongPress={280}>
                      <Text style={[styles.bubbleText, isSelf ? styles.bubbleTextSelf : styles.bubbleTextPeer]}>
                        {sharedReply.text}
                      </Text>
                    </Pressable>
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
                    />
                    <View style={styles.sharedProfileMeta}>
                      <Text style={styles.sharedProfileName} numberOfLines={1}>{sharedProfile.userName}</Text>
                      {sharedProfile.handle ? <Text style={styles.sharedProfileHandle} numberOfLines={1}>{sharedProfile.handle}</Text> : null}
                      {sharedProfile.bio ? <Text style={styles.sharedProfileBio} numberOfLines={1}>{sharedProfile.bio}</Text> : null}
                    </View>
                  </Pressable>
                ) : (
                  <Pressable onLongPress={() => openMessageActions(messageItem)} delayLongPress={280}>
                    <Text style={[styles.bubbleText, isSelf ? styles.bubbleTextSelf : styles.bubbleTextPeer]}>
                      {formatDmInboxPreview(messageItem.body, t)}
                    </Text>
                  </Pressable>
                )}
                <View
                  style={[
                    styles.bubbleMetaRow,
                    isSelf ? styles.bubbleMetaRowSelf : styles.bubbleMetaRowPeer,
                    isRichCard ? styles.reelMeta : null
                  ]}
                >
                  <Text style={[styles.bubbleMeta, isSelf ? styles.bubbleMetaSelf : styles.bubbleMetaPeer]}>
                    {formatMsgTime(new Date(messageItem.createdAt).getTime())}
                  </Text>
                  {isSelf ? (
                    <MessageDeliveryTicks isDelivered={messageItem.isDelivered} isRead={messageItem.isRead} />
                  ) : null}
                </View>
              </View>
              {messageReactions.length ? (
                <View style={[styles.reactionRow, isSelf ? styles.reactionRowSelf : styles.reactionRowPeer]}>
                  {messageReactions.map((reaction) => {
                    const mine = Number(reaction.senderId) === Number(user?.id);
                    return (
                      <Pressable
                        key={reaction.id}
                        hitSlop={6}
                        onPress={() => void reactToMessage(messageItem, reaction.emoji, messageReactions)}
                        style={[styles.reactionChip, mine ? styles.reactionChipMine : null]}
                        accessibilityLabel={mine ? "Remove reaction" : "Add this reaction"}
                      >
                        <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                      </Pressable>
                    );
                  })}
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
        keyboardVerticalOffset={Platform.OS === "ios" ? topChromeInset : 0}
      >
        <View style={[styles.composerWrap, { paddingBottom: bottomPad }]}>
        {isMessageRequest ? (
          <View style={styles.requestBanner}>
            <Text style={styles.requestBannerText}>
              {peerName} isn&apos;t someone you follow. Accept to chat in your inbox, or delete this request.
            </Text>
            <View style={styles.requestBannerActions}>
              <Pressable
                style={[styles.requestBannerBtn, styles.requestBannerDelete]}
                disabled={requestActionBusy}
                onPress={() => void declineIncomingRequest()}
              >
                <Text style={styles.requestBannerDeleteText}>Delete</Text>
              </Pressable>
              <Pressable
                style={[styles.requestBannerBtn, styles.requestBannerAccept]}
                disabled={requestActionBusy}
                onPress={() => void acceptIncomingRequest()}
              >
                {requestActionBusy ? (
                  <ActivityIndicator size="small" color="#111" />
                ) : (
                  <Text style={styles.requestBannerAcceptText}>Accept</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : null}
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
                  <Pressable
                    style={styles.inputTrailingBtn}
                    disabled={attachBusy}
                    onPress={() => setComposerEmojiOpen(true)}
                  >
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
      <AppEmojiPicker
        open={composerEmojiOpen}
        allowMultiple
        onClose={() => setComposerEmojiOpen(false)}
        onSelect={(emoji) => setDraft((text) => `${text}${emoji}`)}
      />
      <ConfirmDialog
        visible={pendingDelete != null}
        title={pendingDelete?.mode === "everyone" ? "Delete for everyone?" : "Delete for me?"}
        message={
          pendingDelete?.mode === "everyone"
            ? "This removes the message for everyone in this chat."
            : "This removes the message only from your chat."
        }
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
        showDeleteForMe
        showDeleteForEveryone={isOwnMessage(actionMessage)}
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
        onDeleteForMe={() => {
          if (actionMessage) deleteMessage(actionMessage, "me");
        }}
        onDeleteForEveryone={() => {
          if (actionMessage) deleteMessage(actionMessage, "everyone");
        }}
        onReact={(emoji) => {
          if (!actionMessage) return;
          const row = threadItems.find(
            (item): item is Extract<ThreadListItem, { type: "message" }> =>
              item.type === "message" && item.message.id === actionMessage.id
          );
          void reactToMessage(actionMessage, emoji, row?.reactions || []);
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
        peerUserId={peerUserId}
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
                      <AppVideo
                        source={videoPlaybackUrl(item.url)}
                        style={styles.chatMediaViewerMedia}
                        contentFit="contain"
                        shouldPlay
                        nativeControls
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
              <AppVideo
                source={videoPlaybackUrl(chatMediaViewer.items[0].url)}
                style={[styles.chatMediaViewerMedia, { width: windowWidth, height: windowHeight }]}
                contentFit="contain"
                shouldPlay
                nativeControls
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
    borderRadius: 20
  },
  headerTitle: { fontSize: 16, fontWeight: "800", color: TEXT },
  headerHandle: { marginTop: 2, fontSize: 13, fontWeight: "500", color: MUTED },
  headerActive: { marginTop: 2, fontSize: 13, fontWeight: "600", color: APP_LIME },
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
  bubbleMetaRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 3
  },
  bubbleMetaRowSelf: { alignSelf: "flex-end", justifyContent: "flex-end" },
  bubbleMetaRowPeer: { alignSelf: "flex-start", justifyContent: "flex-start" },
  bubbleMeta: { fontSize: 11, lineHeight: 15 },
  bubbleMetaSelf: { color: MUTED },
  bubbleMetaPeer: { color: MUTED },
  tickWrap: { marginTop: 0.5, marginLeft: 1 },
  reelMeta: { marginTop: 3, marginRight: 4 },
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
    backgroundColor: BG,
    zIndex: 2,
    elevation: 8
  },
  composerWrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: BG,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER
  },
  requestBanner: {
    marginBottom: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#1c1c1e",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 10
  },
  requestBannerText: {
    fontSize: 13,
    lineHeight: 18,
    color: MUTED
  },
  requestBannerActions: {
    flexDirection: "row",
    gap: 8
  },
  requestBannerBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  requestBannerDelete: {
    backgroundColor: "#2a2a2a"
  },
  requestBannerAccept: {
    backgroundColor: APP_LIME
  },
  requestBannerDeleteText: {
    color: TEXT,
    fontWeight: "700",
    fontSize: 14
  },
  requestBannerAcceptText: {
    color: "#111",
    fontWeight: "800",
    fontSize: 14
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
  reactionChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)"
  },
  reactionChipMine: {
    backgroundColor: "rgba(201,255,53,0.18)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(201,255,53,0.55)"
  },
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
