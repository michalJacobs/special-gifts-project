export function hasPaidContribution(gift) {
  return (gift?.contributions || []).some((contribution) => contribution.is_paid);
}

export function getCollectedAmount(gift) {
  return (gift?.contributions || [])
    .filter((contribution) => contribution.is_paid)
    .reduce((sum, contribution) => sum + Number(contribution.allocated_amount || 0), 0);
}

export function getCollectionPercent(gift) {
  const target = Number(gift?.target_amount || 0);
  const collected = getCollectedAmount(gift);
  return target > 0 ? Math.min(100, Math.round((collected / target) * 100)) : 0;
}
