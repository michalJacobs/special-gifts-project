import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle, Copy, Gift, UserPlus } from "lucide-react";
import RequiredLabel from "../components/ui/RequiredLabel.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { copyText } from "../utils/clipboard.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function CreateFamily() {
  const navigate = useNavigate();
  const { activateAccessToken, createFamily } = useAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    family_name: ""
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [createdFamily, setCreatedFamily] = useState(null);
  const [pendingToken, setPendingToken] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState(false);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function validate() {
    const nextErrors = {};
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
    if (!form.family_name.trim()) {
      nextErrors.family_name = "יש להזין שם משפחה.";
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
    setCopied(false);
    setLoading(true);

    try {
      const result = await createFamily(
        {
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          family_name: form.family_name.trim()
        },
        { activate: false }
      );
      setCreatedFamily(result.family);
      setPendingToken(result.access_token);
    } catch (createError) {
      setError(createError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyFamilyCode() {
    if (!createdFamily?.id) {
      return;
    }

    await copyText(String(createdFamily.id));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function enterDashboard() {
    if (!pendingToken) {
      return;
    }

    setActivating(true);
    try {
      await activateAccessToken(pendingToken);
      navigate("/", { replace: true });
    } catch (activationError) {
      setError(activationError.message);
      setActivating(false);
    }
  }

  if (createdFamily) {
    return (
      <main className="grid min-h-screen place-items-center bg-[linear-gradient(135deg,#f8faf7_0%,#edf6ef_55%,#fff8ed_100%)] p-4">
        <section className="panel w-full max-w-lg overflow-hidden">
          <div className="bg-moss px-6 py-5 text-white">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8" />
              <div>
                <h1 className="text-2xl font-semibold">המשפחה נוצרה בהצלחה!</h1>
                <p className="text-sm text-white/85">שתפו את הקוד עם שאר חברי המשפחה.</p>
              </div>
            </div>
          </div>

          <div className="space-y-5 p-6">
            <div className="rounded-lg border border-moss bg-mint p-5 text-center">
              <p className="mb-2 text-sm font-medium text-stone-700">קוד המשפחה שלכם הוא</p>
              <div className="flex items-center justify-center gap-2">
                <span className="rounded-md bg-white px-5 py-3 text-4xl font-bold tracking-widest text-moss shadow-sm">
                  {createdFamily.id}
                </span>
                <button
                  className="btn-secondary h-12 w-12 px-0"
                  type="button"
                  onClick={handleCopyFamilyCode}
                  aria-label="העתקת קוד משפחה"
                  title="העתקת קוד משפחה"
                >
                  <Copy className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-3 text-sm text-stone-700">
                משפחת {createdFamily.name} מוכנה. שתפו קוד זה עם שאר חברי המשפחה כדי שיוכלו להצטרף.
              </p>
              {copied ? <p className="mt-2 text-sm font-semibold text-moss">הקוד הועתק</p> : null}
            </div>

            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <button className="btn-primary w-full" type="button" onClick={enterDashboard} disabled={activating}>
              {activating ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : null}
              {activating ? "נכנס ללוח הבקרה..." : "מעבר ללוח הבקרה"}
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[linear-gradient(135deg,#f8faf7_0%,#edf6ef_55%,#fff8ed_100%)] p-4">
      <section className="panel w-full max-w-xl p-6">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-mint text-moss">
            <Gift className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">יצירת משפחה חדשה</h1>
            <p className="text-sm text-stone-600">פתחו קופה משפחתית והתחילו להזמין בני משפחה.</p>
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <form className="space-y-5" noValidate onSubmit={handleSubmit}>
          <section className="rounded-lg border border-stone-200 bg-stone-50 p-4">
            <div className="mb-4 border-b border-stone-200 pb-3">
              <h2 className="text-base font-semibold">1. יצירת משתמש</h2>
              <p className="text-sm text-stone-600">הפרטים האישיים שישמשו להתחברות לחשבון שלכם.</p>
            </div>

            <div className="space-y-4">
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
            </div>
          </section>

          <section className="rounded-lg border border-moss/30 bg-mint/60 p-4">
            <div className="mb-4 border-b border-moss/20 pb-3">
              <h2 className="text-base font-semibold">2. יצירת משפחה</h2>
              <p className="text-sm text-stone-600">שם המשפחה שיופיע בקופה וייצור קוד הצטרפות לבני המשפחה.</p>
            </div>

            <label className="block">
              <RequiredLabel>שם המשפחה</RequiredLabel>
              <input className="field" name="family_name" value={form.family_name} onChange={updateField} required />
              {fieldErrors.family_name ? <span className="mt-1 block text-sm text-red-700">{fieldErrors.family_name}</span> : null}
            </label>
          </section>

          <button className="btn-primary w-full" type="submit" disabled={loading}>
            {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <UserPlus className="h-4 w-4" />}
            {loading ? "יוצר משפחה..." : "יצירת משפחה"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-stone-600">
          כבר יש לכם חשבון?{" "}
          <Link className="font-semibold text-moss hover:text-ink" to="/login">
            התחברות
          </Link>
        </p>
      </section>
    </main>
  );
}
