import { Pencil, Trash2 } from "lucide-react";
import Spinner from "../ui/Spinner.jsx";
import { formatMoney } from "../../utils/format.js";
import { getCollectedAmount, getCollectionPercent, hasPaidContribution } from "../../utils/gifts.js";

export default function CreatedGiftCard({ gift, isDeleting, onDelete, onEdit, userById }) {
  const collected = getCollectedAmount(gift);
  const percent = getCollectionPercent(gift);
  const isLocked = hasPaidContribution(gift);

  return (
    <article className="rounded-lg border border-stone-200 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{gift.title}</h3>
          <p className="text-sm text-stone-600">
            נגבו {formatMoney(collected)} מתוך {formatMoney(gift.target_amount)}
          </p>
          {isLocked ? <p className="mt-1 text-xs font-semibold text-amber-700">לא ניתן לערוך או למחוק לאחר תשלום</p> : null}
        </div>
        <div className="flex shrink-0 gap-2">
          <button className="btn-secondary min-h-9 px-3 py-1" type="button" onClick={onEdit} disabled={isDeleting}>
            <Pencil className="h-4 w-4" />
            עריכה
          </button>
          <button
            className="btn-secondary min-h-9 px-3 py-1 text-red-700 hover:border-red-300 hover:text-red-800"
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
          >
            {isDeleting ? <Spinner className="h-4 w-4 border-red-700" /> : <Trash2 className="h-4 w-4" />}
            מחיקה
          </button>
        </div>
      </div>

      <div className="mb-4 h-2 overflow-hidden rounded-full bg-stone-100">
        <div className="h-full rounded-full bg-moss transition-all" style={{ width: `${percent}%` }} />
      </div>

      <div className="space-y-2">
        {(gift.contributions || []).map((contribution) => {
          const user = userById.get(contribution.user_id);
          return (
            <div className="flex items-center justify-between gap-3 text-sm" key={contribution.id}>
              <span className="min-w-0 truncate">{user?.name || `משתמש #${contribution.user_id}`}</span>
              <span className={contribution.is_paid ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>
                {contribution.is_paid ? "שולם" : "ממתין"} · {formatMoney(contribution.allocated_amount)}
              </span>
            </div>
          );
        })}
      </div>
    </article>
  );
}
