import { useEffect, useMemo, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import apiClient from "../api/client.js";

function centsFromValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

function decimalFromCents(cents) {
  return (cents / 100).toFixed(2);
}

function moneyFromCents(cents) {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS"
  }).format(cents / 100);
}

function splitEvenly(totalCents, count) {
  if (count <= 0) {
    return [];
  }

  const base = Math.floor(totalCents / count);
  const remainder = totalCents % count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

function getApiError(error, fallback = "לא ניתן לשמור את המתנה.") {
  return error?.response?.data?.detail || error?.message || fallback;
}

function RequiredLabel({ children }) {
  return (
    <span className="mb-1 block text-sm font-medium">
      {children} <span className="text-red-600">*</span>
    </span>
  );
}

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

    async function fetchMembers() {
      try {
        const response = await apiClient.get(`/families/${currentUser.family_id}/users`);
        if (isMounted) {
          setMembers(response.data);
        }
      } catch {
        if (isMounted && familyUsers.length) {
          setMembers(familyUsers);
        }
      }
    }

    fetchMembers();

    return () => {
      isMounted = false;
    };
  }, [currentUser?.family_id, familyUsers, isOpen]);

  const recipients = useMemo(() => {
    return members.filter((user) => user.id !== currentUser.id);
  }, [currentUser.id, members]);

  const participantOptions = useMemo(() => {
    return members.filter((user) => user.id !== Number(recipientUserId));
  }, [members, recipientUserId]);

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
      setAllocations(
        availableParticipants.reduce((next, user) => {
          const contribution = contributionByUserId.get(user.id);
          next[user.id] = contribution ? Number(contribution.allocated_amount || 0).toFixed(2) : "";
          return next;
        }, {})
      );
    } else {
      const participantIds = availableParticipants.map((user) => user.id);
      setSelectedUserIds(participantIds);
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
    const nextParticipants = members.filter((user) => user.id !== nextRecipientId).map((user) => user.id);
    setRecipientUserId(value);
    setSelectedUserIds(nextParticipants);
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
      const response = editMode && gift
        ? await apiClient.put(`/gifts/${gift.id}`, payload)
        : await apiClient.post("/gifts", payload);

      if (editMode) {
        onUpdated?.(response.data);
      } else {
        onCreated?.(response.data);
      }
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  }

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

        <form className="space-y-5 p-5" noValidate onSubmit={handleSubmit}>
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <RequiredLabel>שם המתנה</RequiredLabel>
              <input className="field" value={title} onChange={(event) => setTitle(event.target.value)} required />
              {fieldErrors.title ? <span className="mt-1 block text-sm text-red-700">{fieldErrors.title}</span> : null}
            </label>

            <label className="block">
              <RequiredLabel>סכום יעד</RequiredLabel>
              <input
                className="field"
                type="number"
                min="0.01"
                step="0.01"
                value={targetAmount}
                onChange={(event) => {
                  setTargetAmount(event.target.value);
                  setFieldErrors({});
                }}
                required
              />
              {fieldErrors.targetAmount ? <span className="mt-1 block text-sm text-red-700">{fieldErrors.targetAmount}</span> : null}
            </label>
          </div>

          <label className="block">
            <RequiredLabel>מקבל/ת המתנה</RequiredLabel>
            <select className="field" value={recipientUserId} onChange={(event) => handleRecipientChange(event.target.value)} required>
              {recipients.length ? (
                recipients.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))
              ) : (
                <option value="">אין מקבלים זמינים</option>
              )}
            </select>
            {fieldErrors.recipientUserId ? <span className="mt-1 block text-sm text-red-700">{fieldErrors.recipientUserId}</span> : null}
          </label>

          <section className="rounded-lg border border-stone-200">
            <div className="flex flex-col gap-2 border-b border-stone-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold">
                  משתתפים בתשלום <span className="text-red-600">*</span>
                </h3>
                <p className="text-sm text-stone-600">הסימון קובע מי משתתף. שינוי סימון או סכום יעד מחלק את הסכום מחדש בין המסומנים.</p>
              </div>
              <span className={isBalanced ? "text-sm font-semibold text-emerald-700" : "text-sm font-semibold text-red-700"}>
                סה"כ {moneyFromCents(allocationCents)} / {moneyFromCents(targetCents)}
              </span>
            </div>

            <div className="divide-y divide-stone-200">
              {participantOptions.map((user) => {
                const isChecked = selectedUserIds.includes(user.id);
                return (
                  <label className="grid gap-3 px-4 py-3 sm:grid-cols-[32px_1fr_170px] sm:items-center" key={user.id}>
                    <input
                      className="h-4 w-4 accent-moss"
                      type="checkbox"
                      checked={isChecked}
                      onChange={(event) => toggleParticipant(user.id, event.target.checked)}
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
                        value={allocations[user.id] || ""}
                        onChange={(event) => updateAllocation(user.id, event.target.value)}
                        disabled={!isChecked}
                        required={isChecked}
                      />
                      {fieldErrors[`allocation_${user.id}`] ? (
                        <span className="mt-1 block text-sm text-red-700">{fieldErrors[`allocation_${user.id}`]}</span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
          </section>

          {fieldErrors.allocations || balanceError ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {fieldErrors.allocations || balanceError}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="btn-secondary" type="button" onClick={onClose} disabled={loading}>
              ביטול
            </button>
            <button className="btn-primary" type="submit" disabled={!canSubmit}>
              {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Check className="h-4 w-4" />}
              {loading ? "שומר..." : editMode ? "שמירת שינויים" : "יצירת מתנה"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}