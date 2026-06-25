import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  fetchMessageThread,
  ringDirectCall,
  sendDirectMessage,
  type DirectMessageItem
} from "../../api/messages";
import { uploadAudioFile, uploadPickedMedia, shouldUseImageUpload } from "../../api/uploads";
import {
  joinDirectThread,
  leaveDirectThread,
  onDirectMessage
} from "../../services/socketChat";
import { ChatAssetIcon } from "../../components/messages/ChatAssetIcon";
import { ChatMessageActionSheet } from "../../components/messages/ChatMessageActionSheet";
import { ForwardMessageModal } from "../../components/messages/ForwardMessageModal";
import { UserAvatar } from "../../components/messages/UserAvatar";
import { useAuth } from "../../auth/AuthContext";
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
  type DmReplyPayload
} from "../../utils/dmMessageFormats";
import { formatMsgTime, parseSharedReel } from "./messagesUtils";

type ReplyTarget = {
  id: number;
  author: string;
  preview: string;
};

type ThreadMessage = {
  message: DirectMessageItem;
  reactions: string[];
};

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
  const reactionsByTarget = new Map<number, string[]>();
  for (const message of messages) {
    const react = parseDmReactMessage(message.body);
    if (!react) continue;
    const list = reactionsByTarget.get(react.targetId) || [];
    list.push(react.emoji);
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
  const [messages, setMessages] = useState<DirectMessageItem[]>([]);
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

  const scrollToEnd = () => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  const reload = useCallback(async () => {
    if (!token || !Number.isFinite(peerUserId) || peerUserId <= 0) {
      setMessages([]);
      setLoading(false);
      return;
    }
    try {
      const data = await fetchMessageThread(token, peerUserId);
      setMessages(data.messages || []);
      setPeerName(data.peer?.fullName || "Chat");
      const av = data.peer?.avatarUrl;
      setPeerAvatar(av != null && String(av).trim() ? String(av).trim() : null);
    } catch {
      setMessages([]);
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
    const unsub = onDirectMessage((payload) => {
      if (Number(payload.peerUserId) !== peerUserId) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === payload.message.id)) return prev;
        return [...prev, payload.message];
      });
      requestAnimationFrame(scrollToEnd);
    });
    return () => {
      unsub();
      leaveDirectThread(peerUserId);
    };
  }, [peerUserId]);

  useEffect(() => {
    scrollToEnd();
  }, [messages.length]);

  const sendText = async (text: string) => {
    if (!text || !token || sending || !Number.isFinite(peerUserId)) return;
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
      await sendDirectMessage(token, peerUserId, body);
      setDraft("");
      await reload();
    } catch {
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  const send = () => void sendText(draft.trim());

  const onPickMedia = async (files: FileList | null) => {
    if (!files?.length || !token || sending) return;
    setSending(true);
    try {
      for (const file of Array.from(files)) {
        const { url } = await uploadPickedMedia(file);
        const kind = shouldUseImageUpload(file) ? "image" : "video";
        await sendDirectMessage(token, peerUserId, buildDmMediaMessage({ kind, url }));
      }
      await reload();
    } catch {
      window.alert("Failed to send media.");
    } finally {
      setSending(false);
      if (fileRef.current) fileRef.current.value = "";
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
      const recorder = new MediaRecorder(stream);
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
        const blob = new Blob(recordChunksRef.current, { type: "audio/webm" });
        recordChunksRef.current = [];
        if (blob.size < 100 || durationMs < 400) return;

        setSending(true);
        try {
          const { url } = await uploadAudioFile(blob, ".webm");
          await sendDirectMessage(token, peerUserId, buildDmVoiceMessage({ url, durationMs }));
          await reload();
        } catch {
          window.alert("Failed to send voice message.");
        } finally {
          setSending(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
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

  const reactToMessage = async (item: DirectMessageItem, emoji: string) => {
    if (!token) return;
    try {
      const result = await sendDirectMessage(
        token,
        peerUserId,
        buildDmReactMessage({ targetId: item.id, emoji })
      );
      if (result.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === result.message!.id)) return prev;
          return [...prev, result.message!];
        });
      } else {
        await reload();
      }
    } catch {
      window.alert("Could not add reaction.");
    }
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
    const reply = parseDmReplyMessage(item.body);
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
    const call = parseDmCallMessage(item.body);
    if (call) {
      return <p className="messages-chat__call">{formatDmCallLabel(call)}</p>;
    }
    const voice = parseDmVoiceMessage(item.body);
    if (voice) {
      return (
        <div className="messages-chat__voice">
          <audio src={resolveWebVideoUrl(voice.url) || voice.url} controls preload="metadata" />
          <span>{formatVoiceDuration(voice.durationMs)}</span>
        </div>
      );
    }
    const media = parseDmMediaMessage(item.body);
    if (media) {
      const src = resolveWebVideoUrl(media.url) || media.url;
      return media.kind === "video" ? (
        <video src={src} controls playsInline className="messages-chat__media" />
      ) : (
        <img src={src} alt="" className="messages-chat__media" />
      );
    }
    const sharedReel = parseSharedReel(item.body);
    const videoSrc = sharedReel?.videoUrl ? resolveWebVideoUrl(sharedReel.videoUrl) : null;
    if (sharedReel) {
      return (
        <div className="messages-chat__reel-card">
          {videoSrc ? (
            <video src={videoSrc} controls playsInline className="messages-chat__reel-media" />
          ) : sharedReel.imageUrl ? (
            <img src={sharedReel.imageUrl} alt="" className="messages-chat__reel-media" />
          ) : (
            <span className="messages-chat__reel-ph">▶ Drop</span>
          )}
          <div className="messages-chat__reel-meta">
            <strong>{sharedReel.author}</strong>
            {sharedReel.caption ? <p>{sharedReel.caption}</p> : null}
          </div>
        </div>
      );
    }
    return <p>{item.body}</p>;
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
        <UserAvatar uri={peerAvatar} name={peerName} size={32} />
        <strong className="messages-chat__title">{peerName}</strong>
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

          return (
            <div
              key={item.id}
              className={`messages-chat__bubble-row${isSelf ? " messages-chat__bubble-row--self" : ""}`}
            >
              <div className="messages-chat__bubble-stack">
                <div
                  className={`messages-chat__bubble${isSelf ? " messages-chat__bubble--self" : ""}${sharedReel ? " messages-chat__bubble--reel" : ""}`}
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
                  <time dateTime={item.createdAt}>{formatMsgTime(item.createdAt)}</time>
                </div>
                {reactions.length ? (
                  <div
                    className={`messages-chat__reactions${isSelf ? " messages-chat__reactions--self" : " messages-chat__reactions--peer"}`}
                  >
                    {reactions.map((emoji, index) => (
                      <span key={`${emoji}-${index}`} className="messages-chat__reaction-emoji">
                        {emoji}
                      </span>
                    ))}
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
                  <button type="button" disabled title="Stickers" aria-label="Stickers">
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
