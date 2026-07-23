const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
  "https://agrovibes.onrender.com/api";

export type AdminLoginResponse = {
  token: string;
  user: {
    id: number;
    email: string;
    fullName: string;
    role: string;
  };
};

export async function adminLogin(payload: { email: string; password: string }) {
  const response = await fetch(`${API_BASE}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: payload.email.trim().toLowerCase(),
      password: payload.password
    })
  });

  const body = (await response.json().catch(() => ({}))) as {
    message?: string;
    token?: string;
    user?: AdminLoginResponse["user"];
  };

  if (!response.ok) {
    throw new Error(body.message || `Login failed (${response.status})`);
  }
  if (!body.token || !body.user) {
    throw new Error("Invalid login response");
  }
  if (String(body.user.role || "").toLowerCase() !== "admin") {
    throw new Error("This account is not an admin. Use an admin account to continue.");
  }

  return { token: body.token, user: body.user } satisfies AdminLoginResponse;
}
