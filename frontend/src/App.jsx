import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicOnlyRoute from "./components/PublicOnlyRoute";
import RoleHomeRedirect from "./components/RoleHomeRedirect";
import { AuthProvider } from "./context/AuthContext";
import AdminPanelPage from "./pages/AdminPanelPage";
import LoginPage from "./pages/LoginPage";
import ExecutivePanelPage from "./pages/ExecutivePanelPage";

const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true
        }}
      >
        <Routes>
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route index element={<RoleHomeRedirect />} />
              <Route path="/dashboard" element={<RoleHomeRedirect />} />
              <Route element={<ProtectedRoute allowedRoles={["executive"]} />}>
                <Route path="/executive" element={<ExecutivePanelPage />} />
              </Route>
              <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
                <Route path="/admin" element={<AdminPanelPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
