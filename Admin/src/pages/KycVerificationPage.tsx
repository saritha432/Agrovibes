import { useState } from "react";
import { AdminLayout } from "../components/AdminLayout";
import "./KycVerificationPage.css";

type Priority = "High" | "Medium" | "Low";
type KycStatus = "pending" | "approved" | "rejected";

type KycRow = {
  id: string;
  applicant: string;
  role: string;
  document: string;
  submitted: string;
  priority: Priority;
  status: KycStatus;
};

export function KycVerificationPage() {
  const [rows] = useState<KycRow[]>([]);

  return (
    <AdminLayout
      title="KYC Verification"
      titleAccent
      breadcrumbs={[
        { label: "Home", to: "/overview" },
        { label: "Verification" },
        { label: "KYC verification" }
      ]}
    >
      <div className="kyc-page">
        <div className="kyc-table-wrap">
          <table className="kyc-table">
            <thead>
              <tr>
                <th>APPLICANT</th>
                <th>ROLE</th>
                <th>DOCUMENT</th>
                <th>SUBMITTED</th>
                <th>PRIORITY</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="kyc-empty">
                    No KYC submissions yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className={row.status !== "pending" ? `kyc-row--${row.status}` : undefined}>
                    <td>{row.applicant}</td>
                    <td>{row.role}</td>
                    <td>{row.document}</td>
                    <td>{row.submitted}</td>
                    <td>
                      <span className={`kyc-priority kyc-priority--${row.priority.toLowerCase()}`}>{row.priority}</span>
                    </td>
                    <td>
                      {row.status === "pending" ? (
                        <div className="kyc-actions">
                          <button type="button" className="kyc-btn kyc-btn--approve">
                            Approve
                          </button>
                          <button type="button" className="kyc-btn kyc-btn--reject">
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className={`kyc-status kyc-status--${row.status}`}>
                          {row.status === "approved" ? "Approved" : "Rejected"}
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
    </AdminLayout>
  );
}
