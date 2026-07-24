import type { AdminUserProfile } from "../types/adminUser";
import "./UserProfileDrawer.css";

type Props = {
  user: AdminUserProfile | null;
  open: boolean;
  onClose: () => void;
};

function DetailItem({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="user-drawer__detail">
      <span className="user-drawer__detail-icon" aria-hidden="true" />
      <div>
        <p className="user-drawer__detail-label">{label}</p>
        <p className={`user-drawer__detail-value${accent ? " is-accent" : ""}`}>{value || "—"}</p>
      </div>
    </div>
  );
}

export function UserProfileDrawer({ user, open, onClose }: Props) {
  if (!open || !user) return null;

  const flagItems = user.flagItems || [];
  const kycItems = user.kycItems || [];

  return (
    <div className="user-drawer" role="dialog" aria-modal="true" aria-label="User Profile">
      <button type="button" className="user-drawer__backdrop" aria-label="Close profile" onClick={onClose} />
      <aside className="user-drawer__panel">
        <header className="user-drawer__header">
          <button type="button" className="user-drawer__back" onClick={onClose} aria-label="Back">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h2>User Profile</h2>
        </header>

        <div className="user-drawer__hero">
          <div className="user-drawer__avatar">
            {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : null}
          </div>
          <div>
            <h3>{user.name}</h3>
            <p>{user.role}</p>
          </div>
        </div>

        <section className="user-drawer__card">
          <h4>APPLICANT DETAILS</h4>
          <div className="user-drawer__grid">
            <DetailItem label="Phone" value={user.phone || "—"} />
            <DetailItem label="Email" value={user.email || "—"} />
            <DetailItem label="Location" value={user.location || user.region || "—"} />
            <DetailItem label="Farmer ID" value={user.farmerId || "—"} />
            <DetailItem label="PAN" value={user.pan || "—"} />
            <DetailItem label="Aadhaar" value={user.aadhaar || "—"} />
            <DetailItem label="Joined" value={user.joined || "—"} />
            <DetailItem label="Status" value={user.accountStatus} accent={user.accountStatus === "Active"} />
          </div>
        </section>

        <section className="user-drawer__card">
          <h4>
            FLAGS
            {user.flags > 0 ? <span className="user-drawer__badge">{user.flags}</span> : null}
          </h4>
          {flagItems.length === 0 ? (
            <p className="user-drawer__empty">No flags.</p>
          ) : (
            <ul className="user-drawer__flags">
              {flagItems.map((item) => (
                <li key={item.id}>
                  <span>{item.label}</span>
                  <em>{item.when}</em>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="user-drawer__card">
          <h4>KYC</h4>
          {kycItems.length === 0 ? (
            <p className="user-drawer__empty">No KYC documents.</p>
          ) : (
            <ul className="user-drawer__kyc">
              {kycItems.map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>{item.label}</strong>
                    <em>{item.value || "—"}</em>
                  </div>
                  <span className={`user-drawer__kyc-status user-drawer__kyc-status--${item.status.toLowerCase()}`}>
                    {item.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}
