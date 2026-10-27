import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useCreateModal } from "../../context/CreateModalContext";
import { useNotificationPanel } from "../../context/NotificationPanelContext";
import { CountBadge } from "../ui/CountBadge";
import "./Sidebar.css";

const NAV = [
  { to: "/", label: "Home", icon: "home" },
  { to: "/search", label: "Search", icon: "search" },
  { to: "/drops", label: "Drops", icon: "drops" },
  { to: "/messages", label: "Messages", icon: "messages" },
  { to: "/weather", label: "Weather", icon: "weather" },
  { to: "/schemes", label: "Schemes", icon: "schemes" },
  { to: "/notifications", label: "Notifications", icon: "notifications" },
  { to: "/profile", label: "Profile", icon: "profile" }
] as const;

type NavIconName = (typeof NAV)[number]["icon"];

function NavIcon({ name }: { name: NavIconName }) {
  switch (name) {
    case "home":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="m3.2 10.8 8.1-6.4a1.2 1.2 0 0 1 1.5 0l8.1 6.4M5.5 9.7V20a1 1 0 0 0 1 1h4.7v-5.2a1 1 0 0 1 1-1h0.6a1 1 0 0 1 1 1V21h4.7a1 1 0 0 0 1-1V9.7" />
        </svg>
      );
    case "search":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm5.7-2.3L21 21" />
        </svg>
      );
    case "drops":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M3.5 6.5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-11Z" />
          <path d="m10 9 5 3-5 3V9Z" />
        </svg>
      );
    case "messages":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M12 4.2c-4.9 0-8.8 3.2-8.8 7.3 0 2.3 1.2 4.3 3.2 5.7v2.6a.6.6 0 0 0 1 .5l2.8-1.7c.6.1 1.2.2 1.8.2 4.9 0 8.8-3.2 8.8-7.3S16.9 4.2 12 4.2Z" />
        </svg>
      );
    case "weather":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M7.5 16.5a4.5 4.5 0 1 1 1.3-8.8 5.5 5.5 0 0 1 10.4 1.7 3.8 3.8 0 0 1 .3 7.1H7.5Z" />
          <path d="M16.2 6.2a3 3 0 0 0-4.4 2.1" />
        </svg>
      );
    case "schemes":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M7 4.5h10a1.5 1.5 0 0 1 1.5 1.5v13l-6.5-3.2L5.5 19V6A1.5 1.5 0 0 1 7 4.5Z" />
        </svg>
      );
    case "notifications":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M12 3.2a5.8 5.8 0 0 0-5.8 5.8v3.4l-1.4 2.2a1 1 0 0 0 .8 1.6h12.8a1 1 0 0 0 .8-1.6l-1.4-2.2V9a5.8 5.8 0 0 0-5.8-5.8Z" />
          <path d="M10 18.8a2 2 0 0 0 4 0" />
        </svg>
      );
    case "profile":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M12 13.2a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Zm0 1.8c-4.7 0-8.2 2.3-8.2 4.8v.2h16.4v-.2c0-2.5-3.5-4.8-8.2-4.8Z" />
        </svg>
      );
    default:
      return null;
  }
}

const PROVIDER_NAV = [
  { to: "/provider", label: "Overview", end: true, icon: "overview" },
  { to: "/provider/rental", label: "Rentals", end: false, icon: "rentals" },
  { to: "/provider/listings/new", label: "Create", end: true, icon: "create" },
  { to: "/provider/listings", label: "Listing", end: true, icon: "listing" },
  { to: "/provider/services", label: "Services", end: false, icon: "services" },
  { to: "/provider/profile", label: "Profile", end: false, icon: "profile" }
] as const;

function ProviderIcon({ name }: { name: (typeof PROVIDER_NAV)[number]["icon"] }) {
  switch (name) {
    case "overview":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M4.5 4.5h6.5v6.5H4.5V4.5Zm8.5 0h6.5v6.5H13V4.5ZM4.5 13h6.5v6.5H4.5V13Zm8.5 0h6.5v6.5H13V13Z" />
        </svg>
      );
    case "rentals":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M4 16.5h16M6.5 16.5v-4h11v4M8 12.5 10 8h4l2 4.5" />
          <path d="M7.5 16.5a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Zm9 0a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Z" />
        </svg>
      );
    case "create":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      );
    case "listing":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M8 7h11M8 12h11M8 17h11M5 7h.01M5 12h.01M5 17h.01" />
        </svg>
      );
    case "services":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M14.5 6.5a3.5 3.5 0 0 1 5 5L11 20l-4.2 1.2L8 17l6.5-10.5Z" />
          <path d="m13.2 8 2.8 2.8" />
        </svg>
      );
    case "profile":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M12 13.2a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Zm0 1.8c-4.7 0-8.2 2.3-8.2 4.8v.2h16.4v-.2c0-2.5-3.5-4.8-8.2-4.8Z" />
        </svg>
      );
    default:
      return null;
  }
}

