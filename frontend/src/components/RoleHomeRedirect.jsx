import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const RoleHomeRedirect = () => {
  const { loading, isAuthenticated, user } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="panel px-8 py-6 text-sm font-semibold text-muted">Loading workspace...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={user?.role === "admin" ? "/admin" : "/executive"} replace />;
};

export default RoleHomeRedirect;
