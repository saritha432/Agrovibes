import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { KycVerificationPage } from "./pages/KycVerificationPage";
import { UsersPage } from "./pages/UsersPage";
import { ListingsPage } from "./pages/ListingsPage";
import { SettlementsPage } from "./pages/SettlementsPage";
import { DisputesPage } from "./pages/DisputesPage";
import { TicketsPage } from "./pages/TicketsPage";
import { LiveChatPage } from "./pages/LiveChatPage";

function Protected({ children }: { children: ReactNode }) {
  const { token, loading } = useAuth();
  if (loading) return <div className="boot-loading">Loading…</div>;
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <Protected>
            <Navigate to="/overview" replace />
          </Protected>
        }
      />
      <Route
        path="/overview"
        element={
          <Protected>
            <DashboardPage />
          </Protected>
        }
      />
      <Route
        path="/kyc-verification"
        element={
          <Protected>
            <KycVerificationPage />
          </Protected>
        }
      />
      <Route
        path="/audit-log"
        element={
          <Protected>
            <PlaceholderPage title="Audit Log" description="Track admin actions and system events." />
          </Protected>
        }
      />
      <Route
        path="/users"
        element={
          <Protected>
            <UsersPage />
          </Protected>
        }
      />
      <Route
        path="/listings"
        element={
          <Protected>
            <ListingsPage />
          </Protected>
        }
      />
      <Route
        path="/settlements"
        element={
          <Protected>
            <SettlementsPage />
          </Protected>
        }
      />
      <Route
        path="/knowledge-base"
        element={
          <Protected>
            <PlaceholderPage title="Knowledge Base" description="Manage help articles and FAQs." />
          </Protected>
        }
      />
      <Route
        path="/tickets"
        element={
          <Protected>
            <TicketsPage />
          </Protected>
        }
      />
      <Route
        path="/disputes"
        element={
          <Protected>
            <DisputesPage />
          </Protected>
        }
      />
      <Route
        path="/live-chat"
        element={
          <Protected>
            <LiveChatPage />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/overview" replace />} />
    </Routes>
  );
}
