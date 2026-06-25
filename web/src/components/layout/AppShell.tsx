import { Outlet, useLocation } from "react-router-dom";
import { HomeRightPanel } from "./HomeRightPanel";
import { Sidebar } from "./Sidebar";
import "./AppShell.css";

const RIGHT_PANEL_ROUTES = new Set(["/", "/search"]);
const FLUSH_ROUTES = new Set(["/drops", "/reels", "/messages"]);

export function AppShell() {
  const { pathname } = useLocation();
  const showRightPanel = RIGHT_PANEL_ROUTES.has(pathname);
  const flushContent = FLUSH_ROUTES.has(pathname) || pathname.startsWith("/messages/");

  return (
    <div className="app-shell">
      <Sidebar />
      <div className={`app-shell__main${showRightPanel ? " app-shell__main--with-right" : ""}`}>
        <div className={`app-shell__content${flushContent ? " app-shell__content--flush" : ""}`}>
          <Outlet />
        </div>
        {showRightPanel ? <HomeRightPanel /> : null}
      </div>
    </div>
  );
}
