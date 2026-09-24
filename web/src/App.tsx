import { BrowserRouter } from "react-router-dom";
import { warmUpApi } from "./api/client";
import { AuthProvider } from "./auth/AuthContext";
import { CreateModalProvider } from "./context/CreateModalContext";
import { NotificationPanelProvider } from "./context/NotificationPanelContext";
import { PresenceProvider } from "./context/PresenceContext";
import { AppRoutes } from "./routes/AppRoutes";

warmUpApi();

export default function App() {
  return (
    <AuthProvider>
      <PresenceProvider>
        <BrowserRouter>
          <NotificationPanelProvider>
            <CreateModalProvider>
              <AppRoutes />
            </CreateModalProvider>
          </NotificationPanelProvider>
        </BrowserRouter>
      </PresenceProvider>
    </AuthProvider>
  );
}
