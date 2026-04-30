import { useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import { useAuth } from "../context/AuthContext";

const TITLES = {
  "/executive": {
    title: "Arshi Enterprises - Executive Panel",
    description: "Add income, add expense, and view your own records."
  },
  "/admin": {
    title: "Arshi Enterprises - Admin Dashboard",
    description: "Manage all business data, export reports, and oversee team records."
  }
};

const AppShell = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const content = useMemo(() => TITLES[location.pathname] || TITLES["/executive"], [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-transparent">
      <Sidebar user={user} open={sidebarOpen} onClose={() => setSidebarOpen(false)} onLogout={handleLogout} />

      <div className="min-w-0 md:pl-[290px]">
        <header className="sticky top-0 z-20 border-b border-line/70 bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4 lg:px-10">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="button-secondary shrink-0 px-4 py-2 md:hidden"
              >
                Menu
              </button>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted">Arshi Enterprises</p>
                <h2 className="truncate text-xl font-bold text-ink sm:max-w-none sm:text-2xl">{content.title}</h2>
              </div>
            </div>

            <div className="hidden items-center gap-3 rounded-full border border-line bg-slate-50/90 px-4 py-2 text-sm text-muted sm:flex">
              <span className="font-semibold text-ink">{user?.username}</span>
              <span className="rounded-full bg-teal/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-teal">
                {user?.role}
              </span>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1500px] px-3 py-4 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
          <div className="mb-5 rounded-3xl border border-line/60 bg-white/70 p-4 shadow-[0_20px_50px_rgba(15,23,42,0.06)] sm:mb-6 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted">Overview</p>
            <p className="mt-2 max-w-3xl text-sm text-muted sm:text-base">{content.description}</p>
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppShell;
