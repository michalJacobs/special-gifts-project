import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Gift, LogIn } from "lucide-react";
import RequiredLabel from "../components/ui/RequiredLabel.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function validate() {
    const nextErrors = {};
    if (!form.email.trim()) {
      nextErrors.email = "יש להזין כתובת אימייל.";
    } else if (!EMAIL_PATTERN.test(form.email.trim())) {
      nextErrors.email = "יש להזין כתובת אימייל תקינה.";
    }
    if (!form.password) {
      nextErrors.password = "יש להזין סיסמה.";
    }
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) {
      return;
    }

    setError("");
    setLoading(true);

    try {
      await login(form);
      navigate("/", { replace: true });
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[linear-gradient(135deg,#f8faf7_0%,#edf6ef_55%,#fff8ed_100%)] p-4">
      <section className="panel w-full max-w-md p-6">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-mint text-moss">
            <Gift className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">קופת המתנות המשפחתית</h1>
            <p className="text-sm text-stone-600">התחברו או פתחו משפחה חדשה.</p>
          </div>
        </div>

        <div className="mb-6 grid gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-moss bg-mint px-3 py-2 text-center text-sm font-semibold text-moss">
            התחברות
          </div>
          <Link className="btn-secondary" to="/create-family">
            יצירת משפחה חדשה
          </Link>
        </div>

        {error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <form className="space-y-4" noValidate onSubmit={handleSubmit}>
          <label className="block">
            <RequiredLabel>אימייל</RequiredLabel>
            <input
              className="field"
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={updateField}
              required
            />
            {fieldErrors.email ? <span className="mt-1 block text-sm text-red-700">{fieldErrors.email}</span> : null}
          </label>

          <label className="block">
            <RequiredLabel>סיסמה</RequiredLabel>
            <input
              className="field"
              name="password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={updateField}
              required
            />
            {fieldErrors.password ? <span className="mt-1 block text-sm text-red-700">{fieldErrors.password}</span> : null}
          </label>

          <button className="btn-primary w-full" type="submit" disabled={loading}>
            {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <LogIn className="h-4 w-4" />}
            {loading ? "מתחבר..." : "התחברות"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-stone-600">
          קיבלתם הזמנה למשפחה קיימת?{" "}
          <Link className="font-semibold text-moss hover:text-ink" to="/register">
            הצטרפות למשפחה
          </Link>
        </p>
      </section>
    </main>
  );
}
