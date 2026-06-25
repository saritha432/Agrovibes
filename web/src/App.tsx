import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { CreateModalProvider } from "./context/CreateModalContext";
import { NotificationPanelProvider } from "./context/NotificationPanelContext";
import { AppRoutes } from "./routes/AppRoutes";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <NotificationPanelProvider>
          <CreateModalProvider>
            <AppRoutes />
          </CreateModalProvider>
        </NotificationPanelProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}