function ProviderSidebar() {
  const { signOut } = useAuth();

  return (
    <aside className="sidebar">
      <div className="sidebar__inner">
        <NavLink to="/" className="sidebar__logo" title="Cropvibe feed">
          <img src="/cropvibefavicon.png" alt="" className="sidebar__logo-icon" />
          <img src="/logo-wordmark.png" alt="Cropvibe" className="sidebar__logo-wordmark" />
        </NavLink>

        <nav className="sidebar__nav" aria-label="Provider">
          {PROVIDER_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={item.label}
              className={({ isActive }) => `sidebar__link${isActive ? " sidebar__link--active" : ""}`}
            >
              <span className="sidebar__icon-wrap">
                <span className="sidebar__icon">
                  <ProviderIcon name={item.icon} />
                </span>
              </span>
              <span className="sidebar__label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__footer">
          <NavLink to="/" className="sidebar__link" title="Cropvibe feed">
            <span className="sidebar__icon-wrap">
              <span className="sidebar__icon">
                <NavIcon name="home" />
              </span>
            </span>
            <span className="sidebar__label">Cropvibe</span>
          </NavLink>
          <button type="button" className="sidebar__more-btn" onClick={signOut} title="Log out">
            <span className="sidebar__icon" aria-hidden>
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="19" r="1.5" />
              </svg>
            </span>
            <span className="sidebar__label">Log out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

export function Sidebar() {
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();
  const { openCreate } = useCreateModal();
  const { messageUnreadCount, notificationUnreadCount } = useNotificationPanel();
  const providerDashboard = pathname === "/provider" || (pathname.startsWith("/provider/") && !pathname.startsWith("/provider/join"));
  if (providerDashboard) return <ProviderSidebar />;

  return (
    <aside className="sidebar">
      <div className="sidebar__inner">
        <NavLink to="/" className="sidebar__logo" end title="Cropvibe">
          <img src="/cropvibefavicon.png" alt="" className="sidebar__logo-icon" />
          <img src="/logo-wordmark.png" alt="Cropvibe" className="sidebar__logo-wordmark" />
        </NavLink>

        <nav className="sidebar__nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              title={item.label}
              className={({ isActive }) =>
                `sidebar__link${isActive ? " sidebar__link--active" : ""}`
              }
            >
              <span className="sidebar__icon-wrap">
                <span className={`sidebar__icon${item.icon === "notifications" ? " sidebar__icon--notifications" : ""}`}>
                  <NavIcon name={item.icon} />
                </span>
                {item.icon === "messages" && messageUnreadCount > 0 ? (
                  <CountBadge count={messageUnreadCount} />
                ) : null}
                {item.icon === "notifications" && notificationUnreadCount > 0 ? (
                  <CountBadge count={notificationUnreadCount} />
                ) : null}
              </span>
              <span className="sidebar__label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <button type="button" className="sidebar__create" title="Create" onClick={openCreate}>
          <span className="sidebar__icon">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M12 4.5v15m7.5-7.5h-15" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
          </span>
          <span className="sidebar__label">Create</span>
        </button>

        <div className="sidebar__footer">
          <NavLink to="/profile" className="sidebar__profile">
            <span className="sidebar__avatar">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" />
              ) : (
                <span>{user?.fullName?.charAt(0) || "?"}</span>
              )}
            </span>
            <span className="sidebar__label">
              {user?.username || user?.fullName || "Profile"}
            </span>
          </NavLink>
          <button type="button" className="sidebar__more-btn" onClick={signOut} title="Log out">
            <span className="sidebar__icon" aria-hidden>
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="19" r="1.5" />
              </svg>
            </span>
            <span className="sidebar__label">Log out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
