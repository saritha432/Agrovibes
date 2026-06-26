import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/layout/AppShell";
import { HomePage } from "../pages/HomePage";
import { LoginPage } from "../pages/LoginPage";
import { MessagesPage } from "../pages/MessagesPage";
import { MessagesChat } from "../pages/messages/MessagesChat";
import { MessagesChatPlaceholder } from "../pages/messages/MessagesChatPlaceholder";
import { NotificationsPage } from "../pages/NotificationsPage";
import { PlaceholderPage } from "../pages/PlaceholderPage";
import { ForgotPasswordPage } from "../pages/ForgotPasswordPage";
import { EditProfilePage } from "../pages/EditProfilePage";
import { ProfilePage } from "../pages/ProfilePage";
import { ReelsPage } from "../pages/ReelsPage";
import { ReelWatchPage } from "../pages/ReelWatchPage";
import { SearchPage } from "../pages/SearchPage";
import { PrivacyPolicy } from "../pages/PrivacyPolicy";
import { DeleteAccount } from "../pages/DeleteAccount";
import { ChildSafety } from "../pages/ChildSafety";

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
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/delete-account" element={<DeleteAccount />} />
      <Route path="/child-safety" element={<ChildSafety />} />
      <Route path="/watch/:postId" element={<ReelWatchPage />} />
      <Route element={<ProtectedLayout />}>
        <Route index element={<HomePage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="drops" element={<ReelsPage />} />
        <Route path="reels" element={<Navigate to="/drops" replace />} />
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
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="profile/edit" element={<EditProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
