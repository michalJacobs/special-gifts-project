export function getApiError(error, fallback = "הבקשה נכשלה.") {
  return error?.response?.data?.detail || error?.message || fallback;
}
