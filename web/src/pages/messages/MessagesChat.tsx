import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  deleteDirectMessage,
  fetchMessageThread,
  markDirectThreadRead,
  ringDirectCall,
  sendDirectMessage,
  type DirectMessageItem
} from "../../api/messages";
import { uploadAudioFile, uploadPickedMedia, shouldUseImageUpload } from "../../api/uploads";
import { fetchHomePost, isPostUnavailableError } from "../../api/home";
import type { HomePost } from "../../api/types";
import {
  joinDirectThread,
  leaveDirectThread,
  onDirectMessage,
  onDirectMessageDeleted,
  onDirectRead,
  onDirectThreadUpdate,
  onSocketConnectionChange
} from "../../services/socketChat";
import { ChatAssetIcon } from "../../components/messages/ChatAssetIcon";
import { ChatMessageActionSheet } from "../../components/messages/ChatMessageActionSheet";
import { ForwardMessageModal } from "../../components/messages/ForwardMessageModal";
import { PresenceAvatar } from "../../components/messages/PresenceAvatar";
import { useAuth } from "../../auth/AuthContext";
import { useIsOnline } from "../../context/PresenceContext";
import { resolveWebVideoUrl } from "../../utils/videoUrl";
import {
  buildDmReactMessage,
  buildDmReplyMessage,
  buildDmMediaMessage,
  buildDmVoiceMessage,
  dmMessageCopyText,
  formatDmCallLabel,
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
  dmMediaIsAlbum,
  dmMediaItems,
  isPhotoClipboardPlaceholder,
  type DmReplyPayload
} from "../../utils/dmMessageFormats";
import { formatMsgTime, parseSharedReel } from "./messagesUtils";
import { AppEmojiPicker } from "../../components/ui/AppEmojiPicker";

type ReplyTarget = {
  id: number;
  author: string;
  preview: string;
};

type MessageReaction = {
  id: number;
  emoji: string;
  senderId: number;
};

type ThreadMessage = {
  message: DirectMessageItem;
  reactions: MessageReaction[];
};

