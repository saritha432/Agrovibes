import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  fetchMessageThread,
  sendDirectMessage,
  type DirectMessageItem
} from "../../api/messages";
import { UserAvatar } from "../../components/messages/UserAvatar";
import { useAuth } from "../../auth/AuthContext";
import { useDynamicTranslations } from "../../localization/dynamicTranslation";
import { useLanguage } from "../../localization/LanguageContext";
import { resolveWebVideoUrl } from "../../utils/videoUrl";
import { formatMsgTime, parseSharedReel } from "./messagesUtils";

export function MessagesChat() {
  const navigate = useNavigate();
  const { peerUserId: peerParam } = useParams();
  const peerUserId = Number(peerParam);
  const { token, user } = useAuth();
  const { language } = useLanguage();
  const { getTranslation, requestTranslation } = useDynamicTranslations(token, language);
  const [messages, setMessages] = useState<DirectMessageItem[]>([]);
  const [peerName, setPeerName] = useState("Chat");
  const [peerAvatar, setPeerAvatar] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

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
    const timer = setInterval(() => void reload(), 2500);
    return () => clearInterval(timer);
  }, [reload]);

  useEffect(() => {
    scrollToEnd();
  }, [messages.length]);

  useEffect(() => {
    for (const item of messages) {
      const sharedReel = parseSharedReel(item.body);
      const text = sharedReel?.caption || item.body;
      if (text) void requestTranslation(text, "chat");
    }
  }, [messages, requestTranslation]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !token || sending || !Number.isFinite(peerUserId)) return;
    setSending(true);
    setDraft("");
    try {
      await sendDirectMessage(token, peerUserId, text);
      await reload();
    } catch {
      setDraft(text);
    } finally {
      setSending(false);
    }
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
      </header>

      <div ref={listRef} className="messages-chat__list">
        {loading ? <p className="messages-chat__status">Loading…</p> : null}
        {!loading && messages.length === 0 ? (
          <p className="messages-chat__empty">
            Say hi to <strong>{peerName}</strong>
          </p>
        ) : null}
        {messages.map((item) => {
          const isSelf = Number(item.senderId) === Number(user?.id);
          const sharedReel = parseSharedReel(item.body);
          const videoSrc = sharedReel?.videoUrl ? resolveWebVideoUrl(sharedReel.videoUrl) : null;
          const translatedBody = getTranslation(item.body, item.body);
          const translatedSharedCaption = sharedReel?.caption ? getTranslation(sharedReel.caption, sharedReel.caption) : "";

          return (
            <div
              key={item.id}
              className={`messages-chat__bubble-row${isSelf ? " messages-chat__bubble-row--self" : ""}`}
            >
              <div
                className={`messages-chat__bubble${isSelf ? " messages-chat__bubble--self" : ""}${sharedReel ? " messages-chat__bubble--reel" : ""}`}
              >
                {sharedReel ? (
                  <div className="messages-chat__reel-card">
                    {videoSrc ? (
                      <video src={videoSrc} controls playsInline className="messages-chat__reel-media" />
                    ) : sharedReel.imageUrl ? (
                      <img src={sharedReel.imageUrl} alt="" className="messages-chat__reel-media" />
                    ) : (
                      <span className="messages-chat__reel-ph">▶ Reel</span>
                    )}
                    <div className="messages-chat__reel-meta">
                      <strong>{sharedReel.author}</strong>
                      {translatedSharedCaption ? <p>{translatedSharedCaption}</p> : null}
                    </div>
                  </div>
                ) : (
                  <p>{translatedBody}</p>
                )}
                <time dateTime={item.createdAt}>{formatMsgTime(item.createdAt)}</time>
              </div>
            </div>
          );
        })}
      </div>

      <footer className="messages-chat__composer">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message..."
          rows={1}
          maxLength={2000}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button
          type="button"
          className="messages-chat__send"
          disabled={!draft.trim() || sending}
          onClick={() => void send()}
        >
          Send
        </button>
      </footer>
    </div>
  );
}
