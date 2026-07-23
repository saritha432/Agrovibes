import { useMemo, useState } from "react";
import { AdminLayout } from "../components/AdminLayout";
import "./DisputesPage.css";

type DisputeStatus = "Open" | "Reviewed" | "Pending";
type DisputePriority = "High" | "Medium" | "Low";

type DisputeParty = {
  name: string;
  role: string;
  avatarUrl?: string | null;
};

type DisputeEvidence = {
  id: string;
  docId: string;
  previewUrl?: string | null;
};

type DisputeMessage = {
  id: string;
  author: string;
  role: "Renter" | "Owner" | "Admin";
  text: string;
  when: string;
};

type DisputeItem = {
  id: string;
  code: string;
  title: string;
  summary: string;
  evidenceCount: number;
  status: DisputeStatus;
  priority: DisputePriority;
  renter: DisputeParty;
  owner: DisputeParty;
  amountDisputed: string;
  evidence: DisputeEvidence[];
  messages: DisputeMessage[];
};

export function DisputesPage() {
  const [items] = useState<DisputeItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId]
  );

  return (
    <AdminLayout
      title="Disputes"
      titleAccent
      breadcrumbs={[
        { label: "Home", to: "/overview" },
        { label: "Help Desk" },
        { label: "Disputes" }
      ]}
    >
      <div className="disputes-page">
        <aside className="disputes-list">
          {items.length === 0 ? (
            <div className="disputes-empty">No disputes found.</div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`disputes-card${selectedId === item.id ? " is-active" : ""}`}
                onClick={() => setSelectedId(item.id)}
              >
                <span className="disputes-card__code">{item.code}</span>
                <strong>{item.title}</strong>
                <em>{item.summary}</em>
                <div className="disputes-card__badges">
                  <span className="disputes-badge disputes-badge--evidence">{item.evidenceCount} Evidence</span>
                  <span className={`disputes-badge disputes-badge--status-${item.status.toLowerCase()}`}>
                    {item.status}
                  </span>
                  <span className={`disputes-badge disputes-badge--priority-${item.priority.toLowerCase()}`}>
                    {item.priority}
                  </span>
                </div>
              </button>
            ))
          )}
        </aside>

        <section className="disputes-detail">
          {!selected ? (
            <div className="disputes-empty disputes-empty--detail">
              {items.length === 0 ? "Disputes will appear here when submitted." : "Select a dispute to view details."}
            </div>
          ) : (
            <>
              <header className="disputes-detail__header">
                <div>
                  <p className="disputes-detail__code">{selected.code}</p>
                  <h2>{selected.title}</h2>
                  <p className="disputes-detail__summary">{selected.summary}</p>
                </div>
                <div className="disputes-card__badges">
                  <span className="disputes-badge disputes-badge--evidence">{selected.evidenceCount} Evidence</span>
                  <span className={`disputes-badge disputes-badge--status-${selected.status.toLowerCase()}`}>
                    {selected.status}
                  </span>
                  <span className={`disputes-badge disputes-badge--priority-${selected.priority.toLowerCase()}`}>
                    {selected.priority}
                  </span>
                </div>
              </header>

              <div className="disputes-parties">
                <div className="disputes-party">
                  <span className="disputes-party__avatar">
                    {selected.renter.avatarUrl ? <img src={selected.renter.avatarUrl} alt="" /> : null}
                  </span>
                  <div>
                    <p className="disputes-party__label">Renter</p>
                    <strong>{selected.renter.name}</strong>
                  </div>
                </div>
                <div className="disputes-party">
                  <span className="disputes-party__avatar">
                    {selected.owner.avatarUrl ? <img src={selected.owner.avatarUrl} alt="" /> : null}
                  </span>
                  <div>
                    <p className="disputes-party__label">Equipment Owner</p>
                    <strong>{selected.owner.name}</strong>
                  </div>
                </div>
                <div className="disputes-party disputes-party--amount">
                  <span className="disputes-party__icon" aria-hidden="true">
                    ₹
                  </span>
                  <div>
                    <p className="disputes-party__label">Amount Disputed</p>
                    <strong>{selected.amountDisputed}</strong>
                  </div>
                </div>
              </div>

              <section className="disputes-section">
                <h3>EVIDENCE ({selected.evidence.length})</h3>
                {selected.evidence.length === 0 ? (
                  <p className="disputes-section__empty">No evidence uploaded.</p>
                ) : (
                  <div className="disputes-evidence">
                    {selected.evidence.map((doc) => (
                      <article key={doc.id} className="disputes-evidence__card">
                        <p>{doc.docId}</p>
                        <div className="disputes-evidence__preview">
                          {doc.previewUrl ? <img src={doc.previewUrl} alt="" /> : null}
                        </div>
                        <button type="button" className="disputes-evidence__download">
                          DOWNLOAD
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="disputes-section">
                <h3>CONVERSATION TIMELINE</h3>
                {selected.messages.length === 0 ? (
                  <p className="disputes-section__empty">No messages yet.</p>
                ) : (
                  <div className="disputes-timeline">
                    {selected.messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`disputes-msg${msg.role === "Admin" ? " disputes-msg--admin" : ""}`}
                      >
                        <div className="disputes-msg__meta">
                          <strong>{msg.author}</strong>
                          <span>{msg.role}</span>
                          <em>{msg.when}</em>
                        </div>
                        <p>{msg.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
