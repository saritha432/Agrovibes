import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/layout/AppShell";
import { HomePage } from "../pages/HomePage";
import { LoginPage } from "../pages/LoginPage";
import { MessagesPage } from "../pages/MessagesPage";
import { MessagesChat } from "../pages/messages/MessagesChat";
import { MessagesChatPlaceholder } from "../pages/messages/MessagesChatPlaceholder";
import { PlaceholderPage } from "../pages/PlaceholderPage";
import { EditProfilePage } from "../pages/EditProfilePage";
import { ProfilePage } from "../pages/ProfilePage";
import { ReelsPage } from "../pages/ReelsPage";
import { SearchPage } from "../pages/SearchPage";

function ProtectedLayout() {
  const { token, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#262626" }}>
        Loading...
      </div>
    );
  }
  if (!token) return <Navigate to="/login" replace />;
  return <AppShell />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedLayout />}>
        <Route index element={<HomePage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="reels" element={<ReelsPage />} />
        <Route
          path="market"
          element={
            <PlaceholderPage
              title="Market"
              description="Marketplace listings — connect your shop catalog here next."
            />
          }
        />
        <Route
          path="learn"
          element={
            <PlaceholderPage title="Learn" description="Courses and lessons from the Cropvibe learn hub." />
          }
        />
        <Route path="messages" element={<MessagesPage />}>
          <Route index element={<MessagesChatPlaceholder />} />
          <Route path=":peerUserId" element={<MessagesChat />} />
        </Route>
        <Route path="profile" element={<ProfilePage />} />
        <Route path="profile/edit" element={<EditProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
