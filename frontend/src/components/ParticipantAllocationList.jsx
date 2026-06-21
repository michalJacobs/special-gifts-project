import { moneyFromCents } from "../utils/money.js";

export default function ParticipantAllocationList({ form }) {
  return (
    <section className="rounded-lg border border-stone-200">
      <div className="flex flex-col gap-2 border-b border-stone-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold">
            משתתפים בתשלום <span className="text-red-600">*</span>
          </h3>
          <p className="text-sm text-stone-600">הסימון קובע מי משתתף. שינוי סימון או סכום יעד מחלק את הסכום מחדש בין המסומנים.</p>
        </div>
        <span className={form.isBalanced ? "text-sm font-semibold text-emerald-700" : "text-sm font-semibold text-red-700"}>
          סה"כ {moneyFromCents(form.allocationCents)} / {moneyFromCents(form.targetCents)}
        </span>
      </div>

      <div className="divide-y divide-stone-200">
        {form.participantOptions.map((user) => {
          const isChecked = form.selectedUserIds.includes(user.id);
          return (
            <label className="grid gap-3 px-4 py-3 sm:grid-cols-[32px_1fr_170px] sm:items-center" key={user.id}>
              <input
                className="h-4 w-4 accent-moss"
                type="checkbox"
                checked={isChecked}
                onChange={(event) => form.toggleParticipant(user.id, event.target.checked)}
              />
              <span>
                <span className="block font-medium">{user.name}</span>
                <span className="text-sm text-stone-600">{user.email}</span>
              </span>
              <span>
                <input
                  className="field"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.allocations[user.id] || ""}
                  onChange={(event) => form.updateAllocation(user.id, event.target.value)}
                  disabled={!isChecked}
                  required={isChecked}
                />
                {form.fieldErrors[`allocation_${user.id}`] ? (
                  <span className="mt-1 block text-sm text-red-700">{form.fieldErrors[`allocation_${user.id}`]}</span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}
