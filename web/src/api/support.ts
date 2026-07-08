import { API_BASE_URL, fetchWithRetry, parseJsonOrThrow } from "./client";

export async function sendSupportContact(payload: {
  firstName?: string;
  lastName?: string;
  email: string;
  subject: string;
  message: string;
}) {
  const response = await fetchWithRetry(`${API_BASE_URL}/v1/support/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return (await parseJsonOrThrow(response)) as { success: boolean };
}
