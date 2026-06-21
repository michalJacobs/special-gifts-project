import { useCallback, useEffect, useMemo, useState } from "react";
import { deleteGift, fetchDashboardData, markContributionPaid } from "../api/dashboard.js";
import { getApiError } from "../utils/apiError.js";
import { copyText } from "../utils/clipboard.js";
import { hasPaidContribution } from "../utils/gifts.js";

const COPY_RESET_DELAY_MS = 1800;

export default function useDashboard(currentUser) {
  const [gifts, setGifts] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payingId, setPayingId] = useState(null);
  const [copiedFamilyCode, setCopiedFamilyCode] = useState(false);
  const [error, setError] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [giftToEdit, setGiftToEdit] = useState(null);
  const [giftToDelete, setGiftToDelete] = useState(null);
  const [lockedGift, setLockedGift] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const familyName = currentUser.family?.name || "";
  const familyCode = currentUser.family?.id || currentUser.family_id;

  const refreshDashboard = useCallback(
    async ({ quiet = false } = {}) => {
      if (!currentUser?.family_id) {
        return;
      }

      setError("");
      quiet ? setRefreshing(true) : setLoading(true);

      try {
        const data = await fetchDashboardData(currentUser.family_id);
        setGifts(data.gifts);
        setUsers(data.users);
      } catch (requestError) {
        setError(getApiError(requestError, "לא ניתן לטעון את לוח הבקרה."));
      } finally {
        quiet ? setRefreshing(false) : setLoading(false);
      }
    },
    [currentUser?.family_id]
  );

  useEffect(() => {
    refreshDashboard();
  }, [refreshDashboard]);

  const userById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);

  const contributionRows = useMemo(() => {
    return gifts.flatMap((gift) =>
      (gift.contributions || [])
        .filter((contribution) => contribution.user_id === currentUser.id)
        .map((contribution) => ({ gift, contribution }))
    );
  }, [currentUser.id, gifts]);

  const pendingContributions = useMemo(
    () => contributionRows.filter((row) => !row.contribution.is_paid),
    [contributionRows]
  );
  const paidContributions = useMemo(
    () => contributionRows.filter((row) => row.contribution.is_paid),
    [contributionRows]
  );
  const createdGifts = useMemo(
    () => gifts.filter((gift) => gift.creator_user_id === currentUser.id),
    [currentUser.id, gifts]
  );

  async function handleCopyFamilyCode() {
    await copyText(String(familyCode));
    setCopiedFamilyCode(true);
    window.setTimeout(() => setCopiedFamilyCode(false), COPY_RESET_DELAY_MS);
  }

  async function handlePay(contributionId) {
    setError("");
    setPayingId(contributionId);

    try {
      await markContributionPaid(contributionId);
      await refreshDashboard({ quiet: true });
    } catch (paymentError) {
      setError(getApiError(paymentError, "לא ניתן לסמן את התשלום כהושלם."));
    } finally {
      setPayingId(null);
    }
  }

  function handleGiftCreated() {
    setIsCreateOpen(false);
    refreshDashboard({ quiet: true });
  }

  function handleGiftUpdated() {
    setGiftToEdit(null);
    refreshDashboard({ quiet: true });
  }

  function requestEditGift(gift) {
    if (hasPaidContribution(gift)) {
      setLockedGift(gift);
      return;
    }

    setGiftToEdit(gift);
  }

  function requestDeleteGift(gift) {
    if (hasPaidContribution(gift)) {
      setLockedGift(gift);
      return;
    }

    setGiftToDelete(gift);
  }

  async function handleDeleteGift() {
    if (!giftToDelete) {
      return;
    }

    setError("");
    setDeletingId(giftToDelete.id);

    try {
      await deleteGift(giftToDelete.id);
      setGiftToDelete(null);
      await refreshDashboard({ quiet: true });
    } catch (deleteError) {
      setError(getApiError(deleteError, "לא ניתן למחוק את המתנה."));
    } finally {
      setDeletingId(null);
    }
  }

  return {
    copiedFamilyCode,
    createdGifts,
    deletingId,
    error,
    familyCode,
    familyName,
    giftToDelete,
    giftToEdit,
    handleCopyFamilyCode,
    handleDeleteGift,
    handleGiftCreated,
    handleGiftUpdated,
    handlePay,
    isCreateOpen,
    loading,
    lockedGift,
    paidContributions,
    payingId,
    pendingContributions,
    refreshing,
    refreshDashboard,
    requestDeleteGift,
    requestEditGift,
    setGiftToDelete,
    setGiftToEdit,
    setIsCreateOpen,
    setLockedGift,
    userById,
    users
  };
}
