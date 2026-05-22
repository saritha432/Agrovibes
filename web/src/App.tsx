import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { LanguageProvider } from "./localization/LanguageContext";
import { AppRoutes } from "./routes/AppRoutes";

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </LanguageProvider>
    </AuthProvider>
  );
}
