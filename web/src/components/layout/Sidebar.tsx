import { NavLink } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useCreateModal } from "../../context/CreateModalContext";
import "./Sidebar.css";

const NAV = [
  { to: "/", label: "Home", icon: "home" },
  { to: "/search", label: "Search", icon: "search" },
  { to: "/drops", label: "Drops", icon: "drops" },
  // { to: "/market", label: "Market", icon: "market" },
  // { to: "/learn", label: "Learn", icon: "learn" },
  { to: "/messages", label: "Messages", icon: "messages" },
  { to: "/profile", label: "Profile", icon: "profile" }
] as const;

function NavIcon({ name }: { name: (typeof NAV)[number]["icon"] }) {
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

export function Sidebar() {
  const { user, signOut } = useAuth();
  const { openCreate } = useCreateModal();

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
              <span className="sidebar__icon">
                <NavIcon name={item.icon} />
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
