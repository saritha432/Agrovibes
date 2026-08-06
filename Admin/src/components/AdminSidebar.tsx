import { NavLink } from "react-router-dom";
import "./AdminSidebar.css";

export type AdminNavItem = {
  to: string;
  label: string;
  icon: string;
};

export type AdminNavSection = {
  id: string;
  title: string;
  items: AdminNavItem[];
};

export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  {
    id: "platform",
    title: "PLATFORM",
    items: [{ to: "/overview", label: "Overview", icon: "/sidebar-icons/overview.png" }]
  },
  {
    id: "verification",
    title: "VERIFICATION",
    items: [
      { to: "/kyc-verification", label: "KYC Verification", icon: "/sidebar-icons/kyc-verifications.png" },
      { to: "/audit-log", label: "Audit Log", icon: "/sidebar-icons/auditlogs.png" }
    ]
  },
  {
    id: "user-content",
    title: "USER & CONTENT",
    items: [
      { to: "/users", label: "Users", icon: "/sidebar-icons/users.png" },
      { to: "/listings", label: "Listings", icon: "/sidebar-icons/listings.png" },
      { to: "/settlements", label: "Settlements", icon: "/sidebar-icons/settlements.png" }
    ]
  },
  {
    id: "help-desk",
    title: "HELP DESK",
    items: [
      { to: "/knowledge-base", label: "Knowledge Base", icon: "/sidebar-icons/knowledge.png" },
      { to: "/tickets", label: "Tickets", icon: "/sidebar-icons/tickets.png" },
      { to: "/disputes", label: "Disputes", icon: "/sidebar-icons/disputes.png" },
      { to: "/live-chat", label: "Live Chat", icon: "/sidebar-icons/live-chat.png" }
    ]
  }
];

type Props = {
  collapsed: boolean;
  onToggle: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  kycPendingCount?: number;
};

export function AdminSidebar({
  collapsed,
  onToggle,
  searchQuery,
  onSearchChange,
  kycPendingCount = 0
}: Props) {
  const platformSection = ADMIN_NAV_SECTIONS[0];
  const otherSections = ADMIN_NAV_SECTIONS.slice(1);

  return (
    <aside className={`admin-sidebar${collapsed ? " admin-sidebar--collapsed" : ""}`}>
      <div className="admin-sidebar__top">
        <button
          type="button"
          className="admin-sidebar__brand"
          onClick={onToggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <img className="admin-sidebar__logo-mark" src="/sidebar-icons/adminlogo.png" alt="Cropvibe" />
          ) : (
            <span className="admin-sidebar__brand-text">
              <img src="/cropvibe.png" alt="CROPVIBE" />
              <span>Admin</span>
            </span>
          )}
        </button>
      </div>

      <nav className="admin-sidebar__nav" aria-label="Admin">
        <div className="admin-sidebar__section">
          {!collapsed ? <p className="admin-sidebar__section-title">PLATFORM</p> : null}

          <label className={`admin-sidebar__search${collapsed ? " admin-sidebar__search--icon" : ""}`}>
            <img src="/sidebar-icons/search.png" alt="" />
            {!collapsed ? (
              <input
                type="search"
                placeholder="Quick Search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            ) : null}
          </label>

          <ul>
            {platformSection.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `admin-sidebar__link${isActive ? " admin-sidebar__link--active" : ""}`
                  }
                  title={item.label}
                >
                  <img src={item.icon} alt="" />
                  {!collapsed ? <span>{item.label}</span> : null}
                </NavLink>
              </li>
            ))}
          </ul>
          {collapsed ? <div className="admin-sidebar__divider" /> : null}
        </div>

        {otherSections.map((section) => (
          <div key={section.id} className="admin-sidebar__section">
            {!collapsed ? <p className="admin-sidebar__section-title">{section.title}</p> : null}
            <ul>
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `admin-sidebar__link${isActive ? " admin-sidebar__link--active" : ""}`
                    }
                    title={item.label}
                  >
                    <img src={item.icon} alt="" />
                    {!collapsed ? <span>{item.label}</span> : null}
                    {!collapsed && item.to === "/kyc-verification" && kycPendingCount > 0 ? (
                      <span className="admin-sidebar__badge">{kycPendingCount > 9 ? "9+" : kycPendingCount}</span>
                    ) : null}
                  </NavLink>
                </li>
              ))}
            </ul>
            {collapsed ? <div className="admin-sidebar__divider" /> : null}
          </div>
        ))}
      </nav>
    </aside>
  );
}
