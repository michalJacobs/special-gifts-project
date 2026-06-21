import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Gift, UserPlus } from "lucide-react";
import RequiredLabel from "../components/ui/RequiredLabel.jsx";
import Spinner from "../components/ui/Spinner.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    family_id: ""
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function validate() {
    const nextErrors = {};
    const familyId = Number(form.family_id);

    if (!form.name.trim()) {
      nextErrors.name = "יש להזין שם מלא.";
    }
    if (!form.email.trim()) {
      nextErrors.email = "יש להזין כתובת אימייל.";
    } else if (!EMAIL_PATTERN.test(form.email.trim())) {
      nextErrors.email = "יש להזין כתובת אימייל תקינה.";
    }
    if (!form.password) {
      nextErrors.password = "יש להזין סיסמה.";
    }
    if (!form.family_id.trim()) {
      nextErrors.family_id = "יש להזין קוד משפחה.";
    } else if (!Number.isInteger(familyId) || familyId <= 0) {
      nextErrors.family_id = "יש להזין קוד משפחה תקין.";
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
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        family_id: Number(form.family_id)
      });
      await login({
        email: form.email.trim(),
        password: form.password
      });
      navigate("/", { replace: true });
    } catch (registerError) {
      setError(registerError.message);
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
            <h1 className="text-xl font-semibold">הצטרפות למשפחה</h1>
            <p className="text-sm text-stone-600">צרו משתמש חדש והצטרפו למשפחה קיימת בעזרת קוד המשפחה.</p>
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <form className="space-y-4" noValidate onSubmit={handleSubmit}>
          <label className="block">
            <RequiredLabel>שם מלא</RequiredLabel>
            <input className="field" name="name" value={form.name} onChange={updateField} required />
            {fieldErrors.name ? <span className="mt-1 block text-sm text-red-700">{fieldErrors.name}</span> : null}
          </label>

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
              autoComplete="new-password"
              minLength={8}
              value={form.password}
              onChange={updateField}
              required
            />
            {fieldErrors.password ? <span className="mt-1 block text-sm text-red-700">{fieldErrors.password}</span> : null}
          </label>

          <label className="block">
            <RequiredLabel>קוד משפחה</RequiredLabel>
            <input
              className="field"
              name="family_id"
              inputMode="numeric"
              value={form.family_id}
              onChange={updateField}
              required
            />
            {fieldErrors.family_id ? <span className="mt-1 block text-sm text-red-700">{fieldErrors.family_id}</span> : null}
          </label>

          <button className="btn-primary w-full" type="submit" disabled={loading}>
            {loading ? <Spinner /> : <UserPlus className="h-4 w-4" />}
            {loading ? "מצטרף למשפחה..." : "הצטרפות למשפחה"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-stone-600">
          רוצים לפתוח משפחה חדשה?{" "}
          <Link className="font-semibold text-moss hover:text-ink" to="/create-family">
            יצירת משפחה
          </Link>
        </p>
      </section>
    </main>
  );
}
