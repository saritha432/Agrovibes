import { useCallback, useEffect, useState } from "react";
import { NavLink, useParams } from "react-router-dom";
import { fetchMessageThreads, type MessageThread } from "../../api/messages";
import { UserAvatar } from "../../components/messages/UserAvatar";
import { useAuth } from "../../auth/AuthContext";
import { formatThreadTime, previewMessage } from "./messagesUtils";

export function MessagesInbox() {
  const { token } = useAuth();
  const { peerUserId } = useParams();
  const activeId = peerUserId ? Number(peerUserId) : null;
  const [query, setQuery] = useState("");
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) {
      setThreads([]);
      setLoading(false);
      return;
    }
    try {
      const { threads: list } = await fetchMessageThreads(token);
      setThreads(list || []);
    } catch {
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 4000);
    return () => clearInterval(timer);
  }, [load]);

  const filtered = query.trim()
    ? threads.filter((t) => t.peerName.toLowerCase().includes(query.trim().toLowerCase()))
    : threads;

  return (
    <div className="messages-inbox">
      <div className="messages-inbox__search">
        <span className="messages-inbox__search-icon" aria-hidden>
          ⌕
        </span>
        <input
          type="search"
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
      </div>

      {loading ? <p className="messages-inbox__status">Loading…</p> : null}

      {!loading && filtered.length === 0 ? (
        <div className="messages-inbox__empty">
          <span className="messages-inbox__empty-icon" aria-hidden>
            💬
          </span>
          <h2>No messages yet</h2>
          <p>When someone reaches out, you will see it here.</p>
        </div>
      ) : null}

      <ul className="messages-inbox__list">
        {filtered.map((t) => {
          const isActive = activeId === t.peerUserId;
          const unread = Number(t.unreadCount || 0) > 0;
          return (
            <li key={t.peerUserId}>
              <NavLink
                to={`/messages/${t.peerUserId}`}
                className={`messages-inbox__row${isActive ? " messages-inbox__row--active" : ""}`}
              >
                <UserAvatar uri={t.peerAvatarUrl} name={t.peerName} size={56} />
                <div className="messages-inbox__row-body">
                  <div className="messages-inbox__row-top">
                    <strong>{t.peerName}</strong>
                    <time dateTime={t.lastAt}>{formatThreadTime(t.lastAt)}</time>
                  </div>
                  <p className={unread ? "messages-inbox__preview messages-inbox__preview--unread" : "messages-inbox__preview"}>
                    {previewMessage(t.lastMessage)}
                  </p>
                </div>
                {unread ? <span className="messages-inbox__badge">{t.unreadCount}</span> : null}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
