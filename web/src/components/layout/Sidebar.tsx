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
          <path d="M9.005 22H4.75a.75.75 0 0 1-.75-.75V10.5a1 1 0 0 1 .3-.7l8.25-7.5a1 1 0 0 1 1.35 0l8.25 7.5a1 1 0 0 1 .3.7V21.25a.75.75 0 0 1-.75.75H15v-7.5a1.5 1.5 0 0 0-1.5-1.5h-3A1.5 1.5 0 0 0 9 13.75V22Z" />
        </svg>
      );
    case "search":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M19 10.5A8.5 8.5 0 1 1 10.5 2 8.5 8.5 0 0 1 19 10.5Zm-1.2 9.3 4.2 4.2" />
        </svg>
      );
    case "drops":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M3 5.25A2.25 2.25 0 0 1 5.25 3h13.5A2.25 2.25 0 0 1 21 5.25v13.5A2.25 2.25 0 0 1 18.75 21H5.25A2.25 2.25 0 0 1 3 18.75V5.25Zm6 3 8 4.5-8 4.5V8.25Z" />
        </svg>
      );
    case "messages":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M12 3a8.25 8.25 0 0 0-8.25 8.25c0 4.28 3.26 7.8 7.43 8.24L12 21l.82-1.51c4.17-.44 7.43-3.96 7.43-8.24A8.25 8.25 0 0 0 12 3Z" />
        </svg>
      );
    case "profile":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.5 4.5 0 0 0 12 12Zm0 2.25c-3.04 0-9 1.52-9 4.53V21h18v-2.22c0-3.01-5.96-4.53-9-4.53Z" />
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
          <img src="/cropvibe.png" alt="" className="sidebar__logo-icon" />
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
