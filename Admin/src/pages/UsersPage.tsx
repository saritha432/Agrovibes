import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "../components/AdminLayout";
import { UserProfileDrawer } from "../components/UserProfileDrawer";
import { useAuth } from "../auth/AuthContext";
import type { AccountStatus, AdminUserProfile, KycStatus } from "../types/adminUser";
import "./UsersPage.css";

type AccountFilter = "all" | "active" | "suspended" | "pending" | "banned";

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
  "https://agrovibes.onrender.com/api";

const FILTERS: { id: AccountFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "suspended", label: "suspended" },
  { id: "pending", label: "Pending" },
  { id: "banned", label: "Banned" }
];

function formatJoined(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toISOString().slice(0, 10);
}

function mapApiUser(row: Record<string, unknown>): AdminUserProfile {
  const id = String(row.id ?? "");
  const role = String(row.role || "User");
  const accountStatus = "Active" as AccountStatus;
  const kycStatus = "Pending" as KycStatus;
  return {
    id,
    name: String(row.fullName || row.username || "User"),
    email: String(row.email || "—"),
    avatarUrl: (row.avatarUrl as string | null | undefined) || null,
    userId: id ? `USR-${id}` : "—",
    role: role.charAt(0).toUpperCase() + role.slice(1),
    region: String(row.locationLabel || "—"),
    joined: formatJoined(row.createdAt),
    kycStatus,
    flags: 0,
    accountStatus,
    phone: String(row.phone || "—"),
    location: String(row.locationLabel || "—"),
    farmerId: "—",
    pan: "—",
    aadhaar: "—",
    flagItems: [],
    kycItems: []
  };
}

export function UsersPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<AdminUserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<AccountFilter>("all");
  const [selected, setSelected] = useState<AdminUserProfile | null>(null);

  useEffect(() => {
    if (!token || token.startsWith("local-admin-")) {
      setRows([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const response = await fetch(`${API_BASE}/v1/admin/users?limit=100`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const body = (await response.json().catch(() => ({}))) as {
          message?: string;
          users?: Record<string, unknown>[];
        };
        if (!response.ok) {
          throw new Error(body.message || `Failed to load users (${response.status})`);
        }
        if (cancelled) return;
        setRows((body.users || []).map(mapApiUser));
      } catch (err) {
        if (!cancelled) {
          setRows([]);
          setError(err instanceof Error ? err.message : "Failed to load users");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const visibleRows = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((row) => row.accountStatus.toLowerCase() === filter);
  }, [filter, rows]);

  return (
    <AdminLayout
      title="Users"
      titleAccent
      breadcrumbs={[
        { label: "Home", to: "/overview" },
        { label: "User Content" },
        { label: "Users" }
      ]}
    >
      <div className="users-page">
        <div className="users-page__toolbar">
          <div className="users-filters" role="tablist" aria-label="Account status">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={filter === item.id}
                className={`users-filters__btn${filter === item.id ? " is-active" : ""}`}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {error ? <p className="users-error">{error}</p> : null}

        <div className="users-table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th>NAME</th>
                <th>USER ID</th>
                <th>ROLE</th>
                <th>REGION</th>
                <th>JOINED</th>
                <th>KYC STATUS</th>
                <th>FLAGS</th>
                <th>ACCOUNT STATUS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="users-empty">
                    Loading users…
                  </td>
                </tr>
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="users-empty">
                    No users found.
                  </td>
                </tr>
              ) : (
                visibleRows.map((row) => (
                  <tr key={row.id} className="users-row" onClick={() => setSelected(row)}>
                    <td>
                      <div className="users-name">
                        <span className="users-name__avatar">
                          {row.avatarUrl ? <img src={row.avatarUrl} alt="" /> : null}
                        </span>
                        <span className="users-name__text">
                          <strong>{row.name}</strong>
                          <em>{row.email}</em>
                        </span>
                      </div>
                    </td>
                    <td>{row.userId}</td>
                    <td>{row.role}</td>
                    <td>{row.region}</td>
                    <td>{row.joined}</td>
                    <td>
                      <span className={`users-pill users-pill--kyc-${row.kycStatus.toLowerCase()}`}>
                        {row.kycStatus}
                      </span>
                    </td>
                    <td>
                      {row.flags > 0 ? (
                        <span className="users-flag">{row.flags}</span>
                      ) : (
                        <span className="users-flag-empty">—</span>
                      )}
                    </td>
                    <td>
                      {row.accountStatus === "Suspended" ? (
                        <span className="users-status-text">{row.accountStatus}</span>
                      ) : (
                        <span className={`users-pill users-pill--account-${row.accountStatus.toLowerCase()}`}>
                          {row.accountStatus}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <UserProfileDrawer user={selected} open={!!selected} onClose={() => setSelected(null)} />
    </AdminLayout>
  );
}
