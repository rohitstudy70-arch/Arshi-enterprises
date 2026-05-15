import { NavLink } from "react-router-dom";


const Sidebar = ({ user, open, onClose, onLogout }) => {
  const links = [
    user?.role === "executive" ? { label: "Executive Panel", to: "/executive" } : null,
    user?.role === "admin" ? { label: "Admin Dashboard", to: "/admin" } : null
  ].filter(Boolean);

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-slate-950/30 transition md:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
      />
      <aside
        className={`fixed left-0 top-0 z-40 flex h-screen w-[min(290px,86vw)] flex-col border-r border-white/10 bg-slate-900 text-white transition-transform duration-300 md:w-[290px] md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="border-b border-white/10 px-4 py-5 sm:px-6 sm:py-7">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 text-lg font-bold text-white shadow-lg">
              AE
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-400">Arshi Enterprises</p>
              <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
            </div>
          </div>
          <p className="mt-4 text-sm text-white/70">
            Signed in as <span className="font-semibold text-white">{user?.username}</span>
          </p>
        </div>

        <nav className="flex-1 space-y-2 px-4 py-6">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={onClose}
              className={({ isActive }) =>
                `block rounded-2xl px-4 py-3 text-sm font-semibold transition ${isActive ? "bg-white text-slate-950" : "text-white/75 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="rounded-3xl bg-white/5 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">{user?.role}</p>
            <p className="mt-2 text-sm text-white/75">Use the sidebar to move between reporting and operations.</p>
            <button type="button" onClick={onLogout} className="mt-4 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-100 transition">
              Logout
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
