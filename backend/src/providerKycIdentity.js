const crypto = require("crypto");
const { query } = require("./db");

let identityReady = false;

function surepassBase() {
  const configured = String(process.env.SUREPASS_BASE_URL || "").trim().replace(/\/$/, "");
  if (configured) return configured;
  const env = String(process.env.SUREPASS_ENV || "").trim().toLowerCase();
  if (env === "production" || env === "prod") return "https://kyc-api.surepass.io";
  return "https://sandbox.surepass.app";
}

function surepassToken() {
  return String(process.env.SUREPASS_TOKEN || process.env.SUREPASS_API_TOKEN || "").trim();
}

let sandboxTokenCache = { token: "", expiresAt: 0 };

function sandboxEnvValue(name) {
  return String(process.env[name] || "")
    .trim()
    .replace(/^['"]|['"]$/g, "");
}

function sandboxCredentials() {
  return {
    key: sandboxEnvValue("SANDBOX_API_KEY"),
    secret: sandboxEnvValue("SANDBOX_API_SECRET")
  };
}

function sandboxConfigured() {
  const { key, secret } = sandboxCredentials();
  return Boolean(key && secret);
}

function sandboxBase() {
  const { key } = sandboxCredentials();
  if (key.startsWith("key_live_")) return "https://api.sandbox.co.in";
  if (key.startsWith("key_test_")) return "https://test-api.sandbox.co.in";
  const configured = sandboxEnvValue("SANDBOX_API_BASE_URL") || sandboxEnvValue("SANDBOX_BASE_URL");
  if (configured) return configured.replace(/\/$/, "");
  const env = sandboxEnvValue("SANDBOX_ENV").toLowerCase();
  if (env === "production" || env === "prod" || env === "live") return "https://api.sandbox.co.in";
  return "https://test-api.sandbox.co.in";
}

function sandboxRedirectUrl() {
  const configured = String(process.env.SANDBOX_DIGILOCKER_REDIRECT_URL || "").trim();
  if (configured.startsWith("https://")) return configured;
  const origin = String(process.env.API_PUBLIC_ORIGIN || "https://cropvibe-api-production.up.railway.app")
    .trim()
    .replace(/\/$/, "");
  return `${origin}/api/v1/provider/kyc/digilocker/done`;
}

function digioCredentials() {
  return {
    clientId: String(process.env.DIGIO_CLIENT_ID || "").trim(),
    clientSecret: String(process.env.DIGIO_CLIENT_SECRET || "").trim(),
    base: String(process.env.DIGIO_BASE_URL || "https://ext.digio.in:444").trim().replace(/\/$/, "")
  };
}

function activeKycProvider() {
  const forced = String(process.env.KYC_PROVIDER || "").trim().toLowerCase();
  if (forced === "sandbox" || forced === "surepass" || forced === "digio") return forced;
  if (sandboxConfigured()) return "sandbox";
  if (surepassToken()) return "surepass";
  const digio = digioCredentials();
  if (digio.clientId && digio.clientSecret) return "digio";
  return null;
}

function normalizePersonName(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

function namesMatch(leftName, rightName) {
  const left = normalizePersonName(leftName);
  const right = normalizePersonName(rightName);
  if (left.length < 3 || right.length < 3) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;
  const leftTokens = String(leftName || "")
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter((token) => token.length > 1);
  const rightTokens = String(rightName || "")
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter((token) => token.length > 1);
  if (!leftTokens.length || !rightTokens.length) return false;
  const overlap = leftTokens.filter((token) => rightTokens.includes(token)).length;
  return overlap >= Math.min(2, leftTokens.length, rightTokens.length);
}

function normalizePan(raw) {
  const pan = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) return null;
  return pan;
}

async function ensureProviderKycIdentity() {
  if (identityReady) return;
  await query(
    `
    CREATE TABLE IF NOT EXISTS provider_kyc_identity (
      user_id INT PRIMARY KEY,
      aadhaar_name TEXT,
      aadhaar_last4 TEXT,
      aadhaar_dob TEXT,
      aadhaar_verified_at TIMESTAMPTZ,
      pan_number TEXT,
      pan_name TEXT,
      pan_matched BOOLEAN NOT NULL DEFAULT false,
      pan_verified_at TIMESTAMPTZ,
      bank_last4 TEXT,
      bank_ifsc TEXT,
      bank_holder_name TEXT,
      bank_matched BOOLEAN NOT NULL DEFAULT false,
      bank_verified_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    `
  );
  await query(`ALTER TABLE provider_kyc_identity ADD COLUMN IF NOT EXISTS digilocker_status TEXT NOT NULL DEFAULT 'pending'`);
  await query(`ALTER TABLE provider_kyc_identity ADD COLUMN IF NOT EXISTS digilocker_message TEXT`);
  await query(
    `
    CREATE TABLE IF NOT EXISTS provider_kyc_digilocker_sessions (
      id TEXT PRIMARY KEY,
      user_id INT NOT NULL,
      provider TEXT NOT NULL,
      client_id TEXT NOT NULL,
      gateway_token TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    )
    `
  );
  identityReady = true;
}

async function surepassRequest(path, body) {
  const token = surepassToken();
  if (!token) {
    const error = new Error("Surepass is not configured");
    error.status = 503;
    throw error;
  }
  let response;
  try {
    response = await fetch(`${surepassBase()}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25000)
    });
  } catch {
    throw providerError("Surepass did not respond. Try again in a moment.", 504);
  }
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

async function sandboxAccessToken(forceRefresh = false) {
  if (!forceRefresh && sandboxTokenCache.token && Date.now() < sandboxTokenCache.expiresAt) {
    return sandboxTokenCache.token;
  }
  const { key, secret } = sandboxCredentials();
  if (!key || !secret) {
    throw providerError("DigiLocker is not configured. Add SANDBOX_API_KEY and SANDBOX_API_SECRET on the server.", 503);
  }
  if (key.startsWith("key_live_") && !secret.startsWith("secret_live_")) {
    throw providerError(
      "The live API key needs its live secret. In Sandbox, regenerate the live key, then save both the new key and the new secret on the server.",
      503
    );
  }
  if (key.startsWith("key_test_") && secret.startsWith("secret_live_")) {
    throw providerError("The test API key needs its test secret, not the live secret.", 503);
  }
  let response;
  try {
    response = await fetch(`${sandboxBase()}/authenticate`, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "x-api-secret": secret,
        "x-api-version": "1.0"
      },
      signal: AbortSignal.timeout(25000)
    });
  } catch {
    throw providerError("Sandbox did not respond. Try again in a moment.", 504);
  }
  const payload = await response.json().catch(() => null);
  const token = String(payload?.data?.access_token || "").trim();
  if (!response.ok || !token) {
    const message = String(payload?.message || "");
    if (/bad credentials|unauthorized|invalid api key/i.test(message)) {
      throw providerError(
        "Sandbox rejected this key and secret. Use the live key with the live secret on https://api.sandbox.co.in, then restart the server.",
        503
      );
    }
    throw providerError(message || "Sandbox login failed. Check the API key and secret.", 503);
  }
  sandboxTokenCache = { token, expiresAt: Date.now() + 23 * 60 * 60 * 1000 };
  return token;
}

async function sandboxRequest(path, { method = "GET", body } = {}, retry = true) {
  const { key } = sandboxCredentials();
  const token = await sandboxAccessToken(false);
  let response;
  try {
    response = await fetch(`${sandboxBase()}${path}`, {
      method,
      headers: {
        Authorization: token,
        "x-api-key": key,
        "x-api-version": "1.0",
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(25000)
    });
  } catch {
    throw providerError("Sandbox did not respond. Try again in a moment.", 504);
  }
  if (response.status === 401 && retry) {
    sandboxTokenCache = { token: "", expiresAt: 0 };
    await sandboxAccessToken(true);
    return sandboxRequest(path, { method, body }, false);
  }
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

function sandboxError(payload, fallback) {
  const message = String(payload?.message || "").trim();
  if (/does not match any saved example/i.test(message)) {
    return providerError(
      "The Sandbox test key cannot open a real DigiLocker session. On the server, use the live API key and set SANDBOX_BASE_URL to https://api.sandbox.co.in.",
      422
    );
  }
  return providerError(message || fallback, 422);
}

function aadhaarFromXml(xml) {
  const text = String(xml || "");
  const attr = (name) => {
    const match = text.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]+)"`, "i"))
      || text.match(new RegExp(`\\b${name}\\s*=\\s*'([^']+)'`, "i"));
    return String(match?.[1] || "").trim();
  };
  const name = attr("name");
  const dob = attr("dob");
  const last4 = attr("uid").replace(/\D/g, "").slice(-4);
  if (!name) return null;
  return { name, last4, dob };
}

function surepassFailure(payload, fallback, response) {
  const message = String(payload?.message || payload?.data?.remarks || "").trim();
  if (/scope|not valid for this api/i.test(message)) {
    return providerError(
      "Surepass has not enabled this API for the current token. Turn on Bank Verification in the Surepass sandbox, then submit again.",
      422
    );
  }
  return providerError(message || fallback, 422);
}

function digioAuthHeader() {
  const { clientId, clientSecret } = digioCredentials();
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

function surepassGatewayUrl(token) {
  const custom = String(process.env.SUREPASS_DIGILOCKER_GATEWAY || "").trim();
  if (custom) {
    const joiner = custom.includes("?") ? "&" : "?";
    return `${custom}${joiner}token=${encodeURIComponent(token)}`;
  }
  const sandbox = surepassBase().includes("sandbox");
  const host = sandbox
    ? "https://sandbox-gateway.surepass.io/digilocker"
    : "https://gateway.surepass.io/digilocker";
  return `${host}?token=${encodeURIComponent(token)}`;
}

function pickAadhaarProfile(payload) {
  const data = payload?.data && typeof payload.data === "object" ? payload.data : payload || {};
  const profile =
    data.aadhaar_xml_data ||
    data.aadhaar_data ||
    data.xml_data ||
    data.aadhaar ||
    data.details ||
    data;
  const name = String(profile.full_name || profile.name || profile.fullName || profile.name_on_card || "").trim();
  const masked = String(profile.masked_aadhaar || profile.aadhaar_number || profile.uid || "");
  const last4 = masked.replace(/\D/g, "").slice(-4);
  const dob = String(profile.dob || profile.date_of_birth || profile.dateOfBirth || "").trim();
  if (!name) return null;
  return { name, last4, dob };
}

function providerError(message, status = 502) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function setDigilockerKycStatus(userId, sessionId, status, message) {
  await ensureProviderKycIdentity();
  await query(
    `
    INSERT INTO provider_kyc_identity (user_id, digilocker_status, digilocker_message, updated_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      digilocker_status = EXCLUDED.digilocker_status,
      digilocker_message = EXCLUDED.digilocker_message,
      updated_at = NOW()
    `,
    [userId, status, message || null]
  );
  if (sessionId) {
    await query(`UPDATE provider_kyc_digilocker_sessions SET status = $2 WHERE id = $1`, [sessionId, status]);
  }
}

async function pullSurepassDigilockerStatus(clientId) {
  const token = surepassToken();
  const response = await fetch(
    `${surepassBase()}/api/v1/digilocker/status/${encodeURIComponent(clientId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (response.status === 404) return { state: "unknown" };
  const payload = await response.json().catch(() => null);
  if (!response.ok) return { state: "pending" };
  const data = payload?.data && typeof payload.data === "object" ? payload.data : {};
  const raw = String(data.status || data.state || "").toLowerCase();
  const failed =
    data.failed === true ||
    raw === "failed" ||
    raw === "failure" ||
    raw === "denied" ||
    raw === "error" ||
    raw === "rejected";
  if (failed) {
    return {
      state: "failed",
      message: String(data.error_description || data.error || data.message || payload?.message || "DigiLocker verification failed.")
    };
  }
  const documentStatus = String(
    data?.documents?.aadhaar?.status || data.aadhaar_status || data.document_status || ""
  ).toLowerCase();
  const completed =
    data.completed === true ||
    data.completed === "true" ||
    data.aadhaar_linked === true ||
    data.success === true;
  const verified =
    completed ||
    ["success", "completed", "verified", "authenticated", "approved", "done"].includes(raw) ||
    ["success", "completed", "verified"].includes(documentStatus);
  if (verified) return { state: "verified" };
  return { state: "pending" };
}

async function startDigilockerSession({ userId, fullName, phone }) {
  const provider = activeKycProvider();
  if (!provider || (provider === "sandbox" && !sandboxConfigured())) {
    throw providerError(
      "DigiLocker is not configured. Add SANDBOX_API_KEY and SANDBOX_API_SECRET on the server.",
      503
    );
  }
  await ensureProviderKycIdentity();
  const sessionId = crypto.randomBytes(16).toString("hex");

  if (provider === "sandbox") {
    const phoneDigits = String(phone || "").replace(/\D/g, "").slice(-10);
    const body = {
      "@entity": "in.co.sandbox.kyc.digilocker.session.request",
      flow: "signin",
      redirect_url: sandboxRedirectUrl(),
      doc_types: ["aadhaar"],
      purpose: "Provider registration",
      requestor_name: "CropVibe"
    };
    if (/^[6-9]\d{9}$/.test(phoneDigits)) {
      body.options = { verified_mobile: phoneDigits };
    }
    const { response, payload } = await sandboxRequest("/kyc/digilocker/sessions/init", {
      method: "POST",
      body
    });
    const data = payload?.data || {};
    const clientId = String(data.session_id || "").trim();
    const gatewayUrl = String(data.authorization_url || "").trim();
    if (!response.ok || !clientId || !gatewayUrl.startsWith("https://")) {
      throw sandboxError(payload, "Could not start DigiLocker.");
    }
    await query(
      `
      INSERT INTO provider_kyc_digilocker_sessions (id, user_id, provider, client_id, gateway_token, expires_at)
      VALUES ($1, $2, 'sandbox', $3, '', NOW() + INTERVAL '20 minutes')
      `,
      [sessionId, userId, clientId]
    );
    await setDigilockerKycStatus(userId, sessionId, "pending", "Waiting for DigiLocker sign-in.");
    return { sessionId, provider: "sandbox", gatewayUrl };
  }

  if (provider === "surepass") {
    const redirectUrl = `${sandboxRedirectUrl()}?session=${encodeURIComponent(sessionId)}`;
    const { response, payload } = await surepassRequest("/api/v1/digilocker/initialize", {
      data: {
        signup_flow: true,
        skip_main_screen: false,
        redirect_url: redirectUrl,
        redirection_url: redirectUrl
      }
    });
    const data = payload?.data || {};
    const clientId = String(data.client_id || "").trim();
    const token = String(data.token || "").trim();
    if (!response.ok || !clientId || !token) {
      throw providerError(payload?.message || "Could not start DigiLocker.");
    }
    const gatewayUrl = String(data.url || data.redirect_url || "").trim() || surepassGatewayUrl(token);
    await query(
      `
      INSERT INTO provider_kyc_digilocker_sessions (id, user_id, provider, client_id, gateway_token, expires_at)
      VALUES ($1, $2, 'surepass', $3, $4, NOW() + INTERVAL '20 minutes')
      `,
      [sessionId, userId, clientId, token]
    );
    await setDigilockerKycStatus(userId, sessionId, "pending", "Waiting for DigiLocker sign-in.");
    return { sessionId, provider: "surepass", gatewayUrl };
  }

  const digio = digioCredentials();
  const identifier = String(phone || "").replace(/\D/g, "").slice(-10) || String(userId);
  const response = await fetch(`${digio.base}/client/kyc/v2/request`, {
    method: "POST",
    headers: {
      Authorization: digioAuthHeader(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      customer_identifier: identifier,
      customer_name: String(fullName || "Provider").trim() || "Provider",
      template_name: String(process.env.DIGIO_DIGILOCKER_TEMPLATE || "DIGILOCKER").trim(),
      notify_customer: false,
      generate_access_token: true,
      reference_id: sessionId
    })
  });
  const payload = await response.json().catch(() => null);
  const requestId = String(payload?.id || payload?.request_id || "").trim();
  const accessToken = payload?.access_token;
  const tokenId = String(accessToken?.id || accessToken || "").trim();
  if (!response.ok || !requestId || !tokenId) {
    throw providerError(payload?.message || "Could not start DigiLocker.");
  }
  const gatewayHost = String(process.env.DIGIO_GATEWAY_URL || "").trim()
    || (digio.base.includes("ext.digio") ? "https://ext.digio.in" : "https://app.digio.in");
  const gatewayUrl = `${gatewayHost}/#/gateway/login/${encodeURIComponent(requestId)}/${encodeURIComponent(tokenId)}/${encodeURIComponent(identifier)}`;
  await query(
    `
    INSERT INTO provider_kyc_digilocker_sessions (id, user_id, provider, client_id, gateway_token, expires_at)
    VALUES ($1, $2, 'digio', $3, $4, NOW() + INTERVAL '20 minutes')
    `,
    [sessionId, userId, requestId, tokenId]
  );
    await setDigilockerKycStatus(userId, sessionId, "pending", "Waiting for DigiLocker sign-in.");
    return { sessionId, provider: "digio", gatewayUrl };
  }

async function latestDigilockerSession(userId, sessionId) {
  await ensureProviderKycIdentity();
  const rows = await query(
    `
    SELECT id, user_id AS "userId", provider, client_id AS "clientId", gateway_token AS "gatewayToken", status
    FROM provider_kyc_digilocker_sessions
    WHERE user_id = $1
      AND ($2::text = '' OR id = $2)
      AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [userId, String(sessionId || "")]
  );
  return rows.rows[0] || null;
}

async function pullSandboxDigilockerStatus(sessionId) {
  const { response, payload } = await sandboxRequest(
    `/kyc/digilocker/sessions/${encodeURIComponent(sessionId)}/status`
  );
  if (!response.ok) {
    if (response.status === 404) {
      return { state: "failed", message: payload?.message || "DigiLocker session was not found." };
    }
    return { state: "pending" };
  }
  const raw = String(payload?.data?.status || "").toLowerCase();
  if (["failed", "failure", "denied", "rejected", "expired", "error"].includes(raw)) {
    return { state: "failed", message: payload?.message || "DigiLocker verification failed." };
  }
  if (["succeeded", "success", "completed", "verified"].includes(raw)) return { state: "verified" };
  return { state: "pending" };
}

async function acceptDigilockerRedirect({ code, state, clientId, sessionId }) {
  await ensureProviderKycIdentity();
  const ourSessionId = String(sessionId || "").trim();
  if (ourSessionId) {
    await query(
      `
      UPDATE provider_kyc_digilocker_sessions
      SET gateway_token = 'returned'
      WHERE id = $1
      `,
      [ourSessionId]
    );
  }
  const surepassClientId = String(clientId || "").trim();
  if (surepassClientId) {
    await query(
      `
      UPDATE provider_kyc_digilocker_sessions
      SET gateway_token = 'returned'
      WHERE client_id = $1
      `,
      [surepassClientId]
    );
  }
  const authCode = String(code || "").trim();
  if (!authCode) return;
  const parts = String(state || "")
    .trim()
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
  const sandboxSessionId = parts.find((part) => /^[0-9a-f-]{16,}$/i.test(part) && part.includes("-")) || parts[1] || "";
  if (!sandboxSessionId) return;
  await query(
    `
    UPDATE provider_kyc_digilocker_sessions
    SET gateway_token = 'returned'
    WHERE provider = 'sandbox' AND client_id = $1
    `,
    [sandboxSessionId]
  );
}

function profileDob(value) {
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

async function pullSandboxProfile(sessionId) {
  const { response, payload } = await sandboxRequest(
    `/kyc/digilocker/sessions/${encodeURIComponent(sessionId)}/user/profile`
  );
  if (!response.ok) return null;
  const data = payload?.data && typeof payload.data === "object" ? payload.data : {};
  const name = String(data.name || "").trim();
  if (!name) return null;
  return { name, last4: "", dob: profileDob(data.date_of_birth) };
}

async function pullSandboxAadhaar(sessionId) {
  const { response, payload } = await sandboxRequest(
    `/kyc/digilocker/sessions/${encodeURIComponent(sessionId)}/documents/aadhaar`
  );
  if (!response.ok) return null;
  const files = Array.isArray(payload?.data?.files) ? payload.data.files : [];
  const url = String(files[0]?.url || "").trim();
  if (!url.startsWith("https://")) return null;
  let xmlResponse;
  try {
    xmlResponse = await fetch(url, { signal: AbortSignal.timeout(25000) });
  } catch {
    return null;
  }
  if (!xmlResponse.ok) return pullSandboxProfile(sessionId);
  const xml = await xmlResponse.text();
  return aadhaarFromXml(xml) || pullSandboxProfile(sessionId);
}

async function pullSurepassAadhaar(clientId) {
  const posted = await surepassRequest("/api/v1/digilocker/download-aadhaar", { client_id: clientId });
  if (posted.response.ok && posted.payload?.success !== false) {
    return pickAadhaarProfile(posted.payload);
  }
  const token = surepassToken();
  const response = await fetch(
    `${surepassBase()}/api/v1/digilocker/download-aadhaar/${encodeURIComponent(clientId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) return null;
  return pickAadhaarProfile(payload);
}

async function pullDigioAadhaar(requestId) {
  const digio = digioCredentials();
  const response = await fetch(`${digio.base}/client/kyc/v2/${encodeURIComponent(requestId)}/response`, {
    headers: { Authorization: digioAuthHeader() }
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) return null;
  const status = String(payload?.status || "").toLowerCase();
  if (status && !["approved", "success", "completed", "signed"].includes(status)) return null;
  return pickAadhaarProfile(payload);
}

async function completeDigilockerSession({ userId, sessionId }) {
  const session = await latestDigilockerSession(userId, sessionId);
  if (!session) {
    throw providerError("DigiLocker session expired. Start again.", 400);
  }
  if (session.status === "failed") {
    return { status: "failed", message: "DigiLocker verification failed. Try again." };
  }
  if (session.status === "verified") {
    const saved = await query(
      `
      SELECT aadhaar_name AS name, aadhaar_last4 AS last4, aadhaar_dob AS dob
      FROM provider_kyc_identity
      WHERE user_id = $1 AND digilocker_status = 'verified'
      LIMIT 1
      `,
      [userId]
    );
    const row = saved.rows[0];
    if (row?.name) {
      return {
        status: "verified",
        name: row.name,
        maskedAadhaar: row.last4 ? `XXXX-XXXX-${row.last4}` : "Verified",
        dob: row.dob || ""
      };
    }
  }
  if (session.provider === "sandbox" && session.status !== "verified") {
    const remote = await pullSandboxDigilockerStatus(session.clientId);
    if (remote.state === "failed") {
      await setDigilockerKycStatus(userId, session.id, "failed", remote.message);
      return { status: "failed", message: remote.message };
    }
    if (remote.state !== "verified" && session.gatewayToken !== "returned") {
      return {
        status: "pending",
        message: "DigiLocker has not shared Aadhaar yet. Finish the consent page, then return to this tab."
      };
    }
  }
  if (session.provider === "surepass" && session.status !== "verified") {
    const remote = await pullSurepassDigilockerStatus(session.clientId);
    if (remote.state === "failed") {
      await setDigilockerKycStatus(userId, session.id, "failed", remote.message);
      return { status: "failed", message: remote.message };
    }
    if (remote.state === "pending" && session.gatewayToken !== "returned") {
      return { status: "pending", message: "Waiting for DigiLocker sign-in." };
    }
  }
  const profile =
    session.provider === "sandbox"
      ? await pullSandboxAadhaar(session.clientId)
      : session.provider === "digio"
        ? await pullDigioAadhaar(session.clientId)
        : await pullSurepassAadhaar(session.clientId);
  if (!profile?.name) {
    return { status: "pending", message: "Waiting for DigiLocker sign-in." };
  }
  await query(
    `
    INSERT INTO provider_kyc_identity (
      user_id, aadhaar_name, aadhaar_last4, aadhaar_dob, aadhaar_verified_at,
      pan_matched, bank_matched, digilocker_status, digilocker_message, updated_at
    )
    VALUES ($1, $2, $3, $4, NOW(), false, false, 'verified', NULL, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      aadhaar_name = EXCLUDED.aadhaar_name,
      aadhaar_last4 = EXCLUDED.aadhaar_last4,
      aadhaar_dob = EXCLUDED.aadhaar_dob,
      aadhaar_verified_at = NOW(),
      pan_number = NULL,
      pan_name = NULL,
      pan_matched = false,
      pan_verified_at = NULL,
      bank_last4 = NULL,
      bank_ifsc = NULL,
      bank_holder_name = NULL,
      bank_matched = false,
      bank_verified_at = NULL,
      digilocker_status = 'verified',
      digilocker_message = NULL,
      updated_at = NOW()
    `,
    [userId, profile.name, profile.last4 || null, profile.dob || null]
  );
  await query(`UPDATE provider_kyc_digilocker_sessions SET status = 'verified' WHERE id = $1`, [session.id]);
  return {
    status: "verified",
    name: profile.name,
    maskedAadhaar: profile.last4 ? `XXXX-XXXX-${profile.last4}` : "Verified",
    dob: profile.dob || ""
  };
}

async function requireAadhaarIdentity(userId) {
  await ensureProviderKycIdentity();
  const rows = await query(
    `
    SELECT aadhaar_name AS "aadhaarName", aadhaar_last4 AS "aadhaarLast4", aadhaar_dob AS "aadhaarDob"
    FROM provider_kyc_identity
    WHERE user_id = $1
      AND aadhaar_verified_at > NOW() - INTERVAL '24 hours'
    LIMIT 1
    `,
    [userId]
  );
  return rows.rows[0] || null;
}

function normalizeDob(raw) {
  const value = String(raw || "").trim();
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = value.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return null;
}

function surepassScopeMiss(response, payload) {
  const message = `${payload?.message || ""} ${payload?.message_code || ""}`;
  return (
    response.status === 404 ||
    response.status === 401 ||
    response.status === 403 ||
    /scope|not valid for this api|invalid token|not found/i.test(message)
  );
}

async function verifyPanNumber({ userId, panNumber, fullName, dob }) {
  const pan = normalizePan(panNumber);
  const holderName = String(fullName || "").trim();
  const isoDob = normalizeDob(dob);
  if (!pan) throw providerError("Enter a valid PAN.", 400);
  if (holderName.length < 3) throw providerError("Enter the full name as on the PAN.", 400);
  if (!isoDob) throw providerError("Enter the date of birth as on the PAN.", 400);
  const identity = await requireAadhaarIdentity(userId);
  if (!identity?.aadhaarName) {
    throw providerError("Verify Aadhaar with DigiLocker before PAN.", 400);
  }
  const provider = activeKycProvider();
  if (!provider || (provider === "sandbox" && !sandboxConfigured())) {
    throw providerError("PAN verification is not configured. Add SANDBOX_API_KEY and SANDBOX_API_SECRET on the server.", 503);
  }

  let panName = holderName;
  let nameMatchedByProvider = null;
  let dobMatchedByProvider = null;
  if (provider === "sandbox") {
    const [year, month, day] = isoDob.split("-");
    const { response, payload } = await sandboxRequest("/kyc/pan/verify", {
      method: "POST",
      body: {
        "@entity": "in.co.sandbox.kyc.pan_verification.request",
        pan,
        name_as_per_pan: holderName,
        date_of_birth: `${day}/${month}/${year}`,
        consent: "Y",
        reason: "Provider onboarding identity check"
      }
    });
    const data = payload?.data && typeof payload.data === "object" ? payload.data : {};
    if (!response.ok || String(data.status || "").toLowerCase() === "invalid") {
      throw providerError(payload?.message || data.remarks || "PAN could not be verified.", 422);
    }
    if (typeof data.name_as_per_pan_match === "boolean") nameMatchedByProvider = data.name_as_per_pan_match;
    if (typeof data.date_of_birth_match === "boolean") dobMatchedByProvider = data.date_of_birth_match;
  } else if (provider === "surepass") {
    const [year, month, day] = isoDob.split("-");
    const body = {
      id_number: pan,
      full_name: holderName,
      name: holderName,
      dob: isoDob,
      date_of_birth: `${day}-${month}-${year}`
    };
    const paths = ["/api/v1/pan/verify", "/api/v1/pan/pan", "/api/v1/pan/pan-comprehensive"];
    let payload = null;
    let response = null;
    for (const path of paths) {
      const result = await surepassRequest(path, body);
      response = result.response;
      payload = result.payload;
      if (!surepassScopeMiss(response, payload)) break;
    }
    const data = payload?.data && typeof payload.data === "object" ? payload.data : {};
    panName = String(data.full_name || data.fullName || data.name || holderName).trim();
    if (typeof data.name_match === "boolean") nameMatchedByProvider = data.name_match;
    if (typeof data.full_name_match === "boolean") nameMatchedByProvider = data.full_name_match;
    if (typeof data.dob_match === "boolean") dobMatchedByProvider = data.dob_match;
    if (typeof data.date_of_birth_match === "boolean") dobMatchedByProvider = data.date_of_birth_match;
    if (!response?.ok || payload?.success === false) {
      throw surepassFailure(payload, "PAN could not be verified.", response);
    }
  } else {
    const digio = digioCredentials();
    const response = await fetch(`${digio.base}/v3/client/kyc/fetch_id_data/PAN`, {
      method: "POST",
      headers: { Authorization: digioAuthHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ id_no: pan })
    });
    const payload = await response.json().catch(() => null);
    panName = String(payload?.full_name || payload?.name || payload?.data?.full_name || "").trim();
    if (!response.ok || !panName) {
      throw providerError(payload?.message || "PAN could not be verified.");
    }
  }

  const enteredMatchesAadhaar = namesMatch(identity.aadhaarName, holderName);
  const returnedMatchesAadhaar = namesMatch(identity.aadhaarName, panName);
  const matched =
    enteredMatchesAadhaar &&
    returnedMatchesAadhaar &&
    nameMatchedByProvider !== false &&
    dobMatchedByProvider !== false;
  await query(
    `
    UPDATE provider_kyc_identity
    SET pan_number = $2,
        pan_name = $3,
        pan_matched = $4,
        pan_verified_at = NOW(),
        bank_matched = false,
        bank_verified_at = NULL,
        updated_at = NOW()
    WHERE user_id = $1
    `,
    [userId, pan, panName, matched]
  );
  return {
    pan,
    panName,
    aadhaarName: identity.aadhaarName,
    matched
  };
}

async function verifyBankAccount({ userId, accountNumber, ifsc, ifscDetails = true }) {
  const account = String(accountNumber || "").replace(/\D/g, "");
  const code = String(ifsc || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  const includeIfscDetails = ifscDetails !== false;
  if (account.length < 6) throw providerError("Enter a valid account number.", 400);
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(code)) throw providerError("Enter a valid IFSC.", 400);
  const identity = await requireAadhaarIdentity(userId);
  if (!identity?.aadhaarName) {
    throw providerError("Verify Aadhaar with DigiLocker before the bank account.", 400);
  }
  const provider = activeKycProvider();
  if (!provider || (provider === "sandbox" && !sandboxConfigured())) {
    throw providerError("Bank verification is not configured. Add SANDBOX_API_KEY and SANDBOX_API_SECRET on the server.", 503);
  }

  let holderName = "";
  let bankName = "";
  let bankBranch = "";
  if (provider === "sandbox") {
    const penniless = await sandboxRequest(
      `/bank/${encodeURIComponent(code)}/accounts/${encodeURIComponent(account)}/penniless-verify`
    );
    let data = penniless.payload?.data && typeof penniless.payload.data === "object" ? penniless.payload.data : {};
    let ok = penniless.response.ok && data.account_exists !== false && String(data.name_at_bank || "").trim();
    if (!ok) {
      const penny = await sandboxRequest(
        `/bank/${encodeURIComponent(code)}/accounts/${encodeURIComponent(account)}/verify`
      );
      data = penny.payload?.data && typeof penny.payload.data === "object" ? penny.payload.data : {};
      if (!penny.response.ok || data.account_exists === false || !String(data.name_at_bank || "").trim()) {
        throw providerError(penny.payload?.message || data.message || "Bank account could not be verified.", 422);
      }
    }
    holderName = String(data.name_at_bank || "").trim();
    if (includeIfscDetails) {
      const branch = await sandboxRequest(`/bank/${encodeURIComponent(code)}`);
      const details = branch.payload?.data && typeof branch.payload.data === "object" ? branch.payload.data : branch.payload || {};
      if (branch.response.ok) {
        bankName = String(details.BANK || details.bank || "").trim();
        bankBranch = String(details.BRANCH || details.branch || "").trim();
      }
    }
  } else if (provider === "surepass") {
    const body = { id_number: account, ifsc: code, ifsc_details: includeIfscDetails };
    const paths = ["/api/v1/bank-verification/pennyless", "/api/v1/bank-verification"];
    let result = null;
    for (const path of paths) {
      result = await surepassRequest(path, body);
      if (!surepassScopeMiss(result.response, result.payload)) break;
    }
    const data = result?.payload?.data || {};
    const details = data.ifsc_details && typeof data.ifsc_details === "object" ? data.ifsc_details : {};
    holderName = String(
      data.full_name || data.name_at_bank || data.account_holder_name || data.beneficiary_name || data.name || ""
    ).trim();
    bankName = String(details.bank_name || details.bank || data.bank_name || "").trim();
    bankBranch = String(details.branch || details.branch_name || "").trim();
    if (!result?.response?.ok || result?.payload?.success === false || !holderName) {
      if (data.account_exists === false) {
        throw providerError("No account was found for this ID number and IFSC.", 422);
      }
      throw surepassFailure(result?.payload, "Bank account could not be verified.", result?.response);
    }
  } else {
    const digio = digioCredentials();
    const response = await fetch(`${digio.base}/v3/client/kyc/verify/BANK_ACC`, {
      method: "POST",
      headers: { Authorization: digioAuthHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({
        beneficiary_account_no: account,
        beneficiary_ifsc: code
      })
    });
    const payload = await response.json().catch(() => null);
    holderName = String(payload?.beneficiary_name || payload?.name || payload?.data?.beneficiary_name || "").trim();
    if (!response.ok || !holderName) {
      throw providerError(payload?.message || "Bank account could not be verified.");
    }
  }

  const matched = namesMatch(identity.aadhaarName, holderName);
  await query(
    `
    UPDATE provider_kyc_identity
    SET bank_last4 = $2,
        bank_ifsc = $3,
        bank_holder_name = $4,
        bank_matched = $5,
        bank_verified_at = NOW(),
        updated_at = NOW()
    WHERE user_id = $1
    `,
    [userId, account.slice(-4), code, holderName, matched]
  );
  return {
    holderName,
    aadhaarName: identity.aadhaarName,
    matched,
    ifsc: code,
    bankName,
    bankBranch
  };
}

async function getRegistrationIdentity(userId) {
  await ensureProviderKycIdentity();
  const rows = await query(
    `
    SELECT
      aadhaar_name AS "aadhaarName",
      aadhaar_last4 AS "aadhaarLast4",
      pan_number AS "panNumber",
      pan_matched AS "panMatched"
    FROM provider_kyc_identity
    WHERE user_id = $1
      AND aadhaar_verified_at > NOW() - INTERVAL '24 hours'
    LIMIT 1
    `,
    [userId]
  );
  return rows.rows[0] || null;
}

async function getCompletedProviderKycIdentity(userId) {
  await ensureProviderKycIdentity();
  const rows = await query(
    `
    SELECT
      aadhaar_name AS "aadhaarName",
      aadhaar_last4 AS "aadhaarLast4",
      pan_number AS "panNumber",
      pan_name AS "panName",
      bank_holder_name AS "bankHolderName",
      bank_ifsc AS "bankIfsc"
    FROM provider_kyc_identity
    WHERE user_id = $1
      AND aadhaar_verified_at > NOW() - INTERVAL '24 hours'
      AND pan_matched = true
      AND bank_matched = true
      AND bank_verified_at > NOW() - INTERVAL '24 hours'
    LIMIT 1
    `,
    [userId]
  );
  return rows.rows[0] || null;
}

module.exports = {
  activeKycProvider,
  namesMatch,
  normalizePan,
  acceptDigilockerRedirect,
  startDigilockerSession,
  completeDigilockerSession,
  verifyPanNumber,
  verifyBankAccount,
  getRegistrationIdentity,
  getCompletedProviderKycIdentity
};
