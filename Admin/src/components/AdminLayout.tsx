import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { AdminSidebar, ADMIN_NAV_SECTIONS } from "./AdminSidebar";
import "./AdminLayout.css";

const COLLAPSE_KEY = "cropvibe_admin_sidebar_collapsed";

export type AdminBreadcrumb = {
  label: string;
  to?: string;
};

type Props = {
  title: string;
  titleAccent?: boolean;
  breadcrumbs?: AdminBreadcrumb[];
  children?: ReactNode;
};

export function AdminLayout({ title, titleAccent = false, breadcrumbs, children }: Props) {
  const { user, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      // ignore
    }
  }, [collapsed]);

  const filteredHint = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    const matches = ADMIN_NAV_SECTIONS.flatMap((s) => s.items).filter((item) =>
      item.label.toLowerCase().includes(q)
    );
    if (!matches.length) return `No menu items match “${searchQuery.trim()}”.`;
    return `Matches: ${matches.map((m) => m.label).join(", ")}`;
  }, [searchQuery]);

  const initial = String(user?.fullName || user?.email || "A")
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <div
      className={`admin-layout${collapsed ? " admin-layout--collapsed" : ""}${
        breadcrumbs?.length ? " admin-layout--has-crumbs" : ""
      }`}
    >
      <AdminSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <div className="admin-layout__main">
        <header className="admin-layout__topbar">
          <div className="admin-layout__topbar-right">
            <button type="button" className="admin-layout__icon-btn" aria-label="Notifications">
              <img src="/notifications-icon.png" alt="" width={18} height={18} />
            </button>
            <div className="admin-layout__profile">
              <button
                type="button"
                className="admin-layout__avatar"
                aria-label="Account menu"
                onClick={() => setMenuOpen((v) => !v)}
              >
                {initial}
              </button>
              {menuOpen ? (
                <div className="admin-layout__menu">
                  <p>{user?.fullName || user?.email}</p>
                  <button type="button" onClick={signOut}>
                    Log out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {breadcrumbs?.length ? (
          <nav className="admin-layout__crumbbar" aria-label="Breadcrumb">
            <div className="admin-layout__crumbs">
              {breadcrumbs.map((crumb, index) => {
                const isLast = index === breadcrumbs.length - 1;
                return (
                  <span
                    key={`${crumb.label}-${index}`}
                    className={`admin-layout__crumb${isLast ? " is-current" : ""}`}
                  >
                    {index > 0 ? <span className="admin-layout__crumb-sep">{">"}</span> : null}
                    {crumb.to && !isLast ? <Link to={crumb.to}>{crumb.label}</Link> : <span>{crumb.label}</span>}
                  </span>
                );
              })}
            </div>
          </nav>
        ) : null}

        <div className="admin-layout__content">
          <h1 className={`admin-layout__title${titleAccent ? " admin-layout__title--accent" : ""}`}>{title}</h1>
          {filteredHint ? <p className="admin-layout__search-hint">{filteredHint}</p> : null}
          {children}
        </div>
      </div>

      <footer className="admin-layout__footer">
        <span className="admin-layout__footer-brand">CROPVIBE</span>
        <div className="admin-layout__footer-right">
          <span>Copyright {new Date().getFullYear()}</span>
          <a href="https://cropvibe.com/privacy" target="_blank" rel="noreferrer">
            Privacy Policy
          </a>
          <a href="https://cropvibe.com" target="_blank" rel="noreferrer">
            Contact Us
          </a>
          <p className="admin-layout__footer-craft">
            Crafted with <span aria-hidden="true">♥</span> in <em>Hyderabad, India</em>
          </p>
        </div>
      </footer>
    </div>
  );
}
