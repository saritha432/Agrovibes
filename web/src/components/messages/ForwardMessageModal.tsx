import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { fetchSocialNetwork } from "../../api/home";
import { sendDirectMessage } from "../../api/messages";
import { useAuth } from "../../auth/AuthContext";
import { UserAvatar } from "./UserAvatar";
import "./ForwardMessageModal.css";

type FollowPerson = {
  userId: number;
  name: string;
  avatarUrl?: string | null;
};

type Props = {
  visible: boolean;
  messageBody: string;
  excludeUserId?: number;
  onClose: () => void;
  onSent?: () => void;
};

export function ForwardMessageModal({ visible, messageBody, excludeUserId, onClose, onSent }: Props) {
  const { token, user } = useAuth();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [following, setFollowing] = useState<FollowPerson[]>([]);
  const [error, setError] = useState("");

  const loadFollowing = useCallback(async () => {
    if (!token || !user?.id) {
      setFollowing([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const network = await fetchSocialNetwork(token, user.id);
      const list = (network.following || [])
        .map((row) => ({
          userId: Number(row.key),
          name: String(row.name || "User").trim() || "User",
          avatarUrl: row.avatarUrl
        }))
        .filter((row) => Number.isFinite(row.userId) && row.userId > 0 && row.userId !== excludeUserId);
      setFollowing(list);
    } catch {
      setFollowing([]);
      setError("Could not load your friends list.");
    } finally {
      setLoading(false);
    }
  }, [excludeUserId, token, user?.id]);

  useEffect(() => {
    if (!visible) {
      setQuery("");
      setSendingId(null);
      return;
    }
    void loadFollowing();
  }, [loadFollowing, visible]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return following;
    return following.filter((person) => person.name.toLowerCase().includes(q));
  }, [following, query]);

  const forwardTo = async (person: FollowPerson) => {
    if (!token || sendingId != null) return;
    setSendingId(person.userId);
    try {
      await sendDirectMessage(token, person.userId, messageBody);
      onSent?.();
      onClose();
    } catch {
      setError(`Could not forward to ${person.name}.`);
    } finally {
      setSendingId(null);
    }
  };

  if (!visible) return null;

  return createPortal(
    <div className="forward-modal" role="presentation" onClick={onClose}>
      <div
        className="forward-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Forward message"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="forward-modal__header">
          <h2>Forward</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="forward-modal__search">
          <span aria-hidden>⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people you follow"
          />
        </div>

        {error ? <p className="forward-modal__error">{error}</p> : null}

        {loading ? (
          <p className="forward-modal__status">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="forward-modal__status">
            {following.length ? "No matches" : "Follow people to forward messages to them in chat."}
          </p>
        ) : (
          <ul className="forward-modal__list">
            {filtered.map((item) => (
              <li key={item.userId}>
                <button
                  type="button"
                  className="forward-modal__row"
                  disabled={sendingId != null}
                  onClick={() => void forwardTo(item)}
                >
                  <UserAvatar uri={item.avatarUrl} name={item.name} size={46} />
                  <span className="forward-modal__name">{item.name}</span>
                  {sendingId === item.userId ? <span className="forward-modal__busy">…</span> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>,
    document.body
  );
}
