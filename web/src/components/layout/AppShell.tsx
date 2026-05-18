import { Outlet, useLocation } from "react-router-dom";
import { HomeRightPanel } from "./HomeRightPanel";
import { Sidebar } from "./Sidebar";
import "./AppShell.css";

const RIGHT_PANEL_ROUTES = new Set(["/", "/search", "/reels"]);

export function AppShell() {
  const { pathname } = useLocation();
  const showRightPanel = RIGHT_PANEL_ROUTES.has(pathname);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className={`app-shell__main${showRightPanel ? " app-shell__main--with-right" : ""}`}>
        <div className="app-shell__content">
          <Outlet />
        </div>
        {showRightPanel ? <HomeRightPanel /> : null}
      </div>
    </div>
  );
}
