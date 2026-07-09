import { API_BASE_URL, fetchWithRetry, parseJsonOrThrow } from "./client";

const SUPPORT_INBOX = "info@cropvibe.com";

type SupportPayload = {
  firstName?: string;
  lastName?: string;
  email: string;
  subject: string;
  message: string;
};

/**
 * Sends support request to backend (inbox + user auto-reply when Resend is configured).
 * Falls back to FormSubmit for inbox delivery only.
 */
export async function sendSupportContact(payload: SupportPayload) {
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/v1/support/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (response.ok) {
      return (await parseJsonOrThrow(response)) as { success: boolean };
    }
  } catch {
    // Fall through to FormSubmit inbox delivery.
  }

  return sendViaFormSubmit(payload);
}

async function sendViaFormSubmit(payload: SupportPayload) {
  const fullName = `${payload.firstName || ""} ${payload.lastName || ""}`.trim() || "Cropvibe user";
  const composedMessage = [
    "New support request from Cropvibe website",
    "",
    `First Name: ${payload.firstName || "-"}`,
    `Last Name: ${payload.lastName || "-"}`,
    `Email: ${payload.email}`,
    `Subject: ${payload.subject}`,
    "",
    "Message:",
    payload.message
  ].join("\n");

  const body = new URLSearchParams({
    name: fullName,
    email: payload.email,
    _replyto: payload.email,
    _subject: `[Cropvibe Support] ${payload.subject}`,
    message: composedMessage,
    _template: "table",
    _captcha: "false",
    _honey: ""
  });

  const response = await fetch(`https://formsubmit.co/ajax/${SUPPORT_INBOX}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body
  });

  const data = (await response.json().catch(() => null)) as
    | { success?: string | boolean; message?: string }
    | null;

  if (!response.ok) {
    throw new Error(
      data?.message ||
        "Could not deliver your message. Please try again in a moment."
    );
  }

  return { success: true as const };
}
