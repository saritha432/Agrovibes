import { useMemo, useState } from "react";
import { AdminLayout } from "../components/AdminLayout";
import "./TicketsPage.css";

type TicketPriority = "High" | "Medium" | "Low";
type TicketStatus = "Open" | "In Progress" | "Escalated" | "Resolved";

type TicketRow = {
  id: string;
  code: string;
  createdAt: string;
  user: string;
  subject: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  assignee: string;
};

const CATEGORY_OPTIONS = ["All", "Payments", "Orders", "Account", "Technical"] as const;
const STATUS_OPTIONS = ["Status", "Open", "In Progress", "Escalated", "Resolved"] as const;

export function TicketsPage() {
  const [rows] = useState<TicketRow[]>([]);
  const [category, setCategory] = useState<(typeof CATEGORY_OPTIONS)[number]>("All");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("Status");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (category !== "All" && row.category !== category) return false;
      if (status !== "Status" && row.status !== status) return false;
      return true;
    });
  }, [category, rows, status]);

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize) || 1);
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const pageItems = useMemo(() => {
    if (filtered.length === 0) return [] as Array<number | "ellipsis">;
    const items: Array<number | "ellipsis"> = [];
    const max = totalPages;
    const start = Math.max(1, Math.min(page - 2, max - 4));
    for (let i = start; i <= Math.min(max, start + 4); i += 1) items.push(i);
    if (items[items.length - 1] !== max) {
      if ((items[items.length - 1] as number) < max - 1) items.push("ellipsis");
      items.push(max);
    }
    return items;
  }, [filtered.length, page, totalPages]);

  return (
    <AdminLayout
      title="Ticket Queue"
      titleAccent
      breadcrumbs={[
        { label: "Home", to: "/overview" },
        { label: "Help Desk" },
        { label: "Ticket Queue" }
      ]}
    >
      <div className="tickets-page">
        <div className="tickets-page__toolbar">
          <label className="tickets-select">
            <span className="sr-only">Category</span>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as (typeof CATEGORY_OPTIONS)[number]);
                setPage(1);
              }}
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
          <label className="tickets-select">
            <span className="sr-only">Status</span>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as (typeof STATUS_OPTIONS)[number]);
                setPage(1);
              }}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="tickets-table-wrap">
          <table className="tickets-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>USER</th>
                <th>SUBJECT</th>
                <th>CATEGORY</th>
                <th>PRIORITY</th>
                <th>STATUS</th>
                <th>ASSIGNEE</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="tickets-empty">
                    No tickets found.
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <tr key={row.id} className="tickets-row">
                    <td>
                      <div className="tickets-id">
                        <strong>{row.code}</strong>
                        <em>{row.createdAt}</em>
                      </div>
                    </td>
                    <td>{row.user}</td>
                    <td>{row.subject}</td>
                    <td>{row.category}</td>
                    <td>
                      <span className={`tickets-pill tickets-pill--priority-${row.priority.toLowerCase()}`}>
                        {row.priority}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`tickets-pill tickets-pill--status-${row.status.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td>{row.assignee}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 ? (
          <div className="tickets-pager">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </button>
            <div className="tickets-pager__pages">
              {pageItems.map((item, index) =>
                item === "ellipsis" ? (
                  <span key={`e-${index}`} className="tickets-pager__ellipsis">
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
