import { NavLink, Outlet } from "react-router-dom";
import "./ProviderDashboard.css";

const TABS = [
  { to: "/provider", label: "Overview", end: true },
  { to: "/provider/rental", label: "Rental", end: false },
  { to: "/provider/listings", label: "Listing", end: false },
  { to: "/provider/services", label: "Services", end: false },
  { to: "/provider/profile", label: "Profile", end: false }
];

export function ProviderDashboard() {
  return (
    <div className="provider-app">
      <header className="provider-app__top">
        <p className="provider-app__brand">Cropvibe Provider</p>
      </header>
      <div className="provider-app__body">
        <Outlet />
      </div>
      <nav className="provider-app__tabs" aria-label="Provider">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => `provider-app__tab${isActive ? " is-active" : ""}`}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
