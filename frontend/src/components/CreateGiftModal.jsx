import { Check, X } from "lucide-react";
import ParticipantAllocationList from "./ParticipantAllocationList.jsx";
import RequiredLabel from "./ui/RequiredLabel.jsx";
import Spinner from "./ui/Spinner.jsx";
import useGiftForm from "../hooks/useGiftForm.js";

export default function CreateGiftModal({
  currentUser,
  familyUsers = [],
  gift = null,
  editMode = false,
  isOpen,
  onClose,
  onCreated,
  onUpdated
}) {
  const form = useGiftForm({
    currentUser,
    editMode,
    familyUsers,
    gift,
    isOpen,
    onCreated,
    onUpdated
  });

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/45 p-4">
      <section className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-lg bg-white shadow-soft">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">{editMode ? "עריכת מתנה" : "יצירת מתנה"}</h2>
            <p className="text-sm text-stone-600">בחרו מקבל/ת, סמנו משתתפים ועדכנו את סכומי ההשתתפות.</p>
          </div>
          <button className="btn-secondary h-10 w-10 px-0" type="button" onClick={onClose} aria-label="סגירת חלון מתנה">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="space-y-5 p-5" noValidate onSubmit={form.handleSubmit}>
          {form.error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {form.error}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <RequiredLabel>שם המתנה</RequiredLabel>
              <input className="field" value={form.title} onChange={(event) => form.setTitle(event.target.value)} required />
              {form.fieldErrors.title ? <span className="mt-1 block text-sm text-red-700">{form.fieldErrors.title}</span> : null}
            </label>

            <label className="block">
              <RequiredLabel>סכום יעד</RequiredLabel>
              <input
                className="field"
                type="number"
                min="0.01"
                step="0.01"
                value={form.targetAmount}
                onChange={(event) => {
                  form.setTargetAmount(event.target.value);
                  form.setFieldErrors({});
                }}
                required
              />
              {form.fieldErrors.targetAmount ? <span className="mt-1 block text-sm text-red-700">{form.fieldErrors.targetAmount}</span> : null}
            </label>
          </div>

          <label className="block">
            <RequiredLabel>מקבל/ת המתנה</RequiredLabel>
            <select className="field" value={form.recipientUserId} onChange={(event) => form.handleRecipientChange(event.target.value)} required>
              {form.recipients.length ? (
                form.recipients.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))
              ) : (
                <option value="">אין מקבלים זמינים</option>
              )}
            </select>
            {form.fieldErrors.recipientUserId ? <span className="mt-1 block text-sm text-red-700">{form.fieldErrors.recipientUserId}</span> : null}
          </label>

          <ParticipantAllocationList form={form} />

          {form.fieldErrors.allocations || form.balanceError ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {form.fieldErrors.allocations || form.balanceError}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="btn-secondary" type="button" onClick={onClose} disabled={form.loading}>
              ביטול
            </button>
            <button className="btn-primary" type="submit" disabled={!form.canSubmit}>
              {form.loading ? <Spinner /> : <Check className="h-4 w-4" />}
              {form.loading ? "שומר..." : editMode ? "שמירת שינויים" : "יצירת מתנה"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
