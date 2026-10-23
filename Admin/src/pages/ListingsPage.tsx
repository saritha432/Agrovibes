import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminLayout } from "../components/AdminLayout";
import { useAuth } from "../auth/AuthContext";
import { fetchAdminListings, respondAdminListing, type AdminListingRow } from "../api/listings";
import "./ListingsPage.css";

type ListingRow = AdminListingRow;

const PAGE_SIZE = 10;

function formatSubmitted(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function ListingsPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<ListingRow[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token || token.startsWith("local-admin-")) {
      setError("Log in with the admin account to load listings.");
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminListings(token);
      setRows(data.listings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load listings");
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

  const setStatus = async (id: number, action: "approve" | "unpublish") => {
    if (!token || token.startsWith("local-admin-")) return;
    setBusyId(id);
    setError(null);
    try {
      await respondAdminListing(token, id, action);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update listing");
    } finally {
      setBusyId(null);
    }
  };

  const pageItems = useMemo(() => {
    if (rows.length === 0) return [] as Array<number | "ellipsis">;
    const items: Array<number | "ellipsis"> = [];
    const max = totalPages;
    const windowStart = Math.max(1, Math.min(page - 2, max - 4));
    for (let i = windowStart; i <= Math.min(max, windowStart + 4); i += 1) items.push(i);
    if (items[items.length - 1] !== max) {
      if ((items[items.length - 1] as number) < max - 1) items.push("ellipsis");
      items.push(max);
    }
    return items;
  }, [page, rows.length, totalPages]);

  return (
    <AdminLayout
      title="Listing"
      titleAccent
      breadcrumbs={[
        { label: "Home", to: "/overview" },
        { label: "User Content" },
        { label: "Listing" }
      ]}
    >
      <div className="listings-page">
        <div className="listings-table-wrap">
          <table className="listings-table">
            <thead>
              <tr>
                <th>CONTENT</th>
                <th>SUBMITTED BY</th>
                <th>DATE</th>
                <th>FLAGS</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {error ? (
                <tr>
                  <td colSpan={6} className="listings-empty">
                    {error}
                  </td>
                </tr>
              ) : loading ? (
                <tr>
                  <td colSpan={6} className="listings-empty">
                    Loading listings…
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="listings-empty">
                    No listings found.
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="listings-content">
                        <span className={`listings-cat listings-cat--${row.category.toLowerCase()}`}>
                          {row.category}
                        </span>
                        <strong>{row.title}</strong>
                        <em>{row.subtitle}</em>
                      </div>
                    </td>
                    <td>
                      <div className="listings-user">
                        <span className="listings-user__avatar">
                          {row.submitterAvatarUrl ? <img src={row.submitterAvatarUrl} alt="" /> : null}
                        </span>
                        <span className="listings-user__text">
                          <strong>{row.submitterName}</strong>
                          <em>{row.submitterEmail}</em>
                        </span>
                      </div>
                    </td>
                    <td>{formatSubmitted(row.date)}</td>
                    <td>
                      {row.flags > 0 ? (
                        <span className="listings-flag">{row.flags}</span>
                      ) : (
                        <span className="listings-flag-empty">—</span>
                      )}
                    </td>
                    <td>
                      <span className={`listings-status listings-status--${row.status.toLowerCase()}`}>
                        {row.status}
                      </span>
                    </td>
                    <td>
                      <div className="listings-actions">
                        <button
                          type="button"
                          className="listings-btn listings-btn--approve"
                          disabled={row.status === "Approved" || busyId === row.id}
                          onClick={() => void setStatus(row.id, "approve")}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="listings-btn listings-btn--unpublish"
                          disabled={row.status === "Unpublished" || busyId === row.id}
                          onClick={() => void setStatus(row.id, "unpublish")}
                        >
                          Unpublish
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {rows.length > 0 ? (
          <div className="listings-pager">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </button>
            <div className="listings-pager__pages">
              {pageItems.map((item, index) =>
                item === "ellipsis" ? (
                  <span key={`e-${index}`} className="listings-pager__ellipsis">
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    className={item === page ? "is-active" : undefined}
                    onClick={() => setPage(item)}
                  >
                    {String(item).padStart(2, "0")}
                  </button>
                )
              )}
            </div>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </AdminLayout>
  );
}
