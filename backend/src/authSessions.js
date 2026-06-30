const crypto = require("crypto");
const { query } = require("./db");

let authSessionsTableReady = false;

async function ensureAuthSessionsTable() {
  if (authSessionsTableReady) return;
  await query(
    `
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id UUID PRIMARY KEY,
      user_id INT NOT NULL REFERENCES learn_users(id) ON DELETE CASCADE,
      device_name TEXT NOT NULL DEFAULT 'Unknown device',
      platform TEXT NOT NULL DEFAULT 'unknown',
      location_label TEXT,
      ip_address TEXT,
      user_agent TEXT,
      is_recognized BOOLEAN NOT NULL DEFAULT true,
      last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revoked_at TIMESTAMPTZ
    )
    `
  );
  await query(`CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_auth_sessions_active ON auth_sessions(user_id) WHERE revoked_at IS NULL`);
  await query(`ALTER TABLE learn_users ADD COLUMN IF NOT EXISTS devices_reviewed_at TIMESTAMPTZ`);
  authSessionsTableReady = true;
}

function normalizePlatform(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "android" || raw === "ios" || raw === "web" || raw === "windows") return raw;
  if (raw.includes("android")) return "android";
  if (raw.includes("ios") || raw.includes("iphone") || raw.includes("ipad")) return "ios";
  if (raw.includes("win")) return "windows";
  if (raw.includes("web")) return "web";
  return "unknown";
}

function parseDeviceInfo(body = {}, req) {
  const deviceName = String(body.deviceName || body.device_name || "").trim().slice(0, 120);
  const platform = normalizePlatform(body.platform || body.os || "");
  const locationLabel = String(body.locationLabel || body.location_label || "").trim().slice(0, 120) || null;
  const userAgent = String(req?.headers?.["user-agent"] || "").trim().slice(0, 500) || null;
  const ipAddress =
    String(req?.headers?.["x-forwarded-for"] || "")
      .split(",")[0]
      .trim()
      .slice(0, 80) ||
    String(req?.ip || "")
      .trim()
      .slice(0, 80) ||
    null;

  let resolvedName = deviceName;
  if (!resolvedName) {
    if (platform === "android") resolvedName = "Android device";
    else if (platform === "ios") resolvedName = "iPhone";
    else if (platform === "windows") resolvedName = "Windows PC";
    else if (platform === "web") resolvedName = "Web browser";
    else resolvedName = "Unknown device";
  }

  return {
    deviceName: resolvedName,
    platform,
    locationLabel,
    userAgent,
    ipAddress
  };
}

