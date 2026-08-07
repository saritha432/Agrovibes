import { useCallback, useEffect, useState } from "react";
import { AdminLayout } from "../components/AdminLayout";
import { useAuth } from "../auth/AuthContext";
import { fetchAdminKyc, respondAdminKyc, type AdminKycDocument, type AdminKycRow } from "../api/kyc";
import "./KycVerificationPage.css";

function formatSubmitted(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function roleLabel(role: string) {
  const normalized = String(role || "").toLowerCase();
  if (normalized === "service") return "Service Provider";
  if (normalized === "both") return "Rental & Service";
  return "Rental Provider";
}

function registrationTypeLabel(value?: string | null) {
  return String(value || "").toLowerCase() === "business" ? "Business / Company" : "Individual";
}

export function KycVerificationPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<AdminKycRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ docs: AdminKycDocument[]; index: number; applicant: string } | null>(
    null
  );

  const load = useCallback(async () => {
    if (!token) {
      setError("Admin session missing. Please log in again.");
      setLoading(false);
      return;
    }
    if (token.startsWith("local-admin-")) {
      setError("Local admin session cannot load KYC. Log in with a real admin API account.");
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminKyc(token);
      setRows(data.submissions || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load KYC submissions");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 20000);
    return () => window.clearInterval(timer);
  }, [load]);

  const onRespond = async (id: number, action: "approve" | "reject") => {
    if (!token || token.startsWith("local-admin-")) return;
    setBusyId(id);
    try {
      await respondAdminKyc(token, id, action);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to ${action} KYC`);
    } finally {
      setBusyId(null);
    }
  };

  const activeDoc = preview?.docs[preview.index] || null;

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
        {error ? <p className="kyc-error">{error}</p> : null}
        <div className="kyc-table-wrap">
          <table className="kyc-table">
            <thead>
              <tr>
                <th>APPLICANT</th>
                <th>ROLE</th>
                <th>DOCUMENTS</th>
                <th>SUBMITTED</th>
                <th>PRIORITY</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="kyc-empty">
                    Loading KYC submissions…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="kyc-empty">
                    No KYC submissions yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const docs = Array.isArray(row.documents) ? row.documents : [];
                  return (
                    <tr key={row.id} className={row.status !== "pending" ? `kyc-row--${row.status}` : undefined}>
                      <td>
                        <div>{row.applicant}</div>
                        {row.businessName ? <small className="kyc-muted">{row.businessName}</small> : null}
                        {row.gstNumber ? <small className="kyc-muted">GST: {row.gstNumber}</small> : null}
                        {row.email ? <small className="kyc-muted">{row.email}</small> : null}
                        {row.applicantEmail ? <small className="kyc-muted">{row.applicantEmail}</small> : null}
                        {row.phone ? <small className="kyc-muted">{row.phone}</small> : null}
                      </td>
                      <td>
                        <div>{roleLabel(row.role)}</div>
                        <small className="kyc-muted">{registrationTypeLabel(row.registrationType)}</small>
                      </td>
                      <td className="kyc-docs-cell">
                        {docs.length > 0 ? (
                          <div className="kyc-docs">
                            {docs.map((doc, index) => (
                              <button
                                key={`${row.id}-${doc.key}-${index}`}
                                type="button"
                                className="kyc-doc-thumb"
                                title={doc.label}
                                onClick={() =>
                                  setPreview({ docs, index, applicant: row.applicant || "Applicant" })
                                }
                              >
                                <img src={doc.url} alt={doc.label} />
                                <span>{doc.label}</span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="kyc-muted">{row.document || "No images"}</span>
                        )}
                      </td>
                      <td>{formatSubmitted(row.submitted)}</td>
                      <td>
                        <span
                          className={`kyc-priority kyc-priority--${String(row.priority || "medium").toLowerCase()}`}
                        >
                          {row.priority}
                        </span>
                      </td>
                      <td>
                        {row.status === "pending" ? (
                          <div className="kyc-actions">
                            <button
                              type="button"
                              className="kyc-btn kyc-btn--approve"
                              disabled={busyId === row.id}
                              onClick={() => void onRespond(row.id, "approve")}
                            >
                              {busyId === row.id ? "…" : "Approve"}
                            </button>
                            <button
                              type="button"
                              className="kyc-btn kyc-btn--reject"
                              disabled={busyId === row.id}
                              onClick={() => void onRespond(row.id, "reject")}
                            >
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {preview && activeDoc ? (
        <div
          className="kyc-lightbox"
          role="dialog"
          aria-modal="true"
          onClick={() => setPreview(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setPreview(null);
          }}
        >
          <div className="kyc-lightbox__panel" onClick={(e) => e.stopPropagation()}>
            <div className="kyc-lightbox__head">
              <div>
                <strong>{preview.applicant}</strong>
                <p>{activeDoc.label}</p>
              </div>
              <button type="button" className="kyc-lightbox__close" onClick={() => setPreview(null)}>
                Close
              </button>
            </div>
            <img className="kyc-lightbox__img" src={activeDoc.url} alt={activeDoc.label} />
            <div className="kyc-lightbox__nav">
              <button
                type="button"
                disabled={preview.index <= 0}
                onClick={() => setPreview((p) => (p ? { ...p, index: Math.max(0, p.index - 1) } : p))}
              >
                Previous
              </button>
              <span>
                {preview.index + 1} / {preview.docs.length}
              </span>
              <button
                type="button"
                disabled={preview.index >= preview.docs.length - 1}
                onClick={() =>
                  setPreview((p) =>
                    p ? { ...p, index: Math.min(p.docs.length - 1, p.index + 1) } : p
                  )
                }
              >
                Next
              </button>
              <a href={activeDoc.url} target="_blank" rel="noreferrer">
                Open original
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
}
