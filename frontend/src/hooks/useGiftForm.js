import { useEffect, useMemo, useRef, useState } from "react";
import { createGift, fetchFamilyUsers, updateGift } from "../api/gifts.js";
import { getApiError } from "../utils/apiError.js";
import { centsFromValue, decimalFromCents, moneyFromCents, splitEvenly } from "../utils/money.js";

function buildAllocations(members, contributionByUserId) {
  return members.reduce((next, user) => {
    const contribution = contributionByUserId.get(user.id);
    next[user.id] = contribution ? Number(contribution.allocated_amount || 0).toFixed(2) : "";
    return next;
  }, {});
}

export default function useGiftForm({
  currentUser,
  editMode,
  familyUsers,
  gift,
  isOpen,
  onCreated,
  onUpdated
}) {
  const [members, setMembers] = useState(familyUsers);
  const [title, setTitle] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [recipientUserId, setRecipientUserId] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [allocations, setAllocations] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializedKey, setInitializedKey] = useState("");
  const skipNextAutoSplitRef = useRef(false);

  useEffect(() => {
    setMembers(familyUsers);
  }, [familyUsers]);

  useEffect(() => {
    if (!isOpen || !currentUser?.family_id) {
      return;
    }

    let isMounted = true;

    async function loadMembers() {
      try {
        const nextMembers = await fetchFamilyUsers(currentUser.family_id);
        if (isMounted) {
          setMembers(nextMembers);
        }
      } catch (loadMembersError) {
        console.error("Failed to load family members for gift form.", loadMembersError);
        if (isMounted) {
          setMembers(familyUsers.length ? familyUsers : []);
        }
      }
    }

    loadMembers();

    return () => {
      isMounted = false;
    };
  }, [currentUser?.family_id, familyUsers, isOpen]);

  const recipients = useMemo(() => members.filter((user) => user.id !== currentUser.id), [currentUser.id, members]);

  const participantOptions = useMemo(
    () => members.filter((user) => user.id !== Number(recipientUserId)),
    [members, recipientUserId]
  );

  const selectedParticipants = useMemo(() => {
    const selected = new Set(selectedUserIds);
    return participantOptions.filter((user) => selected.has(user.id));
  }, [participantOptions, selectedUserIds]);

  useEffect(() => {
    if (!isOpen) {
      setInitializedKey("");
      return;
    }

    const nextKey = `${editMode ? "edit" : "create"}:${gift?.id || "new"}:${members.map((user) => user.id).join(",")}`;
    if (initializedKey === nextKey || !members.length) {
      return;
    }

    const nextRecipientUserId = editMode && gift ? gift.recipient_user_id : recipients[0]?.id;
    const nextTargetAmount = editMode && gift ? Number(gift.target_amount || 0).toFixed(2) : "";
    const availableParticipants = members.filter((user) => user.id !== Number(nextRecipientUserId));

    setTitle(editMode && gift ? gift.title : "");
    setTargetAmount(nextTargetAmount);
    setRecipientUserId(nextRecipientUserId ? String(nextRecipientUserId) : "");
    setFieldErrors({});
    setError("");
    setLoading(false);

    if (editMode && gift) {
      const contributionByUserId = new Map((gift.contributions || []).map((contribution) => [contribution.user_id, contribution]));
      skipNextAutoSplitRef.current = true;
      setSelectedUserIds(availableParticipants.filter((user) => contributionByUserId.has(user.id)).map((user) => user.id));
      setAllocations(buildAllocations(availableParticipants, contributionByUserId));
    } else {
      setSelectedUserIds(availableParticipants.map((user) => user.id));
      setAllocations({});
    }

    setInitializedKey(nextKey);
  }, [editMode, gift, initializedKey, isOpen, members, recipients]);

  useEffect(() => {
    if (!isOpen || !initializedKey) {
      return;
    }

    if (skipNextAutoSplitRef.current) {
      skipNextAutoSplitRef.current = false;
      return;
    }

    if (!targetAmount || selectedParticipants.length === 0) {
      return;
    }

    const split = splitEvenly(centsFromValue(targetAmount), selectedParticipants.length);
    setAllocations((current) => {
      const next = { ...current };
      selectedParticipants.forEach((user, index) => {
        next[user.id] = decimalFromCents(split[index] || 0);
      });
      return next;
    });
  }, [initializedKey, isOpen, selectedParticipants, targetAmount]);

  const targetCents = centsFromValue(targetAmount);
  const allocationCents = selectedParticipants.reduce((sum, user) => sum + centsFromValue(allocations[user.id]), 0);
  const differenceCents = allocationCents - targetCents;
  const isBalanced = targetCents > 0 && selectedParticipants.length > 0 && differenceCents === 0;
  const balanceError =
    targetCents > 0 && selectedParticipants.length > 0 && !isBalanced
      ? `סך ההשתתפויות חייב להיות שווה בדיוק לסכום היעד. כרגע יש הפרש של ${moneyFromCents(Math.abs(differenceCents))}.`
      : "";
  const canSubmit = title.trim() && recipientUserId && isBalanced && !loading;

  function handleRecipientChange(value) {
    const nextRecipientId = Number(value);
    setRecipientUserId(value);
    setSelectedUserIds(members.filter((user) => user.id !== nextRecipientId).map((user) => user.id));
    setFieldErrors({});
  }

  function toggleParticipant(userId, checked) {
    setSelectedUserIds((current) => {
      if (checked) {
        return current.includes(userId) ? current : [...current, userId];
      }
      return current.filter((id) => id !== userId);
    });
    setFieldErrors({});
  }

  function updateAllocation(userId, value) {
    setAllocations((current) => ({ ...current, [userId]: value }));
    setFieldErrors({});
  }

  function validate() {
    const nextErrors = {};
    if (!title.trim()) {
      nextErrors.title = "יש להזין שם מתנה.";
    }
    if (!targetAmount || Number(targetAmount) <= 0) {
      nextErrors.targetAmount = "יש להזין סכום יעד גדול מאפס.";
    }
    if (!recipientUserId) {
      nextErrors.recipientUserId = "יש לבחור מקבל/ת מתנה.";
    }
    if (!selectedParticipants.length) {
      nextErrors.allocations = "יש לבחור לפחות משתתף אחד לתשלום.";
    }
    selectedParticipants.forEach((user) => {
      const value = allocations[user.id];
      if (value === "" || value === undefined || Number(value) < 0) {
        nextErrors[`allocation_${user.id}`] = "יש להזין סכום תקין.";
      }
    });
    if (!nextErrors.allocations && targetCents > 0 && !isBalanced) {
      nextErrors.allocations = "סך ההשתתפויות חייב להיות שווה בדיוק לסכום היעד.";
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

    const payload = {
      title: title.trim(),
      target_amount: Number(targetAmount).toFixed(2),
      family_id: currentUser.family_id,
      recipient_user_id: Number(recipientUserId),
      custom_allocations: selectedParticipants.map((user) => ({
        user_id: user.id,
        allocated_amount: Number(allocations[user.id]).toFixed(2)
      }))
    };

    try {
      const savedGift = editMode && gift
        ? await updateGift(gift.id, payload)
        : await createGift(payload);

      if (editMode) {
        onUpdated?.(savedGift);
      } else {
        onCreated?.(savedGift);
      }
    } catch (requestError) {
      setError(getApiError(requestError, "לא ניתן לשמור את המתנה."));
    } finally {
      setLoading(false);
    }
  }

  return {
    allocationCents,
    allocations,
    balanceError,
    canSubmit,
    error,
    fieldErrors,
    handleRecipientChange,
    handleSubmit,
    isBalanced,
    loading,
    participantOptions,
    recipientUserId,
    recipients,
    selectedUserIds,
    setFieldErrors,
    setTargetAmount,
    setTitle,
    targetAmount,
    targetCents,
    title,
    toggleParticipant,
    updateAllocation
  };
}
