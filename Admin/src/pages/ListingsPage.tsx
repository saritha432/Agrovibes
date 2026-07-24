import { useMemo, useState } from "react";
import { AdminLayout } from "../components/AdminLayout";
import "./ListingsPage.css";

type ListingStatus = "Pending" | "Approved" | "Unpublished";
type ListingCategory = "Products" | "Services" | "Education";

type ListingRow = {
  id: string;
  category: ListingCategory;
  title: string;
  subtitle: string;
  submitterName: string;
  submitterEmail: string;
  submitterAvatarUrl?: string | null;
  date: string;
  flags: number;
  status: ListingStatus;
};

const PAGE_SIZE = 10;

export function ListingsPage() {
  const [rows, setRows] = useState<ListingRow[]>([]);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [page, rows]);

  const setStatus = (id: string, status: ListingStatus) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, status } : row)));
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
              {pageRows.length === 0 ? (
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
                    <td>{row.date}</td>
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
                          disabled={row.status === "Approved"}
                          onClick={() => setStatus(row.id, "Approved")}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="listings-btn listings-btn--unpublish"
                          disabled={row.status === "Unpublished"}
                          onClick={() => setStatus(row.id, "Unpublished")}
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
