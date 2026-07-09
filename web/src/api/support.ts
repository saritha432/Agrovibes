const SUPPORT_INBOX = "info@cropvibe.com";

type SupportPayload = {
  firstName?: string;
  lastName?: string;
  email: string;
  subject: string;
  message: string;
};

/**
 * Delivers contact-form messages to info@cropvibe.com.
 * Uses FormSubmit (no backend Resend key required).
 */
export async function sendSupportContact(payload: SupportPayload) {
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

  // FormSubmit accepts the request even before inbox activation;
  // after first activation email is confirmed, messages arrive in inbox.
  return { success: true as const };
}
