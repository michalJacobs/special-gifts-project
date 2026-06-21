import { Check, Copy, Gift, LogOut, Plus, RefreshCw } from "lucide-react";
import CreatedGiftCard from "../components/dashboard/CreatedGiftCard.jsx";
import { PaidContributionCard, PendingContributionCard } from "../components/dashboard/ContributionCard.jsx";
import DashboardSection from "../components/dashboard/DashboardSection.jsx";
import DeleteGiftModal from "../components/dashboard/DeleteGiftModal.jsx";
import LockedGiftModal from "../components/dashboard/LockedGiftModal.jsx";
import CreateGiftModal from "../components/CreateGiftModal.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import InlineAlert from "../components/ui/InlineAlert.jsx";
import Spinner from "../components/ui/Spinner.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import useDashboard from "../hooks/useDashboard.js";

export default function Dashboard() {
  const { currentUser, logout } = useAuth();
  const dashboard = useDashboard(currentUser);

  return (
    <main className="min-h-screen bg-stone-50">
      <DashboardHeader currentUser={currentUser} dashboard={dashboard} onLogout={logout} />

      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
        {dashboard.error ? <InlineAlert className="mb-5">{dashboard.error}</InlineAlert> : null}

        {dashboard.loading ? (
          <div className="panel flex items-center justify-center gap-3 p-8 text-stone-600">
            <Spinner className="h-5 w-5 border-moss" />
            טוען מתנות
          </div>
        ) : (
          <DashboardContent dashboard={dashboard} />
        )}
      </div>

      <CreateGiftModal
        currentUser={currentUser}
        familyUsers={dashboard.users}
        isOpen={dashboard.isCreateOpen}
        onClose={() => dashboard.setIsCreateOpen(false)}
        onCreated={dashboard.handleGiftCreated}
      />

      <CreateGiftModal
        currentUser={currentUser}
        editMode
        familyUsers={dashboard.users}
        gift={dashboard.giftToEdit}
        isOpen={Boolean(dashboard.giftToEdit)}
        onClose={() => dashboard.setGiftToEdit(null)}
        onUpdated={dashboard.handleGiftUpdated}
      />

      <DeleteGiftModal
        gift={dashboard.giftToDelete}
        isDeleting={dashboard.deletingId === dashboard.giftToDelete?.id}
        onClose={() => dashboard.setGiftToDelete(null)}
        onConfirm={dashboard.handleDeleteGift}
      />

      <LockedGiftModal gift={dashboard.lockedGift} onClose={() => dashboard.setLockedGift(null)} />
    </main>
  );
}

function DashboardHeader({ currentUser, dashboard, onLogout }) {
  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-mint text-moss">
              <Gift className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">קופת המתנות המשפחתית</h1>
              <p className="text-sm text-stone-600">
                שלום, {currentUser.name}
                {dashboard.familyName ? ` | משפחת ${dashboard.familyName}` : ""} (קוד: {dashboard.familyCode})
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" type="button" onClick={() => dashboard.refreshDashboard({ quiet: true })} disabled={dashboard.refreshing}>
              <RefreshCw className={`h-4 w-4 ${dashboard.refreshing ? "animate-spin" : ""}`} />
              רענון
            </button>
            <button className="btn-primary" type="button" onClick={() => dashboard.setIsCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              יצירת מתנה
            </button>
            <button className="btn-secondary" type="button" onClick={onLogout}>
              <LogOut className="h-4 w-4" />
              יציאה
            </button>
          </div>
        </div>

        <FamilyCodePanel dashboard={dashboard} />
      </div>
    </header>
  );
}

function FamilyCodePanel({ dashboard }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-ink">פרטי המשפחה</p>
        <p className="text-sm text-stone-600">
          {dashboard.familyName ? `משפחת ${dashboard.familyName}` : "משפחה"} · קוד להצטרפות:{" "}
          <span className="font-bold text-moss">{dashboard.familyCode}</span>
        </p>
      </div>
      <div className="flex items-center gap-2">
        {dashboard.copiedFamilyCode ? <span className="text-sm font-semibold text-moss">הועתק</span> : null}
        <button
          className="btn-secondary h-10 px-3"
          type="button"
          onClick={dashboard.handleCopyFamilyCode}
          aria-label="העתקת קוד משפחה"
          title="העתקת קוד משפחה"
        >
          {dashboard.copiedFamilyCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          העתק
        </button>
      </div>
    </div>
  );
}

function DashboardContent({ dashboard }) {
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <DashboardSection title="מתנות שעליי לשלם עבורן" count={dashboard.pendingContributions.length}>
        {dashboard.pendingContributions.length ? (
          dashboard.pendingContributions.map(({ gift, contribution }) => (
            <PendingContributionCard
              contribution={contribution}
              gift={gift}
              isPaying={dashboard.payingId === contribution.id}
              key={contribution.id}
              onPay={() => dashboard.handlePay(contribution.id)}
            />
          ))
        ) : (
          <EmptyState text="אין תשלומים פתוחים." />
        )}
      </DashboardSection>

      <DashboardSection title="תשלומים ששילמתי" count={dashboard.paidContributions.length}>
        {dashboard.paidContributions.length ? (
          dashboard.paidContributions.map(({ gift, contribution }) => (
            <PaidContributionCard contribution={contribution} gift={gift} key={contribution.id} />
          ))
        ) : (
          <EmptyState text="תשלומים שהושלמו יופיעו כאן." />
        )}
      </DashboardSection>

      <DashboardSection title="מתנות שיצרתי" count={dashboard.createdGifts.length}>
        {dashboard.createdGifts.length ? (
          dashboard.createdGifts.map((gift) => (
            <CreatedGiftCard
              gift={gift}
              isDeleting={dashboard.deletingId === gift.id}
              key={gift.id}
              onDelete={() => dashboard.requestDeleteGift(gift)}
              onEdit={() => dashboard.requestEditGift(gift)}
              userById={dashboard.userById}
            />
          ))
        ) : (
          <EmptyState text="צרו מתנה כדי לעקוב אחר ההתקדמות בגבייה." />
        )}
      </DashboardSection>
    </div>
  );
}
