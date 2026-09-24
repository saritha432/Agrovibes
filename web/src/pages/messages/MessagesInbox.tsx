import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, useParams } from "react-router-dom";
import { fetchMessageThreads, type MessageThread } from "../../api/messages";
import { fetchUsers } from "../../api/home";
import type { UserSearchRecord } from "../../api/types";
import { PresenceAvatar } from "../../components/messages/PresenceAvatar";
import { useAuth } from "../../auth/AuthContext";
import { onDirectRead, onDirectThreadUpdate } from "../../services/socketChat";
import { formatThreadTime, previewMessage } from "./messagesUtils";

export function MessagesInbox() {
  const { token, user } = useAuth();
  const { peerUserId } = useParams();
  const activeId = peerUserId ? Number(peerUserId) : null;
  const [query, setQuery] = useState("");
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [peopleHits, setPeopleHits] = useState<UserSearchRecord[]>([]);
  const [searchingPeople, setSearchingPeople] = useState(false);
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

  useEffect(() => {
    const applyThreadUpdate = (update: { peerUserId: number; lastMessage?: string; lastAt?: string; lastSenderId?: number; lastReceiverId?: number; unreadDelta?: number; unreadCount?: number }) => {
      setThreads((prev) => {
        const idx = prev.findIndex((thread) => thread.peerUserId === update.peerUserId);
        if (idx < 0) {
          void load();
          return prev;
        }
        const next = [...prev];
        const current = next[idx];
        const unreadDelta = Number(update.unreadDelta || 0);
        const unreadCount =
          typeof update.unreadCount === "number" && Number.isFinite(update.unreadCount)
            ? Math.max(0, update.unreadCount)
            : Math.max(0, Number(current.unreadCount || 0) + unreadDelta);
        next[idx] = {
          ...current,
          lastMessage: update.lastMessage ?? current.lastMessage,
          lastAt: update.lastAt ?? current.lastAt,
          lastSenderId: update.lastSenderId ?? current.lastSenderId,
          lastReceiverId: update.lastReceiverId ?? current.lastReceiverId,
          unreadCount
        };
        next.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
        return next;
      });
    };
    const unsubThread = onDirectThreadUpdate(applyThreadUpdate);
    const unsubRead = onDirectRead((payload) => {
      if (payload?.selfRead && payload.peerUserId) {
        applyThreadUpdate({ peerUserId: payload.peerUserId, unreadCount: 0, unreadDelta: 0 });
      }
      void load();
    });
    return () => {
      unsubThread();
      unsubRead();
    };
  }, [load]);

  const trimmedQuery = query.trim();
  const needle = trimmedQuery.toLowerCase();

  useEffect(() => {
    if (!token || needle.length < 1) {
      setPeopleHits([]);
      setSearchingPeople(false);
      return;
    }
    let cancelled = false;
    setSearchingPeople(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetchUsers(token, { search: trimmedQuery, limit: 40 });
          if (cancelled) return;
          const me = Number(user?.id);
          setPeopleHits((res.users || []).filter((row) => Number(row.id) !== me));
        } catch {
          if (!cancelled) setPeopleHits([]);
        } finally {
          if (!cancelled) setSearchingPeople(false);
        }
      })();
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [needle, token, trimmedQuery, user?.id]);

  const matchingThreads = useMemo(() => {
    if (!needle) return threads;
    const hitIds = new Set(peopleHits.map((row) => Number(row.id)));
    return threads.filter((thread) => {
      const name = thread.peerName.toLowerCase();
      const preview = previewMessage(thread.lastMessage).toLowerCase();
      return name.includes(needle) || preview.includes(needle) || hitIds.has(Number(thread.peerUserId));
    });
  }, [needle, peopleHits, threads]);

  const extraPeople = useMemo(() => {
    if (!needle) return [];
    const chatIds = new Set(threads.map((thread) => Number(thread.peerUserId)));
    return peopleHits.filter((row) => !chatIds.has(Number(row.id)));
  }, [needle, peopleHits, threads]);

  const searching = Boolean(needle);
  const noSearchResults = searching && !searchingPeople && matchingThreads.length === 0 && extraPeople.length === 0;

  return (
    <div className="messages-inbox">
      <div className="messages-inbox__search">
        <span className="messages-inbox__search-icon" aria-hidden>
          ⌕
        </span>
        <input
          type="search"
          placeholder="Search people"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
      </div>

      {loading ? <p className="messages-inbox__status">Loading…</p> : null}

      {!loading && !searching && threads.length === 0 ? (
        <div className="messages-inbox__empty">
          <span className="messages-inbox__empty-icon" aria-hidden>
            💬
          </span>
          <h2>No messages yet</h2>
          <p>When someone reaches out, you will see it here.</p>
        </div>
      ) : null}

      {noSearchResults ? <p className="messages-inbox__status">No users found.</p> : null}
      {searching && searchingPeople && extraPeople.length === 0 ? (
        <p className="messages-inbox__status">Searching…</p>
      ) : null}

      <div className="messages-inbox__results">
        {matchingThreads.length > 0 ? (
          <ul className="messages-inbox__list">
            {searching ? <li className="messages-inbox__section">Messages</li> : null}
            {matchingThreads.map((t) => {
              const isActive = activeId === t.peerUserId;
              const unread = Number(t.unreadCount || 0) > 0;
              return (
                <li key={t.peerUserId}>
                  <NavLink
                    to={`/messages/${t.peerUserId}`}
                    className={`messages-inbox__row${isActive ? " messages-inbox__row--active" : ""}`}
                  >
                    <PresenceAvatar userId={t.peerUserId} uri={t.peerAvatarUrl} name={t.peerName} size={56} />
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
        ) : null}

        {extraPeople.length > 0 ? (
          <ul className="messages-inbox__list">
            <li className="messages-inbox__section">Suggested</li>
            {extraPeople.map((person) => {
              const name = person.fullName || person.username || "User";
              const isActive = activeId === person.id;
              return (
                <li key={person.id}>
                  <NavLink
                    to={`/messages/${person.id}`}
                    className={`messages-inbox__row${isActive ? " messages-inbox__row--active" : ""}`}
                  >
                    <PresenceAvatar userId={person.id} uri={person.avatarUrl} name={name} size={56} />
                    <div className="messages-inbox__row-body">
                      <div className="messages-inbox__row-top">
                        <strong>{name}</strong>
                      </div>
                      <p className="messages-inbox__preview">{person.username || "Message"}</p>
                    </div>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
