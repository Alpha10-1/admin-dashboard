import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Documents from "./pages/Documents";
import Promotions from "./pages/Promotions";
import Admins from "./pages/Admins";
import Support from "./pages/Support";
import Drivers from "./pages/Drivers";
import Riders from "./pages/Riders";
import Content from "./pages/Content";
import Rides from "./pages/Rides";
import Wallets from "./pages/Wallets";
import Sos from "./pages/Sos";
import PricingConfig from "./pages/PricingConfig";
import TestMode from "./pages/TestMode";
import AppShell from "./components/AppShell";

function Gate({ children }: { children: React.ReactNode }) {
  const { loading, admin } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg">
        <div className="live-pulse" />
      </div>
    );
  }

  if (!admin) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <Gate>
            <AppShell>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/drivers" element={<Drivers />} />
                <Route path="/test-mode" element={<TestMode />} />
                <Route path="/riders" element={<Riders />} />
                <Route path="/documents" element={<Documents />} />
                <Route path="/promotions" element={<Promotions />} />
                <Route path="/rides" element={<Rides />} />
                <Route path="/wallets" element={<Wallets />} />
                <Route path="/sos" element={<Sos />} />
                <Route path="/pricing" element={<PricingConfig />} />
                <Route path="/support" element={<Support />} />
                <Route path="/admins" element={<Admins />} />
                <Route path="/content" element={<Content />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppShell>
          </Gate>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
