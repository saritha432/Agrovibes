import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchUsers, sendFollowRequest } from "../api/home";
import type { UserSearchRecord } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import "./SearchPage.css";

export function SearchPage() {
  const { token, user } = useAuth();
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<UserSearchRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (!token) {
      setUsers([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetchUsers(token, { search: q.trim(), limit: 50 });
        if (!cancelled) {
          const viewerId = Number(user?.id);
          setUsers(
            res.users.filter((u) => {
              const id = Number(u.id);
              return Number.isFinite(id) && id > 0 && id !== viewerId;
            })
          );
        }
      } catch {
        if (!cancelled) setUsers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, q.trim() ? 300 : 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [token, q, user?.id]);

  const onFollow = async (target: UserSearchRecord) => {
    if (!token || busyId != null || target.viewerStatus === "pending") return;
    setBusyId(target.id);
    try {
      await sendFollowRequest(token, target.id);
      setUsers((prev) =>
        prev.map((u) => (u.id === target.id ? { ...u, viewerStatus: "pending" as const } : u))
      );
    } catch {
      // ignore
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="search-page">
      <h1>Search</h1>
      <input
        className="search-page__input"
        placeholder="Search people"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {loading ? <p className="search-page__hint">Loading…</p> : null}
      {!loading && users.length === 0 ? (
        <p className="search-page__hint">{q.trim() ? "No users found." : "No users yet."}</p>
      ) : null}
      <ul className="search-page__list">
        {users.map((u) => (
          <li key={u.id} className="search-page__item">
            <span className="search-page__avatar">
              {u.avatarUrl ? <img src={u.avatarUrl} alt="" /> : u.fullName.charAt(0)}
            </span>
            <div className="search-page__meta">
              <strong>{u.fullName}</strong>
              {u.username ? <span>@{u.username}</span> : null}
            </div>
            <div className="search-page__actions">
              <Link to={`/messages/${u.id}`} className="search-page__message">
                Message
              </Link>
              {u.viewerStatus === "accepted" ? (
                <span className="search-page__status">Following</span>
              ) : (
                <button
                  type="button"
                  className="search-page__follow"
                  disabled={busyId === u.id || u.viewerStatus === "pending"}
                  onClick={() => void onFollow(u)}
                >
                  {u.viewerStatus === "pending"
                    ? "Requested"
                    : busyId === u.id
                      ? "…"
                      : u.canFollowBack
                        ? "Follow back"
                        : "Follow"}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