function mergeThreadMessages(prev: DirectMessageItem[], incoming: DirectMessageItem[]) {
  if (!incoming.length) return prev;
  const byId = new Map(prev.map((item) => [item.id, item]));
  for (const item of incoming) byId.set(item.id, item);
  return [...byId.values()].sort((a, b) => a.id - b.id || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

function WebVoiceNote({ url, durationMs }: { url: string; durationMs?: number }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const toggle = async () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
      return;
    }
    try {
      await el.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  return (
    <div className="messages-chat__voice">
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onEnded={() => setPlaying(false)}
      />
      <button
        type="button"
        className="messages-chat__voice-play"
        onClick={(e) => {
          e.stopPropagation();
          void toggle();
        }}
        aria-label={playing ? "Pause voice message" : "Play voice message"}
      >
        {playing ? "❚❚" : "▶"}
      </button>
      <span className="messages-chat__voice-wave" aria-hidden />
      <span className="messages-chat__voice-duration">{formatVoiceDuration(durationMs)}</span>
    </div>
  );
}

function ownReactionOn(reactions: MessageReaction[], userId: number | undefined) {
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid <= 0) return undefined;
  return reactions.find((reaction) => Number(reaction.senderId) === uid);
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
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" }).toUpperCase()} ${time}`;
}

function buildThreadMessages(messages: DirectMessageItem[]): ThreadMessage[] {
  const reactionsByTarget = new Map<number, MessageReaction[]>();
  for (const message of messages) {
    const react = parseDmReactMessage(message.body);
    if (!react) continue;
    const list = reactionsByTarget.get(react.targetId) || [];
    list.push({ id: message.id, emoji: react.emoji, senderId: message.senderId });
    reactionsByTarget.set(react.targetId, list);
  }

  const items: ThreadMessage[] = [];
  for (const message of messages) {
    if (parseDmReactMessage(message.body)) continue;
    items.push({
      message,
      reactions: reactionsByTarget.get(message.id) || []
    });
  }
  return items;
}

export function MessagesChat() {
  const navigate = useNavigate();
  const { peerUserId: peerParam } = useParams();
  const peerUserId = Number(peerParam);
  const { token, user } = useAuth();
  const peerOnline = useIsOnline(peerUserId);
  const [messages, setMessages] = useState<DirectMessageItem[]>([]);
  const [hydratedSharedPosts, setHydratedSharedPosts] = useState<Record<number, HomePost>>({});
  const [unavailableSharedIds, setUnavailableSharedIds] = useState<Record<number, true>>({});
  const [peerName, setPeerName] = useState("Chat");
  const [peerAvatar, setPeerAvatar] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [voiceRecordingMs, setVoiceRecordingMs] = useState(0);
  const [actionMessage, setActionMessage] = useState<DirectMessageItem | null>(null);
  const [forwardBody, setForwardBody] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordStartedRef = useRef(0);
  const voiceCancelledRef = useRef(false);
  const voiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const threadMessages = useMemo(() => buildThreadMessages(messages), [messages]);

  useEffect(() => {
    if (!token) return;
    const ids = [
      ...new Set(
        messages
          .map((item) => parseSharedReel(item.body)?.id)
          .filter((id): id is number => typeof id === "number" && id > 0)
      )
    ];
    if (!ids.length) return;
    let cancelled = false;
    void Promise.all(
      ids.map(async (id) => {
        try {
          const { post } = await fetchHomePost(token, id);
          return { id, post, unavailable: false as const };
        } catch (error) {
          return { id, post: null, unavailable: isPostUnavailableError(error) };
        }
      })
    ).then((results) => {
      if (cancelled) return;
      const nextPosts: Record<number, HomePost> = {};
      const nextUnavailable: Record<number, true> = {};
      for (const row of results) {
        if (row.post) nextPosts[row.id] = row.post;
        else if (row.unavailable) nextUnavailable[row.id] = true;
      }
      if (Object.keys(nextPosts).length) {
        setHydratedSharedPosts((prev) => ({ ...prev, ...nextPosts }));
      }
      if (Object.keys(nextUnavailable).length) {
        setUnavailableSharedIds((prev) => ({ ...prev, ...nextUnavailable }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [messages, token]);

  const scrollToEnd = () => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  const reload = useCallback(async (opts?: { silent?: boolean }) => {
    if (!token || !Number.isFinite(peerUserId) || peerUserId <= 0) {
      setMessages([]);
      setLoading(false);
      return;
    }
    if (!opts?.silent) setLoading(true);
    try {
      const data = await fetchMessageThread(token, peerUserId);
      setMessages((prev) => (opts?.silent ? mergeThreadMessages(prev, data.messages || []) : data.messages || []));
      setPeerName(data.peer?.fullName || "Chat");
      const av = data.peer?.avatarUrl;
      setPeerAvatar(av != null && String(av).trim() ? String(av).trim() : null);
    } catch {
      if (!opts?.silent) setMessages([]);
    } finally {
      setLoading(false);
      requestAnimationFrame(scrollToEnd);
    }
  }, [token, peerUserId]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!Number.isFinite(peerUserId) || peerUserId <= 0) return;
    joinDirectThread(peerUserId);
    const unsubMessage = onDirectMessage((payload) => {
      if (Number(payload.peerUserId) !== peerUserId) return;
      setMessages((prev) => mergeThreadMessages(prev, [payload.message]));
      requestAnimationFrame(scrollToEnd);
      if (token && Number(payload.message.senderId) !== Number(user?.id)) {
        void markDirectThreadRead(token, peerUserId).catch(() => {});
      }
    });
    const unsubDeleted = onDirectMessageDeleted((payload) => {
      if (Number(payload.peerUserId) !== peerUserId) return;
      setMessages((prev) => prev.filter((item) => item.id !== Number(payload.messageId)));
    });
    const unsubRead = onDirectRead((payload) => {
      if (payload?.selfRead) return;
      if (Number(payload.peerUserId) !== peerUserId && Number(payload.readerId) !== peerUserId) return;
      setMessages((prev) =>
        prev.map((item) => (Number(item.senderId) === Number(user?.id) ? { ...item, isRead: true } : item))
      );
    });
    const unsubThread = onDirectThreadUpdate((payload) => {
      if (Number(payload.peerUserId) !== peerUserId) return;
      void reload({ silent: true });
    });
    const unsubConnection = onSocketConnectionChange((connected) => {
      if (connected) void reload({ silent: true });
    });
    const poll = window.setInterval(() => void reload({ silent: true }), 4000);
    return () => {
      unsubMessage();
      unsubDeleted();
      unsubRead();
      unsubThread();
      unsubConnection();
      window.clearInterval(poll);
      leaveDirectThread(peerUserId);
    };
  }, [peerUserId, reload, token, user?.id]);

  useEffect(() => {
    scrollToEnd();
  }, [messages.length]);

  const sendMediaFiles = async (files: File[]) => {
    if (!files.length || !token || sending) return;
    setSending(true);
    try {
      for (const file of files) {
        const { url } = await uploadPickedMedia(file);
        const kind = shouldUseImageUpload(file) ? "image" : "video";
        const result = await sendDirectMessage(token, peerUserId, buildDmMediaMessage({ kind, url }));
        if (result.message) {
          setMessages((prev) => mergeThreadMessages(prev, [result.message!]));
        }
      }
      await reload({ silent: true });
    } catch {
      window.alert("Failed to send media.");
    } finally {
      setSending(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const sendText = async (text: string) => {
    if (!text || !token || sending || !Number.isFinite(peerUserId)) return;
    if (isPhotoClipboardPlaceholder(text)) {
      try {
        const clipItems = await navigator.clipboard.read();
        for (const clipItem of clipItems) {
          const type = clipItem.types.find((entry) => entry.startsWith("image/"));
          if (!type) continue;
          const blob = await clipItem.getType(type);
          await sendMediaFiles([
            new File([blob], `pasted-${Date.now()}.png`, { type: blob.type || "image/png" })
          ]);
          setDraft("");
          return;
        }
      } catch {
        // Fall through to sending the label if the clipboard has no image.
      }
    }
    if (parseDmMediaMessage(text)) {
      setSending(true);
      try {
        const result = await sendDirectMessage(token, peerUserId, text);
        setDraft("");
        if (result.message) {
          setMessages((prev) => mergeThreadMessages(prev, [result.message]));
        } else {
          await reload({ silent: true });
        }
      } catch {
        setDraft(text);
      } finally {
        setSending(false);
      }
      return;
    }
    setSending(true);
    try {
      let body = text;
      if (replyTo) {
        const payload: DmReplyPayload = {
          replyToId: replyTo.id,
          replyAuthor: replyTo.author,
          replyPreview: replyTo.preview,
          text
        };
        body = buildDmReplyMessage(payload);
        setReplyTo(null);
      }
      const result = await sendDirectMessage(token, peerUserId, body);
      setDraft("");
      if (result.message) {
        setMessages((prev) => mergeThreadMessages(prev, [result.message]));
      } else {
        await reload({ silent: true });
      }
    } catch {
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  const send = () => void sendText(draft.trim());

  const onPickMedia = async (files: FileList | null) => {
    await sendMediaFiles(files ? Array.from(files) : []);
  };

  const onComposerPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const imageFiles = Array.from(event.clipboardData?.files || []).filter((file) =>
      file.type.startsWith("image/")
    );
    if (!imageFiles.length) {
      const item = Array.from(event.clipboardData?.items || []).find((entry) =>
        entry.type.startsWith("image/")
      );
      const fromItem = item?.getAsFile();
      if (fromItem) imageFiles.push(fromItem);
    }
    if (imageFiles.length) {
      event.preventDefault();
      void sendMediaFiles(imageFiles);
      return;
    }
    const pastedText = event.clipboardData?.getData("text/plain") || "";
    if (parseDmMediaMessage(pastedText)) {
      event.preventDefault();
      void sendText(pastedText);
    }
  };

  const clearVoiceTimer = () => {
    if (voiceTimerRef.current) {
      clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
  };

  const stopRecordStream = () => {
    recordStreamRef.current?.getTracks().forEach((t) => t.stop());
    recordStreamRef.current = null;
  };

  const cancelVoiceRecording = () => {
    voiceCancelledRef.current = true;
    clearVoiceTimer();
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    mediaRecorderRef.current = null;
    stopRecordStream();
    setRecording(false);
    setVoiceRecordingMs(0);
    recordChunksRef.current = [];
  };

  const startVoiceRecord = async () => {
    if (!token || recording || sending) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordStreamRef.current = stream;
      voiceCancelledRef.current = false;
      const mimeCandidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
      const mimeType = mimeCandidates.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recordChunksRef.current = [];
      recordStartedRef.current = Date.now();
      setVoiceRecordingMs(0);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stopRecordStream();
        clearVoiceTimer();
        const cancelled = voiceCancelledRef.current;
        voiceCancelledRef.current = false;
        setRecording(false);
        setVoiceRecordingMs(0);
        mediaRecorderRef.current = null;

        if (cancelled) {
          recordChunksRef.current = [];
          return;
        }

        const durationMs = Date.now() - recordStartedRef.current;
        const blobType = (recorder.mimeType || mimeType || "audio/webm").split(";")[0] || "audio/webm";
        const blob = new Blob(recordChunksRef.current, { type: blobType });
        recordChunksRef.current = [];
        if (blob.size < 100 || durationMs < 400) return;

        const ext = blobType.includes("mp4") ? ".m4a" : blobType.includes("ogg") ? ".ogg" : ".webm";
        const file = new File([blob], `voice-${Date.now()}${ext}`, { type: blobType });

        setSending(true);
        try {
          const { url } = await uploadAudioFile(file, ext);
          await sendDirectMessage(token, peerUserId, buildDmVoiceMessage({ url, durationMs }));
          await reload({ silent: true });
        } catch {
          window.alert("Failed to send voice message.");
        } finally {
          setSending(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start(200);
      setRecording(true);
      clearVoiceTimer();
      voiceTimerRef.current = setInterval(() => {
        setVoiceRecordingMs(Date.now() - recordStartedRef.current);
      }, 200);
    } catch {
      window.alert("Microphone permission is required for voice messages.");
    }
  };

  const stopVoiceRecordAndSend = () => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  };

  useEffect(() => {
    return () => {
      clearVoiceTimer();
      stopRecordStream();
    };
  }, []);

  const startCall = async (mode: "voice" | "video") => {
    if (!token) return;
    window.alert("Voice and video calls are available in the mobile app.");
    try {
      await ringDirectCall(token, { peerUserId, mode });
    } catch {
      // ring may fail on web without LiveKit — expected
    }
  };

  const openMessageActions = (item: DirectMessageItem) => {
    if (parseDmCallMessage(item.body) || parseDmReactMessage(item.body)) return;
    setActionMessage(item);
  };

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const startLongPress = (item: DirectMessageItem) => {
    clearLongPress();
    longPressTimerRef.current = setTimeout(() => openMessageActions(item), 500);
  };

  const copyMessage = async (item: DirectMessageItem) => {
    const media = parseDmMediaMessage(item.body);
    const image = media ? dmMediaItems(media).find((entry) => entry.kind === "image") : undefined;
    if (image?.url) {
      const src = resolveWebVideoUrl(image.url) || image.url;
      try {
        const res = await fetch(src);
        const blob = await res.blob();
        const type = blob.type.startsWith("image/") ? blob.type : "image/png";
        await navigator.clipboard.write([new ClipboardItem({ [type]: blob })]);
        return;
      } catch {
        try {
          await navigator.clipboard.writeText(item.body);
          return;
        } catch {
          // Fall through to preview text.
        }
      }
    }
    const text = dmMessageCopyText(item.body);
    if (!text.trim()) {
      window.alert("This message cannot be copied as text.");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  const reactToMessage = async (item: DirectMessageItem, emoji: string, reactions: MessageReaction[] = []) => {
    if (!token) return;
    const mine = ownReactionOn(reactions, user?.id);
    try {
      if (mine && mine.emoji === emoji) {
        setMessages((prev) => prev.filter((row) => row.id !== mine.id));
        await deleteDirectMessage(token, mine.id);
        return;
      }
      if (mine) {
        setMessages((prev) => prev.filter((row) => row.id !== mine.id));
        await deleteDirectMessage(token, mine.id);
      }
      const result = await sendDirectMessage(
        token,
        peerUserId,
        buildDmReactMessage({ targetId: item.id, emoji })
      );
      if (result.message) {
        setMessages((prev) => mergeThreadMessages(prev, [result.message!]));
      } else {
        await reload({ silent: true });
      }
    } catch {
      await reload({ silent: true });
      window.alert("Could not update reaction.");
    }
  };

  const isOwnMessage = (item: DirectMessageItem | null | undefined) => {
    if (!item || user?.id == null) return false;
    return String(item.senderId) === String(user.id);
  };

  const deleteMessage = (item: DirectMessageItem, mode: "me" | "everyone") => {
    if (!token) return;
    if (mode === "everyone" && !isOwnMessage(item)) return;
    const confirmed = window.confirm(
      mode === "everyone"
        ? "Delete for everyone?\nThis removes the message for everyone in this chat."
        : "Delete for me?\nThis removes the message only from your chat."
    );
    if (!confirmed) return;
    void (async () => {
      try {
        await deleteDirectMessage(token, item.id, mode);
        setMessages((prev) => prev.filter((entry) => entry.id !== item.id));
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "Could not delete this message.");
      }
    })();
  };

  const startReplyToMessage = (item: DirectMessageItem) => {
    const isSelf = Number(item.senderId) === Number(user?.id);
    const preview = formatDmInboxPreview(item.body).slice(0, 80) || item.body.slice(0, 80);
    setReplyTo({
      id: item.id,
      author: isSelf ? "You" : peerName,
      preview
    });
  };

  const renderBody = (item: DirectMessageItem) => {
    const body = typeof item.body === "string" ? item.body : JSON.stringify(item.body ?? "");
    const reply = parseDmReplyMessage(body);
    if (reply) {
      return (
        <div className="messages-chat__reply-wrap">
          <div className="messages-chat__reply-quote">
            <strong>{reply.replyAuthor}</strong>
            <span>{reply.replyPreview}</span>
          </div>
          <p>{reply.text}</p>
        </div>
      );
    }
    const call = parseDmCallMessage(body);
    if (call) {
      return <p className="messages-chat__call">{formatDmCallLabel(call)}</p>;
    }
    const voice = parseDmVoiceMessage(body);
    if (voice) {
      return (
        <WebVoiceNote url={resolveWebVideoUrl(voice.url) || voice.url} durationMs={voice.durationMs} />
      );
    }
    const media = parseDmMediaMessage(body);
    if (media) {
      const items = dmMediaItems(media);
      if (dmMediaIsAlbum(media) || items.length > 1) {
        return (
          <div className="messages-chat__album">
            {items.map((entry) => {
              const src = resolveWebVideoUrl(entry.url) || entry.url;
              return entry.kind === "video" ? (
                <video key={src} src={src} controls playsInline className="messages-chat__album-item" />
              ) : (
                <img key={src} src={src} alt="" className="messages-chat__album-item" />
              );
            })}
          </div>
        );
      }
      const src = resolveWebVideoUrl(items[0]?.url || "") || items[0]?.url || "";
      if (!src || !items[0]) return <p>Photo</p>;
      return items[0].kind === "video" ? (
        <video src={src} controls playsInline className="messages-chat__media" />
      ) : (
        <img src={src} alt="" className="messages-chat__media" />
      );
    }
    const storyDm = parseStoryDmMessage(body);
    if (storyDm) {
      const thumb = storyDm.imageUrl || storyDm.previewUrl;
      const forwarded = isStoryDmForwarded(storyDm, item);
      const label = storyDmChatLabel(storyDm, forwarded);
      return (
        <div className="messages-chat__story">
          <div className="messages-chat__story-card">
            {thumb ? (
              <img src={thumb} alt="" className="messages-chat__story-thumb" />
            ) : (
              <span className="messages-chat__reel-ph">Story</span>
            )}
            <p className="messages-chat__story-label">{label}</p>
          </div>
          {storyDm.kind === "like" ? (
            <p className="messages-chat__story-heart">❤️</p>
          ) : storyDm.text ? (
            <p className="messages-chat__story-text">{storyDm.text}</p>
          ) : null}
        </div>
      );
    }
    const sharedReel = parseSharedReel(body);
    if (sharedReel) {
      const livePost = sharedReel.id ? hydratedSharedPosts[sharedReel.id] : null;
      const unavailable = sharedReel.id ? Boolean(unavailableSharedIds[sharedReel.id]) : false;
      const liveVideo = livePost ? resolveWebVideoUrl(String(livePost.videoUrl || livePost.hlsUrl || livePost.playbackUrl || "")) : null;
      const liveImage = livePost ? String(livePost.imageUrl || livePost.thumbnailUrl || "") : "";
      return (
        <div className={`messages-chat__reel-card${unavailable ? " messages-chat__reel-card--gone" : ""}`}>
          {unavailable ? (
            <div className="messages-chat__reel-ph messages-chat__reel-ph--gone">This post is no longer available.</div>
          ) : liveVideo ? (
            <video src={liveVideo} controls playsInline className="messages-chat__reel-media" />
          ) : liveImage ? (
            <img src={liveImage} alt="" className="messages-chat__reel-media" />
          ) : (
            <span className="messages-chat__reel-ph">▶ Drop</span>
          )}
          <div className="messages-chat__reel-meta">
            <strong>{livePost?.userName || sharedReel.author}</strong>
            {!unavailable && (livePost?.caption || sharedReel.caption) ? (
              <p>{livePost?.caption || sharedReel.caption}</p>
            ) : null}
          </div>
        </div>
      );
    }
    return <p>{formatDmInboxPreview(body) || "Message"}</p>;
  };

  if (!Number.isFinite(peerUserId) || peerUserId <= 0) {
    return (
      <div className="messages-chat messages-chat--invalid">
        <p>Invalid conversation.</p>
        <Link to="/messages">Back to inbox</Link>
      </div>
    );
  }

  return (
    <div className="messages-chat">
      <header className="messages-chat__header">
        <button type="button" className="messages-chat__back" onClick={() => navigate("/messages")} aria-label="Back">
          ←
        </button>
        <PresenceAvatar userId={peerUserId} uri={peerAvatar} name={peerName} size={32} />
        <div className="messages-chat__header-meta">
          <strong className="messages-chat__title">{peerName}</strong>
          {peerOnline ? <span className="messages-chat__active">Active now</span> : null}
        </div>
        <div className="messages-chat__header-actions">
          <button type="button" title="Voice call" onClick={() => void startCall("voice")} aria-label="Voice call">
            <ChatAssetIcon name="voiceCall" size={22} />
          </button>
          <button type="button" title="Video call" onClick={() => void startCall("video")} aria-label="Video call">
            <ChatAssetIcon name="videoCall" size={22} />
          </button>
        </div>
      </header>

      <div ref={listRef} className="messages-chat__list" onClick={() => setActionMessage(null)}>
        {loading ? <p className="messages-chat__status">Loading…</p> : null}
        {!loading && threadMessages.length === 0 ? (
          <p className="messages-chat__empty">
            Say hi to <strong>{peerName}</strong>
          </p>
        ) : null}
        {threadMessages.map(({ message: item, reactions }) => {
          const isSelf = Number(item.senderId) === Number(user?.id);
          const sharedReel = parseSharedReel(item.body);
          const storyDm = parseStoryDmMessage(item.body);
          const richCard = Boolean(
            sharedReel || storyDm || parseDmMediaMessage(item.body) || parseDmVoiceMessage(item.body)
          );

          return (
            <div
              key={item.id}
              className={`messages-chat__bubble-row${isSelf ? " messages-chat__bubble-row--self" : ""}`}
            >
              <div className="messages-chat__bubble-stack">
                {storyDm && isStoryDmForwarded(storyDm, item) ? (
                  <p className="messages-chat__forwarded">↪ Forwarded</p>
                ) : null}
                <div
                  className={`messages-chat__bubble${isSelf ? " messages-chat__bubble--self" : ""}${richCard ? " messages-chat__bubble--reel" : ""}`}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    openMessageActions(item);
                  }}
                  onPointerDown={() => startLongPress(item)}
                  onPointerUp={clearLongPress}
                  onPointerLeave={clearLongPress}
                  onPointerCancel={clearLongPress}
                >
                  {renderBody(item)}
                  <time dateTime={item.createdAt}>
                    {formatMsgTime(item.createdAt)}
                    {isSelf ? (
                      <span className={item.isRead ? "messages-chat__read messages-chat__read--seen" : "messages-chat__read"}>
                        {item.isRead ? "Seen" : "Unseen"}
                      </span>
                    ) : null}
                  </time>
                </div>
                {reactions.length ? (
                  <div
                    className={`messages-chat__reactions${isSelf ? " messages-chat__reactions--self" : " messages-chat__reactions--peer"}`}
                  >
                    {reactions.map((reaction) => {
                      const mine = Number(reaction.senderId) === Number(user?.id);
                      return (
                        <button
                          key={reaction.id}
                          type="button"
                          className={`messages-chat__reaction-emoji${mine ? " messages-chat__reaction-emoji--mine" : ""}`}
                          title={mine ? "Remove reaction" : "Add this reaction"}
                          onClick={(e) => {
                            e.stopPropagation();
                            void reactToMessage(item, reaction.emoji, reactions);
                          }}
                        >
                          {reaction.emoji}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <ChatMessageActionSheet
        visible={actionMessage != null}
        timestampLabel={
          actionMessage ? formatActionSheetTimestamp(new Date(actionMessage.createdAt).getTime()) : undefined
        }
        activeEmoji={
          ownReactionOn(
            threadMessages.find((row) => row.message.id === actionMessage?.id)?.reactions || [],
            user?.id
          )?.emoji
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
        showDeleteForMe
        showDeleteForEveryone={isOwnMessage(actionMessage)}
        onDeleteForMe={() => {
          const item = actionMessage;
          if (item) deleteMessage(item, "me");
        }}
        onDeleteForEveryone={() => {
          const item = actionMessage;
          if (item) deleteMessage(item, "everyone");
        }}
        onReact={(emoji) => {
          if (!actionMessage) return;
          const reactions =
            threadMessages.find((row) => row.message.id === actionMessage.id)?.reactions || [];
          void reactToMessage(actionMessage, emoji, reactions);
        }}
      />

      <ForwardMessageModal
        visible={forwardBody != null}
        messageBody={forwardBody || ""}
        excludeUserId={peerUserId}
        onClose={() => setForwardBody(null)}
        onSent={() => window.alert("Message forwarded.")}
      />

      {replyTo ? (
        <div className="messages-chat__reply-bar">
          <div>
            <strong>Replying to {replyTo.author}</strong>
            <span>{replyTo.preview}</span>
          </div>
          <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply">
            ×
          </button>
        </div>
      ) : null}

      <footer className="messages-chat__composer-wrap">
        <AppEmojiPicker
          open={emojiOpen}
          variant="overlay"
          closeOnSelect={false}
          onClose={() => setEmojiOpen(false)}
          onSelect={(emoji) => setDraft((d) => `${d}${emoji}`)}
        />
        <div className="messages-chat__composer-bar">
          <button
            type="button"
            className="messages-chat__camera-btn"
            onClick={() => cameraRef.current?.click()}
            disabled={sending || recording}
            title="Camera"
            aria-label="Camera"
          >
            <ChatAssetIcon name="camera" size={35} />
          </button>

          {recording ? (
            <div className="messages-chat__recording">
              <span className="messages-chat__recording-dot" />
              <span className="messages-chat__recording-label">Recording…</span>
              <span className="messages-chat__recording-timer">{formatVoiceDuration(voiceRecordingMs)}</span>
              <button
                type="button"
                className="messages-chat__recording-cancel"
                onClick={cancelVoiceRecording}
                aria-label="Cancel recording"
              >
                ×
              </button>
              <button
                type="button"
                className="messages-chat__recording-send"
                onClick={stopVoiceRecordAndSend}
              >
                Send
              </button>
            </div>
          ) : (
            <div className="messages-chat__input-area">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onPaste={onComposerPaste}
                placeholder="Message"
                rows={1}
                maxLength={2000}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              {draft.trim() ? (
                <button
                  type="button"
                  className="messages-chat__inline-send"
                  disabled={sending}
                  onClick={send}
                  aria-label="Send message"
                >
                  Send
                </button>
              ) : (
                <div className="messages-chat__trailing">
                  <button
                    type="button"
                    disabled={sending}
                    onClick={() => void startVoiceRecord()}
                    title="Voice"
                    aria-label="Voice message"
                  >
                    <ChatAssetIcon name="mic" size={24} />
                  </button>
                  <button
                    type="button"
                    disabled={sending}
                    onClick={() => fileRef.current?.click()}
                    title="Gallery"
                    aria-label="Gallery"
                  >
                    <ChatAssetIcon name="gallery" size={24} />
                  </button>
                  <button
                    type="button"
                    disabled={sending}
                    onClick={() => setEmojiOpen((open) => !open)}
                    title="Stickers"
                    aria-label="Stickers"
                  >
                    <ChatAssetIcon name="sticker" size={24} />
                  </button>
                  <button type="button" disabled title="More" aria-label="More">
                    <ChatAssetIcon name="plus" size={24} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          hidden
          accept="image/*,video/*"
          multiple
          onChange={(e) => void onPickMedia(e.target.files)}
        />
        <input
          ref={cameraRef}
          type="file"
          hidden
          accept="image/*,video/*"
          capture="environment"
          onChange={(e) => void onPickMedia(e.target.files)}
        />
      </footer>
    </div>
  );
}
