import { Outlet } from "react-router-dom";
import "./ProviderDashboard.css";

export function ProviderDashboard() {
  return (
    <div className="provider-app">
      <header className="provider-app__top">
        <p className="provider-app__brand">Cropvibe Provider</p>
      </header>
      <div className="provider-app__body">
        <Outlet />
      </div>
    </div>
  );
}
