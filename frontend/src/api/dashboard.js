import apiClient from "./client.js";

const PAYMENT_WEBHOOK_SECRET = import.meta.env.VITE_PAYMENT_WEBHOOK_SECRET || "dev-payment-webhook-secret";

export async function fetchDashboardData(familyId) {
  const [giftsResponse, usersResponse] = await Promise.all([
    apiClient.get("/gifts"),
    apiClient.get(`/families/${familyId}/users`)
  ]);

  return {
    gifts: giftsResponse.data,
    users: usersResponse.data
  };
}

export async function markContributionPaid(contributionId) {
  return apiClient.post(
    "/payments/webhook",
    { contribution_id: contributionId },
    { headers: { "X-Webhook-Secret": PAYMENT_WEBHOOK_SECRET } }
  );
}

export async function deleteGift(giftId) {
  return apiClient.delete(`/gifts/${giftId}`);
}
