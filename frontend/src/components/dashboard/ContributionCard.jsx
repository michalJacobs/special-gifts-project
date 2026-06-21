import { WalletCards } from "lucide-react";
import Spinner from "../ui/Spinner.jsx";
import { formatMoney } from "../../utils/format.js";

export function PendingContributionCard({ contribution, gift, isPaying, onPay }) {
  return (
    <div className="rounded-lg border border-stone-200 p-4">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">{gift.title}</h3>
          <p className="text-sm text-stone-600">נוצרה על ידי בן/בת משפחה</p>
        </div>
        <span className="rounded-md bg-amber-50 px-2 py-1 text-sm font-semibold text-amber-700">
          {formatMoney(contribution.allocated_amount)}
        </span>
      </div>
      <button className="btn-primary w-full" type="button" onClick={onPay} disabled={isPaying}>
        {isPaying ? <Spinner /> : <WalletCards className="h-4 w-4" />}
        {isPaying ? "מעבד תשלום..." : "תשלום עכשיו"}
      </button>
    </div>
  );
}

export function PaidContributionCard({ contribution, gift }) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">{gift.title}</h3>
          <p className="text-sm text-emerald-700">התשלום הושלם</p>
        </div>
        <span className="font-semibold text-emerald-800">{formatMoney(contribution.allocated_amount)}</span>
      </div>
    </div>
  );
}
