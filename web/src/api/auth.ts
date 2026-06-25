import { API_BASE_URL, fetchWithAuth, fetchWithRetry, parseJsonOrThrow } from "./client";
import type { AuthResponse } from "./types";

export async function authLogin(payload: {
  email?: string;
  identifier?: string;
  password: string;
}) {
  const response = await fetchWithRetry(`${API_BASE_URL}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return (await parseJsonOrThrow(response)) as AuthResponse;
}

export async function authRegister(payload: {
  email: string;
  password: string;
  fullName: string;
  username?: string;
  phone?: string;
  role?: string;
}) {
  const response = await fetchWithRetry(`${API_BASE_URL}/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return (await parseJsonOrThrow(response)) as AuthResponse;
}

export async function fetchAuthMe(token: string) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/auth/me`, token)) as { user: AuthResponse["user"] };
}

export async function sendPhoneOtp(payload: { phone: string }) {
  const response = await fetchWithRetry(`${API_BASE_URL}/v1/auth/phone/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return (await parseJsonOrThrow(response)) as {
    success: boolean;
    phone: string;
    channel: "sms" | "whatsapp";
  };
}

export async function resetPasswordWithOtp(payload: {
  phone: string;
  code: string;
  newPassword: string;
}) {
  const response = await fetchWithRetry(`${API_BASE_URL}/v1/auth/phone/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return (await parseJsonOrThrow(response)) as { success: boolean };
}
