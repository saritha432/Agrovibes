import { API_BASE_URL, parseJsonOrThrow } from "./client";
import type { AuthResponse } from "./types";

export async function authLogin(payload: {
  email?: string;
  identifier?: string;
  password: string;
}) {
  const response = await fetch(`${API_BASE_URL}/v1/auth/login`, {
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
  const response = await fetch(`${API_BASE_URL}/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return (await parseJsonOrThrow(response)) as AuthResponse;
}
