import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { CreateModalProvider } from "./context/CreateModalContext";
import { AppRoutes } from "./routes/AppRoutes";

export default function App() {
  return (
    <AuthProvider>
      <CreateModalProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </CreateModalProvider>
    </AuthProvider>
  );
}
