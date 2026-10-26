import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminLayout } from "../components/AdminLayout";
import { useAuth } from "../auth/AuthContext";
import { fetchAdminBookings, type AdminBookingRow } from "../api/bookings";
import "./ListingsPage.css";

const PAGE_SIZE = 10;

function formatWhen(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function BookingsPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<AdminBookingRow[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || token.startsWith("local-admin-")) {
      setError("Log in with the admin account to load bookings.");
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminBookings(token);
      setRows(data.bookings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bookings");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [page, rows]);

  return (
    <AdminLayout
      title="Bookings"
      titleAccent
      breadcrumbs={[
        { label: "Home", to: "/overview" },
        { label: "User Content" },
        { label: "Bookings" }
      ]}
    >
      <div className="listings-page">
        <div className="listings-table-wrap">
          <table className="listings-table">
            <thead>
              <tr>
                <th>BOOKING</th>
                <th>CUSTOMER</th>
                <th>PLACE</th>
                <th>DATE NEEDED</th>
                <th>NOTE</th>
                <th>REQUESTED</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {error ? (
                <tr>
                  <td colSpan={7} className="listings-empty">
                    {error}
                  </td>
                </tr>
              ) : loading ? (
                <tr>
                  <td colSpan={7} className="listings-empty">
                    Loading bookings…
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="listings-empty">
                    No bookings yet. A customer request will show up here.
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="listings-content">
                        <span className="listings-cat listings-cat--products">{row.category}</span>
                        <strong>{row.title}</strong>
                      </div>
                    </td>
                    <td>
                      <div className="listings-user">
                        <span className="listings-user__text">
                          <strong>{row.customerName}</strong>
                          <em>{row.customerPhone || row.customerEmail || "—"}</em>
                        </span>
                      </div>
                    </td>
                    <td>{row.location || "—"}</td>
                    <td>{row.date || "—"}</td>
                    <td>{row.note || "—"}</td>
                    <td>{formatWhen(row.createdAt)}</td>
                    <td>
                      <span className={`listings-status listings-status--${row.status === "Approved" ? "approved" : "pending"}`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {rows.length > PAGE_SIZE ? (
          <div className="listings-pager">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </button>
            <span>
              {page} / {totalPages}
            </span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              Next
            </button>
          </div>
        ) : null}
      </div>
    </AdminLayout>
  );
}