async function createAuthSession({ userId, deviceInfo, req, recognize = true }) {
  await ensureAuthSessionsTable();
  const parsed = parseDeviceInfo(deviceInfo, req);
  const sessionId = crypto.randomUUID();
  await query(
    `
    INSERT INTO auth_sessions (
      id, user_id, device_name, platform, location_label, ip_address, user_agent, is_recognized
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
    [
      sessionId,
      userId,
      parsed.deviceName,
      parsed.platform,
      parsed.locationLabel,
      parsed.ipAddress,
      parsed.userAgent,
      recognize
    ]
  );
  return { sessionId, ...parsed };
}

async function isSessionActive(sessionId, userId) {
  if (!sessionId) return true;
  await ensureAuthSessionsTable();
  const result = await query(
    `
    SELECT id
    FROM auth_sessions
    WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
    LIMIT 1
    `,
    [sessionId, userId]
  );
  return Boolean(result.rows[0]);
}

async function touchSession(sessionId) {
  if (!sessionId) return;
  await ensureAuthSessionsTable();
  await query(`UPDATE auth_sessions SET last_active_at = NOW() WHERE id = $1 AND revoked_at IS NULL`, [sessionId]);
}

async function listUserSessions(userId, currentSessionId) {
  await ensureAuthSessionsTable();
  const result = await query(
    `
    SELECT
      id,
      device_name AS "deviceName",
      platform,
      location_label AS "locationLabel",
      is_recognized AS "isRecognized",
      last_active_at AS "lastActiveAt",
      created_at AS "createdAt"
    FROM auth_sessions
    WHERE user_id = $1 AND revoked_at IS NULL
    ORDER BY last_active_at DESC
    `,
    [userId]
  );
  return result.rows.map((row) => ({
    ...row,
    isCurrent: currentSessionId ? row.id === currentSessionId : false
  }));
}

async function getUserSession(sessionId, userId) {
  await ensureAuthSessionsTable();
  const result = await query(
    `
    SELECT
      id,
      device_name AS "deviceName",
      platform,
      location_label AS "locationLabel",
      is_recognized AS "isRecognized",
      last_active_at AS "lastActiveAt",
      created_at AS "createdAt"
    FROM auth_sessions
    WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
    LIMIT 1
    `,
    [sessionId, userId]
  );
  return result.rows[0] || null;
}

async function revokeSession(sessionId, userId) {
  await ensureAuthSessionsTable();
  const result = await query(
    `
    UPDATE auth_sessions
    SET revoked_at = NOW()
    WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
    RETURNING id
    `,
    [sessionId, userId]
  );
  return Boolean(result.rows[0]);
}

async function revokeOtherSessions(userId, currentSessionId) {
  await ensureAuthSessionsTable();
  const result = await query(
    `
    UPDATE auth_sessions
    SET revoked_at = NOW()
    WHERE user_id = $1
      AND revoked_at IS NULL
      AND ($2::UUID IS NULL OR id <> $2::UUID)
    RETURNING id
    `,
    [userId, currentSessionId || null]
  );
  return result.rowCount || 0;
}

async function markSessionUnrecognized(sessionId, userId) {
  await ensureAuthSessionsTable();
  const result = await query(
    `
    UPDATE auth_sessions
    SET is_recognized = false, revoked_at = NOW()
    WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
    RETURNING id
    `,
    [sessionId, userId]
  );
  return Boolean(result.rows[0]);
}

async function markDevicesReviewed(userId) {
  await ensureAuthSessionsTable();
  await query(`UPDATE learn_users SET devices_reviewed_at = NOW() WHERE id = $1`, [userId]);
}

async function getSecurityCheckup(userId, currentSessionId) {
  await ensureAuthSessionsTable();
  const userResult = await query(
    `
    SELECT
      full_name AS "fullName",
      email,
      phone,
      password_updated_at AS "passwordUpdatedAt",
      devices_reviewed_at AS "devicesReviewedAt",
      created_at AS "createdAt"
    FROM learn_users
    WHERE id = $1
    LIMIT 1
    `,
    [userId]
  );
  const user = userResult.rows[0];
  if (!user) return null;

  const sessions = await listUserSessions(userId, currentSessionId);
  const unrecognizedCount = sessions.filter((s) => !s.isRecognized && !s.isCurrent).length;
  const hasPhone = Boolean(String(user.phone || "").trim());
  const hasEmail = Boolean(String(user.email || "").trim() && !String(user.email).includes("@phone.agrovibes"));
  const contactComplete = hasPhone || hasEmail;

  const recommendations = [];
  if (!contactComplete) {
    recommendations.push({
      key: "contact-info",
      title: "Review Your Contact Info",
      subtitle: "Take a look at your contact info so that we can help if you lose access.",
      route: "ProfilesPersonalDetails"
    });
  }
  if (unrecognizedCount > 0) {
    recommendations.push({
      key: "unrecognized-logins",
      title: "Review Unrecognized Logins",
      subtitle: `We detected ${unrecognizedCount} unrecognized login${unrecognizedCount === 1 ? "" : "s"}.`,
      route: "WhereLoggedIn"
    });
  }

  return {
    recommendationCount: recommendations.length,
    recommendations,
    passwordUpdatedAt: user.passwordUpdatedAt || user.createdAt || null,
    devicesReviewedAt: user.devicesReviewedAt || null,
    unrecognizedLoginCount: unrecognizedCount,
    sessions,
    contactComplete,
    twoFactorEnabled: false
  };
}

function sessionSummaryByPlatform(sessions) {
  const groups = new Map();
  for (const session of sessions) {
    const key = session.platform || "unknown";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(session);
  }
  return Array.from(groups.entries()).map(([platform, items]) => {
    const sorted = [...items].sort((a, b) => new Date(b.lastActiveAt) - new Date(a.lastActiveAt));
    const primary = sorted[0];
    const extra = sorted.length - 1;
    return {
      platform,
      deviceName: primary.deviceName,
      extraCount: extra,
      summary: extra > 0 ? `${primary.deviceName} | +${extra} More` : primary.deviceName
    };
  });
}

async function assertActiveSession(req, res, next) {
  try {
    const sessionId = req.user?.sessionId;
    const userId = req.user?.userId;
    if (!sessionId || !userId) {
      next();
      return;
    }
    const active = await isSessionActive(sessionId, userId);
    if (!active) {
      res.status(401).json({ message: "Session expired", code: "SESSION_REVOKED" });
      return;
    }
    void touchSession(sessionId);
    next();
  } catch (error) {
    res.status(500).json({ message: "Failed to validate session", error: error?.message || String(error) });
  }
}

module.exports = {
  ensureAuthSessionsTable,
  parseDeviceInfo,
  createAuthSession,
  isSessionActive,
  touchSession,
  listUserSessions,
  getUserSession,
  revokeSession,
  revokeOtherSessions,
  markSessionUnrecognized,
  markDevicesReviewed,
  getSecurityCheckup,
  sessionSummaryByPlatform,
  assertActiveSession
};
