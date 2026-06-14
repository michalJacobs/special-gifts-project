import { useCallback, useEffect, useMemo, useState } from "react";
import { Gift, LogOut, Pencil, Plus, RefreshCw, WalletCards } from "lucide-react";
import apiClient from "../api/client.js";
import CreateGiftModal from "../components/CreateGiftModal.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const PAYMENT_WEBHOOK_SECRET = import.meta.env.VITE_PAYMENT_WEBHOOK_SECRET || "dev-payment-webhook-secret";

function money(value) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS" }).format(Number(value || 0));
}

function getApiError(error, fallback = "הבקשה נכשלה.") {
  return error?.response?.data?.detail || error?.message || fallback;
}

export default function Dashboard() {
  const { currentUser, logout } = useAuth();
  const [gifts, setGifts] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payingId, setPayingId] = useState(null);
  const [error, setError] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [giftToEdit, setGiftToEdit] = useState(null);

  const fetchDashboard = useCallback(
    async ({ quiet = false } = {}) => {
      if (!currentUser?.family_id) {
        return;
      }

      setError("");
      quiet ? setRefreshing(true) : setLoading(true);

      try {
        const [giftsResponse, usersResponse] = await Promise.all([
          apiClient.get("/gifts"),
          apiClient.get(`/families/${currentUser.family_id}/users`)
        ]);
        setGifts(giftsResponse.data);
        setUsers(usersResponse.data);
      } catch (requestError) {
        setError(getApiError(requestError, "לא ניתן לטעון את לוח הבקרה."));
      } finally {
        quiet ? setRefreshing(false) : setLoading(false);
      }
    },
    [currentUser?.family_id]
  );

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const userById = useMemo(() => {
    return new Map(users.map((user) => [user.id, user]));
  }, [users]);

  const contributionRows = useMemo(() => {
    return gifts.flatMap((giftItem) =>
      (giftItem.contributions || [])
        .filter((contribution) => contribution.user_id === currentUser.id)
        .map((contribution) => ({ gift: giftItem, contribution }))
    );
  }, [currentUser.id, gifts]);

  const pendingContributions = contributionRows.filter((row) => !row.contribution.is_paid);
  const paidContributions = contributionRows.filter((row) => row.contribution.is_paid);
  const createdGifts = gifts.filter((giftItem) => giftItem.creator_user_id === currentUser.id);

  async function handlePay(contributionId) {
    setError("");
    setPayingId(contributionId);

    try {
      await apiClient.post(
        "/payments/webhook",
        { contribution_id: contributionId },
        { headers: { "X-Webhook-Secret": PAYMENT_WEBHOOK_SECRET } }
      );
      await fetchDashboard({ quiet: true });
    } catch (paymentError) {
      setError(getApiError(paymentError, "לא ניתן לסמן את התשלום כהושלם."));
    } finally {
      setPayingId(null);
    }
  }

  function handleGiftCreated() {
    setIsCreateOpen(false);
    fetchDashboard({ quiet: true });
  }

  function handleGiftUpdated() {
    setGiftToEdit(null);
    fetchDashboard({ quiet: true });
  }

  return (
    <main className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-mint text-moss">
              <Gift className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">קופת המתנות המשפחתית</h1>
              <p className="text-sm text-stone-600">שלום, {currentUser.name}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" type="button" onClick={() => fetchDashboard({ quiet: true })} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              רענון
            </button>
            <button className="btn-primary" type="button" onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              יצירת מתנה
            </button>
            <button className="btn-secondary" type="button" onClick={logout}>
              <LogOut className="h-4 w-4" />
              יציאה
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
        {error ? (
          <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="panel flex items-center justify-center gap-3 p-8 text-stone-600">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-moss border-t-transparent" />
            טוען מתנות
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-3">
            <DashboardSection title="מתנות שעליי לשלם עבורן" count={pendingContributions.length}>
              {pendingContributions.length ? (
                pendingContributions.map(({ gift: giftItem, contribution }) => (
                  <div className="rounded-lg border border-stone-200 p-4" key={contribution.id}>
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold">{giftItem.title}</h3>
                        <p className="text-sm text-stone-600">נוצרה על ידי בן/בת משפחה</p>
                      </div>
                      <span className="rounded-md bg-amber-50 px-2 py-1 text-sm font-semibold text-amber-700">
                        {money(contribution.allocated_amount)}
                      </span>
                    </div>
                    <button className="btn-primary w-full" type="button" onClick={() => handlePay(contribution.id)} disabled={payingId === contribution.id}>
                      {payingId === contribution.id ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <WalletCards className="h-4 w-4" />}
                      {payingId === contribution.id ? "מעבד תשלום..." : "תשלום עכשיו"}
                    </button>
                  </div>
                ))
              ) : (
                <EmptyState text="אין תשלומים פתוחים." />
              )}
            </DashboardSection>

            <DashboardSection title="תשלומים ששילמתי" count={paidContributions.length}>
              {paidContributions.length ? (
                paidContributions.map(({ gift: giftItem, contribution }) => (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4" key={contribution.id}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold">{giftItem.title}</h3>
                        <p className="text-sm text-emerald-700">התשלום הושלם</p>
                      </div>
                      <span className="font-semibold text-emerald-800">{money(contribution.allocated_amount)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState text="תשלומים שהושלמו יופיעו כאן." />
              )}
            </DashboardSection>

            <DashboardSection title="מתנות שיצרתי" count={createdGifts.length}>
              {createdGifts.length ? (
                createdGifts.map((giftItem) => (
                  <CreatedGiftCard
                    giftItem={giftItem}
                    key={giftItem.id}
                    onEdit={() => setGiftToEdit(giftItem)}
                    userById={userById}
                  />
                ))
              ) : (
                <EmptyState text="צרו מתנה כדי לעקוב אחר ההתקדמות בגבייה." />
              )}
            </DashboardSection>
          </div>
        )}
      </div>

      <CreateGiftModal
        currentUser={currentUser}
        familyUsers={users}
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={handleGiftCreated}
      />

      <CreateGiftModal
        currentUser={currentUser}
        editMode
        familyUsers={users}
        gift={giftToEdit}
        isOpen={Boolean(giftToEdit)}
        onClose={() => setGiftToEdit(null)}
        onUpdated={handleGiftUpdated}
      />
    </main>
  );
}

function DashboardSection({ title, count, children }) {
  return (
    <section className="panel min-h-72 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="rounded-md bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-600">{count}</span>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function EmptyState({ text }) {
  return <div className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">{text}</div>;
}

function CreatedGiftCard({ giftItem, onEdit, userById }) {
  const target = Number(giftItem.target_amount || 0);
  const collected = (giftItem.contributions || [])
    .filter((contribution) => contribution.is_paid)
    .reduce((sum, contribution) => sum + Number(contribution.allocated_amount || 0), 0);
  const percent = target > 0 ? Math.min(100, Math.round((collected / target) * 100)) : 0;

  return (
    <article className="rounded-lg border border-stone-200 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{giftItem.title}</h3>
          <p className="text-sm text-stone-600">
            נגבו {money(collected)} מתוך {money(target)}
          </p>
        </div>
        <button className="btn-secondary min-h-9 px-3 py-1" type="button" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
          עריכה
        </button>
      </div>

      <div className="mb-4 h-2 overflow-hidden rounded-full bg-stone-100">
        <div className="h-full rounded-full bg-moss transition-all" style={{ width: `${percent}%` }} />
      </div>

      <div className="space-y-2">
        {(giftItem.contributions || []).map((contribution) => {
          const user = userById.get(contribution.user_id);
          return (
            <div className="flex items-center justify-between gap-3 text-sm" key={contribution.id}>
              <span className="min-w-0 truncate">{user?.name || `משתמש #${contribution.user_id}`}</span>
              <span className={contribution.is_paid ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>
                {contribution.is_paid ? "שולם" : "ממתין"} · {money(contribution.allocated_amount)}
              </span>
            </div>
          );
        })}
      </div>
    </article>
  );
}
