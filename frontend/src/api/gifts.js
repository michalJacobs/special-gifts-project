import apiClient from "./client.js";

export async function fetchFamilyUsers(familyId) {
  const response = await apiClient.get(`/families/${familyId}/users`);
  return response.data;
}

export async function createGift(payload) {
  const response = await apiClient.post("/gifts", payload);
  return response.data;
}

export async function updateGift(giftId, payload) {
  const response = await apiClient.put(`/gifts/${giftId}`, payload);
  return response.data;
}
