import { Link, useNavigate } from "react-router-dom";
import "./SettingsMenuPage.css";

function SettingsSubTopbar({ title, backTo = "/settings" }: { title: string; backTo?: string }) {
  const navigate = useNavigate();
  return (
    <header className="settings-topbar">
      <button
        type="button"
        className="settings-topbar__back"
        onClick={() => navigate(backTo)}
        aria-label="Back"
      >
        ‹
      </button>
      <h1 className="settings-topbar__title">{title}</h1>
      <span className="settings-topbar__spacer" aria-hidden />
    </header>
  );
}

function SettingsLinkRow({ title, to, icon, external }: { title: string; to: string; icon: string; external?: boolean }) {
  const className = "settings-row";
  const content = (
    <>
      <span className="settings-row__icon" aria-hidden>{icon}</span>
      <span className="settings-row__body">
        <span className="settings-row__title">{title}</span>
      </span>
      <span className="settings-row__chevron" aria-hidden>›</span>
    </>
  );

  return (
    <section className="settings-section">
      <div className="settings-section__card">
        {external ? (
          <a className={className} href={to} target="_blank" rel="noreferrer">{content}</a>
        ) : (
          <Link className={className} to={to}>{content}</Link>
        )}
      </div>
    </section>
  );
}

export function AccountCenterPage() {
  return (
    <div className="settings-subpage">
      <SettingsSubTopbar title="Account Center" />
      <div className="settings-subpage__content">
        <SettingsLinkRow icon="👤" title="Profiles & personal details" to="/profile/edit" />
        <SettingsLinkRow icon="🔑" title="Password and security" to="/forgot-password" />
        <SettingsLinkRow icon="👥" title="Manage accounts" to="/delete-account" />
      </div>
    </div>
  );
}

export function AboutSettingsPage() {
  return (
    <div className="settings-subpage">
      <SettingsSubTopbar title="About" />
      <div className="settings-subpage__content">
        <div className="settings-about-logo">
          <div className="settings-about-logo__mark" aria-hidden>🌿</div>
          <h2>Cropvibe</h2>
          <p>Web app</p>
        </div>
        <p className="settings-about-text">
          Cropvibe connects farmers, buyers, and agricultural experts on a single platform. Share knowledge,
          trade produce, learn modern farming techniques, and grow together as a community.
        </p>
        <SettingsLinkRow icon="🛡️" title="Privacy Policy" to="/privacy-policy" />
        <SettingsLinkRow icon="🌐" title="Website" to="https://cropvibe.com" external />
        <SettingsLinkRow icon="✉️" title="Contact Us" to="/contact-support" />
      </div>
    </div>
  );
}
