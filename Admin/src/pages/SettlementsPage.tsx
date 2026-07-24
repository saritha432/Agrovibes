import { useMemo, useState } from "react";
import { AdminLayout } from "../components/AdminLayout";
import "./SettlementsPage.css";

type SettlementsTab = "payouts" | "refund";
type PayoutStatus = "Approved" | "Pending" | "Completed" | "Processing";

type SettlementRow = {
  id: string;
  payoutId: string;
  userId: string;
  amount: string;
  method: string;
  requested: string;
  status: PayoutStatus;
};

const TABS: { id: SettlementsTab; label: string }[] = [
  { id: "payouts", label: "Payouts" },
  { id: "refund", label: "Refund" }
];

export function SettlementsPage() {
  const [tab, setTab] = useState<SettlementsTab>("payouts");
  const [payoutRows, setPayoutRows] = useState<SettlementRow[]>([]);
  const [refundRows] = useState<SettlementRow[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const rows = tab === "payouts" ? payoutRows : refundRows;
  const pendingCount = useMemo(
    () => payoutRows.filter((row) => row.status === "Pending").length,
    [payoutRows]
  );

  const allSelected = rows.length > 0 && rows.every((row) => selected[row.id]);

  const toggleAll = () => {
    if (allSelected) {
      setSelected({});
      return;
    }
    const next: Record<string, boolean> = {};
    rows.forEach((row) => {
      next[row.id] = true;
    });
    setSelected(next);
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const processRow = (id: string) => {
    setPayoutRows((prev) =>
      prev.map((row) => (row.id === id && row.status === "Pending" ? { ...row, status: "Processing" } : row))
    );
  };

  return (
    <AdminLayout
      title="Settlements"
      titleAccent
      breadcrumbs={[
        { label: "Home", to: "/overview" },
        { label: "User Content" },
        { label: "Settlements" }
      ]}
    >
      <div className="settlements-page">
        <div className="settlements-page__toolbar">
          <div className="settlements-tabs" role="tablist" aria-label="Settlements type">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={`settlements-tabs__btn${tab === item.id ? " is-active" : ""}`}
                onClick={() => {
                  setTab(item.id);
                  setSelected({});
                }}
              >
                {item.label}
                {item.id === "payouts" && pendingCount > 0 ? (
                  <span className="settlements-tabs__badge">{pendingCount}</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        <div className="settlements-table-wrap">
          <table className="settlements-table">
            <thead>
              <tr>
                <th className="settlements-check">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
                </th>
                <th>PAYOUT ID</th>
                <th>USER ID</th>
                <th>AMOUNT</th>
                <th>METHOD</th>
                <th>REQUESTED</th>
                <th>STATUS</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="settlements-empty">
                    {tab === "payouts" ? "No payouts found." : "No refunds found."}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td className="settlements-check">
                      <input
                        type="checkbox"
                        checked={!!selected[row.id]}
                        onChange={() => toggleOne(row.id)}
                        aria-label={`Select ${row.payoutId}`}
                      />
                    </td>
                    <td>{row.payoutId}</td>
                    <td>{row.userId}</td>
                    <td>{row.amount}</td>
                    <td>{row.method}</td>
                    <td>{row.requested}</td>
                    <td>
                      <span className={`settlements-status settlements-status--${row.status.toLowerCase()}`}>
                        {row.status}
                      </span>
                    </td>
                    <td>
                      {row.status === "Pending" ? (
                        <button
                          type="button"
                          className="settlements-process"
                          onClick={() => processRow(row.id)}
                        >
                          Process
                        </button>
                      ) : (
                        <span className="settlements-action-empty">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {rows.length > 0 ? (
          <div className="settlements-pager">
            <button type="button" disabled>
              Previous
            </button>
            <button type="button" disabled>
              Next
            </button>
          </div>
        ) : null}
      </div>
    </AdminLayout>
  );
}
