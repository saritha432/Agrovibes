const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
  "https://cropvibe-api-production.up.railway.app/api";

/** Default Cropvibe admin credentials (must also exist in DB for production API calls). */
export const DEFAULT_ADMIN_EMAIL = "info@cropvibe.com";
export const DEFAULT_ADMIN_PASSWORD = "Cropvibe@2026";

export type AdminLoginResponse = {
  token: string;
  user: {
    id: number;
    email: string;
    fullName: string;
    role: string;
  };
  localOnly?: boolean;
};

function localAdminSession(email: string): AdminLoginResponse {
  return {
    token: `local-admin-${Date.now()}`,
    localOnly: true,
    user: {
      id: 0,
      email,
      fullName: "Cropvibe Admin",
      role: "admin"
    }
  };
}

function isDefaultAdmin(email: string, password: string) {
  return (
    email.trim().toLowerCase() === DEFAULT_ADMIN_EMAIL &&
    password === DEFAULT_ADMIN_PASSWORD
  );
}

/**
 * Prefer live API login. In local Vite (`import.meta.env.DEV`), if the API rejects
 * the default admin credentials (user not created in DB yet), fall back to a
 * local-only session so the Admin UI can be used.
 */
export async function adminLogin(payload: { email: string; password: string }) {
  const email = payload.email.trim().toLowerCase();
  const password = payload.password;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: email,
        password
      })
    });
  } catch {
    if (import.meta.env.DEV && isDefaultAdmin(email, password)) {
      return localAdminSession(email);
    }
    throw new Error("Cannot reach API. Check your network or API URL.");
  }

  const body = (await response.json().catch(() => ({}))) as {
    message?: string;
    token?: string;
    user?: AdminLoginResponse["user"];
  };

  if (!response.ok) {
    if (import.meta.env.DEV && isDefaultAdmin(email, password)) {
      return localAdminSession(email);
    }
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
