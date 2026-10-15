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

function digioCredentials() {
  return {
    clientId: String(process.env.DIGIO_CLIENT_ID || "").trim(),
    clientSecret: String(process.env.DIGIO_CLIENT_SECRET || "").trim(),
    base: String(process.env.DIGIO_BASE_URL || "https://ext.digio.in:444").trim().replace(/\/$/, "")
  };
}

function activeKycProvider() {
  const forced = String(process.env.KYC_PROVIDER || "").trim().toLowerCase();
  if (forced === "surepass" || forced === "digio") return forced;
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
  const response = await fetch(`${surepassBase()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => null);
  return { response, payload };
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
  const name = String(profile.full_name || profile.name || profile.fullName || "").trim();
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
  const verified =
    data.completed === true ||
    data.success === true ||
    raw === "success" ||
    raw === "completed" ||
    raw === "verified";
  if (verified) return { state: "verified" };
  return { state: "pending" };
}

async function startDigilockerSession({ userId, fullName, phone }) {
  const provider = activeKycProvider();
  if (!provider) {
    throw providerError(
      "DigiLocker is not configured. Add SUREPASS_TOKEN or Digio credentials on the server.",
      503
    );
  }
  await ensureProviderKycIdentity();
  const sessionId = crypto.randomBytes(16).toString("hex");

  if (provider === "surepass") {
    const { response, payload } = await surepassRequest("/api/v1/digilocker/initialize", {
      data: {
        signup_flow: true,
        skip_main_screen: false,
        auth_type: "app"
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
    SELECT id, user_id AS "userId", provider, client_id AS "clientId", status
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
  if (session.provider === "surepass" && session.status !== "verified") {
    const remote = await pullSurepassDigilockerStatus(session.clientId);
    if (remote.state === "failed") {
      await setDigilockerKycStatus(userId, session.id, "failed", remote.message);
      return { status: "failed", message: remote.message };
    }
    if (remote.state === "pending") {
      return { status: "pending", message: "Waiting for DigiLocker sign-in." };
    }
  }
  const profile =
    session.provider === "digio"
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
  if (!provider) throw providerError("PAN verification is not configured.", 503);

  let panName = holderName;
  let nameMatchedByProvider = null;
  let dobMatchedByProvider = null;
  if (provider === "surepass") {
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
      throw providerError(payload?.message || "PAN could not be verified.");
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

async function verifyBankAccount({ userId, accountNumber, ifsc }) {
  const account = String(accountNumber || "").replace(/\D/g, "");
  const code = String(ifsc || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (account.length < 6) throw providerError("Enter a valid account number.", 400);
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(code)) throw providerError("Enter a valid IFSC.", 400);
  const identity = await requireAadhaarIdentity(userId);
  if (!identity?.aadhaarName) {
    throw providerError("Verify Aadhaar with DigiLocker before the bank account.", 400);
  }
  const provider = activeKycProvider();
  if (!provider) throw providerError("Bank verification is not configured.", 503);

  let holderName = "";
  if (provider === "surepass") {
    let result = await surepassRequest("/api/v1/bank-verification/pennyless", {
      id_number: account,
      ifsc: code,
      ifsc_details: true
    });
    if (result.response.status === 404) {
      result = await surepassRequest("/api/v1/bank-verification/", {
        id_number: account,
        ifsc: code,
        ifsc_details: true
      });
    }
    const data = result.payload?.data || {};
    holderName = String(data.full_name || data.name_at_bank || data.account_holder_name || "").trim();
    if (!result.response.ok || !holderName) {
      throw providerError(result.payload?.message || "Bank account could not be verified.");
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
    ifsc: code
  };
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
  startDigilockerSession,
  completeDigilockerSession,
  verifyPanNumber,
  verifyBankAccount,
  getCompletedProviderKycIdentity
};
