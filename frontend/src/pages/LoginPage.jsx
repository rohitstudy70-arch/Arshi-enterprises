import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const LoginPage = () => {
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleChange = (event) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const user = await login(form);
      const fallback = user.role === "admin" ? "/admin" : "/executive";
      const destination = location.state?.from?.pathname || fallback;
      navigate(destination, { replace: true });
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
        "Server is currently unavailable. Please try again later."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(30,64,175,0.18),transparent_26%),radial-gradient(circle_at_right,rgba(217,119,6,0.16),transparent_24%)]" />

      <div className="relative grid w-full max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="hidden rounded-[36px] bg-slate-900 p-10 text-white shadow-float lg:block">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 text-xl font-bold text-white shadow-lg">
              AE
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-400">Arshi Enterprises</p>
          </div>
          <h1 className="mt-8 max-w-lg text-4xl font-bold leading-tight">
            Professional finance management for your business operations.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-white/70">
            Sign in to manage revenue, track dues, monitor expenses, and access role-based reporting.
          </p>
          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-semibold text-white/75">Secure Access</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-semibold text-white/75">Executive Portal</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-semibold text-white/75">Admin Controls</p>
            </div>
          </div>
        </section>

        <section className="panel px-6 py-8 sm:px-10 sm:py-10">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted">Account Access</p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight text-ink">Login</h2>
          <p className="mt-3 text-sm text-muted">Use your username and password to open your workspace.</p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="label" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                name="username"
                className="field"
                value={form.username}
                onChange={handleChange}
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                className="field"
                value={form.password}
                onChange={handleChange}
                autoComplete="current-password"
                required
              />
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            ) : null}

            <button type="submit" className="button-primary w-full" disabled={submitting}>
              {submitting ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};

export default LoginPage;
