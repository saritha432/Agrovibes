import { useAuth } from "../auth/AuthContext";
import "./DashboardPage.css";

export function DashboardPage() {
  const { user, signOut } = useAuth();

  return (
    <div className="admin-dash">
      <header className="admin-dash__header">
        <div className="admin-dash__brand">
          <img src="/cropvibe.png" alt="" width={28} height={28} />
          <span>Cropvibe Admin</span>
        </div>
        <div className="admin-dash__user">
          <span>{user?.fullName || user?.email}</span>
          <button type="button" onClick={signOut}>
            Log out
          </button>
        </div>
      </header>
      <main className="admin-dash__main">
        <h1>Dashboard</h1>
        <p>Admin login is ready. Next we can add users, reports, and moderation tools here.</p>
      </main>
    </div>
  );
}
