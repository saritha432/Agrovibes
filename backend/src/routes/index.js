const express = require("express");
const { query } = require("../db");
const {
  isRedisConfigured,
  cachePing,
  cacheGetJson,
  cacheSetJson,
  cacheDel,
  cacheIncr,
  cacheGenString
} = require("../cache");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { AccessToken, RoomServiceClient } = require("livekit-server-sdk");
const { signJwt, authOptional, authRequired, requireRole } = require("../auth");
const {
  createAuthSession,
  isSessionActive,
  listUserSessions,
  getUserSession,
  revokeSession,
  revokeOtherSessions,
  markSessionUnrecognized,
  markDevicesReviewed,
  getSecurityCheckup,
  sessionSummaryByPlatform
} = require("../authSessions");
const { isMediaStorageConfigured, uploadMediaBuffer, checkMediaStorageHealth, getMediaStorageProvider } = require("../mediaStorage");
const { stripLegacyCloudinaryUrl, sanitizeHomePostRowMedia, sanitizeStoryRowMedia } = require("../mediaUrls");
const {
  isEgressConfigured,
  startLiveRoomRecording,
  stopLiveRoomRecordingAndGetVideoUrl
} = require("../livekitEgress");
const {
  isPushConfigured,
  registerPushDeviceToken,
  unregisterPushDeviceToken,
  getPushSettings,
  setPushSettings,
  sendIncomingCallPush,
  sendCallCancelledPush,
  sendSocialPushToUser,
  sendSocialPushToFollowers,
  directMessagePushPayload
} = require("../pushNotifications");
const { buildShareReelHtml } = require("../shareReelPage");
const { emitDirectMessage, emitDirectMessageDeleted, emitMessagesRead, getSocketIo } = require("../socketChat");
const { isCloudFrontConfigured } = require("../s3Storage");

const router = express.Router();
let homePostsTableReady = false;
let homeStoriesTableReady = false;
let learnCoursesTableReady = false;
let learnUsersTableReady = false;
let learnEnrollmentsReady = false;
let learnProgressReady = false;
let phoneOtpTableReady = false;
let socialFollowsTableReady = false;
let socialNotificationsTableReady = false;
let homePostLikesTableReady = false;
let homePostCommentsTableReady = false;
let homePostSavesTableReady = false;
let homePostResharesTableReady = false;
let postReportsTableReady = false;
let directMessagesTableReady = false;
let scheduledLivesTableReady = false;
const phoneOtpMemory = new Map();
const phoneUserMemory = new Map();

function fireSocialPush(payload) {
  void sendSocialPushToUser(payload).catch((error) => {
    console.warn("[push] social:", error?.message || error);
  });
}

function fireSocialPushToFollowers(payload) {
  void sendSocialPushToFollowers(payload).catch((error) => {
    console.warn("[push] followers:", error?.message || error);
  });
}

function looksLikePhoneNumber(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return false;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return false;
  const letters = trimmed.match(/[a-zA-Z\u0900-\u097F\u0C00-\u0C7F]/g);
  return !letters || letters.length === 0;
}

function sanitizePersonDisplayName(fullName, username) {
  const candidates = [fullName, username].map((v) => String(v || "").trim()).filter(Boolean);
  for (const candidate of candidates) {
    if (looksLikePhoneNumber(candidate)) continue;
    if (candidate.includes("@phone.agrovibes")) continue;
    return candidate;
  }
  const bareUsername = String(username || "")
    .trim()
    .replace(/^@+/, "");
  if (bareUsername && !looksLikePhoneNumber(bareUsername)) return bareUsername;
  return "User";
}

async function actorDisplayName(userId) {
  const result = await query(`SELECT full_name, username FROM learn_users WHERE id = $1 LIMIT 1`, [userId]);
  const row = result.rows[0];
  return sanitizePersonDisplayName(row?.full_name, row?.username);
}

const uploadsRootDir = path.join(process.cwd(), "uploads");
const videoUploadDir = path.join(uploadsRootDir, "videos");
if (!fs.existsSync(videoUploadDir)) {
  fs.mkdirSync(videoUploadDir, { recursive: true });
}
const uploadVideo = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, videoUploadDir),
    filename: (_req, file, cb) => {
      const safeBase = String(file.originalname || "video")
        .replace(/\.[^/.]+$/, "")
        .replace(/[^a-zA-Z0-9-_]+/g, "-")
        .slice(0, 40) || "video";
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeBase}.mp4`);
    }
  }),
  limits: { fileSize: 120 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const type = String(file.mimetype || "").toLowerCase();
    const name = String(file.originalname || "").toLowerCase();
    if (type.includes("video") || name.endsWith(".mp4") || name.endsWith(".mov") || name.endsWith(".m4v") || name.endsWith(".webm")) {
      cb(null, true);
      return;
    }
    cb(new Error("Only video files are allowed"));
  }
});

/** Supabase ~50MB; S3 allows larger uploads via API. */
const MAX_MEDIA_UPLOAD_BYTES = 100 * 1024 * 1024;

const uploadMediaMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MEDIA_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    const type = String(file.mimetype || "").toLowerCase();
    const name = String(file.originalname || "").toLowerCase();
    if (type.startsWith("image/") || type.startsWith("video/") || type.startsWith("audio/")) {
      cb(null, true);
      return;
    }
    if (/\.(jpe?g|png|gif|webp|heic|bmp|avif|mp4|mov|webm|m4v|m4a|mp3|caf|aac|wav|ogg)$/i.test(name)) {
      cb(null, true);
      return;
    }
    cb(new Error("Only image, video, or audio files are allowed"));
  }
});

function mediaExtFromMime(mimeType, originalName) {
  const mime = String(mimeType || "").toLowerCase();
  if (mime.includes("jpeg") || mime.includes("jpg")) return ".jpg";
  if (mime.includes("png")) return ".png";
  if (mime.includes("webp")) return ".webp";
  if (mime.includes("gif")) return ".gif";
  if (mime.includes("heic")) return ".heic";
  if (mime.includes("webm")) return ".webm";
  if (mime.includes("quicktime")) return ".mov";
  if (mime.includes("mp4") && mime.includes("audio")) return ".m4a";
  if (mime.includes("mpeg") || mime.includes("mp3")) return ".mp3";
  if (mime.includes("m4a") || mime.includes("x-m4a")) return ".m4a";
  if (mime.includes("caf")) return ".caf";
  if (mime.includes("wav")) return ".wav";
  if (mime.includes("aac")) return ".aac";
  if (mime.includes("ogg")) return ".ogg";
  if (mime.includes("mp4")) return ".mp4";
  const name = String(originalName || "").toLowerCase();
  const m = name.match(/\.(jpe?g|png|gif|webp|heic|bmp|avif|mp4|mov|webm|m4v|m4a|mp3|caf|aac|wav|ogg)$/i);
  return m ? m[0].toLowerCase() : ".bin";
}

async function ensureLearnUsersTable() {
  if (learnUsersTableReady) return;
  await query(
    `
    CREATE TABLE IF NOT EXISTS learn_users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    `
  );
  await query(`ALTER TABLE learn_users ADD COLUMN IF NOT EXISTS phone TEXT UNIQUE`);
  await query(`ALTER TABLE learn_users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE`);
  await query(`ALTER TABLE learn_users ADD COLUMN IF NOT EXISTS avatar_url TEXT`);
  await query(`ALTER TABLE learn_users ADD COLUMN IF NOT EXISTS bio TEXT`);
  await query(`ALTER TABLE learn_users ADD COLUMN IF NOT EXISTS website TEXT`);
  await query(`ALTER TABLE learn_users ADD COLUMN IF NOT EXISTS location_label TEXT`);
  await query(`ALTER TABLE learn_users ADD COLUMN IF NOT EXISTS password_updated_at TIMESTAMPTZ`);
  await query(`ALTER TABLE learn_users ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active'`);
  learnUsersTableReady = true;
}

async function ensurePhoneOtpTable() {
  if (phoneOtpTableReady) return;
  await query(
    `
    CREATE TABLE IF NOT EXISTS phone_otp_codes (
      id SERIAL PRIMARY KEY,
      phone TEXT NOT NULL,
      otp_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      attempts INT NOT NULL DEFAULT 0,
      used BOOLEAN NOT NULL DEFAULT false,
      channel TEXT NOT NULL DEFAULT 'sms',
      provider_request_id TEXT,
      provider_status TEXT,
      provider_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    `
  );
  await query(`ALTER TABLE phone_otp_codes ADD COLUMN IF NOT EXISTS provider_status TEXT`);
  await query(`ALTER TABLE phone_otp_codes ADD COLUMN IF NOT EXISTS provider_message TEXT`);
  phoneOtpTableReady = true;
}

async function ensureSocialFollowsTable() {
  if (socialFollowsTableReady) return;
  await ensureLearnUsersTable();
  await query(
    `
    CREATE TABLE IF NOT EXISTS social_follows (
      id SERIAL PRIMARY KEY,
      follower_id INT NOT NULL REFERENCES learn_users(id) ON DELETE CASCADE,
      following_id INT NOT NULL REFERENCES learn_users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      responded_at TIMESTAMPTZ,
      UNIQUE (follower_id, following_id)
    )
    `
  );
  await query(`ALTER TABLE social_follows ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'`);
  await query(`ALTER TABLE social_follows ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ`);
  await query(`ALTER TABLE social_follows ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`);
  socialFollowsTableReady = true;
}

async function ensureSocialNotificationsTable() {
  if (socialNotificationsTableReady) return;
  await ensureSocialFollowsTable();
  await ensureHomePostsTable();
  await query(
    `
    CREATE TABLE IF NOT EXISTS social_notifications (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES learn_users(id) ON DELETE CASCADE,
      actor_id INT NOT NULL REFERENCES learn_users(id) ON DELETE CASCADE,
      follow_id INT REFERENCES social_follows(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      is_read BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    `
  );
  await query(`ALTER TABLE social_notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false`);
  await query(`ALTER TABLE social_notifications ADD COLUMN IF NOT EXISTS post_id INT`);
  await query(`ALTER TABLE social_notifications ADD COLUMN IF NOT EXISTS comment_excerpt TEXT`);
  socialNotificationsTableReady = true;
}

function liveScheduleExcerpt(topic, scheduledAt) {
  return JSON.stringify({
    topic: String(topic || "").trim().slice(0, 160),
    scheduledAt: String(scheduledAt || "")
  });
}

async function ensureScheduledLivesTable() {
  if (scheduledLivesTableReady) return;
  await ensureLearnUsersTable();
  await query(
    `
    CREATE TABLE IF NOT EXISTS scheduled_lives (
      id SERIAL PRIMARY KEY,
      host_id INT NOT NULL REFERENCES learn_users(id) ON DELETE CASCADE,
      topic TEXT NOT NULL,
      scheduled_at TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      post_id INT REFERENCES home_posts(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      started_at TIMESTAMPTZ
    )
    `
  );
  scheduledLivesTableReady = true;
}

async function ensureHomePostLikesTable() {
  if (homePostLikesTableReady) return;
  await ensureHomePostsTable();
  await ensureLearnUsersTable();
  await query(
    `
    CREATE TABLE IF NOT EXISTS home_post_likes (
      post_id INT NOT NULL REFERENCES home_posts(id) ON DELETE CASCADE,
      user_id INT NOT NULL REFERENCES learn_users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (post_id, user_id)
    )
    `
  );
  homePostLikesTableReady = true;
}

async function ensureHomePostCommentsTable() {
  if (homePostCommentsTableReady) return;
  await ensureHomePostsTable();
  await ensureLearnUsersTable();
  await query(
    `
    CREATE TABLE IF NOT EXISTS home_post_comments (
      id SERIAL PRIMARY KEY,
      post_id INT NOT NULL REFERENCES home_posts(id) ON DELETE CASCADE,
      user_id INT NOT NULL REFERENCES learn_users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    `
  );
  await query(
    `ALTER TABLE home_post_comments ADD COLUMN IF NOT EXISTS parent_comment_id INT REFERENCES home_post_comments(id) ON DELETE CASCADE`
  );
  homePostCommentsTableReady = true;
}

async function ensureHomePostSavesTable() {
  if (homePostSavesTableReady) return;
  await ensureHomePostsTable();
  await ensureLearnUsersTable();
  await query(
    `
    CREATE TABLE IF NOT EXISTS home_post_saves (
      post_id INT NOT NULL REFERENCES home_posts(id) ON DELETE CASCADE,
      user_id INT NOT NULL REFERENCES learn_users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (post_id, user_id)
    )
    `
  );
  homePostSavesTableReady = true;
}

async function ensureHomePostResharesTable() {
  if (homePostResharesTableReady) return;
  await ensureHomePostsTable();
  await ensureLearnUsersTable();
  await query(
    `
    CREATE TABLE IF NOT EXISTS home_post_reshares (
      post_id INT NOT NULL REFERENCES home_posts(id) ON DELETE CASCADE,
      user_id INT NOT NULL REFERENCES learn_users(id) ON DELETE CASCADE,
      quote_caption TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (post_id, user_id)
    )
    `
  );
  await query(`ALTER TABLE home_post_reshares ADD COLUMN IF NOT EXISTS quote_caption TEXT`);
  homePostResharesTableReady = true;
}

async function ensureDirectMessagesTable() {
  if (directMessagesTableReady) return;
  await ensureLearnUsersTable();
  await query(
    `
    CREATE TABLE IF NOT EXISTS direct_messages (
      id SERIAL PRIMARY KEY,
      sender_id INT NOT NULL REFERENCES learn_users(id) ON DELETE CASCADE,
      receiver_id INT NOT NULL REFERENCES learn_users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      is_read BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    `
  );
  await query(`ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false`);
  directMessagesTableReady = true;
}

function isLegacySyntheticPostAuthorEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  return e.startsWith("legacy_post_") && e.endsWith("@phone.agrovibes");
}

function authUserFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    role: row.role,
    phone: row.phone || undefined,
    username: row.username || undefined,
    avatarUrl: stripLegacyCloudinaryUrl(row.avatarUrl) || undefined,
    bio: row.bio || undefined,
    website: row.website || undefined,
    locationLabel: row.locationLabel || undefined,
    accountStatus: row.accountStatus || "active"
  };
}

const authUserSelect = `
  id,
  email,
  full_name AS "fullName",
  role,
  phone,
  username,
  avatar_url AS "avatarUrl",
  bio,
  website,
  location_label AS "locationLabel",
  account_status AS "accountStatus"
`;

const hideDeactivatedPostOwnersClause = `
  AND COALESCE(owner.account_status, 'active') <> 'deactivated'
  AND NOT EXISTS (
    SELECT 1
    FROM learn_users post_owner
    WHERE COALESCE(post_owner.account_status, 'active') = 'deactivated'
      AND (
        post_owner.id = p.user_id
        OR LOWER(TRIM(post_owner.full_name)) = LOWER(TRIM(p.user_name))
        OR (
          post_owner.username IS NOT NULL AND TRIM(post_owner.username) <> ''
          AND LOWER(TRIM(post_owner.username)) = LOWER(TRIM(p.user_name))
        )
        OR (
          post_owner.email IS NOT NULL AND TRIM(post_owner.email) <> ''
          AND LOWER(TRIM(SPLIT_PART(post_owner.email, '@', 1))) = LOWER(TRIM(p.user_name))
        )
      )
  )
`;

async function verifyUserPassword(userId, password) {
  const existing = await query(
    `SELECT password_hash AS "passwordHash" FROM learn_users WHERE id = $1 LIMIT 1`,
    [userId]
  );
  const row = existing.rows[0];
  if (!row) return false;
  const hash = String(row.passwordHash || "");
  let ok = await bcrypt.compare(String(password || ""), hash);
  if (!ok) {
    ok = await bcrypt.compare(String(password || "").trim(), hash);
  }
  return ok;
}

async function isUserAccountDeactivated(userId) {
  const result = await query(
    `SELECT COALESCE(account_status, 'active') AS status FROM learn_users WHERE id = $1 LIMIT 1`,
    [userId]
  );
  return String(result.rows[0]?.status || "active").toLowerCase() === "deactivated";
}

/**
 * Resolves which learn_users row should receive like/comment notifications for a home post.
 * Prefers real accounts over legacy backfill placeholders; updates home_posts.user_id when remapping.
 */
async function resolveHomePostAuthorUserId(postRow) {
  const name = String(postRow.user_name || "").trim();
  const postId = postRow.id != null ? Number(postRow.id) : null;

  const persistAuthor = async (uid) => {
    if (uid && Number.isFinite(postId) && postId > 0) {
      await query(`UPDATE home_posts SET user_id = $1 WHERE id = $2`, [uid, postId]);
    }
  };

  const direct = postRow.user_id != null ? Number(postRow.user_id) : null;
  if (direct && Number.isFinite(direct) && direct > 0) {
    const ur = await query(`SELECT id, email FROM learn_users WHERE id = $1 LIMIT 1`, [direct]);
    if (ur.rows[0]) {
      const email = String(ur.rows[0].email || "");
      if (!isLegacySyntheticPostAuthorEmail(email)) return direct;
    }
  }

  if (name) {
    const nameMatchSql = `
      LOWER(TRIM(REGEXP_REPLACE(COALESCE(full_name, ''), '\\s+', ' ', 'g')))
      = LOWER(TRIM(REGEXP_REPLACE($1::text, '\\s+', ' ', 'g')))
    `;
    let r = await query(
      `
      SELECT id FROM learn_users
      WHERE ${nameMatchSql}
        AND NOT (LOWER(TRIM(email)) LIKE 'legacy_post_%@phone.agrovibes')
      ORDER BY id ASC
      LIMIT 1
      `,
      [name]
    );
    if (!r.rows[0]) {
      r = await query(
        `
        SELECT id FROM learn_users
        WHERE ${nameMatchSql}
        ORDER BY id ASC
        LIMIT 1
        `,
        [name]
      );
    }
    if (r.rows[0]) {
      const uid = Number(r.rows[0].id);
      await persistAuthor(uid);
      return uid;
    }

    const slug = slugUsernameFromName(name);
    if (slug) {
      let r2 = await query(
        `
        SELECT id FROM learn_users
        WHERE LOWER(TRIM(username)) = LOWER(TRIM($1))
          AND NOT (LOWER(TRIM(email)) LIKE 'legacy_post_%@phone.agrovibes')
        ORDER BY id ASC
        LIMIT 1
        `,
        [slug]
      );
      if (!r2.rows[0]) {
        r2 = await query(
          `
          SELECT id FROM learn_users
          WHERE LOWER(TRIM(username)) = LOWER(TRIM($1))
          ORDER BY id ASC
          LIMIT 1
          `,
          [slug]
        );
      }
      if (r2.rows[0]) {
        const uid = Number(r2.rows[0].id);
        await persistAuthor(uid);
        return uid;
      }
    }

    let r3 = await query(
      `
      SELECT id FROM learn_users
      WHERE LOWER(TRIM(full_name)) = LOWER(TRIM($1))
        AND NOT (LOWER(TRIM(email)) LIKE 'legacy_post_%@phone.agrovibes')
      ORDER BY id ASC
      LIMIT 1
      `,
      [name]
    );
    if (!r3.rows[0]) {
      r3 = await query(
        `
        SELECT id FROM learn_users
        WHERE LOWER(TRIM(full_name)) = LOWER(TRIM($1))
        ORDER BY id ASC
        LIMIT 1
        `,
        [name]
      );
    }
    if (r3.rows[0]) {
      const uid = Number(r3.rows[0].id);
      await persistAuthor(uid);
      return uid;
    }
  }

  if (direct && Number.isFinite(direct) && direct > 0) return direct;
  return null;
}

/** Surface pg / connection errors (ECONNREFUSED often has an empty `.message`). */
function authRouteErrorInfo(error) {
  const code = String(error?.code || "");
  const msg = String(error?.message || error?.detail || "").trim();
  if (code === "ECONNREFUSED" || msg.includes("ECONNREFUSED")) {
    return {
      status: 503,
      message:
        "Database is not running. Start PostgreSQL (from repo root: docker compose up -d) and check DATABASE_URL in backend/.env."
    };
  }
  if (code === "23505" || /duplicate key|already exists|unique/i.test(msg)) {
    return { status: 409, message: "Email, phone, or username already registered" };
  }
  return {
    status: 500,
    message: msg || code || "Request failed",
    error: msg || code || ""
  };
}

function normalizeIndiaPhone(rawPhone) {
  const digits = String(rawPhone || "").replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `+91${digits.slice(1)}`;
  if (String(rawPhone || "").startsWith("+") && /^\+\d{11,15}$/.test(String(rawPhone))) {
    return String(rawPhone);
  }
  return null;
}

function slugUsernameFromName(name) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);
}

/** Same synthetic email shape as mobile register (`{digits}@phone.agrovibes`). */
function syntheticPhoneEmailFromIdentifier(normalizedIdentifier) {
  const digits = String(normalizedIdentifier || "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `${digits.slice(-10)}@phone.agrovibes`.toLowerCase();
}

function phoneDigitsOnly(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function randomOtp6() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function stableNumericId(seed) {
  let hash = 0;
  const raw = String(seed || "");
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  }
  return (hash % 900000) + 100000;
}

function hashOtp(phone, otp) {
  const secret = String(process.env.OTP_HASH_SECRET || process.env.JWT_SECRET || "agrovibes-otp-secret");
  return crypto.createHmac("sha256", secret).update(`${phone}:${otp}`).digest("hex");
}

function allowDevOtpFallback() {
  return String(process.env.OTP_STRICT_PROVIDER || "").trim().toLowerCase() !== "true";
}

function otpProvider() {
  const configured = String(process.env.OTP_PROVIDER || "msg91").trim().toLowerCase();
  return configured === "twilio" ? "twilio" : "msg91";
}

function msg91Mode() {
  const mode = String(process.env.MSG91_API_MODE || "").trim().toLowerCase();
  return mode === "widget" ? "widget" : "sendotp";
}

function staticOtpCode() {
  const fromEnv = String(process.env.STATIC_OTP_CODE || "").trim();
  const disabledValues = new Set(["false", "0", "no", "off", "disabled"]);
  if (fromEnv && !disabledValues.has(fromEnv.toLowerCase())) return fromEnv;
  return "525252";
}

function matchesStaticOtp(code) {
  const digits = String(code || "").replace(/\D/g, "");
  if (digits.length !== 6) return false;
  const disabled = String(process.env.STATIC_OTP_DISABLED || "").trim().toLowerCase();
  if (disabled === "true" || disabled === "1" || disabled === "yes") return false;
  return digits === staticOtpCode() || digits === "525252";
}

async function sendTwilioVerifyOtp(phone) {
  const accountSid = String(process.env.TWILIO_ACCOUNT_SID || "").trim();
  const authToken = String(process.env.TWILIO_AUTH_TOKEN || "").trim();
  const verifyServiceSid = String(process.env.TWILIO_VERIFY_SERVICE_SID || "").trim();

  if (!accountSid || !authToken || !verifyServiceSid) {
    if (allowDevOtpFallback()) {
      return {
        channel: "sms",
        providerRequestId: null,
        providerStatus: "dev-fallback",
        providerMessage: "Twilio Verify is not configured in development fallback mode"
      };
    }
    throw new Error("Twilio Verify is not configured");
  }

  const response = await fetch(`https://verify.twilio.com/v2/Services/${encodeURIComponent(verifyServiceSid)}/Verifications`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      To: phone,
      Channel: "sms"
    }).toString()
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.message || payload?.detail || "Failed to send OTP";
    throw new Error(message);
  }

  return {
    channel: "sms",
    providerRequestId: String(payload?.sid || ""),
    providerStatus: String(payload?.status || "pending"),
    providerMessage: String(payload?.lookup?.carrier?.name || "")
  };
}

async function verifyTwilioOtp(phone, code) {
  const accountSid = String(process.env.TWILIO_ACCOUNT_SID || "").trim();
  const authToken = String(process.env.TWILIO_AUTH_TOKEN || "").trim();
  const verifyServiceSid = String(process.env.TWILIO_VERIFY_SERVICE_SID || "").trim();

  if (!accountSid || !authToken || !verifyServiceSid) {
    if (allowDevOtpFallback()) return false;
    throw new Error("Twilio Verify is not configured");
  }

  const response = await fetch(`https://verify.twilio.com/v2/Services/${encodeURIComponent(verifyServiceSid)}/VerificationCheck`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      To: phone,
      Code: code
    }).toString()
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) return false;
  return String(payload?.status || "").toLowerCase() === "approved";
}

async function sendSmsOtp(phone, otp) {
  const authKey = String(process.env.MSG91_AUTH_KEY || "").trim();
  const templateId = String(process.env.MSG91_TEMPLATE_ID || "").trim();
  const senderId = String(process.env.MSG91_SENDER_ID || "").trim();
  const msg91FlowId = String(process.env.MSG91_FLOW_ID || "").trim();
  const widgetId = String(process.env.MSG91_WIDGET_ID || "").trim();
  const digitsPhone = phoneDigitsOnly(phone);
  const mode = msg91Mode();

  if (!authKey || (mode === "sendotp" && !templateId) || (mode === "widget" && !widgetId)) {
    if (allowDevOtpFallback()) {
      // eslint-disable-next-line no-console
      console.log(`[DEV OTP] ${phone} => ${otp}`);
      return { channel: "sms", providerRequestId: null };
    }
    throw new Error("SMS provider is not configured");
  }

  try {
    const url = mode === "widget" ? "https://api.msg91.com/api/v5/widget/sendOtp" : "https://api.msg91.com/api/v5/otp";
    const requestPayload =
      mode === "widget"
        ? {
            widgetId,
            tokenAuth: authKey,
            identifier: digitsPhone,
            ...(otp ? { otp } : {})
          }
        : {
            template_id: templateId,
            mobile: digitsPhone,
            otp,
            ...(senderId ? { sender: senderId } : {}),
            ...(msg91FlowId ? { flow_id: msg91FlowId } : {})
          };
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(mode === "widget" ? { token: authKey } : { authkey: authKey })
      },
      body: JSON.stringify(requestPayload)
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        payload?.message ||
        payload?.error ||
        payload?.errors?.[0]?.message ||
        payload?.type ||
        "Failed to send OTP";
      throw new Error(message);
    }
    return {
      channel: "sms",
      providerRequestId: String(payload?.request_id || payload?.requestId || payload?.reqId || ""),
      providerStatus: String(payload?.type || payload?.status || "accepted"),
      providerMessage: String(payload?.message || payload?.details || "")
    };
  } catch (error) {
    if (allowDevOtpFallback()) {
      // eslint-disable-next-line no-console
      console.log(`[DEV OTP FALLBACK] ${phone} => ${otp}`);
      return { channel: "sms", providerRequestId: null, providerStatus: "dev-fallback", providerMessage: "Provider unavailable in development fallback mode" };
    }
    throw error;
  }
}

async function ensureLearnEnrollmentsTable() {
  if (learnEnrollmentsReady) return;
  await ensureLearnUsersTable();
  await query(
    `
    CREATE TABLE IF NOT EXISTS learn_enrollments (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES learn_users(id) ON DELETE CASCADE,
      course_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      is_paid BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, course_id)
    )
    `
  );
  learnEnrollmentsReady = true;
}

async function ensureLearnProgressTable() {
  if (learnProgressReady) return;
  await ensureLearnUsersTable();
  await query(
    `
    CREATE TABLE IF NOT EXISTS learn_progress (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES learn_users(id) ON DELETE CASCADE,
      course_id TEXT NOT NULL,
      lesson_id TEXT NOT NULL,
      completed BOOLEAN NOT NULL DEFAULT false,
      last_watched_seconds INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, course_id, lesson_id)
    )
    `
  );
  learnProgressReady = true;
}

function learnFallbackCourses() {
  const sampleVideo = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
  const sampleVideo2 = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4";
  const sampleVideo3 = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4";
  return [
    {
      id: "soil-health-natural-farming",
      title: "Soil Health & Natural Farming Techniques",
      category: "Soil health",
      tags: ["Hindi", "Beginner", "Marathi"],
      level: "Beginner",
      rating: 4.9,
      learnersCount: 18200,
      durationLabel: "3h 45m",
      isFree: true,
      heroGradient: ["#f7d7c9", "#cfe7d9", "#f6d8b7"],
      instructor: {
        name: "Vijay Deshmukh",
        title: "NGO Agricultural Consultant",
        bio:
          "A seasoned agriculture expert with over a decade of hands-on experience working with Maharashtra's farmers. Known for practical, results-driven teaching methods."
      },
      syllabus: [
        { id: "1", title: "Soil Microbiology — The Invisible Workforce", durationLabel: "12:45", locked: false },
        { id: "2", title: "Composting & Organic Matter Management", durationLabel: "18:10", locked: true },
        { id: "3", title: "Green Manure Crops & Cover Cropping", durationLabel: "14:05", locked: true },
        { id: "4", title: "Natural Farming Principles — Zero Budget", durationLabel: "16:30", locked: true }
      ],
      lessons: [
        { id: "1", title: "Welcome & How to use this course", durationLabel: "03:10", locked: false, videoUrl: sampleVideo },
        { id: "2", title: "Soil Microbiology — The Invisible Workforce", durationLabel: "12:45", locked: false, videoUrl: sampleVideo2 },
        { id: "3", title: "Composting & Organic Matter Management", durationLabel: "18:10", locked: true, videoUrl: sampleVideo3 },
        { id: "4", title: "Natural Farming Principles — Zero Budget", durationLabel: "16:30", locked: true, videoUrl: sampleVideo }
      ],
      reviewsPreview: [
        {
          name: "Ganesh Pawar",
          rating: 5,
          text: "Extremely practical. I set up drip irrigation on my 2-acre farm following this course."
        },
        { name: "Meera Joshi", rating: 4, text: "Very useful in Marathi. Some modules could have more detail on soil types." },
        { name: "Sunil Wagh", rating: 5, text: "Best course for water management. Clear explanations and field examples." }
      ]
    },
    {
      id: "crop-management-basics",
      title: "Crop Management Basics",
      category: "Crop management",
      tags: ["Hindi", "Beginner"],
      level: "Beginner",
      rating: 4.7,
      learnersCount: 9800,
      durationLabel: "2h 10m",
      isFree: true,
      heroGradient: ["#f6d6c7", "#d9f3dd", "#d6e6ff"],
      instructor: {
        name: "Anita Kulkarni",
        title: "Extension Officer",
        bio: "Focused on simple, step-by-step practices for improving yields with low input cost."
      },
      syllabus: [
        { id: "1", title: "Planning Your Season", durationLabel: "10:15", locked: false },
        { id: "2", title: "Sowing & Spacing", durationLabel: "12:40", locked: true },
        { id: "3", title: "Nutrient Management", durationLabel: "14:30", locked: true }
      ],
      lessons: [
        { id: "1", title: "Planning Your Season", durationLabel: "10:15", locked: false, videoUrl: sampleVideo2 },
        { id: "2", title: "Sowing & Spacing", durationLabel: "12:40", locked: true, videoUrl: sampleVideo3 },
        { id: "3", title: "Nutrient Management", durationLabel: "14:30", locked: true, videoUrl: sampleVideo }
      ],
      reviewsPreview: [{ name: "Rohit Jadhav", rating: 5, text: "Simple and clear. Helped me plan inputs and spacing." }]
    },
    {
      id: "plant-protection-ipm",
      title: "Plant Protection: Integrated Pest Management (IPM)",
      category: "Plant care",
      tags: ["English", "Intermediate", "Hindi"],
      level: "Intermediate",
      rating: 4.8,
      learnersCount: 12600,
      durationLabel: "2h 55m",
      isFree: false,
      heroGradient: ["#e7f0ff", "#d9f3dd", "#f9e2c7"],
      instructor: {
        name: "Dr. Neha Kulkarni",
        title: "Plant Pathologist",
        bio: "Helps farmers reduce pesticide usage with practical scouting and threshold-based actions."
      },
      syllabus: [
        { id: "1", title: "Scouting & Identification", durationLabel: "11:20", locked: false },
        { id: "2", title: "Economic Thresholds", durationLabel: "13:15", locked: true },
        { id: "3", title: "Biological Controls", durationLabel: "15:40", locked: true }
      ],
      lessons: [
        { id: "1", title: "Scouting & Identification", durationLabel: "11:20", locked: false, videoUrl: sampleVideo3 },
        { id: "2", title: "Economic Thresholds", durationLabel: "13:15", locked: true, videoUrl: sampleVideo },
        { id: "3", title: "Biological Controls", durationLabel: "15:40", locked: true, videoUrl: sampleVideo2 }
      ],
      reviewsPreview: [{ name: "Anil Patil", rating: 5, text: "Very practical scouting tips and action thresholds." }]
    }
  ];
}

async function ensureLearnCoursesTable() {
  if (learnCoursesTableReady) return;
  await query(
    `
    CREATE TABLE IF NOT EXISTS learn_courses (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      tags JSONB NOT NULL DEFAULT '[]',
      level TEXT NOT NULL,
      rating NUMERIC NOT NULL DEFAULT 0,
      learners_count INT NOT NULL DEFAULT 0,
      duration_label TEXT NOT NULL,
      is_free BOOLEAN NOT NULL DEFAULT false,
      hero_gradient JSONB NOT NULL DEFAULT '[]',
      instructor JSONB NOT NULL DEFAULT '{}',
      syllabus JSONB NOT NULL DEFAULT '[]',
      lessons JSONB NOT NULL DEFAULT '[]',
      reviews_preview JSONB NOT NULL DEFAULT '[]',
      created_by_user_id INT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    `
  );
  // Lightweight migration for older deployments.
  await query(`ALTER TABLE learn_courses ADD COLUMN IF NOT EXISTS lessons JSONB NOT NULL DEFAULT '[]'`);
  await query(`ALTER TABLE learn_courses ADD COLUMN IF NOT EXISTS created_by_user_id INT`);
  learnCoursesTableReady = true;
}

async function seedLearnCoursesIfEmpty() {
  await ensureLearnCoursesTable();
  const countRes = await query(`SELECT COUNT(*)::INT AS count FROM learn_courses`);
  if ((countRes.rows[0]?.count || 0) > 0) return;

  const seed = learnFallbackCourses();
  for (const c of seed) {
    await query(
      `
      INSERT INTO learn_courses
        (id, title, category, tags, level, rating, learners_count, duration_label, is_free, hero_gradient, instructor, syllabus, lessons, reviews_preview)
      VALUES
        ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb)
      ON CONFLICT (id) DO NOTHING
      `,
      [
        c.id,
        c.title,
        c.category,
        JSON.stringify(c.tags || []),
        c.level,
        c.rating,
        c.learnersCount,
        c.durationLabel,
        c.isFree,
        JSON.stringify(c.heroGradient || []),
        JSON.stringify(c.instructor || {}),
        JSON.stringify(c.syllabus || []),
        JSON.stringify(c.lessons || []),
        JSON.stringify(c.reviewsPreview || [])
      ]
    );
  }
}

async function ensureHomePostsTable() {
  if (homePostsTableReady) return;
  await query(
    `
    CREATE TABLE IF NOT EXISTS home_posts (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES learn_users(id) ON DELETE SET NULL,
      user_name TEXT NOT NULL,
      location TEXT NOT NULL,
      caption TEXT NOT NULL,
      likes_count INT NOT NULL DEFAULT 0,
      comments_count INT NOT NULL DEFAULT 0,
      video_url TEXT,
      image_url TEXT,
      thumbnail_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    `
  );
  // Lightweight migrations for older deployments.
  await query(`ALTER TABLE home_posts ADD COLUMN IF NOT EXISTS image_url TEXT`);
  await query(`ALTER TABLE home_posts ALTER COLUMN video_url DROP NOT NULL`);
  await query(`ALTER TABLE home_posts ADD COLUMN IF NOT EXISTS image_urls TEXT`);
  await query(`ALTER TABLE home_posts ADD COLUMN IF NOT EXISTS user_id INT REFERENCES learn_users(id) ON DELETE SET NULL`);
  await query(`ALTER TABLE home_posts ADD COLUMN IF NOT EXISTS tagged_user_ids JSONB NOT NULL DEFAULT '[]'::jsonb`);
  await query(`ALTER TABLE home_posts ADD COLUMN IF NOT EXISTS music_label TEXT`);
  await query(`ALTER TABLE home_posts ADD COLUMN IF NOT EXISTS music_audio_url TEXT`);
  await query(`ALTER TABLE home_posts ADD COLUMN IF NOT EXISTS creative_meta JSONB NOT NULL DEFAULT '{}'::jsonb`);
  await query(`ALTER TABLE home_posts ADD COLUMN IF NOT EXISTS live_status TEXT`);
  await query(`ALTER TABLE home_posts ADD COLUMN IF NOT EXISTS live_ended_at TIMESTAMPTZ`);
  await query(`CREATE INDEX IF NOT EXISTS home_posts_id_desc_idx ON home_posts (id DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS home_posts_created_at_desc_idx ON home_posts (created_at DESC)`);
  homePostsTableReady = true;
}

async function ensurePostReportsTable() {
  if (postReportsTableReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS post_reports (
      id SERIAL PRIMARY KEY,
      post_id INT NOT NULL REFERENCES home_posts(id) ON DELETE CASCADE,
      reporter_user_id INT NOT NULL REFERENCES learn_users(id) ON DELETE CASCADE,
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS post_reports_post_idx ON post_reports (post_id)`);
  await query(`CREATE INDEX IF NOT EXISTS post_reports_created_idx ON post_reports (created_at DESC)`);
  postReportsTableReady = true;
}

/** Same rules as mobile `normalizeIdentity` — compare post.user_name to learn_users.full_name reliably. */
function normalizeUserLabelForHomePostAuth(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHomePostRow(row) {
  const base = { ...row };
  let list = null;
  if (base.image_urls) {
    try {
      const parsed = JSON.parse(base.image_urls);
      if (Array.isArray(parsed) && parsed.length) list = parsed.filter((u) => typeof u === "string" && u);
    } catch (_e) {
      list = null;
    }
  }
  if (!list || list.length === 0) {
    if (base.imageUrl) list = [base.imageUrl];
  }
  delete base.image_urls;
  if (list && list.length > 1) {
    base.imageUrls = list;
    base.imageUrl = list[0] || null;
  } else if (list && list.length === 1) {
    base.imageUrl = list[0];
    delete base.imageUrls;
  }
  // Coerce tagged_user_ids -> taggedUserIds as a clean number[]
  const rawTagged = base.taggedUserIds ?? base.tagged_user_ids;
  delete base.tagged_user_ids;
  let taggedIds = [];
  if (Array.isArray(rawTagged)) {
    taggedIds = rawTagged.map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0);
  } else if (typeof rawTagged === "string" && rawTagged.trim()) {
    try {
      const parsed = JSON.parse(rawTagged);
      if (Array.isArray(parsed)) {
        taggedIds = parsed.map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0);
      }
    } catch (_e) {
      taggedIds = [];
    }
  }
  base.taggedUserIds = taggedIds;
  const rawCreative = base.creativeMeta ?? base.creative_meta;
  delete base.creative_meta;
  let creativeMeta = {};
  let creativeObj = null;
  if (rawCreative && typeof rawCreative === "object" && !Array.isArray(rawCreative)) {
    creativeObj = rawCreative;
  } else if (typeof rawCreative === "string" && rawCreative.trim()) {
    try {
      const parsed = JSON.parse(rawCreative);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) creativeObj = parsed;
    } catch (_e) {
      creativeObj = null;
    }
  }
  if (creativeObj) {
    const filter = String(creativeObj.filter || "").trim();
    const overlayText = String(creativeObj.overlayText || "").trim();
    const textColor = String(creativeObj.textColor || "").trim();
    const textBackground = !!creativeObj.textBackground;
    const font = String(creativeObj.font || "").trim();
    creativeMeta = {
      ...(filter ? { filter } : {}),
      ...(overlayText ? { overlayText } : {}),
      ...(textColor ? { textColor } : {}),
      ...(textBackground ? { textBackground } : {}),
      ...(font ? { font } : {})
    };
  }
  base.creativeMeta = creativeMeta;
  const rawLikers = base.recentLikers;
  if (typeof rawLikers === "string" && rawLikers.trim()) {
    try {
      const parsed = JSON.parse(rawLikers);
      base.recentLikers = Array.isArray(parsed) ? parsed : [];
    } catch (_e) {
      base.recentLikers = [];
    }
  } else if (!Array.isArray(rawLikers)) {
    base.recentLikers = [];
  }
  if (/^\[LIVE\]/i.test(String(base.caption || "").trim())) {
    base.liveRoomName = `agrovibes-live-${base.id}`;
    const hasLiveMedia = !!(
      (typeof base.videoUrl === "string" && base.videoUrl.trim()) ||
      (typeof base.imageUrl === "string" && base.imageUrl.trim()) ||
      (Array.isArray(base.imageUrls) && base.imageUrls.length)
    );
    const dbStatus = String(base.liveStatus || base.live_status || "")
      .trim()
      .toLowerCase();
    delete base.live_status;
    if (base.live_ended_at) {
      base.liveEndedAt = base.live_ended_at;
      delete base.live_ended_at;
    }
    if (hasLiveMedia) {
      base.liveStatus = dbStatus === "active" ? "active" : "ended";
      if (base.liveStatus === "ended") base.liveViewerCount = 0;
    } else if (dbStatus === "ended") {
      base.liveStatus = "ended";
      base.liveViewerCount = 0;
    } else if (dbStatus === "active") {
      base.liveStatus = "active";
      base.liveStartedAt = base.liveStartedAt || base.createdAt;
    } else {
      // Still broadcasting — no VOD yet and DB has not marked ended.
      base.liveStatus = "active";
      base.liveStartedAt = base.liveStartedAt || base.createdAt;
    }
  }
  const repostByUserId = Number(base.repostByUserId);
  if (Number.isFinite(repostByUserId) && repostByUserId > 0) {
    const quote = String(base.repostQuoteCaption || base.reshareQuoteCaption || "").trim();
    base.repost = {
      byUserId: repostByUserId,
      byUserName: String(base.repostByUserName || "").trim() || "User",
      byAvatarUrl: base.repostByAvatarUrl ?? null,
      ...(quote ? { quoteCaption: quote } : {}),
      repostedAt: base.repostedAt || base.resharedAt || base.createdAt
    };
    base.feedEntryKey = `repost:${repostByUserId}:${base.id}`;
  }
  delete base.repostByUserId;
  delete base.repostByUserName;
  delete base.repostByAvatarUrl;
  delete base.repostQuoteCaption;
  return sanitizeHomePostRowMedia(base);
}

function parseHomeFeedPagination(req) {
  const limitRaw = req.query.limit;
  const hasLimit = limitRaw != null && String(limitRaw).trim() !== "";
  const limit = hasLimit
    ? Math.min(Math.max(Number(limitRaw) || 10, 1), 50)
    : 50;
  const cursorRaw = Number(req.query.cursor);
  const cursor = Number.isFinite(cursorRaw) && cursorRaw > 0 ? cursorRaw : null;
  return { limit, cursor };
}

function paginateHomeFeedRows(rows, limit) {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = page.length ? page[page.length - 1].id : null;
  return { page, nextCursor, hasMore };
}

function homeFeedListSql({ cursorParamIndex = null, videoOnly = false } = {}) {
  const videoClause = videoOnly
    ? `AND p.video_url IS NOT NULL AND TRIM(p.video_url) <> ''`
    : "";
  const cursorClause =
    cursorParamIndex != null ? `AND p.id < $${cursorParamIndex}` : "";
  return `
    SELECT
      p.id,
      COALESCE(p.user_id, u.id) AS "userId",
      COALESCE(NULLIF(TRIM(owner.full_name), ''), p.user_name) AS "userName",
      owner.username AS "username",
      p.location,
      p.caption,
      p.likes_count AS "likesCount",
      p.comments_count AS "commentsCount",
      p.video_url AS "videoUrl",
      p.image_url AS "imageUrl",
      p.image_urls AS "image_urls",
      p.thumbnail_url AS "thumbnailUrl",
      p.created_at AS "createdAt",
      p.tagged_user_ids AS "tagged_user_ids",
      p.music_label AS "musicLabel",
      p.music_audio_url AS "musicAudioUrl",
      p.creative_meta AS "creativeMeta",
      p.live_status AS "liveStatus",
      p.live_ended_at AS "liveEndedAt",
      COALESCE(NULLIF(TRIM(owner.avatar_url), ''), NULLIF(TRIM(u.avatar_url), '')) AS "authorAvatarUrl",
      CASE
        WHEN $1::integer IS NULL THEN false
        ELSE EXISTS (
          SELECT 1 FROM home_post_likes hpl
          WHERE hpl.post_id = p.id AND hpl.user_id = $1::integer
        )
      END AS "viewerHasLiked",
      CASE
        WHEN $1::integer IS NULL THEN false
        ELSE EXISTS (
          SELECT 1 FROM home_post_saves hps
          WHERE hps.post_id = p.id AND hps.user_id = $1::integer
        )
      END AS "viewerHasSaved",
      CASE
        WHEN $1::integer IS NULL THEN false
        ELSE EXISTS (
          SELECT 1 FROM home_post_reshares hpr
          WHERE hpr.post_id = p.id AND hpr.user_id = $1::integer
        )
      END AS "viewerHasReshared"
    FROM home_posts p
    LEFT JOIN learn_users owner ON owner.id = p.user_id
    LEFT JOIN LATERAL (
      SELECT id, avatar_url
      FROM learn_users
      WHERE LOWER(TRIM(full_name)) = LOWER(TRIM(p.user_name))
      ORDER BY id ASC
      LIMIT 1
    ) u ON TRUE
    WHERE 1=1 ${hideDeactivatedPostOwnersClause} ${videoClause} ${cursorClause}
    ORDER BY p.id DESC
  `;
}

function liveKitHttpUrl(wssUrl) {
  return String(wssUrl || "").replace(/^wss:\/\//i, "https://");
}

function isLiveKitRoomMissingError(error) {
  const msg = String(error?.message || error || "").toLowerCase();
  return msg.includes("not found") || msg.includes("does not exist") || msg.includes("requested room");
}

async function fetchLiveRoomInfo(roomName) {
  const cfg = readLiveKitConfig();
  if (!cfg.ok) return null;
  try {
    const client = new RoomServiceClient(liveKitHttpUrl(cfg.livekitUrl), cfg.apiKey, cfg.apiSecret);
    const participants = await client.listParticipants(roomName);
    return { ended: false, viewerCount: Math.max(0, participants.length - 1) };
  } catch (error) {
    if (isLiveKitRoomMissingError(error)) {
      return { ended: true, viewerCount: 0 };
    }
    return null;
  }
}

async function deleteLiveKitRoom(roomName) {
  const cfg = readLiveKitConfig();
  if (!cfg.ok) return;
  try {
    const client = new RoomServiceClient(liveKitHttpUrl(cfg.livekitUrl), cfg.apiKey, cfg.apiSecret);
    await client.deleteRoom(roomName);
  } catch (_error) {
    // Room may already be closed.
  }
}

async function enrichHomePostsLiveState(posts) {
  const out = [];
  for (const post of posts) {
    if (!/^\[LIVE\]/i.test(String(post.caption || "").trim())) {
      out.push(post);
      continue;
    }
    const hasLiveMedia = !!(
      (typeof post.videoUrl === "string" && post.videoUrl.trim()) ||
      (typeof post.imageUrl === "string" && post.imageUrl.trim()) ||
      (Array.isArray(post.imageUrls) && post.imageUrls.length)
    );
    const dbActive = String(post.liveStatus || "").toLowerCase() === "active";
    if (hasLiveMedia || post.liveStatus === "ended") {
      if (post.liveStatus !== "active") {
        post.liveStatus = "ended";
        post.liveViewerCount = 0;
      }
      out.push(post);
      continue;
    }
    // If DB says active, trust it — skip LiveKit check entirely.
    // The end-live API is the single source of truth for stopping.
    if (dbActive) {
      post.liveStatus = "active";
      post.liveViewerCount = Number(post.liveViewerCount || 0);
      post.liveStartedAt = post.liveStartedAt || post.createdAt;
      out.push(post);
      continue;
    }
    const roomName = post.liveRoomName || `agrovibes-live-${post.id}`;
    const info = await fetchLiveRoomInfo(roomName);
    if (info === null) {
      post.liveStatus = post.liveStatus || "active";
      post.liveViewerCount = Number(post.liveViewerCount || 0);
      out.push(post);
      continue;
    }
    if (info.ended) {
      post.liveStatus = "ended";
      post.liveViewerCount = 0;
      if (Number.isFinite(Number(post.id)) && Number(post.id) > 0) {
        await query(
          `
          UPDATE home_posts
          SET live_status = 'ended', live_ended_at = COALESCE(live_ended_at, NOW())
          WHERE id = $1 AND COALESCE(live_status, '') <> 'ended'
          `,
          [post.id]
        );
      }
    } else {
      post.liveStatus = "active";
      post.liveViewerCount = info.viewerCount;
      post.liveStartedAt = post.liveStartedAt || post.createdAt;
    }
    out.push(post);
  }
  return out;
}

function dedupeHomePostRows(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const post = normalizeHomePostRow(row);
    const name = String(post.userName || "").trim().toLowerCase();
    const caption = String(post.caption || "").trim();
    const key = post.videoUrl ? `video:${post.videoUrl}:${name}:${caption}` : `id:${post.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(post);
  }
  return out;
}

async function invalidateProfilePostsCache(userId) {
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) return;
  await cacheDel(`v1:home:posts:mine:${id}`);
}

async function ensureHomeStoriesTable() {
  if (homeStoriesTableReady) return;
  await ensureLearnUsersTable();
  await query(
    `
    CREATE TABLE IF NOT EXISTS home_stories (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES learn_users(id) ON DELETE SET NULL,
      user_name TEXT NOT NULL,
      district TEXT NOT NULL,
      avatar_label TEXT NOT NULL,
      has_new BOOLEAN NOT NULL DEFAULT true,
      viewed BOOLEAN NOT NULL DEFAULT false,
      video_url TEXT,
      image_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    `
  );
  // Lightweight migration for older deployments.
  await query(`ALTER TABLE home_stories ADD COLUMN IF NOT EXISTS user_id INT REFERENCES learn_users(id) ON DELETE SET NULL`);
  await query(`ALTER TABLE home_stories ADD COLUMN IF NOT EXISTS video_url TEXT`);
  await query(`ALTER TABLE home_stories ADD COLUMN IF NOT EXISTS image_url TEXT`);
  homeStoriesTableReady = true;
}

async function findLearnUserIdForPostAuthor(displayName) {
  const trimmed = String(displayName || "").trim();
  if (!trimmed) return null;
  const normalizedName = trimmed.toLowerCase();
  const slug = slugUsernameFromName(trimmed) || null;
  const matchRes = await query(
    `
    SELECT id
    FROM learn_users
    WHERE
      LOWER(TRIM(username)) = $1
      OR LOWER(TRIM(full_name)) = $1
      OR LOWER(TRIM(SPLIT_PART(full_name, ' ', 1))) = $1
      OR ($2::text IS NOT NULL AND $2 <> '' AND LOWER(TRIM(username)) = $2)
    ORDER BY
      CASE WHEN email LIKE 'legacy_post_%' THEN 1 ELSE 0 END ASC,
      id ASC
    LIMIT 1
    `,
    [normalizedName, slug]
  );
  return matchRes.rows[0]?.id || null;
}

async function backfillHomePostUserIds() {
  await ensureHomePostsTable();
  await ensureLearnUsersTable();
  const legacyPosts = await query(
    `
    SELECT p.id, p.user_name AS "userName", p.user_id AS "userId"
    FROM home_posts p
    LEFT JOIN learn_users u ON u.id = p.user_id
    WHERE p.user_id IS NULL OR u.email LIKE 'legacy_post_%'
    ORDER BY p.id ASC
    `
  );
  if (!legacyPosts.rows.length) return;

  const fallbackPasswordHash = await bcrypt.hash(`legacy-${Date.now()}-${Math.random()}`, 10);
  for (const post of legacyPosts.rows) {
    const displayName = String(post.userName || "").trim() || "Farmer";
    let userId = await findLearnUserIdForPostAuthor(displayName);

    if (!userId && post.userId == null) {
      const syntheticEmail = `legacy_post_${post.id}@phone.agrovibes`;
      const created = await query(
        `
        INSERT INTO learn_users (email, password_hash, full_name, role, username)
        VALUES ($1, $2, $3, 'student', $4)
        RETURNING id
        `,
        [syntheticEmail, fallbackPasswordHash, displayName, null]
      );
      userId = created.rows[0]?.id || null;
    }

    if (userId && Number(post.userId) !== Number(userId)) {
      await query(`UPDATE home_posts SET user_id = $2 WHERE id = $1`, [post.id, userId]);
    }
  }
}

async function socialCountsForUser(userId) {
  const uid = Number(userId);
  const [followersRes, followingRes] = await Promise.all([
    query(`SELECT COUNT(*)::INT AS count FROM social_follows WHERE following_id = $1 AND status = 'accepted'`, [uid]),
    query(`SELECT COUNT(*)::INT AS count FROM social_follows WHERE follower_id = $1 AND status = 'accepted'`, [uid])
  ]);
  return {
    followersCount: followersRes.rows[0]?.count || 0,
    followingCount: followingRes.rows[0]?.count || 0
  };
}

async function socialListsForUser(userId) {
  const targetUserId = Number(userId);
  const [followersRes, followingRes] = await Promise.all([
    query(
      `
      SELECT u.id AS "userId", u.full_name AS "fullName", NULLIF(TRIM(u.username), '') AS "username",
             NULLIF(TRIM(u.avatar_url), '') AS "avatarUrl"
      FROM social_follows f
      JOIN learn_users u ON u.id = f.follower_id
      WHERE f.following_id = $1 AND f.status = 'accepted'
      ORDER BY u.full_name ASC
      `,
      [targetUserId]
    ),
    query(
      `
      SELECT u.id AS "userId", u.full_name AS "fullName", NULLIF(TRIM(u.username), '') AS "username",
             NULLIF(TRIM(u.avatar_url), '') AS "avatarUrl"
      FROM social_follows f
      JOIN learn_users u ON u.id = f.following_id
      WHERE f.follower_id = $1 AND f.status = 'accepted'
      ORDER BY u.full_name ASC
      `,
      [targetUserId]
    )
  ]);
  const mapRow = (row) => ({
    name: sanitizePersonDisplayName(row.fullName, row.username),
    key: String(row.userId),
    username: row.username || undefined,
    avatarUrl: row.avatarUrl || undefined
  });
  return {
    followers: followersRes.rows.map(mapRow),
    following: followingRes.rows.map(mapRow)
  };
}

async function relationshipForUsers(viewerUserId, targetUserId) {
  const viewerId = Number(viewerUserId);
  const targetId = Number(targetUserId);
  const result = await query(
    `
    SELECT follower_id AS "followerId", following_id AS "followingId", status
    FROM social_follows
    WHERE (follower_id = $1 AND following_id = $2)
       OR (follower_id = $2 AND following_id = $1)
    `,
    [viewerId, targetId]
  );
  const viewerEdge = result.rows.find((r) => Number(r.followerId) === viewerId && Number(r.followingId) === targetId);
  const reverseEdge = result.rows.find((r) => Number(r.followerId) === targetId && Number(r.followingId) === viewerId);
  const viewerStatus = viewerEdge?.status || "none";
  const reverseStatus = reverseEdge?.status || "none";
  return {
    viewerStatus,
    reverseStatus,
    canFollowBack: reverseStatus === "accepted" && viewerStatus !== "accepted" && viewerStatus !== "pending"
  };
}

router.get("/health", async (_req, res) => {
  try {
    await query("SELECT 1");
    const redis = isRedisConfigured() ? await cachePing() : { ok: false, skipped: true };
    const mediaProvider = getMediaStorageProvider();
    res.json({
      status: "ok",
      stack: {
        database: "postgresql",
        images: mediaProvider === "s3" ? "s3" : mediaProvider === "supabase" ? "supabase" : "none",
        cdn: mediaProvider === "s3" && isCloudFrontConfigured() ? "cloudfront" : null,
        notifications: "fcm",
        chat: "socket.io",
        analytics: "firebase",
        crashTracking: "firebase-crashlytics"
      },
      db: "connected",
      redis,
      media: { provider: mediaProvider, cloudFront: isCloudFrontConfigured() },
      push: { provider: "fcm", configured: isPushConfigured() },
      socket: { enabled: Boolean(getSocketIo()) }
    });
  } catch (error) {
    res.status(500).json({ status: "error", db: "disconnected", message: error.message });
  }
});

router.get("/v1/bootstrap", (_req, res) => {
  const mediaProvider = getMediaStorageProvider();
  res.json({
    app: "Cropvibe",
    modules: ["home", "marketplace", "create", "services", "community", "profile", "wallet", "escrow"],
    stack: {
      database: "postgresql",
      images: mediaProvider === "s3" ? "s3" : mediaProvider || "none",
      cdn: mediaProvider === "s3" && isCloudFrontConfigured() ? "cloudfront" : null,
      notifications: "fcm",
      chat: "socket.io",
      analytics: "firebase",
      crashTracking: "firebase-crashlytics"
    }
  });
});

async function issueAuthToken(user, req, deviceInfo) {
  const { sessionId } = await createAuthSession({
    userId: user.id,
    deviceInfo: deviceInfo || {},
    req
  });
  const token = signJwt({
    userId: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
    phone: user.phone,
    sessionId
  });
  return token;
}

router.post("/v1/auth/register", async (req, res) => {
  try {
    await ensureLearnUsersTable();
    const { email, password, fullName, role, username, phone } = req.body || {};
    const normalizedPhone = normalizeIndiaPhone(phone || email);
    const phoneDigits = normalizedPhone ? phoneDigitsOnly(normalizedPhone).slice(-10) : "";
    let storeEmail = phoneDigits || String(email || "").trim().toLowerCase();
    if (storeEmail.endsWith("@phone.agrovibes")) {
      const localDigits = storeEmail.split("@")[0].replace(/\D/g, "");
      if (localDigits.length >= 10) {
        storeEmail = localDigits.slice(-10);
      }
    }
    const normalizedUsername = String(username || "").trim().toLowerCase() || null;
    const safeRole = ["student", "instructor", "admin"].includes(String(role)) ? String(role) : "student";

    if (!normalizedPhone || !storeEmail || !password || String(password).length < 6 || !fullName) {
      res.status(400).json({ message: "phone, fullName and password (min 6 chars) are required" });
      return;
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const result = await query(
      `
      INSERT INTO learn_users (email, password_hash, full_name, role, username, phone)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING ${authUserSelect}
      `,
      [storeEmail, passwordHash, String(fullName).trim(), safeRole, normalizedUsername, normalizedPhone]
    );

    const user = authUserFromRow(result.rows[0]);
    const token = await issueAuthToken(user, req, req.body?.deviceInfo || req.body);
    res.status(201).json({ token, user });
  } catch (error) {
    const info = authRouteErrorInfo(error);
    if (info.status === 409) {
      res.status(409).json({ message: info.message });
      return;
    }
    if (info.status === 503) {
      res.status(503).json({ message: info.message });
      return;
    }
    res.status(500).json({ message: "Failed to register", error: info.error });
  }
});

router.post("/v1/auth/login", async (req, res) => {
  try {
    await ensureLearnUsersTable();
    const { email, identifier, password } = req.body || {};
    const normalizedIdentifier = String(identifier || email || "").trim().toLowerCase();
    const phoneIdentifier = normalizeIndiaPhone(normalizedIdentifier);
    const syntheticPhoneEmail = syntheticPhoneEmailFromIdentifier(normalizedIdentifier);
    if (!normalizedIdentifier || !password) {
      res.status(400).json({ message: "mobile number and password are required" });
      return;
    }

    const idDigits = phoneIdentifier ? phoneDigitsOnly(phoneIdentifier) : "";
    const phoneDigitsLast10 = idDigits.length >= 10 ? idDigits.slice(-10) : "";
    const syntheticLocal = syntheticPhoneEmail ? syntheticPhoneEmail.split("@")[0] : "";
    const phoneOnlyLogin = Boolean(phoneIdentifier || syntheticPhoneEmail);

    const result = await query(
      `
      SELECT ${authUserSelect}, password_hash AS "passwordHash"
      FROM learn_users
      WHERE ($6::BOOLEAN = false AND (
              LOWER(TRIM(email)) = $1
              OR LOWER(TRIM(username)) = $1
            ))
         OR ($2::TEXT IS NOT NULL AND $4::TEXT <> '' AND (
              phone = $2
              OR RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10) = $4
            ))
         OR ($3::TEXT IS NOT NULL AND LOWER(TRIM(email)) = $3)
         OR ($5::TEXT <> '' AND (
              LOWER(TRIM(email)) = $5
              OR (LOWER(TRIM(email)) LIKE '%@phone.agrovibes'
                  AND RIGHT(REGEXP_REPLACE(SPLIT_PART(LOWER(TRIM(email)), '@', 1), '[^0-9]', '', 'g'), 10) = $5)
            ))
      LIMIT 1
      `,
      [normalizedIdentifier, phoneIdentifier, syntheticPhoneEmail, phoneDigitsLast10, syntheticLocal, phoneOnlyLogin]
    );
    const userRow = result.rows[0];
    if (!userRow) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }
    const hash = String(userRow.passwordHash);
    let ok = await bcrypt.compare(String(password), hash);
    if (!ok) {
      ok = await bcrypt.compare(String(password).trim(), hash);
    }
    if (!ok) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }
    if (String(userRow.accountStatus || "active").toLowerCase() === "deleted") {
      res.status(403).json({ message: "This account was deleted. Please create a new account." });
      return;
    }

    const user = authUserFromRow(userRow);

    const plainMobileKey = phoneDigitsLast10 || syntheticLocal;

    if (phoneOnlyLogin && plainMobileKey) {
      const updates = [];
      const params = [];
      let idx = 1;
      const currentEmail = String(userRow.email || "").trim().toLowerCase();
      const normalizedCurrentEmail =
        currentEmail.endsWith("@phone.agrovibes")
          ? currentEmail.split("@")[0].replace(/\D/g, "").slice(-10)
          : currentEmail.replace(/\D/g, "").slice(-10) || currentEmail;
      if (normalizedCurrentEmail !== plainMobileKey) {
        updates.push(`email = $${idx++}`);
        params.push(plainMobileKey);
        user.email = plainMobileKey;
      }
      if (phoneIdentifier && !String(userRow.phone || "").trim()) {
        updates.push(`phone = $${idx++}`);
        params.push(phoneIdentifier);
        user.phone = phoneIdentifier;
      }
      if (updates.length) {
        params.push(userRow.id);
        await query(`UPDATE learn_users SET ${updates.join(", ")} WHERE id = $${idx}`, params);
      }
    }

    const token = await issueAuthToken(user, req, req.body?.deviceInfo || req.body);
    res.json({ token, user });
  } catch (error) {
    const info = authRouteErrorInfo(error);
    if (info.status === 503) {
      res.status(503).json({ message: info.message });
      return;
    }
    res.status(500).json({ message: "Failed to login", error: info.error });
  }
});

router.post("/v1/auth/phone/send-otp", async (req, res) => {
  try {
    const provider = otpProvider();
    const phone = normalizeIndiaPhone(req.body?.phone);
    const staticCode = staticOtpCode();
    if (!phone) {
      res.status(400).json({ message: "Enter a valid phone number" });
      return;
    }

    if (staticCode) {
      res.json({
        success: true,
        phone,
        provider: "static",
        channel: "sms",
        requestId: null,
        providerStatus: "static-otp-enabled",
        providerMessage: "Static OTP mode enabled. Use STATIC_OTP_CODE to verify."
      });
      return;
    }

    let canSend = true;
    try {
      await ensurePhoneOtpTable();
      const recentSendCheck = await query(
        `
        SELECT COUNT(*)::INT AS count
        FROM phone_otp_codes
        WHERE phone = $1
          AND created_at >= NOW() - INTERVAL '15 minutes'
        `,
        [phone]
      );
      canSend = (recentSendCheck.rows[0]?.count || 0) < 3;
    } catch (_e) {
      const memoryRows = phoneOtpMemory.get(phone) || [];
      const recent = memoryRows.filter((row) => row.createdAt > Date.now() - 15 * 60 * 1000);
      canSend = recent.length < 3;
    }
    if (!canSend) {
      res.status(429).json({ message: "Too many OTP requests. Try again later." });
      return;
    }

    const otp = randomOtp6();
    const otpHash = hashOtp(phone, otp);
    const sent = provider === "twilio" ? await sendTwilioVerifyOtp(phone) : await sendSmsOtp(phone, otp);

    try {
      await query(
        `
        INSERT INTO phone_otp_codes (phone, otp_hash, expires_at, attempts, used, channel, provider_request_id, provider_status, provider_message)
        VALUES ($1, $2, NOW() + INTERVAL '10 minutes', 0, false, $3, $4, $5, $6)
        `,
        [phone, otpHash, sent.channel, sent.providerRequestId || null, sent.providerStatus || null, sent.providerMessage || null]
      );
    } catch (_e) {
      const rows = phoneOtpMemory.get(phone) || [];
      rows.push({
        otpHash,
        expiresAt: Date.now() + 10 * 60 * 1000,
        attempts: 0,
        used: false,
        createdAt: Date.now()
      });
      phoneOtpMemory.set(phone, rows.slice(-5));
    }

    res.json({
      success: true,
      phone,
      provider,
      channel: sent.channel,
      requestId: sent.providerRequestId || null,
      providerStatus: sent.providerStatus || null,
      providerMessage: sent.providerMessage || null
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("send-otp failed", error);
    const errorMessage = String(error?.message || "");
    if (errorMessage.includes("SMS provider is not configured") || errorMessage.includes("Twilio Verify is not configured")) {
      res.status(503).json({
        message: "OTP service is not configured on this server",
        error: errorMessage
      });
      return;
    }
    res.status(500).json({ message: "Failed to send OTP", error: errorMessage || String(error) });
  }
});

router.post("/v1/auth/phone/verify-otp", async (req, res) => {
  try {
    const provider = otpProvider();
    const phone = normalizeIndiaPhone(req.body?.phone);
    const code = String(req.body?.code || "").replace(/\D/g, "");
    if (!phone || code.length !== 6) {
      res.status(400).json({ message: "Phone and 6-digit OTP are required" });
      return;
    }

    const isStaticOtp = matchesStaticOtp(code);

    let otpRow = null;
    let otpRowFromDb = false;
    if (!isStaticOtp) {
      try {
        await ensurePhoneOtpTable();
        const otpRows = await query(
          `
          SELECT id, otp_hash AS "otpHash", attempts, provider_request_id AS "providerRequestId"
          FROM phone_otp_codes
          WHERE phone = $1
            AND used = false
            AND expires_at > NOW()
          ORDER BY created_at DESC
          LIMIT 1
          `,
          [phone]
        );
        otpRow = otpRows.rows[0] || null;
        otpRowFromDb = Boolean(otpRow);
      } catch (_e) {
        const rows = phoneOtpMemory.get(phone) || [];
        otpRow = rows.find((row) => !row.used && row.expiresAt > Date.now()) || null;
        otpRowFromDb = false;
      }

      if (!otpRow && provider !== "twilio") {
        res.status(400).json({ message: "OTP expired. Please request a new code." });
        return;
      }

      if (otpRow && Number(otpRow.attempts || 0) >= 5) {
        res.status(429).json({ message: "Maximum attempts exceeded. Request OTP again." });
        return;
      }
    }

    let isValidOtp = false;
    if (isStaticOtp) {
      isValidOtp = true;
    } else if (provider === "twilio") {
      isValidOtp = await verifyTwilioOtp(phone, code);
    } else if (msg91Mode() === "widget" && otpRow?.providerRequestId) {
      const authKey = String(process.env.MSG91_AUTH_KEY || "").trim();
      const widgetId = String(process.env.MSG91_WIDGET_ID || "").trim();
      try {
        const verifyResponse = await fetch("https://api.msg91.com/api/v5/widget/verifyOtp", {
          method: "POST",
          headers: { "Content-Type": "application/json", token: authKey },
          body: JSON.stringify({
            widgetId,
            tokenAuth: authKey,
            reqId: otpRow.providerRequestId,
            otp: code
          })
        });
        if (verifyResponse.ok) {
          isValidOtp = true;
        }
      } catch (_e) {
        isValidOtp = false;
      }
    } else {
      const otpHash = hashOtp(phone, code);
      isValidOtp = otpHash === otpRow.otpHash;
    }

    if (!isValidOtp) {
      if (otpRowFromDb && otpRow?.id) {
        await query(`UPDATE phone_otp_codes SET attempts = attempts + 1 WHERE id = $1`, [otpRow.id]);
      } else if (otpRow) {
        otpRow.attempts = Number(otpRow.attempts || 0) + 1;
      }
      res.status(401).json({ message: "Invalid OTP" });
      return;
    }

    if (!isStaticOtp) {
      if (otpRowFromDb && otpRow?.id) {
        await query(`UPDATE phone_otp_codes SET used = true WHERE id = $1`, [otpRow.id]);
      } else if (otpRow) {
        otpRow.used = true;
      }
    }

    const syntheticEmail = `${phone.replace(/\D/g, "")}@phone.agrovibes`;
    let user = null;
    let isNewUser = false;
    try {
      await ensureLearnUsersTable();
      const lookup = await query(
        `
        SELECT ${authUserSelect}
        FROM learn_users
        WHERE phone = $1
        LIMIT 1
        `,
        [phone]
      );

      user = authUserFromRow(lookup.rows[0]);
      if (!user) {
        isNewUser = true;
        const tempPassword = crypto.randomBytes(24).toString("hex");
        const passwordHash = await bcrypt.hash(tempPassword, 10);
        const created = await query(
          `
          INSERT INTO learn_users (email, password_hash, full_name, role, phone)
          VALUES ($1, $2, $3, 'student', $4)
          RETURNING ${authUserSelect}
          `,
          [syntheticEmail, passwordHash, "Farmer", phone]
        );
        user = authUserFromRow(created.rows[0]);
      }
    } catch (_e) {
      user = phoneUserMemory.get(phone);
      if (!user) {
        isNewUser = true;
        user = {
          id: stableNumericId(`phone:${phone}`),
          email: syntheticEmail,
          fullName: "Farmer",
          role: "student",
          phone
        };
        phoneUserMemory.set(phone, user);
      }
    }

    const token = await issueAuthToken(user, req, req.body?.deviceInfo || req.body);
    res.json({ token, user, isNewUser });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("verify-otp failed", error);
    const message = String(error?.message || "");
    if (message.includes("duplicate key") || message.includes("unique")) {
      res.status(409).json({ message: "Phone number already linked to another account" });
      return;
    }
    res.status(500).json({ message: "Failed to verify OTP", error: error?.message || String(error) });
  }
});

async function applyPhonePasswordReset(phone, newPassword) {
  await ensureLearnUsersTable();
  const phoneDigits = phone.replace(/\D/g, "");
  const last10 = phoneDigits.length >= 10 ? phoneDigits.slice(-10) : phoneDigits;
  const passwordHash = await bcrypt.hash(newPassword, 10);
  return query(
    `
    UPDATE learn_users
    SET password_hash = $1
    WHERE phone = $2
       OR ($3 <> '' AND RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10) = $3)
    RETURNING id, email
    `,
    [passwordHash, phone, last10]
  );
}

router.post("/v1/auth/phone/reset-password", async (req, res) => {
  try {
    const provider = otpProvider();
    const phone = normalizeIndiaPhone(req.body?.phone);
    const code = String(req.body?.code || "").replace(/\D/g, "");
    const newPassword = String(req.body?.newPassword || "");

    if (!phone || code.length !== 6) {
      res.status(400).json({ message: "Phone and 6-digit OTP are required" });
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ message: "New password (min 6 chars) is required" });
      return;
    }

    if (matchesStaticOtp(code)) {
      const updated = await applyPhonePasswordReset(phone, newPassword);
      if (!updated.rows?.length) {
        res.status(404).json({ message: "Phone number not registered" });
        return;
      }
      res.json({ success: true });
      return;
    }

    let otpRow = null;
    let otpRowFromDb = false;
    try {
      await ensurePhoneOtpTable();
      const otpRows = await query(
        `
        SELECT id, otp_hash AS "otpHash", attempts, provider_request_id AS "providerRequestId"
        FROM phone_otp_codes
        WHERE phone = $1
          AND used = false
          AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [phone]
      );
      otpRow = otpRows.rows[0] || null;
      otpRowFromDb = Boolean(otpRow);
    } catch (_e) {
      const rows = phoneOtpMemory.get(phone) || [];
      otpRow = rows.find((row) => !row.used && row.expiresAt > Date.now()) || null;
      otpRowFromDb = false;
    }

    if (!otpRow && provider !== "twilio") {
      res.status(400).json({ message: "OTP expired. Please request a new code." });
      return;
    }

    if (otpRow && Number(otpRow.attempts || 0) >= 5) {
      res.status(429).json({ message: "Maximum attempts exceeded. Request OTP again." });
      return;
    }

    let isValidOtp = false;
    if (provider === "twilio") {
      isValidOtp = await verifyTwilioOtp(phone, code);
    } else if (msg91Mode() === "widget" && otpRow?.providerRequestId) {
      const authKey = String(process.env.MSG91_AUTH_KEY || "").trim();
      const widgetId = String(process.env.MSG91_WIDGET_ID || "").trim();
      try {
        const verifyResponse = await fetch("https://api.msg91.com/api/v5/widget/verifyOtp", {
          method: "POST",
          headers: { "Content-Type": "application/json", token: authKey },
          body: JSON.stringify({
            widgetId,
            tokenAuth: authKey,
            reqId: otpRow.providerRequestId,
            otp: code
          })
        });
        isValidOtp = verifyResponse.ok;
      } catch (_e) {
        isValidOtp = false;
      }
    } else {
      const otpHash = hashOtp(phone, code);
      isValidOtp = otpRow && otpHash === otpRow.otpHash;
    }

    if (!isValidOtp) {
      if (otpRowFromDb && otpRow?.id) {
        await query(`UPDATE phone_otp_codes SET attempts = attempts + 1 WHERE id = $1`, [otpRow.id]);
      } else if (otpRow) {
        otpRow.attempts = Number(otpRow.attempts || 0) + 1;
      }
      res.status(401).json({ message: "Invalid OTP" });
      return;
    }

    if (otpRowFromDb && otpRow?.id) {
      await query(`UPDATE phone_otp_codes SET used = true WHERE id = $1`, [otpRow.id]);
    } else if (otpRow) {
      otpRow.used = true;
    }

    const updated = await applyPhonePasswordReset(phone, newPassword);

    if (!updated.rows?.length) {
      res.status(404).json({ message: "Phone number not registered" });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("reset-password failed", error);
    res.status(500).json({ message: "Failed to reset password", error: error?.message || String(error) });
  }
});

router.get("/v1/auth/me", authRequired, async (req, res) => {
  try {
    await ensureLearnUsersTable();
    const result = await query(
      `SELECT ${authUserSelect}, password_updated_at AS "passwordUpdatedAt", created_at AS "createdAt" FROM learn_users WHERE id = $1 LIMIT 1`,
      [req.user.userId]
    );
    const user = authUserFromRow(result.rows[0]);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    const row = result.rows[0];
    res.json({
      user,
      passwordUpdatedAt: row.passwordUpdatedAt || row.createdAt || null
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load profile", error: error.message });
  }
});

router.post("/v1/auth/me/deactivate", authRequired, async (req, res) => {
  try {
    await ensureLearnUsersTable();
    const password = String(req.body?.password || "");
    if (!password) {
      res.status(400).json({ message: "Password is required to deactivate your account" });
      return;
    }
    const ok = await verifyUserPassword(req.user.userId, password);
    if (!ok) {
      res.status(401).json({ message: "Password is incorrect" });
      return;
    }
    const result = await query(
      `
      UPDATE learn_users
      SET account_status = 'deactivated'
      WHERE id = $1
      RETURNING ${authUserSelect}
      `,
      [req.user.userId]
    );
    if (!result.rows[0]) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    await cacheIncr("home:posts:gen");
    await cacheIncr("home:stories:gen");
    res.json({ success: true, user: authUserFromRow(result.rows[0]) });
  } catch (error) {
    res.status(500).json({ message: "Failed to deactivate account", error: error?.message || String(error) });
  }
});

router.post("/v1/auth/me/activate", authRequired, async (req, res) => {
  try {
    await ensureLearnUsersTable();
    const result = await query(
      `
      UPDATE learn_users
      SET account_status = 'active'
      WHERE id = $1
      RETURNING ${authUserSelect}
      `,
      [req.user.userId]
    );
    if (!result.rows[0]) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.json({ success: true, user: authUserFromRow(result.rows[0]) });
  } catch (error) {
    res.status(500).json({ message: "Failed to activate account", error: error?.message || String(error) });
  }
});

router.delete("/v1/auth/me", authRequired, async (req, res) => {
  try {
    await ensureLearnUsersTable();
    const password = String(req.body?.password || "");
    if (!password) {
      res.status(400).json({ message: "Password is required to delete your account" });
      return;
    }
    const ok = await verifyUserPassword(req.user.userId, password);
    if (!ok) {
      res.status(401).json({ message: "Password is incorrect" });
      return;
    }
    await query(`DELETE FROM learn_users WHERE id = $1`, [req.user.userId]);
    await cacheIncr("home:posts:gen");
    await cacheIncr("home:stories:gen");
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete account", error: error?.message || String(error) });
  }
});

router.get("/v1/auth/sessions", authRequired, async (req, res) => {
  try {
    let currentSessionId = req.user.sessionId || null;
    const deviceInfo = {
      deviceName: req.query.deviceName,
      platform: req.query.platform,
      locationLabel: req.query.locationLabel
    };
    if (!currentSessionId || !(await isSessionActive(currentSessionId, req.user.userId))) {
      const created = await createAuthSession({
        userId: req.user.userId,
        deviceInfo,
        req
      });
      currentSessionId = created.sessionId;
      const token = signJwt({
        userId: req.user.userId,
        email: req.user.email,
        role: req.user.role,
        fullName: req.user.fullName,
        phone: req.user.phone,
        sessionId: currentSessionId
      });
      res.setHeader("x-refresh-auth-token", token);
    }

    const sessions = await listUserSessions(req.user.userId, currentSessionId);
    const summaries = sessionSummaryByPlatform(sessions);
    const unrecognizedCount = sessions.filter((s) => !s.isRecognized && !s.isCurrent).length;
    res.json({
      sessions,
      platformSummaries: summaries,
      unrecognizedLoginCount: unrecognizedCount,
      hasUnrecognizedLogins: unrecognizedCount > 0,
      refreshedToken: res.getHeader("x-refresh-auth-token") || undefined
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load sessions", error: error?.message || String(error) });
  }
});

router.get("/v1/auth/sessions/:sessionId", authRequired, async (req, res) => {
  try {
    const session = await getUserSession(req.params.sessionId, req.user.userId);
    if (!session) {
      res.status(404).json({ message: "Session not found" });
      return;
    }
    res.json({
      session: {
        ...session,
        isCurrent: req.user.sessionId ? session.id === req.user.sessionId : false
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load session", error: error?.message || String(error) });
  }
});

router.post("/v1/auth/sessions/:sessionId/revoke", authRequired, async (req, res) => {
  try {
    const sessionId = String(req.params.sessionId || "");
    const revoked = await revokeSession(sessionId, req.user.userId);
    if (!revoked) {
      res.status(404).json({ message: "Session not found" });
      return;
    }
    res.json({ success: true, revokedSessionId: sessionId, isCurrent: sessionId === req.user.sessionId });
  } catch (error) {
    res.status(500).json({ message: "Failed to revoke session", error: error?.message || String(error) });
  }
});

router.post("/v1/auth/sessions/:sessionId/report", authRequired, async (req, res) => {
  try {
    const sessionId = String(req.params.sessionId || "");
    const reported = await markSessionUnrecognized(sessionId, req.user.userId);
    if (!reported) {
      res.status(404).json({ message: "Session not found" });
      return;
    }
    res.json({ success: true, revokedSessionId: sessionId, isCurrent: sessionId === req.user.sessionId });
  } catch (error) {
    res.status(500).json({ message: "Failed to report session", error: error?.message || String(error) });
  }
});

router.post("/v1/auth/sessions/revoke-others", authRequired, async (req, res) => {
  try {
    const count = await revokeOtherSessions(req.user.userId, req.user.sessionId || null);
    res.json({ success: true, revokedCount: count });
  } catch (error) {
    res.status(500).json({ message: "Failed to revoke other sessions", error: error?.message || String(error) });
  }
});

router.post("/v1/auth/sessions/reviewed", authRequired, async (req, res) => {
  try {
    await markDevicesReviewed(req.user.userId);
    res.json({ success: true, reviewedAt: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ message: "Failed to mark devices reviewed", error: error?.message || String(error) });
  }
});

router.get("/v1/auth/security-checkup", authRequired, async (req, res) => {
  try {
    const checkup = await getSecurityCheckup(req.user.userId, req.user.sessionId || null);
    if (!checkup) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.json(checkup);
  } catch (error) {
    res.status(500).json({ message: "Failed to load security checkup", error: error?.message || String(error) });
  }
});

router.get("/v1/admin/users", authRequired, requireRole("admin"), async (req, res) => {
  try {
    await ensureLearnUsersTable();
    await ensureHomePostsTable();
    await ensureSocialFollowsTable();
    await ensureDirectMessagesTable();

    const limitRaw = Number(req.query.limit || 100);
    const offsetRaw = Number(req.query.offset || 0);
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 100, 1), 500);
    const offset = Math.max(Number.isFinite(offsetRaw) ? offsetRaw : 0, 0);
    const search = String(req.query.search || "").trim();
    const searchLike = `%${search.toLowerCase()}%`;

    const usersResult = await query(
      `
      SELECT
        u.id,
        u.email,
        u.full_name AS "fullName",
        u.role,
        u.phone,
        u.username,
        u.avatar_url AS "avatarUrl",
        u.bio,
        u.website,
        u.location_label AS "locationLabel",
        u.created_at AS "createdAt",
        COUNT(*) OVER()::INT AS "totalCount",
        COALESCE(posts.posts_count, 0)::INT AS "postsCount",
        COALESCE(posts.reels_count, 0)::INT AS "reelsCount",
        COALESCE(followers.followers_count, 0)::INT AS "followersCount",
        COALESCE(following.following_count, 0)::INT AS "followingCount",
        COALESCE(sent.messages_sent_count, 0)::INT AS "messagesSentCount",
        COALESCE(received.messages_received_count, 0)::INT AS "messagesReceivedCount"
      FROM learn_users u
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::INT AS posts_count,
          COUNT(*) FILTER (WHERE video_url IS NOT NULL AND TRIM(video_url) <> '')::INT AS reels_count
        FROM home_posts p
        WHERE
          p.user_id = u.id
          OR LOWER(TRIM(p.user_name)) = LOWER(TRIM(u.full_name))
          OR (
            u.username IS NOT NULL AND TRIM(u.username) <> ''
            AND LOWER(TRIM(p.user_name)) = LOWER(TRIM(u.username))
          )
          OR (
            u.email IS NOT NULL AND TRIM(u.email) <> ''
            AND LOWER(TRIM(p.user_name)) = LOWER(TRIM(SPLIT_PART(u.email, '@', 1)))
          )
      ) posts ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::INT AS followers_count
        FROM social_follows f
        WHERE f.following_id = u.id AND f.status = 'accepted'
      ) followers ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::INT AS following_count
        FROM social_follows f
        WHERE f.follower_id = u.id AND f.status = 'accepted'
      ) following ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::INT AS messages_sent_count
        FROM direct_messages dm
        WHERE dm.sender_id = u.id
      ) sent ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::INT AS messages_received_count
        FROM direct_messages dm
        WHERE dm.receiver_id = u.id
      ) received ON TRUE
      WHERE (
        $1::TEXT = ''
        OR LOWER(COALESCE(u.full_name, '')) LIKE $2
        OR LOWER(COALESCE(u.email, '')) LIKE $2
        OR LOWER(COALESCE(u.username, '')) LIKE $2
        OR COALESCE(u.phone, '') LIKE $3
      )
      ORDER BY u.created_at DESC, u.id DESC
      LIMIT $4 OFFSET $5
      `,
      [search, searchLike, `%${search.replace(/\D/g, "")}%`, limit, offset]
    );

    const users = usersResult.rows.map(({ totalCount, ...user }) => user);
    const total = Number(usersResult.rows[0]?.totalCount || 0);
    res.json({ users, total, limit, offset });
  } catch (error) {
    res.status(500).json({ message: "Failed to list users", error: error.message });
  }
});

router.get("/v1/users", authRequired, async (req, res) => {
  try {
    await ensureLearnUsersTable();
    await ensureHomePostsTable();
    await ensureSocialFollowsTable();

    const viewerId = Number(req.user.userId);
    const limitRaw = Number(req.query.limit || 100);
    const offsetRaw = Number(req.query.offset || 0);
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 100, 1), 500);
    const offset = Math.max(Number.isFinite(offsetRaw) ? offsetRaw : 0, 0);
    const search = String(req.query.search || "").trim();
    const searchLike = `%${search.toLowerCase()}%`;

    const result = await query(
      `
      SELECT
        u.id,
        u.full_name AS "fullName",
        u.username,
        u.avatar_url AS "avatarUrl",
        u.bio,
        u.website,
        u.location_label AS "locationLabel",
        u.created_at AS "createdAt",
        COUNT(*) OVER()::INT AS "totalCount",
        COALESCE(posts.posts_count, 0)::INT AS "postsCount",
        COALESCE(posts.reels_count, 0)::INT AS "reelsCount",
        COALESCE(followers.followers_count, 0)::INT AS "followersCount",
        COALESCE(following.following_count, 0)::INT AS "followingCount",
        CASE
          WHEN u.id = $1 THEN 'self'
          ELSE COALESCE(viewer_follow.status, 'none')
        END AS "viewerStatus",
        COALESCE(reverse_follow.status, 'none') AS "reverseStatus"
      FROM learn_users u
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::INT AS posts_count,
          COUNT(*) FILTER (WHERE video_url IS NOT NULL AND TRIM(video_url) <> '')::INT AS reels_count
        FROM home_posts p
        WHERE
          p.user_id = u.id
          OR LOWER(TRIM(p.user_name)) = LOWER(TRIM(u.full_name))
          OR (
            u.username IS NOT NULL AND TRIM(u.username) <> ''
            AND LOWER(TRIM(p.user_name)) = LOWER(TRIM(u.username))
          )
          OR (
            u.email IS NOT NULL AND TRIM(u.email) <> ''
            AND LOWER(TRIM(p.user_name)) = LOWER(TRIM(SPLIT_PART(u.email, '@', 1)))
          )
      ) posts ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::INT AS followers_count
        FROM social_follows f
        WHERE f.following_id = u.id AND f.status = 'accepted'
      ) followers ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::INT AS following_count
        FROM social_follows f
        WHERE f.follower_id = u.id AND f.status = 'accepted'
      ) following ON TRUE
      LEFT JOIN social_follows viewer_follow ON viewer_follow.follower_id = $1 AND viewer_follow.following_id = u.id
      LEFT JOIN social_follows reverse_follow ON reverse_follow.follower_id = u.id AND reverse_follow.following_id = $1
      WHERE (
        $2::TEXT = ''
        OR LOWER(COALESCE(u.full_name, '')) LIKE $3
        OR LOWER(COALESCE(u.username, '')) LIKE $3
      )
      AND (COALESCE(u.account_status, 'active') <> 'deactivated' OR u.id = $1)
      ORDER BY
        CASE WHEN u.id = $1 THEN 1 ELSE 0 END ASC,
        u.created_at DESC,
        u.id DESC
      LIMIT $4 OFFSET $5
      `,
      [viewerId, search, searchLike, limit, offset]
    );

    const users = result.rows.map(({ totalCount, reverseStatus, ...row }) => ({
      ...row,
      fullName: sanitizePersonDisplayName(row.fullName, row.username),
      canFollowBack: reverseStatus === "accepted" && row.viewerStatus !== "accepted" && row.viewerStatus !== "pending"
    }));
    const total = Number(result.rows[0]?.totalCount || 0);
    res.json({ users, total, limit, offset });
  } catch (error) {
    res.status(500).json({ message: "Failed to list users", error: error.message });
  }
});

function validateNewPassword(password) {
  const value = String(password || "");
  if (value.length < 6) return "New password must be at least 6 characters";
  if (!/[A-Za-z]/.test(value)) return "New password must include a letter";
  if (!/\d/.test(value)) return "New password must include a number";
  if (!/[!$%@#&*()_+\-=[\]{};':"\\|,.<>/?]/.test(value)) {
    return "New password must include a special character";
  }
  return null;
}

router.post("/v1/auth/me/change-password", authRequired, async (req, res) => {
  try {
    await ensureLearnUsersTable();
    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = String(req.body?.newPassword || "");
    const passwordError = validateNewPassword(newPassword);
    if (!currentPassword) {
      res.status(400).json({ message: "Current password is required" });
      return;
    }
    if (passwordError) {
      res.status(400).json({ message: passwordError });
      return;
    }
    if (currentPassword === newPassword) {
      res.status(400).json({ message: "New password must be different from your current password" });
      return;
    }

    const existing = await query(
      `SELECT password_hash AS "passwordHash" FROM learn_users WHERE id = $1 LIMIT 1`,
      [req.user.userId]
    );
    const row = existing.rows[0];
    if (!row) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const hash = String(row.passwordHash || "");
    let ok = await bcrypt.compare(currentPassword, hash);
    if (!ok) {
      ok = await bcrypt.compare(currentPassword.trim(), hash);
    }
    if (!ok) {
      res.status(401).json({ message: "Current password is incorrect" });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await query(
      `
      UPDATE learn_users
      SET password_hash = $1, password_updated_at = NOW()
      WHERE id = $2
      `,
      [passwordHash, req.user.userId]
    );

    if (req.body?.logoutOtherDevices) {
      await revokeOtherSessions(req.user.userId, req.user.sessionId || null);
    }

    res.json({ success: true, passwordUpdatedAt: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ message: "Failed to change password", error: error?.message || String(error) });
  }
});

router.put("/v1/auth/me", authRequired, async (req, res) => {
  try {
    await ensureLearnUsersTable();
    const fullName = String(req.body?.fullName || "").trim();
    const usernameRaw = String(req.body?.username || "").trim().toLowerCase();
    const username = usernameRaw
      ? usernameRaw
          .replace(/[^a-z0-9_.]+/g, "_")
          .replace(/^_+|_+$/g, "")
      : null;
    const bio = String(req.body?.bio || "").trim().slice(0, 150) || null;
    const website = String(req.body?.website || "").trim().slice(0, 200) || null;
    const locationLabel = String(req.body?.locationLabel || "").trim().slice(0, 120) || null;
    const avatarUrl = stripLegacyCloudinaryUrl(String(req.body?.avatarUrl || "").trim().slice(0, 1000));

    if (!fullName) {
      res.status(400).json({ message: "Name is required" });
      return;
    }
    if (usernameRaw && !username) {
      res.status(400).json({ message: "Username can only include letters, numbers, underscores, and dots" });
      return;
    }

    const updated = await query(
      `
      UPDATE learn_users
      SET
        full_name = $1,
        username = $2,
        bio = $3,
        website = $4,
        location_label = $5,
        avatar_url = $6
      WHERE id = $7
      RETURNING ${authUserSelect}
      `,
      [fullName, username, bio, website, locationLabel, avatarUrl, req.user.userId]
    );
    const user = authUserFromRow(updated.rows[0]);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    const token = signJwt({
      userId: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      phone: user.phone,
      sessionId: req.user.sessionId
    });
    res.json({ token, user });
  } catch (error) {
    const msg = String(error.message || "");
    if (msg.includes("duplicate key") || msg.includes("unique")) {
      res.status(409).json({ message: "Username already taken" });
      return;
    }
    res.status(500).json({ message: "Failed to update profile", error: error.message });
  }
});

router.get("/v1/social/profile-stats/:userId", authRequired, async (req, res) => {
  try {
    await ensureSocialNotificationsTable();
    await ensureLearnUsersTable();
    await ensureHomePostsTable();
    const targetUserId = Number(req.params.userId);
    if (!Number.isFinite(targetUserId)) {
      res.status(400).json({ message: "Valid userId is required" });
      return;
    }
    const userRes = await query(
      `
      SELECT
        u.id,
        u.full_name AS "fullName",
        u.username,
        u.avatar_url AS "avatarUrl",
        u.bio,
        u.website,
        u.location_label AS "locationLabel",
        u.created_at AS "createdAt",
        u.account_status AS "accountStatus",
        COALESCE(posts.posts_count, 0)::INT AS "postsCount",
        COALESCE(posts.reels_count, 0)::INT AS "reelsCount"
      FROM learn_users u
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::INT AS posts_count,
          COUNT(*) FILTER (WHERE video_url IS NOT NULL AND TRIM(video_url) <> '')::INT AS reels_count
        FROM home_posts p
        WHERE
          p.user_id = u.id
          OR LOWER(TRIM(p.user_name)) = LOWER(TRIM(u.full_name))
          OR (
            u.username IS NOT NULL AND TRIM(u.username) <> ''
            AND LOWER(TRIM(p.user_name)) = LOWER(TRIM(u.username))
          )
          OR (
            u.email IS NOT NULL AND TRIM(u.email) <> ''
            AND LOWER(TRIM(p.user_name)) = LOWER(TRIM(SPLIT_PART(u.email, '@', 1)))
          )
      ) posts ON TRUE
      WHERE u.id = $1
      LIMIT 1
      `,
      [targetUserId]
    );
    if (!userRes.rows[0]) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    const viewerId = Number(req.user.userId);
    const accountStatus = String(userRes.rows[0].accountStatus || "active").toLowerCase();
    if (accountStatus === "deactivated" && viewerId !== targetUserId) {
      res.status(404).json({ message: "This account is unavailable" });
      return;
    }
    const profile = userRes.rows[0];
    profile.fullName = sanitizePersonDisplayName(profile.fullName, profile.username);
    const counts = await socialCountsForUser(targetUserId);
    const lists = await socialListsForUser(targetUserId);
    const relation =
      Number(req.user.userId) === targetUserId
        ? { viewerStatus: "self", reverseStatus: "self", canFollowBack: false }
        : await relationshipForUsers(req.user.userId, targetUserId);
    res.json({ ...profile, ...counts, ...lists, ...relation });
  } catch (error) {
    res.status(500).json({ message: "Failed to load profile stats", error: error.message });
  }
});

/** Accepted followers + following + pending outgoing (for profile lists). Viewer must match userId. */
router.get("/v1/social/network/:userId", authRequired, async (req, res) => {
  try {
    await ensureSocialFollowsTable();
    const targetUserId = Number(req.params.userId);
    if (!Number.isFinite(targetUserId) || Number(req.user.userId) !== targetUserId) {
      res.status(403).json({ message: "You can only load your own follow network" });
      return;
    }

    const followersRes = await query(
      `
      SELECT u.id AS "userId", u.full_name AS "fullName", NULLIF(TRIM(u.avatar_url), '') AS "avatarUrl"
      FROM social_follows f
      JOIN learn_users u ON u.id = f.follower_id
      WHERE f.following_id = $1 AND f.status = 'accepted'
      ORDER BY u.full_name ASC
      `,
      [targetUserId]
    );
    const followingRes = await query(
      `
      SELECT u.id AS "userId", u.full_name AS "fullName", NULLIF(TRIM(u.avatar_url), '') AS "avatarUrl"
      FROM social_follows f
      JOIN learn_users u ON u.id = f.following_id
      WHERE f.follower_id = $1 AND f.status = 'accepted'
      ORDER BY u.full_name ASC
      `,
      [targetUserId]
    );
    const pendingOutRes = await query(
      `
      SELECT u.id AS "userId", u.full_name AS "fullName", NULLIF(TRIM(u.avatar_url), '') AS "avatarUrl"
      FROM social_follows f
      JOIN learn_users u ON u.id = f.following_id
      WHERE f.follower_id = $1 AND f.status = 'pending'
      ORDER BY u.full_name ASC
      `,
      [targetUserId]
    );

    const followingAcceptedIds = new Set(followingRes.rows.map((r) => Number(r.userId)));
    const pendingFollowingIds = new Set(pendingOutRes.rows.map((r) => Number(r.userId)));

    const followers = followersRes.rows.map((row) => {
      const uid = Number(row.userId);
      const iFollow = followingAcceptedIds.has(uid);
      const iPending = pendingFollowingIds.has(uid);
      const viewerStatus = iFollow ? "accepted" : iPending ? "pending" : "none";
      return {
        name: row.fullName,
        key: String(row.userId),
        avatarUrl: row.avatarUrl || undefined,
        viewerStatus,
        canFollowBack: viewerStatus === "none"
      };
    });

    const following = followingRes.rows.map((row) => ({
      name: row.fullName,
      key: String(row.userId),
      avatarUrl: row.avatarUrl || undefined,
      viewerStatus: "accepted",
      canFollowBack: false
    }));

    res.json({ followers, following });
  } catch (error) {
    res.status(500).json({ message: "Failed to load follow network", error: error.message });
  }
});

/** Public follower/following lists for any profile (read-only). */
router.get("/v1/social/public-lists/:userId", authRequired, async (req, res) => {
  try {
    await ensureSocialFollowsTable();
    const targetUserId = Number(req.params.userId);
    if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
      res.status(400).json({ message: "Valid userId is required" });
      return;
    }

    const lists = await socialListsForUser(targetUserId);
    res.json(lists);
  } catch (error) {
    res.status(500).json({ message: "Failed to load public follow lists", error: error.message });
  }
});

router.get("/v1/social/relationships", authRequired, async (req, res) => {
  try {
    await ensureSocialNotificationsTable();
    const raw = String(req.query.userIds || "");
    const ids = raw
      .split(",")
      .map((v) => Number(String(v).trim()))
      .filter((v) => Number.isFinite(v) && v > 0);
    const uniqueIds = [...new Set(ids)].filter((id) => id !== Number(req.user.userId)).slice(0, 80);
    if (!uniqueIds.length) {
      res.json({ relationships: {} });
      return;
    }

    const result = await query(
      `
      SELECT follower_id AS "followerId", following_id AS "followingId", status
      FROM social_follows
      WHERE (follower_id = $1 AND following_id = ANY($2::INT[]))
         OR (following_id = $1 AND follower_id = ANY($2::INT[]))
      `,
      [req.user.userId, uniqueIds]
    );
    const map = {};
    for (const uid of uniqueIds) {
      const viewerEdge = result.rows.find((r) => Number(r.followerId) === Number(req.user.userId) && Number(r.followingId) === uid);
      const reverseEdge = result.rows.find((r) => Number(r.followingId) === Number(req.user.userId) && Number(r.followerId) === uid);
      const viewerStatus = viewerEdge?.status || "none";
      const reverseStatus = reverseEdge?.status || "none";
      map[uid] = {
        viewerStatus,
        reverseStatus,
        canFollowBack: reverseStatus === "accepted" && viewerStatus !== "accepted" && viewerStatus !== "pending"
      };
    }
    res.json({ relationships: map });
  } catch (error) {
    res.status(500).json({ message: "Failed to load relationships", error: error.message });
  }
});

/** Instagram-style context: who you both know (people you follow who also follow them). */
router.post("/v1/social/mutual-connections", authRequired, async (req, res) => {
  try {
    await ensureSocialFollowsTable();
    const viewerId = Number(req.user.userId);
    const rawIds = Array.isArray(req.body?.userIds) ? req.body.userIds : [];
    const userIds = [
      ...new Set(
        rawIds
          .map((v) => Number(v))
          .filter((id) => Number.isFinite(id) && id > 0 && id !== viewerId)
      )
    ].slice(0, 40);
    if (!userIds.length) {
      res.json({ connections: {} });
      return;
    }

    const connections = {};
    for (const uid of userIds) {
      connections[uid] = { followsYou: false, mutual: [], mutualCount: 0 };
    }

    const followsYouRes = await query(
      `
      SELECT follower_id AS "userId"
      FROM social_follows
      WHERE following_id = $1
        AND follower_id = ANY($2::INT[])
        AND status = 'accepted'
      `,
      [viewerId, userIds]
    );
    for (const row of followsYouRes.rows) {
      const uid = Number(row.userId);
      if (connections[uid]) connections[uid].followsYou = true;
    }

    const mutualRes = await query(
      `
      SELECT
        f_target.following_id AS "targetUserId",
        u.id AS "userId",
        u.full_name AS "fullName",
        NULLIF(TRIM(u.avatar_url), '') AS "avatarUrl"
      FROM social_follows f_viewer
      JOIN social_follows f_target
        ON f_target.follower_id = f_viewer.following_id
        AND f_target.following_id = ANY($2::INT[])
        AND f_target.status = 'accepted'
      JOIN learn_users u ON u.id = f_viewer.following_id
      WHERE f_viewer.follower_id = $1
        AND f_viewer.status = 'accepted'
      ORDER BY f_target.following_id ASC, u.full_name ASC
      `,
      [viewerId, userIds]
    );

    const grouped = {};
    for (const row of mutualRes.rows) {
      const tid = Number(row.targetUserId);
      if (!grouped[tid]) grouped[tid] = [];
      grouped[tid].push({
        userId: Number(row.userId),
        fullName: row.fullName,
        avatarUrl: row.avatarUrl || undefined
      });
    }
    for (const tid of userIds) {
      const all = grouped[tid] || [];
      connections[tid].mutual = all.slice(0, 3);
      connections[tid].mutualCount = all.length;
    }

    res.json({ connections });
  } catch (error) {
    res.status(500).json({ message: "Failed to load mutual connections", error: error.message });
  }
});

router.post("/v1/social/follow/request", authRequired, async (req, res) => {
  try {
    await ensureSocialNotificationsTable();
    const actorUserId = Number(req.user.userId);
    const targetUserId = Number(req.body?.targetUserId);
    if (!Number.isFinite(targetUserId)) {
      res.status(400).json({ message: "targetUserId is required" });
      return;
    }
    if (targetUserId === actorUserId) {
      res.status(400).json({ message: "You cannot follow yourself" });
      return;
    }

    const userExists = await query(`SELECT id FROM learn_users WHERE id = $1 LIMIT 1`, [targetUserId]);
    if (!userExists.rows[0]) {
      res.status(404).json({ message: "Target user not found" });
      return;
    }

    const existing = await query(
      `SELECT id, status FROM social_follows WHERE follower_id = $1 AND following_id = $2 LIMIT 1`,
      [actorUserId, targetUserId]
    );

    let followRow = null;
    if (!existing.rows[0]) {
      const inserted = await query(
        `
        INSERT INTO social_follows (follower_id, following_id, status, updated_at, responded_at)
        VALUES ($1, $2, 'pending', NOW(), NULL)
        RETURNING id, status
        `,
        [actorUserId, targetUserId]
      );
      followRow = inserted.rows[0];
    } else if (existing.rows[0].status === "accepted") {
      followRow = existing.rows[0];
    } else if (existing.rows[0].status === "pending") {
      followRow = existing.rows[0];
    } else {
      const updated = await query(
        `
        UPDATE social_follows
        SET status = 'pending', updated_at = NOW(), responded_at = NULL
        WHERE id = $1
        RETURNING id, status
        `,
        [existing.rows[0].id]
      );
      followRow = updated.rows[0];
    }

    if (followRow?.status === "pending") {
      await query(
        `
        INSERT INTO social_notifications (user_id, actor_id, follow_id, type, is_read)
        VALUES ($1, $2, $3, 'follow_request', false)
        `,
        [targetUserId, actorUserId, followRow.id]
      );
      fireSocialPush({
        userId: targetUserId,
        type: "follow_request",
        actorName: await actorDisplayName(actorUserId),
        followId: followRow.id
      });
    }

    const [actorCounts, targetCounts] = await Promise.all([socialCountsForUser(actorUserId), socialCountsForUser(targetUserId)]);
    res.status(201).json({
      follow: { id: followRow.id, status: followRow.status, followerId: actorUserId, followingId: targetUserId },
      actorCounts,
      targetCounts
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to request follow", error: error.message });
  }
});

router.post("/v1/social/follow/unfollow", authRequired, async (req, res) => {
  try {
    await ensureSocialNotificationsTable();
    const actorUserId = Number(req.user.userId);
    const targetUserId = Number(req.body?.targetUserId);
    if (!Number.isFinite(targetUserId)) {
      res.status(400).json({ message: "targetUserId is required" });
      return;
    }
    if (targetUserId === actorUserId) {
      res.status(400).json({ message: "Invalid unfollow target" });
      return;
    }

    await query(
      `
      UPDATE social_follows
      SET status = 'declined', responded_at = NOW(), updated_at = NOW()
      WHERE follower_id = $1 AND following_id = $2 AND status IN ('accepted', 'pending')
      `,
      [actorUserId, targetUserId]
    );

    const [actorCounts, targetCounts] = await Promise.all([socialCountsForUser(actorUserId), socialCountsForUser(targetUserId)]);
    res.json({ ok: true, actorCounts, targetCounts });
  } catch (error) {
    res.status(500).json({ message: "Failed to unfollow", error: error.message });
  }
});

router.post("/v1/social/follow/remove-follower", authRequired, async (req, res) => {
  try {
    await ensureSocialNotificationsTable();
    const actorUserId = Number(req.user.userId);
    const targetUserId = Number(req.body?.targetUserId);
    if (!Number.isFinite(targetUserId)) {
      res.status(400).json({ message: "targetUserId is required" });
      return;
    }
    if (targetUserId === actorUserId) {
      res.status(400).json({ message: "Invalid remove follower target" });
      return;
    }

    await query(
      `
      UPDATE social_follows
      SET status = 'declined', responded_at = NOW(), updated_at = NOW()
      WHERE follower_id = $1 AND following_id = $2 AND status IN ('accepted', 'pending')
      `,
      [targetUserId, actorUserId]
    );

    const [actorCounts, targetCounts] = await Promise.all([socialCountsForUser(actorUserId), socialCountsForUser(targetUserId)]);
    res.json({ ok: true, actorCounts, targetCounts });
  } catch (error) {
    res.status(500).json({ message: "Failed to remove follower", error: error.message });
  }
});

/**
 * Upsert follow rows from client-side (AsyncStorage) history into social_follows.
 * Body: { edges: [{ peerFullName, relation: "i_follow" | "follows_me", status: "accepted" | "pending" }] }
 * peerFullName must match learn_users.full_name (case-insensitive). No notifications are created here.
 */
router.post("/v1/social/follow/sync-local", authRequired, async (req, res) => {
  try {
    await ensureSocialFollowsTable();
    const me = Number(req.user.userId);
    const raw = Array.isArray(req.body?.edges) ? req.body.edges : [];
    const edges = raw.slice(0, 120);
    let imported = 0;
    /** @type {{ peerFullName: string; relation: string; status: string }[]} */
    const synced = [];

    for (const edge of edges) {
      const peerFullName = String(edge.peerFullName || "").trim();
      const relation = String(edge.relation || "").trim();
      const status = edge.status === "accepted" ? "accepted" : edge.status === "pending" ? "pending" : null;
      if (!peerFullName || !status || !["i_follow", "follows_me"].includes(relation)) continue;

      const peerRes = await query(
        `SELECT id FROM learn_users WHERE LOWER(TRIM(full_name)) = LOWER(TRIM($1)) LIMIT 1`,
        [peerFullName]
      );
      const peerId = peerRes.rows[0]?.id != null ? Number(peerRes.rows[0].id) : null;
      if (!peerId || peerId === me) continue;

      const followerId = relation === "i_follow" ? me : peerId;
      const followingId = relation === "i_follow" ? peerId : me;

      await query(
        `
        INSERT INTO social_follows (follower_id, following_id, status, updated_at, responded_at)
        VALUES ($1, $2, $3, NOW(), CASE WHEN $3 = 'pending' THEN NULL ELSE NOW() END)
        ON CONFLICT (follower_id, following_id)
        DO UPDATE SET
          status = EXCLUDED.status,
          updated_at = NOW(),
          responded_at = CASE
            WHEN EXCLUDED.status = 'pending' THEN NULL
            ELSE COALESCE(social_follows.responded_at, NOW())
          END
        `,
        [followerId, followingId, status]
      );
      imported += 1;
      synced.push({ peerFullName, relation, status });
    }

    const counts = await socialCountsForUser(me);
    res.json({ ok: true, imported, synced, followersCount: counts.followersCount, followingCount: counts.followingCount });
  } catch (error) {
    res.status(500).json({ message: "Failed to sync local follows", error: error.message });
  }
});

router.post("/v1/social/follow/:followId/respond", authRequired, async (req, res) => {
  try {
    await ensureSocialNotificationsTable();
    const followId = Number(req.params.followId);
    const action = String(req.body?.action || "").trim().toLowerCase();
    if (!Number.isFinite(followId) || !["accept", "decline"].includes(action)) {
      res.status(400).json({ message: "Valid followId and action(accept/decline) are required" });
      return;
    }

    const followRes = await query(
      `
      SELECT id, follower_id AS "followerId", following_id AS "followingId", status
      FROM social_follows
      WHERE id = $1
      LIMIT 1
      `,
      [followId]
    );
    const follow = followRes.rows[0];
    if (!follow) {
      res.status(404).json({ message: "Follow request not found" });
      return;
    }
    if (Number(follow.followingId) !== Number(req.user.userId)) {
      res.status(403).json({ message: "You cannot respond to this request" });
      return;
    }
    if (follow.status !== "pending") {
      res.status(409).json({ message: "Request already resolved" });
      return;
    }

    const nextStatus = action === "accept" ? "accepted" : "declined";
    const updated = await query(
      `
      UPDATE social_follows
      SET status = $2, responded_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING id, follower_id AS "followerId", following_id AS "followingId", status
      `,
      [followId, nextStatus]
    );
    const updatedFollow = updated.rows[0];

    await query(
      `
      UPDATE social_notifications
      SET is_read = true
      WHERE follow_id = $1 AND user_id = $2 AND type = 'follow_request'
      `,
      [followId, req.user.userId]
    );

    if (nextStatus === "accepted") {
      await query(
        `
        INSERT INTO social_notifications (user_id, actor_id, follow_id, type, is_read)
        VALUES ($1, $2, $3, 'follow_accept', false)
        `,
        [updatedFollow.followerId, updatedFollow.followingId, followId]
      );
      fireSocialPush({
        userId: updatedFollow.followerId,
        type: "follow_accept",
        actorName: await actorDisplayName(updatedFollow.followingId),
        followId
      });
    }

    const [actorCounts, targetCounts] = await Promise.all([
      socialCountsForUser(updatedFollow.followerId),
      socialCountsForUser(updatedFollow.followingId)
    ]);

    res.json({
      follow: updatedFollow,
      actorCounts,
      targetCounts
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to respond to follow request", error: error.message });
  }
});

router.get("/v1/social/notifications", authRequired, async (req, res) => {
  try {
    await ensureSocialNotificationsTable();
    const currentUserId = Number(req.user.userId);
    await ensureHomePostsTable();
    const result = await query(
      `
      SELECT
        n.id,
        n.type,
        n.is_read AS "isRead",
        n.created_at AS "createdAt",
        n.follow_id AS "followId",
        n.actor_id AS "actorId",
        n.post_id AS "postId",
        n.comment_excerpt AS "commentExcerpt",
        u.full_name AS "actorName",
        NULLIF(TRIM(u.avatar_url), '') AS "actorAvatarUrl",
        COALESCE(f.status, 'pending') AS "followStatus",
        CASE
          WHEN p.video_url IS NOT NULL AND TRIM(COALESCE(p.video_url, '')) <> '' THEN true
          ELSE false
        END AS "postIsReel",
        p.thumbnail_url AS "postThumbnailUrl",
        p.image_url AS "postImageUrl",
        p.video_url AS "postVideoUrl",
        p.live_status AS "postLiveStatus",
        p.live_ended_at AS "postLiveEndedAt"
      FROM social_notifications n
      JOIN learn_users u ON u.id = n.actor_id
      LEFT JOIN social_follows f ON f.id = n.follow_id
      LEFT JOIN home_posts p ON p.id = n.post_id
      WHERE n.user_id = $1
        AND n.created_at <= NOW()
      ORDER BY n.created_at DESC
      LIMIT 100
      `,
      [currentUserId]
    );

    const followRequests = result.rows.filter((r) => r.type === "follow_request" && !r.isRead && r.followStatus === "pending");
    const followAccepted = result.rows.filter((r) => r.type === "follow_accept");
    const postLikes = result.rows.filter((r) => r.type === "post_like");
    const postComments = result.rows.filter(
      (r) => r.type === "post_comment" || r.type === "comment_reply"
    );
    const liveStarts = result.rows.filter(
      (r) =>
        r.type === "live_start" ||
        r.type === "live_scheduled" ||
        r.type === "live_reminder" ||
        r.type === "live_host_reminder"
    );
    const unreadCount = result.rows.filter((r) => {
      if (r.isRead) return false;
      if (r.type === "follow_request") return r.followStatus === "pending";
      return (
        r.type === "follow_accept" ||
        r.type === "post_like" ||
        r.type === "post_comment" ||
        r.type === "comment_reply" ||
        r.type === "live_start" ||
        r.type === "live_scheduled" ||
        r.type === "live_reminder" ||
        r.type === "live_host_reminder"
      );
    }).length;
    res.json({
      followRequests,
      followAccepted,
      postLikes,
      postComments,
      liveStarts,
      unreadCount
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load notifications", error: error.message });
  }
});

router.get("/v1/push/config", authRequired, async (_req, res) => {
  res.json({
    provider: "fcm",
    configured: isPushConfigured()
  });
});

router.get("/v1/push/settings", authRequired, async (req, res) => {
  try {
    const settings = await getPushSettings(Number(req.user.userId));
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: "Failed to load push settings", error: error.message });
  }
});

router.put("/v1/push/settings", authRequired, async (req, res) => {
  try {
    const pushEnabled = req.body?.pushEnabled;
    const messagesEnabled = req.body?.messagesEnabled;
    const activityEnabled = req.body?.activityEnabled;
    if (
      typeof pushEnabled !== "boolean" ||
      typeof messagesEnabled !== "boolean" ||
      typeof activityEnabled !== "boolean"
    ) {
      res.status(400).json({
        message: "pushEnabled, messagesEnabled and activityEnabled booleans are required"
      });
      return;
    }
    const settings = await setPushSettings(Number(req.user.userId), {
      pushEnabled,
      messagesEnabled,
      activityEnabled
    });
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: "Failed to save push settings", error: error.message });
  }
});

router.post("/v1/push/register", authRequired, async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();
    const platform = String(req.body?.platform || "android").trim().slice(0, 16) || "android";
    if (!token) {
      res.status(400).json({ message: "token is required" });
      return;
    }
    await registerPushDeviceToken({
      userId: Number(req.user.userId),
      token,
      platform
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to register push token", error: error.message });
  }
});

router.delete("/v1/push/register", authRequired, async (req, res) => {
  try {
    const token = String(req.body?.token || req.query?.token || "").trim();
    if (!token) {
      res.status(400).json({ message: "token is required" });
      return;
    }
    const result = await unregisterPushDeviceToken({
      userId: Number(req.user.userId),
      token
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to unregister push token", error: error.message });
  }
});

router.post("/v1/social/notifications/:notificationId/read", authRequired, async (req, res) => {
  try {
    await ensureSocialNotificationsTable();
    const notificationId = Number(req.params.notificationId);
    if (!Number.isFinite(notificationId)) {
      res.status(400).json({ message: "Valid notificationId is required" });
      return;
    }
    const updated = await query(
      `
      UPDATE social_notifications
      SET is_read = true
      WHERE id = $1 AND user_id = $2
      RETURNING id
      `,
      [notificationId, req.user.userId]
    );
    if (!updated.rows[0]) {
      res.status(404).json({ message: "Notification not found" });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to update notification", error: error.message });
  }
});

router.post("/v1/social/notifications/read-all", authRequired, async (req, res) => {
  try {
    await ensureSocialNotificationsTable();
    const me = Number(req.user.userId);
    const updated = await query(
      `
      UPDATE social_notifications n
      SET is_read = true
      WHERE n.user_id = $1
        AND n.is_read = false
        AND NOT (
          n.type = 'follow_request'
          AND EXISTS (
            SELECT 1
            FROM social_follows f
            WHERE f.id = n.follow_id
              AND f.status = 'pending'
          )
        )
      RETURNING n.id
      `,
      [me]
    );
    res.json({ ok: true, marked: updated.rows.length });
  } catch (error) {
    res.status(500).json({ message: "Failed to mark notifications read", error: error.message });
  }
});

router.get("/v1/messages/threads", authRequired, async (req, res) => {
  try {
    await ensureDirectMessagesTable();
    const me = Number(req.user.userId);
    const result = await query(
      `
      WITH thread_rows AS (
        SELECT
          CASE WHEN dm.sender_id = $1 THEN dm.receiver_id ELSE dm.sender_id END AS peer_id,
          dm.id,
          dm.sender_id,
          dm.receiver_id,
          dm.body,
          dm.created_at,
          ROW_NUMBER() OVER (
            PARTITION BY CASE WHEN dm.sender_id = $1 THEN dm.receiver_id ELSE dm.sender_id END
            ORDER BY dm.created_at DESC
          ) AS rn
        FROM direct_messages dm
        WHERE dm.sender_id = $1 OR dm.receiver_id = $1
      )
      SELECT
        t.peer_id AS "peerUserId",
        u.full_name AS "peerName",
        u.email AS "peerEmail",
        NULLIF(TRIM(u.username), '') AS "peerUsername",
        NULLIF(TRIM(u.avatar_url), '') AS "peerAvatarUrl",
        t.sender_id AS "lastSenderId",
        t.receiver_id AS "lastReceiverId",
        t.body AS "lastMessage",
        t.created_at AS "lastAt",
        COALESCE((
          SELECT COUNT(*)::INT
          FROM direct_messages dm2
          WHERE dm2.sender_id = t.peer_id
            AND dm2.receiver_id = $1
            AND dm2.is_read = false
        ), 0) AS "unreadCount"
      FROM thread_rows t
      JOIN learn_users u ON u.id = t.peer_id
      WHERE t.rn = 1
      ORDER BY t.created_at DESC
      `
      ,
      [me]
    );
    res.json({ threads: result.rows });
  } catch (error) {
    res.status(500).json({ message: "Failed to load message threads", error: error.message });
  }
});

router.get("/v1/messages/thread/:peerUserId", authRequired, async (req, res) => {
  try {
    await ensureDirectMessagesTable();
    const me = Number(req.user.userId);
    const peerUserId = Number(req.params.peerUserId);
    if (!Number.isFinite(peerUserId) || peerUserId <= 0 || peerUserId === me) {
      res.status(400).json({ message: "Valid peerUserId is required" });
      return;
    }

    const peerRes = await query(
      `SELECT id, full_name AS "fullName", email, phone, NULLIF(TRIM(avatar_url), '') AS "avatarUrl" FROM learn_users WHERE id = $1 LIMIT 1`,
      [peerUserId]
    );
    if (!peerRes.rows[0]) {
      res.status(404).json({ message: "Peer user not found" });
      return;
    }

    await query(`UPDATE direct_messages SET is_read = true WHERE sender_id = $1 AND receiver_id = $2 AND is_read = false`, [peerUserId, me]);
    emitMessagesRead({ readerId: me, peerUserId });

    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const beforeId = Number(req.query.beforeId);
    const beforeClause =
      Number.isFinite(beforeId) && beforeId > 0 ? `AND id < $3` : "";
    const params = Number.isFinite(beforeId) && beforeId > 0 ? [me, peerUserId, beforeId, limit] : [me, peerUserId, limit];

    const rows = await query(
      `
      SELECT
        id,
        sender_id AS "senderId",
        receiver_id AS "receiverId",
        body,
        created_at AS "createdAt"
      FROM direct_messages
      WHERE (sender_id = $1 AND receiver_id = $2)
         OR (sender_id = $2 AND receiver_id = $1)
      ${beforeClause}
      ORDER BY created_at DESC
      LIMIT ${Number.isFinite(beforeId) && beforeId > 0 ? "$4" : "$3"}
      `,
      params
    );

    const messages = rows.rows.slice().reverse();
    const oldestId = messages.length ? Number(messages[0].id) : null;
    let hasMore = false;
    if (oldestId) {
      const older = await query(
        `
        SELECT 1 FROM direct_messages
        WHERE ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1))
          AND id < $3
        LIMIT 1
        `,
        [me, peerUserId, oldestId]
      );
      hasMore = older.rows.length > 0;
    }

    res.json({
      peer: {
        id: peerRes.rows[0].id,
        fullName: peerRes.rows[0].fullName,
        email: peerRes.rows[0].email,
        phone: peerRes.rows[0].phone,
        avatarUrl: peerRes.rows[0].avatarUrl || undefined
      },
      messages,
      hasMore
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load message thread", error: error.message });
  }
});

router.post("/v1/calls/ring", authRequired, async (req, res) => {
  try {
    const cfg = readLiveKitConfig();
    if (!cfg.livekitUrl || !cfg.apiKey || !cfg.apiSecret) {
      res.status(503).json({
        message: "LiveKit is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET."
      });
      return;
    }
    const me = Number(req.user.userId);
    const peerUserId = Number(req.body?.peerUserId);
    const mode = String(req.body?.mode || "voice").trim() === "video" ? "video" : "voice";
    if (!Number.isFinite(peerUserId) || peerUserId <= 0 || peerUserId === me) {
      res.status(400).json({ message: "Valid peerUserId is required" });
      return;
    }
    const peerRes = await query(`SELECT id FROM learn_users WHERE id = $1 LIMIT 1`, [peerUserId]);
    if (!peerRes.rows[0]) {
      res.status(404).json({ message: "Peer user not found" });
      return;
    }
    const low = Math.min(me, peerUserId);
    const high = Math.max(me, peerUserId);
    const roomName = `dmcall-${low}-${high}-${Date.now()}`;
    const callerRes = await query(
      `
      SELECT
        COALESCE(NULLIF(TRIM(full_name), ''), 'Someone') AS full_name,
        NULLIF(TRIM(avatar_url), '') AS avatar_url
      FROM learn_users
      WHERE id = $1
      LIMIT 1
      `,
      [me]
    );
    const callerName = String(callerRes.rows[0]?.full_name || "Someone").trim() || "Someone";
    const callerAvatarUrl = String(callerRes.rows[0]?.avatar_url || "").trim() || "";
    const pushResult = await sendIncomingCallPush({
      userId: peerUserId,
      callerName,
      mode,
      roomName,
      callerId: me,
      callerAvatarUrl
    }).catch((error) => {
      console.warn("[push] incoming call:", error?.message || error);
      return { sent: 0, failed: 0, skipped: "error" };
    });
    res.status(201).json({ roomName, mode, peerUserId, push: pushResult });
  } catch (error) {
    res.status(500).json({ message: "Failed to start call", error: error.message });
  }
});

router.post("/v1/calls/cancel", authRequired, async (req, res) => {
  try {
    const me = Number(req.user.userId);
    const peerUserId = Number(req.body?.peerUserId);
    const roomName = String(req.body?.roomName || "").trim();
    if (!Number.isFinite(peerUserId) || peerUserId <= 0 || peerUserId === me) {
      res.status(400).json({ message: "Valid peerUserId is required" });
      return;
    }
    if (!roomName) {
      res.status(400).json({ message: "roomName is required" });
      return;
    }
    const peerRes = await query(`SELECT id FROM learn_users WHERE id = $1 LIMIT 1`, [peerUserId]);
    if (!peerRes.rows[0]) {
      res.status(404).json({ message: "Peer user not found" });
      return;
    }
    const pushResult = await sendCallCancelledPush({
      userId: peerUserId,
      roomName,
      callerId: me
    }).catch((error) => {
      console.warn("[push] call cancel:", error?.message || error);
      return { sent: 0, failed: 0, skipped: "error" };
    });
    res.status(200).json({ ok: true, peerUserId, roomName, push: pushResult });
  } catch (error) {
    res.status(500).json({ message: "Failed to cancel call", error: error.message });
  }
});

router.post("/v1/messages/thread/:peerUserId", authRequired, async (req, res) => {
  try {
    await ensureDirectMessagesTable();
    const me = Number(req.user.userId);
    const peerUserId = Number(req.params.peerUserId);
    const body = String(req.body?.text || "").trim();
    if (!Number.isFinite(peerUserId) || peerUserId <= 0 || peerUserId === me) {
      res.status(400).json({ message: "Valid peerUserId is required" });
      return;
    }
    if (!body) {
      res.status(400).json({ message: "Message text is required" });
      return;
    }

    const peerRes = await query(
      `SELECT id, COALESCE(account_status, 'active') AS status FROM learn_users WHERE id = $1 LIMIT 1`,
      [peerUserId]
    );
    if (!peerRes.rows[0]) {
      res.status(404).json({ message: "Peer user not found" });
      return;
    }
    if (await isUserAccountDeactivated(me)) {
      res.status(403).json({ message: "Activate your account to send messages" });
      return;
    }
    if (String(peerRes.rows[0].status || "active").toLowerCase() === "deactivated") {
      res.status(404).json({ message: "Peer user not found" });
      return;
    }

    const ins = await query(
      `
      INSERT INTO direct_messages (sender_id, receiver_id, body, is_read)
      VALUES ($1, $2, $3, false)
      RETURNING
        id,
        sender_id AS "senderId",
        receiver_id AS "receiverId",
        body,
        created_at AS "createdAt"
      `,
      [me, peerUserId, body]
    );
    const isLiveShare = String(body).startsWith("[Cropvibe Live]");
    let livePostId;
    if (isLiveShare) {
      try {
        const parsed = JSON.parse(String(body).slice("[Cropvibe Live]".length).trim());
        const pid = Number(parsed?.postId);
        if (Number.isFinite(pid) && pid > 0) livePostId = pid;
      } catch {
        // no-op
      }
    }
    const dmPush = directMessagePushPayload(body);
    const isCallHistory = String(body).startsWith("[Cropvibe Call]");
    if (!isCallHistory) {
      fireSocialPush({
        userId: peerUserId,
        type: isLiveShare ? "live_share" : "direct_message",
        actorId: me,
        actorName: await actorDisplayName(me),
        postId: livePostId,
        commentExcerpt: dmPush.excerpt,
        imageUrl: dmPush.imageUrl
      });
    }
    emitDirectMessage({
      senderId: me,
      receiverId: peerUserId,
      message: ins.rows[0]
    });
    res.status(201).json({ message: ins.rows[0] });
  } catch (error) {
    res.status(500).json({ message: "Failed to send message", error: error.message });
  }
});

router.delete("/v1/messages/:messageId", authRequired, async (req, res) => {
  try {
    await ensureDirectMessagesTable();
    const me = Number(req.user.userId);
    const messageId = Number(req.params.messageId);
    if (!Number.isFinite(messageId) || messageId <= 0) {
      res.status(400).json({ message: "Valid messageId is required" });
      return;
    }

    const rowRes = await query(
      `SELECT id, sender_id, receiver_id FROM direct_messages WHERE id = $1 LIMIT 1`,
      [messageId]
    );
    const row = rowRes.rows[0];
    if (!row) {
      res.status(404).json({ message: "Message not found" });
      return;
    }
    if (Number(row.sender_id) !== me) {
      res.status(403).json({ message: "You can only delete your own messages" });
      return;
    }

    await query(`DELETE FROM direct_messages WHERE id = $1`, [messageId]);
    emitDirectMessageDeleted({
      messageId,
      senderId: me,
      receiverId: Number(row.receiver_id)
    });
    res.json({ ok: true, messageId });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete message", error: error.message });
  }
});

router.get("/v1/marketplace/listings", async (_req, res) => {
  try {
    const cacheKey = "v1:marketplace:listings";
    const cached = await cacheGetJson(cacheKey);
    if (cached && Array.isArray(cached.listings)) {
      res.json(cached);
      return;
    }
    const result = await query(
      `
      SELECT
        l.id,
        l.crop_name AS "cropName",
        COALESCE(d.name, 'Unknown') AS district,
        l.price_per_kg AS "pricePerKg",
        l.verified_only AS "verifiedOnly",
        'produce' AS "listingType"
      FROM listings l
      LEFT JOIN districts d ON d.id = l.district_id
      ORDER BY l.created_at DESC
      LIMIT 30
      `
    );

    const body = { listings: result.rows };
    res.json(body);
    await cacheSetJson(cacheKey, body, 90);
  } catch (error) {
    res.json({
      listings: [],
      source: "fallback",
      message: error.message
    });
  }
});

router.get("/v1/community/questions", async (_req, res) => {
  try {
    const cacheKey = "v1:community:questions";
    const cached = await cacheGetJson(cacheKey);
    if (cached && Array.isArray(cached.questions)) {
      res.json(cached);
      return;
    }
    const result = await query(
      `
      SELECT
        q.id,
        u.full_name AS "userName",
        COALESCE(d.name, 'Unknown') AS district,
        q.text_content AS "textContent",
        q.created_at AS "createdAt",
        COALESCE(SUM(a.upvotes), 0)::INT AS upvotes,
        COALESCE(COUNT(a.id), 0)::INT AS "answersCount",
        COALESCE(BOOL_OR(a.is_resolved), false) AS "isResolved"
      FROM community_questions q
      JOIN users u ON u.id = q.user_id
      LEFT JOIN districts d ON d.id = q.district_id
      LEFT JOIN community_answers a ON a.question_id = q.id
      GROUP BY q.id, u.full_name, d.name
      ORDER BY q.created_at DESC
      LIMIT 30
      `
    );

    const body = { questions: result.rows };
    res.json(body);
    await cacheSetJson(cacheKey, body, 90);
  } catch (error) {
    res.json({
      questions: [],
      source: "fallback",
      message: error.message
    });
  }
});

const STORY_TTL_SQL = "24 hours";

router.get("/v1/home/stories", authOptional, async (req, res) => {
  try {
    const viewerIdRaw = req.user && req.user.userId != null ? Number(req.user.userId) : null;
    const viewerId = Number.isFinite(viewerIdRaw) && viewerIdRaw > 0 ? viewerIdRaw : null;
    const viewerKey = viewerId != null ? String(viewerId) : "anon";
    const gen = await cacheGenString("home:stories:gen");
    const cacheKey = `v1:home:stories:v4:${gen}:${viewerKey}`;
    const cached = await cacheGetJson(cacheKey);
    if (cached && Array.isArray(cached.stories)) {
      res.json(cached);
      return;
    }
    await ensureHomeStoriesTable();
    await ensureSocialFollowsTable();
    // Stories expire after 24 hours (Instagram-style). Remove expired rows so they no longer appear.
    await query(`DELETE FROM home_stories WHERE created_at < NOW() - INTERVAL '${STORY_TTL_SQL}'`);
    const result = await query(
      `
      SELECT
        s.id,
        s.user_id AS "userId",
        s.user_name AS "userName",
        s.district,
        s.avatar_label AS "avatarLabel",
        s.has_new AS "hasNew",
        s.viewed,
        s.video_url AS "videoUrl",
        s.image_url AS "imageUrl",
        s.created_at AS "createdAt",
        COALESCE(
          NULLIF(TRIM(lu.avatar_url), ''),
          NULLIF(TRIM(nm.avatar_url), '')
        ) AS "avatarUrl"
      FROM home_stories s
      LEFT JOIN learn_users lu ON lu.id = s.user_id
      LEFT JOIN LATERAL (
        SELECT u2.avatar_url
        FROM learn_users u2
        WHERE
          LOWER(TRIM(u2.full_name)) = LOWER(TRIM(s.user_name))
          OR LOWER(TRIM(SPLIT_PART(u2.full_name, ' ', 1))) = LOWER(TRIM(s.user_name))
          OR LOWER(TRIM(u2.full_name)) LIKE LOWER(TRIM(s.user_name)) || ' %'
          OR LOWER(TRIM(REGEXP_REPLACE(COALESCE(u2.username, ''), '^@+', '', 'g'))) = LOWER(TRIM(s.user_name))
        ORDER BY
          CASE
            WHEN LOWER(TRIM(u2.full_name)) = LOWER(TRIM(s.user_name)) THEN 0
            WHEN LOWER(TRIM(SPLIT_PART(u2.full_name, ' ', 1))) = LOWER(TRIM(s.user_name)) THEN 1
            WHEN LOWER(TRIM(u2.full_name)) LIKE LOWER(TRIM(s.user_name)) || ' %' THEN 2
            ELSE 3
          END,
          u2.id ASC
        LIMIT 1
      ) nm ON TRUE
      WHERE s.created_at >= NOW() - INTERVAL '${STORY_TTL_SQL}'
        AND $1::integer IS NOT NULL
        AND COALESCE(s.user_id, lu.id) IS NOT NULL
        AND COALESCE(lu.account_status, 'active') <> 'deactivated'
        AND (
          COALESCE(s.user_id, lu.id) = $1::integer
          OR EXISTS (
            SELECT 1
            FROM social_follows sf
            WHERE sf.follower_id = $1::integer
              AND sf.following_id = COALESCE(s.user_id, lu.id)
              AND sf.status = 'accepted'
          )
        )
      ORDER BY s.created_at DESC
      LIMIT 40
      `,
      [viewerId]
    );

    const body = { stories: result.rows.map(sanitizeStoryRowMedia) };
    res.json(body);
    await cacheSetJson(cacheKey, body, 45);
  } catch (error) {
    res.json({
      stories: [],
      source: "fallback",
      message: error.message
    });
  }
});

router.post("/v1/home/stories", authOptional, async (req, res) => {
  try {
    await ensureHomeStoriesTable();
    const { userName, district, videoUrl, imageUrl } = req.body || {};
    if (!userName || !district) {
      res.status(400).json({ message: "userName and district are required" });
      return;
    }
    if (!videoUrl && !imageUrl) {
      res.status(400).json({ message: "one of videoUrl/imageUrl is required" });
      return;
    }

    const avatarLabel = String(userName).trim().charAt(0).toUpperCase() || "U";
    const actorUserIdRaw = req.user && req.user.userId != null ? Number(req.user.userId) : null;
    const actorUserId = Number.isFinite(actorUserIdRaw) && actorUserIdRaw > 0 ? actorUserIdRaw : null;
    if (actorUserId && (await isUserAccountDeactivated(actorUserId))) {
      res.status(403).json({ message: "Activate your account to create stories" });
      return;
    }
    const result = await query(
      `
      INSERT INTO home_stories (user_id, user_name, district, avatar_label, has_new, viewed, video_url, image_url)
      VALUES ($1, $2, $3, $4, true, false, $5, $6)
      RETURNING
        id,
        user_id AS "userId",
        user_name AS "userName",
        district,
        avatar_label AS "avatarLabel",
        has_new AS "hasNew",
        viewed,
        video_url AS "videoUrl",
        image_url AS "imageUrl",
        created_at AS "createdAt"
      `,
      [
        actorUserId,
        userName,
        district,
        avatarLabel,
        stripLegacyCloudinaryUrl(videoUrl),
        stripLegacyCloudinaryUrl(imageUrl)
      ]
    );

    let storyAvatarUrl = null;
    if (actorUserId) {
      const av = await query(`SELECT NULLIF(TRIM(avatar_url), '') AS "avatarUrl" FROM learn_users WHERE id = $1 LIMIT 1`, [
        actorUserId
      ]);
      storyAvatarUrl = av.rows[0]?.avatarUrl || null;
    } else {
      const av = await query(
        `
        SELECT NULLIF(TRIM(avatar_url), '') AS "avatarUrl"
        FROM learn_users
        WHERE LOWER(TRIM(full_name)) = LOWER(TRIM($1))
        ORDER BY id ASC
        LIMIT 1
        `,
        [userName]
      );
      storyAvatarUrl = av.rows[0]?.avatarUrl || null;
    }

    await cacheIncr("home:stories:gen");
    res.status(201).json({ story: { ...result.rows[0], avatarUrl: storyAvatarUrl } });
  } catch (error) {
    res.status(500).json({ message: "Failed to create story", error: error.message });
  }
});

router.get("/v1/home/posts", authOptional, async (req, res) => {
  try {
    const viewerIdRaw = req.user && req.user.userId != null ? Number(req.user.userId) : null;
    const viewerId = Number.isFinite(viewerIdRaw) ? viewerIdRaw : null;
    const viewerKey = viewerId != null ? String(viewerId) : "anon";
    const { limit, cursor } = parseHomeFeedPagination(req);
    const gen = await cacheGenString("home:posts:gen");
    const cacheKey = `v1:home:posts:${gen}:${viewerKey}:${limit}:${cursor || "start"}`;
    const cached = await cacheGetJson(cacheKey);
    if (cached && Array.isArray(cached.posts)) {
      res.json(cached);
      return;
    }

    await backfillHomePostUserIds();
    await ensureHomePostsTable();
    await ensureLearnUsersTable();
    await ensureHomePostLikesTable();
    await ensureHomePostSavesTable();
    await ensureHomePostResharesTable();
    const params = [viewerId];
    if (cursor != null) params.push(cursor);
    params.push(limit + 1);
    const limitIdx = params.length;
    const result = await query(
      `${homeFeedListSql({ cursorParamIndex: cursor != null ? 2 : null })}
      LIMIT $${limitIdx}`,
      params
    );

    const { page, nextCursor, hasMore } = paginateHomeFeedRows(result.rows, limit);
    const body = {
      posts: await enrichHomePostsLiveState(dedupeHomePostRows(page)),
      nextCursor: hasMore ? nextCursor : null,
      hasMore
    };
    res.json(body);
    await cacheSetJson(cacheKey, body, 30);
  } catch (error) {
    res.json({
      posts: [],
      nextCursor: null,
      hasMore: false,
      source: "fallback",
      message: error.message
    });
  }
});

router.get("/v1/home/posts/reels", authOptional, async (req, res) => {
  try {
    const viewerIdRaw = req.user && req.user.userId != null ? Number(req.user.userId) : null;
    const viewerId = Number.isFinite(viewerIdRaw) ? viewerIdRaw : null;
    const viewerKey = viewerId != null ? String(viewerId) : "anon";
    const limitRaw = Number(req.query.limit);
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 24, 1), 48);
    const cursorRaw = Number(req.query.cursor);
    const cursor = Number.isFinite(cursorRaw) && cursorRaw > 0 ? cursorRaw : null;
    const gen = await cacheGenString("home:posts:gen");
    const cacheKey = `v1:home:posts:reels:${gen}:${viewerKey}:${limit}:${cursor || "start"}`;
    const cached = await cacheGetJson(cacheKey);
    if (cached && Array.isArray(cached.posts)) {
      res.json(cached);
      return;
    }

    await ensureHomePostsTable();
    await ensureLearnUsersTable();
    await ensureHomePostLikesTable();
    await ensureHomePostSavesTable();
    await ensureHomePostResharesTable();
    const params = [viewerId];
    if (cursor != null) params.push(cursor);
    params.push(limit + 1);
    const limitIdx = params.length;
    const result = await query(
      `${homeFeedListSql({ cursorParamIndex: cursor != null ? 2 : null, videoOnly: true })}
      LIMIT $${limitIdx}`,
      params
    );

    const { page, nextCursor, hasMore } = paginateHomeFeedRows(result.rows, limit);
    const body = {
      posts: await enrichHomePostsLiveState(dedupeHomePostRows(page)),
      nextCursor: hasMore ? nextCursor : null,
      hasMore
    };
    res.json(body);
    await cacheSetJson(cacheKey, body, 45);
  } catch (error) {
    res.status(500).json({ message: "Failed to load reels", error: error.message });
  }
});

router.post("/v1/home/posts", authOptional, async (req, res) => {
  try {
    await ensureHomePostsTable();
    const {
      userId,
      userName,
      location,
      caption,
      videoUrl,
      imageUrl,
      imageUrls,
      thumbnailUrl,
      taggedUserIds,
      musicLabel,
      musicAudioUrl,
      creativeMeta
    } = req.body || {};

    let urlList = Array.isArray(imageUrls)
      ? imageUrls.map((u) => stripLegacyCloudinaryUrl(u)).filter(Boolean)
      : [];
    if (!urlList.length) {
      const single = stripLegacyCloudinaryUrl(imageUrl);
      if (single) urlList = [single];
    }
    const primaryImage = urlList[0] || null;
    const imageUrlsJson = urlList.length > 1 ? JSON.stringify(urlList) : null;
    const cleanVideoUrl = stripLegacyCloudinaryUrl(videoUrl);
    const cleanThumbnailUrl = stripLegacyCloudinaryUrl(thumbnailUrl);
    const hasVideo = !!cleanVideoUrl;
    const hasImage = !!primaryImage;
    const isLivePost = /^\[LIVE\]/i.test(String(caption || "").trim());

    if (!userName || !location || !caption || (!hasVideo && !hasImage && !isLivePost)) {
      res.status(400).json({
        message:
          "userName, location, caption and one of videoUrl, imageUrl, imageUrls, or a [LIVE] caption are required"
      });
      return;
    }
    if (hasVideo && hasImage) {
      res.status(400).json({ message: "Send either a video or images for one post, not both" });
      return;
    }

    const ownerIdRaw = req.user?.userId != null ? Number(req.user.userId) : Number(userId);
    const ownerId = Number.isFinite(ownerIdRaw) && ownerIdRaw > 0 ? ownerIdRaw : null;

    if (ownerId && (await isUserAccountDeactivated(ownerId))) {
      res.status(403).json({ message: "Activate your account to create posts" });
      return;
    }

    const cleanTagged = Array.isArray(taggedUserIds)
      ? [...new Set(taggedUserIds.map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0))]
      : [];
    const taggedJson = JSON.stringify(cleanTagged);
    const cleanMusicLabel =
      typeof musicLabel === "string" && musicLabel.trim() ? musicLabel.trim().slice(0, 240) : null;
    const cleanMusicAudioUrl =
      typeof musicAudioUrl === "string" && musicAudioUrl.trim() ? musicAudioUrl.trim().slice(0, 2000) : null;
    const cleanCreativeMeta =
      creativeMeta && typeof creativeMeta === "object" && !Array.isArray(creativeMeta)
        ? {
            ...(typeof creativeMeta.filter === "string" && creativeMeta.filter.trim()
              ? { filter: creativeMeta.filter.trim().slice(0, 32) }
              : {}),
            ...(typeof creativeMeta.overlayText === "string" && creativeMeta.overlayText.trim()
              ? { overlayText: creativeMeta.overlayText.trim().slice(0, 240) }
              : {}),
            ...(typeof creativeMeta.textColor === "string" && creativeMeta.textColor.trim()
              ? { textColor: creativeMeta.textColor.trim().slice(0, 32) }
              : {}),
            ...(typeof creativeMeta.font === "string" && creativeMeta.font.trim()
              ? { font: creativeMeta.font.trim().slice(0, 32) }
              : {}),
            ...(typeof creativeMeta.textBackground === "boolean" ? { textBackground: creativeMeta.textBackground } : {})
          }
        : {};

    const result = await query(
      `
      INSERT INTO home_posts (user_id, user_name, location, caption, video_url, image_url, image_urls, thumbnail_url, tagged_user_ids, music_label, music_audio_url, creative_meta)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12::jsonb)
      RETURNING
        id,
        user_id AS "userId",
        user_name AS "userName",
        location,
        caption,
        likes_count AS "likesCount",
        comments_count AS "commentsCount",
        video_url AS "videoUrl",
        image_url AS "imageUrl",
        image_urls AS "image_urls",
        thumbnail_url AS "thumbnailUrl",
        tagged_user_ids AS "tagged_user_ids",
        music_label AS "musicLabel",
        music_audio_url AS "musicAudioUrl",
        creative_meta AS "creativeMeta",
        created_at AS "createdAt"
      `,
      [
        ownerId,
        userName,
        location,
        caption,
        cleanVideoUrl,
        primaryImage,
        imageUrlsJson,
        cleanThumbnailUrl,
        taggedJson,
        cleanMusicLabel,
        cleanMusicAudioUrl,
        JSON.stringify(cleanCreativeMeta)
      ]
    );

    const normalizedPost = normalizeHomePostRow(result.rows[0]);
    const actorId = ownerId || Number(userId || 0);
    if (isLivePost && Number.isFinite(actorId) && actorId > 0) {
      await query(`UPDATE home_posts SET live_status = 'active' WHERE id = $1`, [normalizedPost.id]);
      normalizedPost.liveStatus = "active";
      normalizedPost.liveStartedAt = normalizedPost.createdAt;
      normalizedPost.liveViewerCount = 0;
      await ensureSocialNotificationsTable();
      await query(
        `
        INSERT INTO social_notifications (user_id, actor_id, follow_id, type, is_read, post_id, comment_excerpt)
        SELECT f.follower_id, $1, f.id, 'live_start', false, $2, $3
        FROM social_follows f
        WHERE f.following_id = $1
          AND f.status = 'accepted'
          AND f.follower_id <> $1
        `,
        [actorId, normalizedPost.id, "started live"]
      );
      fireSocialPushToFollowers({
        hostUserId: actorId,
        type: "live_start",
        postId: normalizedPost.id,
        commentExcerpt: "started live"
      });
    }

    await cacheIncr("home:posts:gen");
    await invalidateProfilePostsCache(actorId);
    res.status(201).json({ post: normalizedPost });
  } catch (error) {
    res.status(500).json({ message: "Failed to create home post", error: error.message });
  }
});

router.put("/v1/home/posts/:postId/live-video", authRequired, async (req, res) => {
  try {
    await ensureHomePostsTable();
    const postId = Number(req.params.postId);
    const me = Number(req.user.userId);
    const { videoUrl, thumbnailUrl } = req.body || {};
    const cleanVideoUrl = typeof videoUrl === "string" ? videoUrl.trim() : "";
    if (!Number.isFinite(postId) || postId <= 0 || !cleanVideoUrl) {
      res.status(400).json({ message: "Valid postId and videoUrl are required" });
      return;
    }
    const updated = await query(
      `
      UPDATE home_posts
      SET video_url = $1, thumbnail_url = $2
      WHERE id = $3 AND user_id = $4 AND caption ~* '^\\[LIVE\\]'
      RETURNING
        id,
        user_id AS "userId",
        user_name AS "userName",
        location,
        caption,
        likes_count AS "likesCount",
        comments_count AS "commentsCount",
        video_url AS "videoUrl",
        image_url AS "imageUrl",
        image_urls AS "image_urls",
        thumbnail_url AS "thumbnailUrl",
        tagged_user_ids AS "tagged_user_ids",
        music_label AS "musicLabel",
        music_audio_url AS "musicAudioUrl",
        creative_meta AS "creativeMeta",
        live_status AS "liveStatus",
        live_ended_at AS "liveEndedAt",
        created_at AS "createdAt"
      `,
      [cleanVideoUrl, typeof thumbnailUrl === "string" && thumbnailUrl.trim() ? thumbnailUrl.trim() : null, postId, me]
    );
    if (!updated.rows[0]) {
      res.status(404).json({ message: "Live post not found" });
      return;
    }
    await cacheIncr("home:posts:gen");
    await invalidateProfilePostsCache(me);
    const post = normalizeHomePostRow(updated.rows[0]);
    if (post.liveStatus !== "ended") post.liveStatus = "ended";
    res.json({ post });
  } catch (error) {
    res.status(500).json({ message: "Failed to update live video", error: error.message });
  }
});

router.post("/v1/home/posts/:postId/end-live", authRequired, async (req, res) => {
  try {
    await ensureHomePostsTable();
    const postId = Number(req.params.postId);
    const me = Number(req.user.userId);
    if (!Number.isFinite(postId) || postId <= 0) {
      res.status(400).json({ message: "Valid postId is required" });
      return;
    }
    const existing = await query(
      `
      SELECT id, user_id, caption
      FROM home_posts
      WHERE id = $1
      LIMIT 1
      `,
      [postId]
    );
    const row = existing.rows[0];
    if (!row) {
      res.status(404).json({ message: "Live post not found" });
      return;
    }
    if (Number(row.user_id) !== me) {
      res.status(403).json({ message: "Only the host can end this live" });
      return;
    }
    if (!/^\[LIVE\]/i.test(String(row.caption || "").trim())) {
      res.status(400).json({ message: "Post is not a live stream" });
      return;
    }
    const roomName = `agrovibes-live-${postId}`;
    const lkCfg = readLiveKitConfig();
    let savedVideoUrl = null;
    let savedThumbUrl = null;
    let egressStarted = false;
    let egressError = null;
    const egressConfigured = isEgressConfigured();
    // RESTORE WHEN SUPABASE PAID — uncomment block below (LiveKit egress → Supabase storage).
    // if (lkCfg.ok) {
    //   if (egressConfigured) {
    //     const startResult = await startLiveRoomRecording(lkCfg, roomName);
    //     egressStarted = !!startResult?.egressId;
    //     egressError = startResult?.error || null;
    //   } else {
    //     egressError = "egress_s3_not_configured";
    //   }
    //   savedVideoUrl = await stopLiveRoomRecordingAndGetVideoUrl(lkCfg, roomName);
    //   if (!savedVideoUrl) {
    //     console.warn("[livekit-egress] end-live no video", {
    //       postId,
    //       roomName,
    //       egressConfigured,
    //       egressStarted,
    //       egressError
    //     });
    //   }
    // }
    await deleteLiveKitRoom(roomName);
    const updated = await query(
      `
      UPDATE home_posts
      SET live_status = 'ended',
          live_ended_at = NOW(),
          video_url = COALESCE($2, video_url),
          thumbnail_url = COALESCE($3, thumbnail_url)
      WHERE id = $1
      RETURNING
        id,
        user_id AS "userId",
        user_name AS "userName",
        location,
        caption,
        likes_count AS "likesCount",
        comments_count AS "commentsCount",
        video_url AS "videoUrl",
        image_url AS "imageUrl",
        image_urls AS "image_urls",
        thumbnail_url AS "thumbnailUrl",
        tagged_user_ids AS "tagged_user_ids",
        music_label AS "musicLabel",
        music_audio_url AS "musicAudioUrl",
        creative_meta AS "creativeMeta",
        live_status AS "liveStatus",
        live_ended_at AS "liveEndedAt",
        created_at AS "createdAt"
      `,
      [postId, savedVideoUrl, savedThumbUrl]
    );
    await cacheIncr("home:posts:gen");
    await invalidateProfilePostsCache(me);
    const post = normalizeHomePostRow(updated.rows[0]);
    post.liveStatus = "ended";
    post.liveViewerCount = 0;
    const recordingSaved = !!String(post.videoUrl || "").trim();
    let recordingMessage = recordingSaved
      ? "Recording saved."
      : "Recording was not saved for this live.";
    if (!recordingSaved && !egressConfigured) {
      recordingMessage =
        "Recording was not saved — add LIVEKIT_EGRESS_S3_* and SUPABASE_URL on the API server (Render env).";
    } else if (!recordingSaved && egressError) {
      recordingMessage = `Recording was not saved — server error: ${egressError}`;
    }
    res.json({
      post,
      liveRecording: {
        saved: recordingSaved,
        egressConfigured,
        egressStarted,
        egressError,
        message: recordingMessage
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to end live", error: error.message });
  }
});

async function handleScheduleLive(req, res) {
  try {
    await ensureSocialNotificationsTable();
    await ensureScheduledLivesTable();
    const actorId = Number(req.user.userId);
    const topic = String(req.body?.topic || "").trim();
    const scheduledAtRaw = String(req.body?.scheduledAt || "").trim();
    const scheduledAtMs = Date.parse(scheduledAtRaw);
    if (!topic || !Number.isFinite(scheduledAtMs)) {
      res.status(400).json({ message: "Topic and valid scheduledAt are required" });
      return;
    }
    if (scheduledAtMs <= Date.now()) {
      res.status(400).json({ message: "Scheduled time must be in the future" });
      return;
    }
    const scheduledAtIso = new Date(scheduledAtMs).toISOString();
    const excerpt = liveScheduleExcerpt(topic, scheduledAtIso);
    const reminderAtMs = scheduledAtMs - 10 * 60 * 1000;
    const reminderScheduled = reminderAtMs > Date.now();

    const saved = await query(
      `
      INSERT INTO scheduled_lives (host_id, topic, scheduled_at, status)
      VALUES ($1, $2, $3::timestamptz, 'scheduled')
      RETURNING id, topic, scheduled_at AS "scheduledAt", status, created_at AS "createdAt"
      `,
      [actorId, topic.slice(0, 160), scheduledAtIso]
    );

    await query(
      `
      INSERT INTO social_notifications (user_id, actor_id, follow_id, type, is_read, post_id, comment_excerpt)
      SELECT f.follower_id, $1, f.id, 'live_scheduled', false, NULL, $2
      FROM social_follows f
      WHERE f.following_id = $1
        AND f.status = 'accepted'
        AND f.follower_id <> $1
      `,
      [actorId, excerpt]
    );
    fireSocialPushToFollowers({
      hostUserId: actorId,
      type: "live_scheduled",
      commentExcerpt: topic
    });

    if (reminderScheduled) {
      await query(
        `
        INSERT INTO social_notifications (user_id, actor_id, follow_id, type, is_read, post_id, comment_excerpt, created_at)
        SELECT f.follower_id, $1, f.id, 'live_reminder', false, NULL, $2, $3::timestamptz
        FROM social_follows f
        WHERE f.following_id = $1
          AND f.status = 'accepted'
          AND f.follower_id <> $1
        `,
        [actorId, excerpt, new Date(reminderAtMs).toISOString()]
      );
    }

    const row = saved.rows[0] || {};
    const scheduleId = Number(row.id);
    const hostExcerpt = JSON.stringify({
      topic,
      scheduledAt: scheduledAtIso,
      scheduleId: Number.isFinite(scheduleId) && scheduleId > 0 ? scheduleId : undefined
    });
    await query(
      `
      INSERT INTO social_notifications (user_id, actor_id, follow_id, type, is_read, post_id, comment_excerpt, created_at)
      VALUES ($1, $1, NULL, 'live_host_reminder', false, NULL, $2, $3::timestamptz)
      `,
      [actorId, hostExcerpt, scheduledAtIso]
    );

    res.status(201).json({
      ok: true,
      id: row.id,
      topic,
      scheduledAt: scheduledAtIso,
      reminderScheduled
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to schedule live", error: error.message });
  }
}

async function handleMyScheduledLives(req, res) {
  try {
    await ensureScheduledLivesTable();
    const hostId = Number(req.user.userId);
    const result = await query(
      `
      SELECT id, topic, scheduled_at AS "scheduledAt", status, post_id AS "postId", created_at AS "createdAt", started_at AS "startedAt"
      FROM scheduled_lives
      WHERE host_id = $1
        AND status = 'scheduled'
        AND scheduled_at >= NOW() - INTERVAL '2 hours'
      ORDER BY scheduled_at ASC
      LIMIT 20
      `,
      [hostId]
    );
    res.json({ scheduledLives: result.rows });
  } catch (error) {
    res.status(500).json({ message: "Failed to load scheduled lives", error: error.message });
  }
}

async function handleStartScheduledLive(req, res) {
  try {
    await ensureScheduledLivesTable();
    const hostId = Number(req.user.userId);
    const scheduleId = Number(req.params.scheduleId);
    const postIdRaw = req.body?.postId;
    const postId = postIdRaw != null ? Number(postIdRaw) : null;
    if (!Number.isFinite(scheduleId) || scheduleId <= 0) {
      res.status(400).json({ message: "Valid scheduleId is required" });
      return;
    }
    const updated = await query(
      `
      UPDATE scheduled_lives
      SET status = 'started', started_at = NOW(), post_id = COALESCE($3, post_id)
      WHERE id = $1 AND host_id = $2 AND status = 'scheduled'
      RETURNING id, topic, scheduled_at AS "scheduledAt", status, post_id AS "postId", started_at AS "startedAt"
      `,
      [scheduleId, hostId, Number.isFinite(postId) && postId > 0 ? postId : null]
    );
    if (!updated.rows.length) {
      res.status(404).json({ message: "Scheduled live not found" });
      return;
    }
    res.json({ scheduledLive: updated.rows[0] });
  } catch (error) {
    res.status(500).json({ message: "Failed to start scheduled live", error: error.message });
  }
}

router.post("/v1/live/schedule", authRequired, handleScheduleLive);
router.post("/v1/social/live/schedule", authRequired, handleScheduleLive);
router.get("/v1/live/scheduled/mine", authRequired, handleMyScheduledLives);
router.post("/v1/live/scheduled/:scheduleId/start", authRequired, handleStartScheduledLive);

function stripEnvValue(value) {
  return String(value || "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

function readLiveKitConfig() {
  const livekitUrl = stripEnvValue(process.env.LIVEKIT_URL).replace(/\/+$/, "");
  const apiKey = stripEnvValue(process.env.LIVEKIT_API_KEY);
  const apiSecret = stripEnvValue(process.env.LIVEKIT_API_SECRET);
  const issues = [];

  if (!livekitUrl || !apiKey || !apiSecret) {
    issues.push("Set LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET on the server.");
    return { livekitUrl, apiKey, apiSecret, issues, ok: false, isCloud: false };
  }

  const isCloud = /livekit\.cloud/i.test(livekitUrl);
  const isDevPair = apiKey === "devkey" && apiSecret === "secret";

  if (isCloud && !livekitUrl.startsWith("wss://")) {
    issues.push("LiveKit Cloud LIVEKIT_URL must start with wss:// (copy the WebSocket URL from cloud.livekit.io).");
  }
  if (isCloud && isDevPair) {
    issues.push("devkey/secret only work with local Docker LiveKit. Create API keys in LiveKit Cloud for wss://*.livekit.cloud.");
  }
  if (!isCloud && isDevPair && livekitUrl.startsWith("wss://")) {
    issues.push("LIVEKIT_URL points to LiveKit Cloud but keys are devkey/secret. Use LiveKit Cloud API key + secret.");
  }
  if (livekitUrl.startsWith("https://")) {
    issues.push("LIVEKIT_URL must be a WebSocket URL (wss://...), not https://.");
  }

  let urlHost = "";
  try {
    urlHost = new URL(livekitUrl).host;
  } catch {
    issues.push("LIVEKIT_URL is not a valid URL.");
  }

  return { livekitUrl, apiKey, apiSecret, issues, ok: issues.length === 0, isCloud, urlHost };
}

router.get("/v1/live/setup-check", authRequired, async (_req, res) => {
  const cfg = readLiveKitConfig();
  res.json({
    configured: !!(cfg.livekitUrl && cfg.apiKey && cfg.apiSecret),
    ok: cfg.ok,
    urlHost: cfg.urlHost || null,
    isCloud: cfg.isCloud,
    apiKeyPrefix: cfg.apiKey ? `${cfg.apiKey.slice(0, 6)}...` : null,
    issues: cfg.issues,
    egressRecording: isEgressConfigured()
  });
});

router.post("/v1/live/start-recording", authRequired, async (req, res) => {
  try {
    const cfg = readLiveKitConfig();
    if (!cfg.ok) {
      res.status(503).json({
        message: cfg.issues[0] || "LiveKit is not configured.",
        issues: cfg.issues
      });
      return;
    }
    const roomName = String(req.body?.roomName || "").trim().slice(0, 120);
    if (!roomName || !/^[a-zA-Z0-9_-]+$/.test(roomName)) {
      res.status(400).json({ message: "Valid roomName is required" });
      return;
    }
    res.json({ started: false, egressRecording: false, egressId: null });
    return;
    // RESTORE WHEN SUPABASE PAID — uncomment block below (remove early return above).
    // if (!isEgressConfigured()) {
    //   res.json({ started: false, egressRecording: false, egressId: null });
    //   return;
    // }
    // const startResult = await startLiveRoomRecording(cfg, roomName);
    // res.json({
    //   started: !!startResult?.egressId,
    //   egressId: startResult?.egressId || null,
    //   egressRecording: true,
    //   error: startResult?.error || null
    // });
  } catch (error) {
    res.status(500).json({ message: "Failed to start live recording", error: error.message });
  }
});

router.post("/v1/live/token", authRequired, async (req, res) => {
  try {
    const cfg = readLiveKitConfig();
    if (!cfg.livekitUrl || !cfg.apiKey || !cfg.apiSecret) {
      res.status(503).json({
        message: "LiveKit is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET.",
        issues: cfg.issues
      });
      return;
    }
    if (!cfg.ok) {
      res.status(503).json({
        message: cfg.issues[0] || "LiveKit configuration looks invalid.",
        issues: cfg.issues
      });
      return;
    }
    const roomName = String(req.body?.roomName || "").trim().slice(0, 120);
    if (!roomName || !/^[a-zA-Z0-9_-]+$/.test(roomName)) {
      res.status(400).json({ message: "Valid roomName is required" });
      return;
    }
    const canPublish = req.body?.canPublish === true || req.body?.canPublish === "true";
    const userId = Number(req.user.userId);
    const userRes = await query(`SELECT full_name FROM learn_users WHERE id = $1 LIMIT 1`, [userId]);
    const displayName = String(userRes.rows[0]?.full_name || `User ${userId}`).trim();
    const sessionIdentity = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const token = new AccessToken(cfg.apiKey, cfg.apiSecret, {
      identity: sessionIdentity,
      name: displayName,
      ttl: "6h"
    });
    token.addGrant({
      room: roomName,
      roomJoin: true,
      roomCreate: canPublish,
      canPublish,
      canSubscribe: true,
      canPublishData: true
    });
    const jwt = await token.toJwt();
    // RESTORE WHEN SUPABASE PAID — uncomment block below (host live egress → Supabase).
    // if (canPublish) {
    //   void startLiveRoomRecording(cfg, roomName).then((result) => {
    //     if (!result?.egressId) {
    //       console.warn("[livekit-egress] host start:", result?.error || "unknown");
    //     }
    //   });
    // }
    res.json({
      token: jwt,
      url: cfg.livekitUrl,
      roomName,
      identity: sessionIdentity,
      name: displayName,
      livekitHost: cfg.urlHost || null
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to create live token", error: error.message });
  }
});

router.delete("/v1/home/posts/:postId", authRequired, async (req, res) => {
  try {
    await ensureHomePostsTable();
    const postId = Number(req.params.postId);
    if (!Number.isFinite(postId) || postId <= 0) {
      res.status(400).json({ message: "Valid postId is required" });
      return;
    }
    const me = Number(req.user.userId);
    if (!Number.isFinite(me) || me <= 0) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const postRes = await query(
      `
      SELECT
        p.id,
        p.user_id AS "userId",
        p.user_name AS "userName",
        COALESCE(
          p.user_id,
          (
            SELECT u.id
            FROM learn_users u
            WHERE LOWER(TRIM(u.full_name)) = LOWER(TRIM(p.user_name))
            ORDER BY u.id ASC
            LIMIT 1
          )
        ) AS "effectiveUserId"
      FROM home_posts p
      WHERE p.id = $1
      LIMIT 1
      `,
      [postId]
    );
    const row = postRes.rows[0];
    if (!row) {
      res.status(404).json({ message: "Post not found" });
      return;
    }
    const effectiveOwnerId = row.effectiveUserId != null ? Number(row.effectiveUserId) : NaN;
    const meRow = await query(`SELECT full_name FROM learn_users WHERE id = $1 LIMIT 1`, [me]);
    const myName = normalizeUserLabelForHomePostAuth(meRow.rows[0]?.full_name || req.user?.fullName || "");
    const authorName = normalizeUserLabelForHomePostAuth(row.userName || "");

    const isOwner =
      (Number.isFinite(effectiveOwnerId) && effectiveOwnerId > 0 && effectiveOwnerId === me) ||
      ((!Number.isFinite(effectiveOwnerId) || effectiveOwnerId <= 0) &&
        authorName.length > 0 &&
        authorName === myName);

    if (!isOwner) {
      res.status(403).json({ message: "You can only delete your own posts" });
      return;
    }

    await query(`DELETE FROM home_posts WHERE id = $1`, [postId]);
    await cacheIncr("home:posts:gen");
    await invalidateProfilePostsCache(me);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete post", error: error.message });
  }
});

router.post("/v1/home/posts/:postId/report", authRequired, async (req, res) => {
  try {
    await ensureHomePostsTable();
    await ensureLearnUsersTable();
    await ensurePostReportsTable();
    const postId = Number(req.params.postId);
    if (!Number.isFinite(postId) || postId <= 0) {
      res.status(400).json({ message: "Valid postId is required" });
      return;
    }
    const me = Number(req.user.userId);
    if (!Number.isFinite(me) || me <= 0) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const existsRes = await query(`SELECT 1 FROM home_posts WHERE id = $1 LIMIT 1`, [postId]);
    if (!existsRes.rows.length) {
      res.status(404).json({ message: "Post not found" });
      return;
    }
    const rawReason = req.body && typeof req.body.reason === "string" ? req.body.reason.trim() : "";
    const reason = rawReason ? rawReason.slice(0, 500) : null;
    await query(
      `INSERT INTO post_reports (post_id, reporter_user_id, reason) VALUES ($1, $2, $3)`,
      [postId, me, reason]
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to submit report", error: error.message });
  }
});

router.get("/v1/home/posts/mine", authRequired, async (req, res) => {
  try {
    await backfillHomePostUserIds();
    await ensureHomePostsTable();
    await ensureLearnUsersTable();
    await ensureHomePostLikesTable();
    await ensureHomePostSavesTable();
    await ensureHomePostResharesTable();
    const viewerId = Number(req.user.userId);
    const cacheKey = `v1:home:posts:mine:${viewerId}`;
    const cached = await cacheGetJson(cacheKey);
    if (cached && Array.isArray(cached.posts)) {
      res.json(cached);
      return;
    }

    const userRes = await query(`SELECT full_name, username, email FROM learn_users WHERE id = $1 LIMIT 1`, [viewerId]);
    const fullName = String(userRes.rows[0]?.full_name || "").trim();
    const username = String(userRes.rows[0]?.username || "").trim();
    const emailLocal = String(userRes.rows[0]?.email || "")
      .split("@")[0]
      .trim();

    const result = await query(
      `
      SELECT
        p.id,
        COALESCE(p.user_id, owner.id) AS "userId",
        COALESCE(NULLIF(TRIM(owner.full_name), ''), p.user_name) AS "userName",
        owner.username AS "username",
        p.location,
        p.caption,
        (SELECT COUNT(*)::int FROM home_post_likes hpl_count WHERE hpl_count.post_id = p.id) AS "likesCount",
        p.comments_count AS "commentsCount",
        p.video_url AS "videoUrl",
        p.image_url AS "imageUrl",
        p.image_urls AS "image_urls",
        p.thumbnail_url AS "thumbnailUrl",
        p.created_at AS "createdAt",
        p.tagged_user_ids AS "tagged_user_ids",
        p.music_label AS "musicLabel",
        p.music_audio_url AS "musicAudioUrl",
        p.creative_meta AS "creativeMeta",
        p.live_status AS "liveStatus",
        p.live_ended_at AS "liveEndedAt",
        COALESCE(NULLIF(TRIM(owner.avatar_url), ''), NULLIF(TRIM(nm.avatar_url), '')) AS "authorAvatarUrl",
        EXISTS (
          SELECT 1 FROM home_post_likes hpl
          WHERE hpl.post_id = p.id AND hpl.user_id = $1
        ) AS "viewerHasLiked",
        EXISTS (
          SELECT 1 FROM home_post_saves hps
          WHERE hps.post_id = p.id AND hps.user_id = $1
        ) AS "viewerHasSaved",
        EXISTS (
          SELECT 1 FROM home_post_reshares hpr
          WHERE hpr.post_id = p.id AND hpr.user_id = $1
        ) AS "viewerHasReshared"
      FROM home_posts p
      LEFT JOIN learn_users owner ON owner.id = p.user_id
      LEFT JOIN LATERAL (
        SELECT avatar_url
        FROM learn_users
        WHERE LOWER(TRIM(full_name)) = LOWER(TRIM(p.user_name))
        ORDER BY id ASC
        LIMIT 1
      ) nm ON TRUE
      WHERE
        p.user_id = $1
        OR LOWER(TRIM(p.user_name)) = LOWER(TRIM($2))
        OR ($3::text IS NOT NULL AND $3 <> '' AND LOWER(TRIM(p.user_name)) = LOWER(TRIM($3)))
        OR ($4::text IS NOT NULL AND $4 <> '' AND LOWER(TRIM(p.user_name)) = LOWER(TRIM($4)))
      ORDER BY p.created_at DESC
      LIMIT 100
      `,
      [viewerId, fullName, username || null, emailLocal || null]
    );

    const body = { posts: await enrichHomePostsLiveState(dedupeHomePostRows(result.rows)) };
    res.json(body);
    await cacheSetJson(cacheKey, body, 30);
  } catch (error) {
    res.status(500).json({ message: "Failed to load profile posts", error: error.message });
  }
});

router.get("/v1/home/posts/tagged", authRequired, async (req, res) => {
  try {
    await ensureHomePostsTable();
    await ensureLearnUsersTable();
    await ensureHomePostLikesTable();
    await ensureHomePostSavesTable();
    await ensureHomePostResharesTable();
    const viewerId = Number(req.user.userId);
    const result = await query(
      `
      SELECT
        p.id,
        COALESCE(p.user_id, owner.id) AS "userId",
        COALESCE(NULLIF(TRIM(owner.full_name), ''), p.user_name) AS "userName",
        owner.username AS "username",
        p.location,
        p.caption,
        p.likes_count AS "likesCount",
        p.comments_count AS "commentsCount",
        p.video_url AS "videoUrl",
        p.image_url AS "imageUrl",
        p.image_urls AS "image_urls",
        p.thumbnail_url AS "thumbnailUrl",
        p.created_at AS "createdAt",
        p.tagged_user_ids AS "tagged_user_ids",
        p.music_label AS "musicLabel",
        p.music_audio_url AS "musicAudioUrl",
        p.creative_meta AS "creativeMeta",
        COALESCE(NULLIF(TRIM(owner.avatar_url), ''), NULLIF(TRIM(nm.avatar_url), '')) AS "authorAvatarUrl",
        EXISTS (
          SELECT 1 FROM home_post_likes hpl
          WHERE hpl.post_id = p.id AND hpl.user_id = $1
        ) AS "viewerHasLiked",
        EXISTS (
          SELECT 1 FROM home_post_saves hps
          WHERE hps.post_id = p.id AND hps.user_id = $1
        ) AS "viewerHasSaved",
        EXISTS (
          SELECT 1 FROM home_post_reshares hpr
          WHERE hpr.post_id = p.id AND hpr.user_id = $1
        ) AS "viewerHasReshared"
      FROM home_posts p
      LEFT JOIN learn_users owner ON owner.id = p.user_id
      LEFT JOIN LATERAL (
        SELECT avatar_url
        FROM learn_users
        WHERE LOWER(TRIM(full_name)) = LOWER(TRIM(p.user_name))
        ORDER BY id ASC
        LIMIT 1
      ) nm ON TRUE
      WHERE p.tagged_user_ids @> to_jsonb($1::integer)
      ORDER BY p.created_at DESC
      LIMIT 100
      `,
      [viewerId]
    );
    res.json({ posts: result.rows.map(normalizeHomePostRow) });
  } catch (error) {
    res.status(500).json({ message: "Failed to load tagged posts", error: error.message });
  }
});

router.get("/v1/home/posts/saved", authRequired, async (req, res) => {
  try {
    await ensureHomePostSavesTable();
    const viewerId = Number(req.user.userId);
    const result = await query(
      `
      SELECT
        p.id,
        COALESCE(p.user_id, owner.id) AS "userId",
        COALESCE(NULLIF(TRIM(owner.full_name), ''), p.user_name) AS "userName",
        owner.username AS "username",
        p.location,
        p.caption,
        p.likes_count AS "likesCount",
        p.comments_count AS "commentsCount",
        p.video_url AS "videoUrl",
        p.image_url AS "imageUrl",
        p.image_urls AS "image_urls",
        p.thumbnail_url AS "thumbnailUrl",
        p.created_at AS "createdAt",
        p.tagged_user_ids AS "tagged_user_ids",
        p.music_label AS "musicLabel",
        p.music_audio_url AS "musicAudioUrl",
        p.creative_meta AS "creativeMeta",
        COALESCE(NULLIF(TRIM(owner.avatar_url), ''), NULLIF(TRIM(nm.avatar_url), '')) AS "authorAvatarUrl",
        EXISTS (
          SELECT 1 FROM home_post_likes hpl
          WHERE hpl.post_id = p.id AND hpl.user_id = $1
        ) AS "viewerHasLiked",
        true AS "viewerHasSaved",
        hps.created_at AS "savedAt"
      FROM home_post_saves hps
      JOIN home_posts p ON p.id = hps.post_id
      LEFT JOIN learn_users owner ON owner.id = p.user_id
      LEFT JOIN LATERAL (
        SELECT avatar_url
        FROM learn_users
        WHERE LOWER(TRIM(full_name)) = LOWER(TRIM(p.user_name))
        ORDER BY id ASC
        LIMIT 1
      ) nm ON TRUE
      WHERE hps.user_id = $1
      ORDER BY hps.created_at DESC
      LIMIT 100
      `,
      [viewerId]
    );
    res.json({ posts: result.rows.map(normalizeHomePostRow) });
  } catch (error) {
    res.status(500).json({ message: "Failed to load saved posts", error: error.message });
  }
});

router.post("/v1/home/posts/:postId/save", authRequired, async (req, res) => {
  try {
    await ensureHomePostSavesTable();
    const postId = Number(req.params.postId);
    const userId = Number(req.user.userId);
    if (!Number.isFinite(postId) || postId <= 0) {
      res.status(400).json({ message: "Valid postId is required" });
      return;
    }
    const post = await query(`SELECT id FROM home_posts WHERE id = $1 LIMIT 1`, [postId]);
    if (!post.rows[0]) {
      res.status(404).json({ message: "Post not found" });
      return;
    }
    await query(
      `
      INSERT INTO home_post_saves (post_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (post_id, user_id) DO NOTHING
      `,
      [postId, userId]
    );
    await cacheIncr("home:posts:gen");
    res.json({ saved: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to save post", error: error.message });
  }
});

router.post("/v1/home/posts/:postId/unsave", authRequired, async (req, res) => {
  try {
    await ensureHomePostSavesTable();
    const postId = Number(req.params.postId);
    const userId = Number(req.user.userId);
    if (!Number.isFinite(postId) || postId <= 0) {
      res.status(400).json({ message: "Valid postId is required" });
      return;
    }
    await query(`DELETE FROM home_post_saves WHERE post_id = $1 AND user_id = $2`, [postId, userId]);
    await cacheIncr("home:posts:gen");
    res.json({ saved: false });
  } catch (error) {
    res.status(500).json({ message: "Failed to unsave post", error: error.message });
  }
});

router.get("/v1/home/posts/reshared", authRequired, async (req, res) => {
  try {
    await ensureHomePostResharesTable();
    const viewerId = Number(req.user.userId);
    const result = await query(
      `
      SELECT
        p.id,
        COALESCE(p.user_id, owner.id) AS "userId",
        COALESCE(NULLIF(TRIM(owner.full_name), ''), p.user_name) AS "userName",
        owner.username AS "username",
        p.location,
        p.caption,
        p.likes_count AS "likesCount",
        p.comments_count AS "commentsCount",
        p.video_url AS "videoUrl",
        p.image_url AS "imageUrl",
        p.image_urls AS "image_urls",
        p.thumbnail_url AS "thumbnailUrl",
        p.created_at AS "createdAt",
        p.tagged_user_ids AS "tagged_user_ids",
        p.music_label AS "musicLabel",
        p.music_audio_url AS "musicAudioUrl",
        p.creative_meta AS "creativeMeta",
        COALESCE(NULLIF(TRIM(owner.avatar_url), ''), NULLIF(TRIM(nm.avatar_url), '')) AS "authorAvatarUrl",
        EXISTS (
          SELECT 1 FROM home_post_likes hpl
          WHERE hpl.post_id = p.id AND hpl.user_id = $1
        ) AS "viewerHasLiked",
        EXISTS (
          SELECT 1 FROM home_post_saves hps
          WHERE hps.post_id = p.id AND hps.user_id = $1
        ) AS "viewerHasSaved",
        true AS "viewerHasReshared",
        hpr.quote_caption AS "reshareQuoteCaption",
        hpr.created_at AS "resharedAt"
      FROM home_post_reshares hpr
      JOIN home_posts p ON p.id = hpr.post_id
      LEFT JOIN learn_users owner ON owner.id = p.user_id
      LEFT JOIN LATERAL (
        SELECT avatar_url
        FROM learn_users
        WHERE LOWER(TRIM(full_name)) = LOWER(TRIM(p.user_name))
        ORDER BY id ASC
        LIMIT 1
      ) nm ON TRUE
      WHERE hpr.user_id = $1
      ORDER BY hpr.created_at DESC
      LIMIT 100
      `,
      [viewerId]
    );
    res.json({ posts: result.rows.map(normalizeHomePostRow) });
  } catch (error) {
    res.status(500).json({ message: "Failed to load reshared posts", error: error.message });
  }
});

router.post("/v1/home/posts/:postId/reshare", authRequired, async (req, res) => {
  try {
    await ensureHomePostResharesTable();
    const postId = Number(req.params.postId);
    const userId = Number(req.user.userId);
    if (!Number.isFinite(postId) || postId <= 0) {
      res.status(400).json({ message: "Valid postId is required" });
      return;
    }
    const post = await query(`SELECT id FROM home_posts WHERE id = $1 LIMIT 1`, [postId]);
    if (!post.rows[0]) {
      res.status(404).json({ message: "Post not found" });
      return;
    }
    const quoteRaw = req.body && typeof req.body.quoteCaption === "string" ? req.body.quoteCaption.trim() : "";
    const quoteCaption = quoteRaw ? quoteRaw.slice(0, 2200) : null;
    await query(
      `
      INSERT INTO home_post_reshares (post_id, user_id, quote_caption)
      VALUES ($1, $2, $3)
      ON CONFLICT (post_id, user_id) DO UPDATE SET
        quote_caption = EXCLUDED.quote_caption,
        created_at = NOW()
      `,
      [postId, userId, quoteCaption]
    );
    await cacheIncr("home:posts:gen");
    res.json({ reshared: true, quoteCaption });
  } catch (error) {
    res.status(500).json({ message: "Failed to reshare post", error: error.message });
  }
});

router.post("/v1/home/posts/:postId/unreshare", authRequired, async (req, res) => {
  try {
    await ensureHomePostResharesTable();
    const postId = Number(req.params.postId);
    const userId = Number(req.user.userId);
    if (!Number.isFinite(postId) || postId <= 0) {
      res.status(400).json({ message: "Valid postId is required" });
      return;
    }
    await query(`DELETE FROM home_post_reshares WHERE post_id = $1 AND user_id = $2`, [postId, userId]);
    await cacheIncr("home:posts:gen");
    res.json({ reshared: false });
  } catch (error) {
    res.status(500).json({ message: "Failed to unreshare post", error: error.message });
  }
});

router.get("/v1/home/posts/repost-feed", authRequired, async (req, res) => {
  try {
    await ensureHomePostResharesTable();
    await ensureSocialFollowsTable();
    await ensureHomePostsTable();
    await ensureLearnUsersTable();
    await ensureHomePostLikesTable();
    await ensureHomePostSavesTable();
    const viewerId = Number(req.user.userId);
    const limitRaw = Number(req.query.limit);
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 24, 1), 48);
    const result = await query(
      `
      SELECT
        p.id,
        COALESCE(p.user_id, owner.id) AS "userId",
        COALESCE(NULLIF(TRIM(owner.full_name), ''), p.user_name) AS "userName",
        owner.username AS "username",
        p.location,
        p.caption,
        p.likes_count AS "likesCount",
        p.comments_count AS "commentsCount",
        p.video_url AS "videoUrl",
        p.image_url AS "imageUrl",
        p.image_urls AS "image_urls",
        p.thumbnail_url AS "thumbnailUrl",
        p.created_at AS "createdAt",
        p.tagged_user_ids AS "tagged_user_ids",
        p.music_label AS "musicLabel",
        p.music_audio_url AS "musicAudioUrl",
        p.creative_meta AS "creativeMeta",
        COALESCE(NULLIF(TRIM(owner.avatar_url), ''), NULLIF(TRIM(nm.avatar_url), '')) AS "authorAvatarUrl",
        EXISTS (
          SELECT 1 FROM home_post_likes hpl
          WHERE hpl.post_id = p.id AND hpl.user_id = $1
        ) AS "viewerHasLiked",
        EXISTS (
          SELECT 1 FROM home_post_saves hps
          WHERE hps.post_id = p.id AND hps.user_id = $1
        ) AS "viewerHasSaved",
        EXISTS (
          SELECT 1 FROM home_post_reshares hpr_self
          WHERE hpr_self.post_id = p.id AND hpr_self.user_id = $1
        ) AS "viewerHasReshared",
        hpr.created_at AS "repostedAt",
        hpr.quote_caption AS "repostQuoteCaption",
        hpr.user_id AS "repostByUserId",
        COALESCE(NULLIF(TRIM(reposter.full_name), ''), 'User') AS "repostByUserName",
        reposter.avatar_url AS "repostByAvatarUrl"
      FROM home_post_reshares hpr
      JOIN home_posts p ON p.id = hpr.post_id
      JOIN learn_users reposter ON reposter.id = hpr.user_id
      LEFT JOIN learn_users owner ON owner.id = p.user_id
      LEFT JOIN LATERAL (
        SELECT avatar_url
        FROM learn_users
        WHERE LOWER(TRIM(full_name)) = LOWER(TRIM(p.user_name))
        ORDER BY id ASC
        LIMIT 1
      ) nm ON TRUE
      WHERE EXISTS (
        SELECT 1 FROM social_follows sf
        WHERE sf.follower_id = $1
          AND sf.following_id = hpr.user_id
          AND sf.status = 'accepted'
      )
      ORDER BY hpr.created_at DESC
      LIMIT $2
      `,
      [viewerId, limit]
    );
    res.json({ posts: result.rows.map(normalizeHomePostRow) });
  } catch (error) {
    res.status(500).json({ message: "Failed to load repost feed", error: error.message });
  }
});

router.get("/v1/home/posts/user/:userId", authOptional, async (req, res) => {
  try {
    await backfillHomePostUserIds();
    await ensureHomePostsTable();
    await ensureLearnUsersTable();
    await ensureHomePostLikesTable();
    await ensureHomePostSavesTable();
    await ensureHomePostResharesTable();

    const targetUserId = Number(req.params.userId);
    if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
      res.status(400).json({ message: "Valid userId is required" });
      return;
    }

    const viewerIdRaw = req.user && req.user.userId != null ? Number(req.user.userId) : null;
    const viewerId = Number.isFinite(viewerIdRaw) ? viewerIdRaw : null;

    const userRes = await query(
      `SELECT full_name, username, email, COALESCE(account_status, 'active') AS status FROM learn_users WHERE id = $1 LIMIT 1`,
      [targetUserId]
    );
    if (!userRes.rows.length) {
      res.json({ posts: [] });
      return;
    }
    if (
      String(userRes.rows[0]?.status || "active").toLowerCase() === "deactivated" &&
      viewerId !== targetUserId
    ) {
      res.json({ posts: [] });
      return;
    }

    const fullName = String(userRes.rows[0]?.full_name || "").trim();
    const username = String(userRes.rows[0]?.username || "").trim();
    const emailLocal = String(userRes.rows[0]?.email || "")
      .split("@")[0]
      .trim();
    const userNameParam = String(req.query.userName || "").trim();

    const result = await query(
      `
      SELECT
        p.id,
        COALESCE(p.user_id, owner.id) AS "userId",
        COALESCE(NULLIF(TRIM(owner.full_name), ''), p.user_name) AS "userName",
        owner.username AS "username",
        p.location,
        p.caption,
        (SELECT COUNT(*)::int FROM home_post_likes hpl_count WHERE hpl_count.post_id = p.id) AS "likesCount",
        p.comments_count AS "commentsCount",
        p.video_url AS "videoUrl",
        p.image_url AS "imageUrl",
        p.image_urls AS "image_urls",
        p.thumbnail_url AS "thumbnailUrl",
        p.created_at AS "createdAt",
        p.tagged_user_ids AS "tagged_user_ids",
        p.music_label AS "musicLabel",
        p.music_audio_url AS "musicAudioUrl",
        p.creative_meta AS "creativeMeta",
        p.live_status AS "liveStatus",
        p.live_ended_at AS "liveEndedAt",
        COALESCE(NULLIF(TRIM(owner.avatar_url), ''), NULLIF(TRIM(nm.avatar_url), '')) AS "authorAvatarUrl",
        CASE
          WHEN $1::integer IS NULL THEN false
          ELSE EXISTS (
            SELECT 1 FROM home_post_likes hpl
            WHERE hpl.post_id = p.id AND hpl.user_id = $1::integer
          )
        END AS "viewerHasLiked",
        CASE
          WHEN $1::integer IS NULL THEN false
          ELSE EXISTS (
            SELECT 1 FROM home_post_saves hps
            WHERE hps.post_id = p.id AND hps.user_id = $1::integer
          )
        END AS "viewerHasSaved",
        CASE
          WHEN $1::integer IS NULL THEN false
          ELSE EXISTS (
            SELECT 1 FROM home_post_reshares hpr
            WHERE hpr.post_id = p.id AND hpr.user_id = $1::integer
          )
        END AS "viewerHasReshared"
      FROM home_posts p
      LEFT JOIN learn_users owner ON owner.id = p.user_id
      LEFT JOIN LATERAL (
        SELECT avatar_url
        FROM learn_users
        WHERE LOWER(TRIM(full_name)) = LOWER(TRIM(p.user_name))
        ORDER BY id ASC
        LIMIT 1
      ) nm ON TRUE
      WHERE
        p.user_id = $2
        OR LOWER(TRIM(p.user_name)) = LOWER(TRIM($3))
        OR LOWER(TRIM(SPLIT_PART(p.user_name, ' ', 1))) = LOWER(TRIM(SPLIT_PART($3, ' ', 1)))
        OR ($4::text IS NOT NULL AND $4 <> '' AND LOWER(TRIM(p.user_name)) = LOWER(TRIM($4)))
        OR ($5::text IS NOT NULL AND $5 <> '' AND LOWER(TRIM(p.user_name)) = LOWER(TRIM($5)))
        OR ($6::text IS NOT NULL AND $6 <> '' AND LOWER(TRIM(p.user_name)) = LOWER(TRIM($6)))
      ORDER BY p.created_at DESC
      LIMIT 100
      `,
      [viewerId, targetUserId, fullName, username || null, emailLocal || null, userNameParam || null]
    );

    const body = { posts: await enrichHomePostsLiveState(dedupeHomePostRows(result.rows)) };
    res.json(body);
  } catch (error) {
    res.status(500).json({ message: "Failed to load user posts", error: error.message });
  }
});

router.get("/v1/home/posts/:postId", authOptional, async (req, res) => {
  try {
    await ensureHomePostsTable();
    await ensureLearnUsersTable();
    await ensureHomePostLikesTable();
    await ensureHomePostSavesTable();
    await ensureHomePostResharesTable();
    const postId = Number(req.params.postId);
    if (!Number.isFinite(postId) || postId <= 0) {
      res.status(400).json({ message: "Valid postId is required" });
      return;
    }
    const viewerId = req.user?.userId ? Number(req.user.userId) : null;
    const result = await query(
      `
      SELECT
        p.id,
        COALESCE(p.user_id, u.id) AS "userId",
        COALESCE(NULLIF(TRIM(owner.full_name), ''), p.user_name) AS "userName",
        owner.username AS "username",
        p.location,
        p.caption,
        (SELECT COUNT(*)::int FROM home_post_likes hpl_count WHERE hpl_count.post_id = p.id) AS "likesCount",
        p.comments_count AS "commentsCount",
        p.video_url AS "videoUrl",
        p.image_url AS "imageUrl",
        p.image_urls AS "image_urls",
        p.thumbnail_url AS "thumbnailUrl",
        p.created_at AS "createdAt",
        p.tagged_user_ids AS "tagged_user_ids",
        p.music_label AS "musicLabel",
        p.music_audio_url AS "musicAudioUrl",
        p.creative_meta AS "creativeMeta",
        p.live_status AS "liveStatus",
        p.live_ended_at AS "liveEndedAt",
        COALESCE(NULLIF(TRIM(owner.avatar_url), ''), NULLIF(TRIM(u.avatar_url), '')) AS "authorAvatarUrl",
        CASE
          WHEN $1::integer IS NULL THEN false
          ELSE EXISTS (
            SELECT 1 FROM home_post_likes hpl
            WHERE hpl.post_id = p.id AND hpl.user_id = $1::integer
          )
        END AS "viewerHasLiked",
        CASE
          WHEN $1::integer IS NULL THEN false
          ELSE EXISTS (
            SELECT 1 FROM home_post_saves hps
            WHERE hps.post_id = p.id AND hps.user_id = $1::integer
          )
        END AS "viewerHasSaved",
        CASE
          WHEN $1::integer IS NULL THEN false
          ELSE EXISTS (
            SELECT 1 FROM home_post_reshares hpr
            WHERE hpr.post_id = p.id AND hpr.user_id = $1::integer
          )
        END AS "viewerHasReshared"
      FROM home_posts p
      LEFT JOIN learn_users owner ON owner.id = p.user_id
      LEFT JOIN LATERAL (
        SELECT id, avatar_url
        FROM learn_users
        WHERE LOWER(TRIM(full_name)) = LOWER(TRIM(p.user_name))
        ORDER BY id ASC
        LIMIT 1
      ) u ON TRUE
      WHERE p.id = $2
      ${hideDeactivatedPostOwnersClause}
      LIMIT 1
      `,
      [viewerId, postId]
    );
    if (!result.rows[0]) {
      res.status(404).json({ message: "Post not found" });
      return;
    }
    const posts = await enrichHomePostsLiveState(dedupeHomePostRows(result.rows));
    res.json({ post: posts[0] });
  } catch (error) {
    res.status(500).json({ message: "Failed to load post", error: error.message });
  }
});

router.get("/v1/home/posts/:postId/likes", async (req, res) => {
  try {
    await ensureHomePostLikesTable();
    const postId = Number(req.params.postId);
    if (!Number.isFinite(postId)) {
      res.status(400).json({ message: "Valid postId is required" });
      return;
    }
    const result = await query(
      `
      SELECT
        lu.id AS "userId",
        lu.full_name AS "fullName",
        lu.username,
        lu.avatar_url AS "avatarUrl",
        hpl.created_at AS "createdAt"
      FROM home_post_likes hpl
      JOIN learn_users lu ON lu.id = hpl.user_id
      WHERE hpl.post_id = $1
      ORDER BY hpl.created_at DESC
      LIMIT 200
      `,
      [postId]
    );
    res.json({ likers: result.rows });
  } catch (error) {
    res.status(500).json({ message: "Failed to load post likes", error: error.message });
  }
});

router.post("/v1/home/posts/:postId/like", authRequired, async (req, res) => {
  try {
    await ensureHomePostLikesTable();
    await ensureSocialNotificationsTable();
    const postId = Number(req.params.postId);
    if (!Number.isFinite(postId)) {
      res.status(400).json({ message: "Valid postId is required" });
      return;
    }
    const actorUserId = Number(req.user.userId);
    const postRes = await query(
      `SELECT id, user_id, user_name, likes_count, video_url FROM home_posts WHERE id = $1 LIMIT 1`,
      [postId]
    );
    if (!postRes.rows[0]) {
      res.status(404).json({ message: "Post not found" });
      return;
    }
    const post = postRes.rows[0];
    const insertLike = await query(
      `INSERT INTO home_post_likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT (post_id, user_id) DO NOTHING RETURNING post_id`,
      [postId, actorUserId]
    );
    if (!insertLike.rows[0]) {
      const cur = await query(`SELECT likes_count AS "likesCount" FROM home_posts WHERE id = $1`, [postId]);
      const liked = await query(`SELECT 1 FROM home_post_likes WHERE post_id = $1 AND user_id = $2`, [postId, actorUserId]);
      res.json({
        liked: !!liked.rows[0],
        likesCount: Number(cur.rows[0]?.likesCount || 0)
      });
      return;
    }
    const updated = await query(
      `UPDATE home_posts SET likes_count = likes_count + 1 WHERE id = $1 RETURNING likes_count AS "likesCount"`,
      [postId]
    );
    const authorUserId = await resolveHomePostAuthorUserId(post);
    if (authorUserId && authorUserId !== actorUserId) {
      await query(
        `INSERT INTO social_notifications (user_id, actor_id, follow_id, type, is_read, post_id, comment_excerpt)
         VALUES ($1, $2, NULL, 'post_like', false, $3, NULL)`,
        [authorUserId, actorUserId, postId]
      );
      fireSocialPush({
        userId: authorUserId,
        type: "post_like",
        actorName: await actorDisplayName(actorUserId),
        postId
      });
    }
    await cacheIncr("home:posts:gen");
    res.json({ liked: true, likesCount: Number(updated.rows[0]?.likesCount || 0) });
  } catch (error) {
    res.status(500).json({ message: "Failed to like post", error: error.message });
  }
});

router.post("/v1/home/posts/:postId/unlike", authRequired, async (req, res) => {
  try {
    await ensureHomePostLikesTable();
    const postId = Number(req.params.postId);
    if (!Number.isFinite(postId)) {
      res.status(400).json({ message: "Valid postId is required" });
      return;
    }
    const actorUserId = Number(req.user.userId);
    const del = await query(`DELETE FROM home_post_likes WHERE post_id = $1 AND user_id = $2 RETURNING post_id`, [
      postId,
      actorUserId
    ]);
    if (del.rows[0]) {
      await query(`UPDATE home_posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1`, [postId]);
    }
    const cur = await query(`SELECT likes_count AS "likesCount" FROM home_posts WHERE id = $1`, [postId]);
    await cacheIncr("home:posts:gen");
    res.json({ liked: false, likesCount: Number(cur.rows[0]?.likesCount || 0) });
  } catch (error) {
    res.status(500).json({ message: "Failed to unlike post", error: error.message });
  }
});

router.get("/v1/home/posts/:postId/comments", async (req, res) => {
  try {
    await ensureHomePostCommentsTable();
    const postId = Number(req.params.postId);
    if (!Number.isFinite(postId)) {
      res.status(400).json({ message: "Valid postId is required" });
      return;
    }
    const postCheck = await query(`SELECT id FROM home_posts WHERE id = $1 LIMIT 1`, [postId]);
    if (!postCheck.rows[0]) {
      res.status(404).json({ message: "Post not found" });
      return;
    }
    const result = await query(
      `
      SELECT
        c.id::text AS id,
        c.body AS text,
        u.full_name AS "user",
        c.user_id AS "userId",
        NULLIF(TRIM(u.avatar_url), '') AS "avatarUrl",
        c.created_at AS "createdAt",
        c.parent_comment_id AS "parentCommentId"
      FROM home_post_comments c
      JOIN learn_users u ON u.id = c.user_id
      WHERE c.post_id = $1
      ORDER BY c.created_at DESC
      `,
      [postId]
    );
    res.json({
      comments: result.rows.map((row) => ({
        id: String(row.id),
        user: row.user,
        text: row.text,
        likes: 0,
        userId: row.userId != null ? Number(row.userId) : undefined,
        avatarUrl: row.avatarUrl || undefined,
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : undefined,
        parentCommentId: row.parentCommentId != null ? String(row.parentCommentId) : undefined
      }))
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load comments", error: error.message });
  }
});

router.post("/v1/home/posts/:postId/comments", authRequired, async (req, res) => {
  try {
    await ensureHomePostCommentsTable();
    await ensureSocialNotificationsTable();
    const postId = Number(req.params.postId);
    const body = String((req.body || {}).text || "").trim();
    if (!Number.isFinite(postId) || !body) {
      res.status(400).json({ message: "Valid postId and text are required" });
      return;
    }
    const actorUserId = Number(req.user.userId);
    const parentRaw = (req.body || {}).parentCommentId;
    const parentCommentPk =
      parentRaw != null && parentRaw !== "" && Number.isFinite(Number(parentRaw)) && Number(parentRaw) > 0
        ? Number(parentRaw)
        : null;

    const postRes = await query(`SELECT id, user_id, user_name FROM home_posts WHERE id = $1 LIMIT 1`, [postId]);
    if (!postRes.rows[0]) {
      res.status(404).json({ message: "Post not found" });
      return;
    }
    const post = postRes.rows[0];

    if (parentCommentPk) {
      const parentRow = await query(
        `SELECT id, post_id, user_id FROM home_post_comments WHERE id = $1 LIMIT 1`,
        [parentCommentPk]
      );
      if (!parentRow.rows[0] || Number(parentRow.rows[0].post_id) !== postId) {
        res.status(400).json({ message: "Invalid parent comment for this post" });
        return;
      }
    }

    const excerpt = body.length > 160 ? `${body.slice(0, 157)}...` : body;
    const ins = await query(
      `
      INSERT INTO home_post_comments (post_id, user_id, body, parent_comment_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id, body, created_at AS "createdAt", parent_comment_id AS "parentCommentId"
      `,
      [postId, actorUserId, body, parentCommentPk]
    );
    await query(`UPDATE home_posts SET comments_count = comments_count + 1 WHERE id = $1`, [postId]);

    const authorUserId = await resolveHomePostAuthorUserId(post);
    let parentCommentAuthorId = null;
    if (parentCommentPk) {
      const pu = await query(`SELECT user_id FROM home_post_comments WHERE id = $1 LIMIT 1`, [parentCommentPk]);
      parentCommentAuthorId = pu.rows[0] != null ? Number(pu.rows[0].user_id) : null;
    }

    if (parentCommentAuthorId && parentCommentAuthorId !== actorUserId) {
      await query(
        `INSERT INTO social_notifications (user_id, actor_id, follow_id, type, is_read, post_id, comment_excerpt)
         VALUES ($1, $2, NULL, 'comment_reply', false, $3, $4)`,
        [parentCommentAuthorId, actorUserId, postId, excerpt]
      );
      fireSocialPush({
        userId: parentCommentAuthorId,
        type: "comment_reply",
        actorName: await actorDisplayName(actorUserId),
        postId,
        commentExcerpt: excerpt
      });
    }

    if (authorUserId && authorUserId !== actorUserId) {
      const skipPostOwnerNotif =
        parentCommentPk && parentCommentAuthorId != null && authorUserId === parentCommentAuthorId;
      if (!skipPostOwnerNotif) {
        await query(
          `INSERT INTO social_notifications (user_id, actor_id, follow_id, type, is_read, post_id, comment_excerpt)
           VALUES ($1, $2, NULL, 'post_comment', false, $3, $4)`,
          [authorUserId, actorUserId, postId, excerpt]
        );
        fireSocialPush({
          userId: authorUserId,
          type: "post_comment",
          actorName: await actorDisplayName(actorUserId),
          postId,
          commentExcerpt: excerpt
        });
      }
    }

    const actor = await query(
      `SELECT full_name AS "fullName", NULLIF(TRIM(avatar_url), '') AS "avatarUrl" FROM learn_users WHERE id = $1`,
      [actorUserId]
    );
    const row = ins.rows[0];
    const cc = await query(`SELECT comments_count AS "commentsCount" FROM home_posts WHERE id = $1`, [postId]);
    res.status(201).json({
      comment: {
        id: String(row.id),
        user: actor.rows[0]?.fullName || "Member",
        text: row.body,
        likes: 0,
        userId: actorUserId,
        createdAt: row.createdAt,
        avatarUrl: actor.rows[0]?.avatarUrl || undefined,
        parentCommentId: row.parentCommentId != null ? String(row.parentCommentId) : undefined
      },
      commentsCount: Number(cc.rows[0]?.commentsCount ?? 0)
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to add comment", error: error.message });
  }
});

router.delete("/v1/home/posts/:postId/comments/:commentId", authRequired, async (req, res) => {
  try {
    await ensureHomePostCommentsTable();
    const postId = Number(req.params.postId);
    const commentId = Number(req.params.commentId);
    const actorUserId = Number(req.user.userId);
    if (!Number.isFinite(postId) || !Number.isFinite(commentId) || commentId <= 0) {
      res.status(400).json({ message: "Valid postId and commentId are required" });
      return;
    }

    const existing = await query(
      `SELECT id, user_id FROM home_post_comments WHERE id = $1 AND post_id = $2 LIMIT 1`,
      [commentId, postId]
    );
    if (!existing.rows[0]) {
      res.status(404).json({ message: "Comment not found" });
      return;
    }
    if (Number(existing.rows[0].user_id) !== actorUserId) {
      res.status(403).json({ message: "You can only delete your own comments" });
      return;
    }

    await query(`DELETE FROM home_post_comments WHERE id = $1 AND post_id = $2`, [commentId, postId]);
    const countRes = await query(`SELECT COUNT(*)::int AS c FROM home_post_comments WHERE post_id = $1`, [postId]);
    const commentsCount = Number(countRes.rows[0]?.c ?? 0);
    await query(`UPDATE home_posts SET comments_count = $1 WHERE id = $2`, [commentsCount, postId]);

    res.json({ ok: true, commentsCount });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete comment", error: error.message });
  }
});

router.get("/v1/media/config", async (_req, res) => {
  if (!isMediaStorageConfigured()) {
    res.status(503).json({
      provider: null,
      ok: false,
      configured: false,
      message:
        "Media storage is not configured. Set AWS S3 (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET) or Supabase Storage vars."
    });
    return;
  }
  try {
    const health = await checkMediaStorageHealth();
    res.json(health);
  } catch (error) {
    res.json({
      provider: null,
      ok: false,
      configured: true,
      message: error.message || "Media storage check failed"
    });
  }
});

router.post("/v1/media/upload", authOptional, (req, res) => {
  uploadMediaMemory.single("file")(req, res, async (err) => {
    if (err) {
      const errMsg = String(err.message || "");
      res.status(400).json({
        message: errMsg || "Invalid upload request",
        error: errMsg,
        hint: /file too large|limit/i.test(errMsg)
          ? "File is over the 100MB upload limit. Trim the video or export a smaller MP4."
          : undefined
      });
      return;
    }
    if (!req.file) {
      res.status(400).json({ message: "file is required" });
      return;
    }
    if (!isMediaStorageConfigured()) {
      res.status(503).json({
        message:
          "Media storage is not configured. Set AWS S3 or Supabase Storage env vars on the server."
      });
      return;
    }

    try {
      const mimeType = String(req.file.mimetype || "application/octet-stream");
      const isVideo = mimeType.startsWith("video/");
      const ext = mediaExtFromMime(mimeType, req.file.originalname);
      const objectPath = `agrovibes/${isVideo ? "videos" : "images"}/${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      const uploaded = await uploadMediaBuffer({
        buffer: req.file.buffer,
        mimeType,
        objectPath
      });
      res.status(201).json({ url: uploaded.url, provider: uploaded.provider, path: uploaded.path });
    } catch (error) {
      const msg = String(error.message || "");
      res.status(500).json({
        message: "Media upload failed",
        error: msg,
        hint: /AWS|S3|bucket/i.test(msg)
          ? "Check AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET and IAM s3:PutObject permission."
          : /bucket/i.test(msg)
            ? 'Create a public Storage bucket named "media" in Supabase.'
            : /jwt|api key|invalid/i.test(msg)
              ? "Use the legacy service_role key (eyJ...), not sb_publishable_."
              : /SUPABASE_URL|project url|pooler|https:\/\//i.test(msg)
                ? "Fix SUPABASE_URL on Render: use Project Settings → API → Project URL (https://xxxx.supabase.co)."
                : /Invalid path specified/i.test(msg)
                  ? "SUPABASE_URL on Render is wrong. Use https://YOUR-REF.supabase.co only — not the database URL or /storage/v1 path."
                  : /maximum allowed size|payload too large|entity too large/i.test(msg)
                    ? "File is over the upload size limit. Trim the video or export a shorter/smaller MP4."
                    : undefined
      });
    }
  });
});

router.post("/v1/uploads/video", (req, res) => {
  uploadVideo.single("video")(req, res, (err) => {
    if (err) {
      res.status(400).json({ message: err.message || "Invalid upload request" });
      return;
    }
    if (!req.file) {
      res.status(400).json({ message: "video file is required" });
      return;
    }
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const url = `${baseUrl}/uploads/videos/${encodeURIComponent(req.file.filename)}`;
    res.status(201).json({
      url,
      filename: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size
    });
  });
});

router.get("/v1/learn/courses", async (_req, res) => {
  try {
    const cacheKey = "v1:learn:courses";
    const cached = await cacheGetJson(cacheKey);
    if (cached && Array.isArray(cached.courses)) {
      res.json(cached);
      return;
    }
    await seedLearnCoursesIfEmpty();
    const result = await query(
      `
      SELECT
        id,
        title,
        category,
        tags,
        level,
        rating::FLOAT AS rating,
        learners_count AS "learnersCount",
        duration_label AS "durationLabel",
        is_free AS "isFree",
        hero_gradient AS "heroGradient",
        instructor,
        syllabus,
        lessons,
        reviews_preview AS "reviewsPreview",
        updated_at AS "updatedAt"
      FROM learn_courses
      ORDER BY updated_at DESC
      `
    );
    const body = { courses: result.rows, source: "db" };
    res.json(body);
    await cacheSetJson(cacheKey, body, 120);
  } catch (error) {
    res.json({ courses: learnFallbackCourses(), source: "fallback", message: error.message });
  }
});

router.post("/v1/learn/courses", authRequired, requireRole(["instructor", "admin"]), async (req, res) => {
  try {
    await ensureLearnCoursesTable();
    const payload = req.body || {};
    const id = String(payload.id || "").trim();
    const title = String(payload.title || "").trim();
    const category = String(payload.category || "").trim() || "General";
    const tags = Array.isArray(payload.tags) ? payload.tags.map(String) : [];
    const level = String(payload.level || "Beginner");
    const rating = Number(payload.rating || 0);
    const learnersCount = Number(payload.learnersCount || 0);
    const durationLabel = String(payload.durationLabel || "0m");
    const isFree = Boolean(payload.isFree ?? true);
    const heroGradient = Array.isArray(payload.heroGradient) ? payload.heroGradient.map(String) : ["#f7d7c9", "#cfe7d9", "#f6d8b7"];
    const instructor = payload.instructor && typeof payload.instructor === "object" ? payload.instructor : { name: req.user.fullName, title: "Instructor", bio: "" };
    const syllabus = Array.isArray(payload.syllabus) ? payload.syllabus : [];
    const lessons = Array.isArray(payload.lessons) ? payload.lessons : [];
    const reviewsPreview = Array.isArray(payload.reviewsPreview) ? payload.reviewsPreview : [];

    if (!id || !title) {
      res.status(400).json({ message: "id and title are required" });
      return;
    }

    const isProbablyMp4Url = (url) => {
      const u = String(url || "").trim().toLowerCase();
      return (u.startsWith("http://") || u.startsWith("https://")) && /\.mp4(\?|#|$)/.test(u);
    };

    if (lessons.length > 0) {
      for (const l of lessons) {
        const videoUrl = l?.videoUrl;
        if (!isProbablyMp4Url(videoUrl)) {
          res.status(400).json({
            message: "Lesson videoUrl must be a direct .mp4 URL (Google search links will not play)."
          });
          return;
        }
      }
    }

    const result = await query(
      `
      INSERT INTO learn_courses
        (id, title, category, tags, level, rating, learners_count, duration_label, is_free, hero_gradient, instructor, syllabus, lessons, reviews_preview, created_by_user_id, updated_at)
      VALUES
        ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,$15,NOW())
      RETURNING id
      `,
      [
        id,
        title,
        category,
        JSON.stringify(tags),
        level,
        rating,
        learnersCount,
        durationLabel,
        isFree,
        JSON.stringify(heroGradient),
        JSON.stringify(instructor),
        JSON.stringify(syllabus),
        JSON.stringify(lessons),
        JSON.stringify(reviewsPreview),
        req.user.userId
      ]
    );

    await cacheDel("v1:learn:courses");
    res.status(201).json({ courseId: result.rows[0].id });
  } catch (error) {
    const msg = String(error.message || "");
    if (msg.includes("duplicate key") || msg.includes("already exists") || msg.includes("unique")) {
      res.status(409).json({ message: "Course id already exists" });
      return;
    }
    res.status(500).json({ message: "Failed to create course", error: error.message });
  }
});

router.put("/v1/learn/courses/:id", authRequired, requireRole(["instructor", "admin"]), async (req, res) => {
  try {
    await ensureLearnCoursesTable();
    const id = String(req.params.id || "");
    const payload = req.body || {};

    const patch = {
      title: payload.title,
      category: payload.category,
      tags: payload.tags,
      level: payload.level,
      rating: payload.rating,
      learnersCount: payload.learnersCount,
      durationLabel: payload.durationLabel,
      isFree: payload.isFree,
      heroGradient: payload.heroGradient,
      instructor: payload.instructor,
      syllabus: payload.syllabus,
      lessons: payload.lessons,
      reviewsPreview: payload.reviewsPreview
    };

    const isProbablyMp4Url = (url) => {
      const u = String(url || "").trim().toLowerCase();
      return (u.startsWith("http://") || u.startsWith("https://")) && /\.mp4(\?|#|$)/.test(u);
    };

    if (Array.isArray(patch.lessons)) {
      for (const l of patch.lessons) {
        const videoUrl = l?.videoUrl;
        if (!isProbablyMp4Url(videoUrl)) {
          res.status(400).json({ message: "Lesson videoUrl must be a direct .mp4 URL" });
          return;
        }
      }
    }

    // Fetch current for ownership check if instructor (admin can edit all)
    if (req.user.role !== "admin") {
      const ownerRes = await query(`SELECT created_by_user_id AS "createdByUserId" FROM learn_courses WHERE id = $1 LIMIT 1`, [id]);
      const owner = ownerRes.rows[0];
      if (!owner) {
        res.status(404).json({ message: "Course not found" });
        return;
      }
      if (owner.createdByUserId && Number(owner.createdByUserId) !== Number(req.user.userId)) {
        res.status(403).json({ message: "You can only edit your own courses" });
        return;
      }
    }

    const current = await query(`SELECT * FROM learn_courses WHERE id = $1 LIMIT 1`, [id]);
    if (!current.rows[0]) {
      res.status(404).json({ message: "Course not found" });
      return;
    }

    const merged = {
      id,
      title: String(patch.title ?? current.rows[0].title),
      category: String(patch.category ?? current.rows[0].category),
      tags: Array.isArray(patch.tags) ? patch.tags.map(String) : current.rows[0].tags,
      level: String(patch.level ?? current.rows[0].level),
      rating: Number(patch.rating ?? current.rows[0].rating),
      learnersCount: Number(patch.learnersCount ?? current.rows[0].learners_count ?? current.rows[0].learnersCount ?? 0),
      durationLabel: String(patch.durationLabel ?? current.rows[0].duration_label ?? current.rows[0].durationLabel),
      isFree: Boolean(patch.isFree ?? current.rows[0].is_free ?? current.rows[0].isFree),
      heroGradient: Array.isArray(patch.heroGradient) ? patch.heroGradient.map(String) : current.rows[0].hero_gradient,
      instructor: patch.instructor && typeof patch.instructor === "object" ? patch.instructor : current.rows[0].instructor,
      syllabus: Array.isArray(patch.syllabus) ? patch.syllabus : current.rows[0].syllabus,
      lessons: Array.isArray(patch.lessons) ? patch.lessons : current.rows[0].lessons,
      reviewsPreview: Array.isArray(patch.reviewsPreview) ? patch.reviewsPreview : current.rows[0].reviews_preview
    };

    await query(
      `
      UPDATE learn_courses
      SET
        title = $2,
        category = $3,
        tags = $4::jsonb,
        level = $5,
        rating = $6,
        learners_count = $7,
        duration_label = $8,
        is_free = $9,
        hero_gradient = $10::jsonb,
        instructor = $11::jsonb,
        syllabus = $12::jsonb,
        lessons = $13::jsonb,
        reviews_preview = $14::jsonb,
        updated_at = NOW()
      WHERE id = $1
      `,
      [
        merged.id,
        merged.title,
        merged.category,
        JSON.stringify(merged.tags || []),
        merged.level,
        merged.rating,
        merged.learnersCount,
        merged.durationLabel,
        merged.isFree,
        JSON.stringify(merged.heroGradient || []),
        JSON.stringify(merged.instructor || {}),
        JSON.stringify(merged.syllabus || []),
        JSON.stringify(merged.lessons || []),
        JSON.stringify(merged.reviewsPreview || [])
      ]
    );

    await cacheDel("v1:learn:courses");
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to update course", error: error.message });
  }
});

router.post("/v1/learn/courses/:id/enroll", authRequired, async (req, res) => {
  try {
    await seedLearnCoursesIfEmpty();
    await ensureLearnEnrollmentsTable();

    const courseId = String(req.params.id || "");
    const courseRes = await query(`SELECT is_free AS "isFree" FROM learn_courses WHERE id = $1 LIMIT 1`, [courseId]);
    if (!courseRes.rows[0]) {
      res.status(404).json({ message: "Course not found" });
      return;
    }

    const { paid } = req.body || {};
    const isFree = Boolean(courseRes.rows[0].isFree);
    const isPaid = Boolean(paid) || isFree;

    const result = await query(
      `
      INSERT INTO learn_enrollments (user_id, course_id, status, is_paid)
      VALUES ($1, $2, 'active', $3)
      ON CONFLICT (user_id, course_id)
      DO UPDATE SET status='active', is_paid = GREATEST(learn_enrollments.is_paid::INT, EXCLUDED.is_paid::INT)::BOOLEAN
      RETURNING id, course_id AS "courseId", status, is_paid AS "isPaid"
      `,
      [req.user.userId, courseId, isPaid]
    );

    res.status(201).json({ enrollment: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: "Failed to enroll", error: error.message });
  }
});

router.get("/v1/learn/courses/:id/progress", authRequired, async (req, res) => {
  try {
    await ensureLearnProgressTable();
    const courseId = String(req.params.id || "");
    const rows = await query(
      `
      SELECT lesson_id AS "lessonId", completed, last_watched_seconds AS "lastWatchedSeconds", updated_at AS "updatedAt"
      FROM learn_progress
      WHERE user_id=$1 AND course_id=$2
      ORDER BY updated_at DESC
      `,
      [req.user.userId, courseId]
    );
    res.json({ progress: rows.rows });
  } catch (error) {
    res.status(500).json({ message: "Failed to load progress", error: error.message });
  }
});

router.post("/v1/learn/courses/:id/progress", authRequired, async (req, res) => {
  try {
    await ensureLearnProgressTable();
    const courseId = String(req.params.id || "");
    const { lessonId, completed, lastWatchedSeconds } = req.body || {};
    if (!lessonId) {
      res.status(400).json({ message: "lessonId is required" });
      return;
    }
    const result = await query(
      `
      INSERT INTO learn_progress (user_id, course_id, lesson_id, completed, last_watched_seconds, updated_at)
      VALUES ($1,$2,$3,$4,$5,NOW())
      ON CONFLICT (user_id, course_id, lesson_id)
      DO UPDATE SET completed=EXCLUDED.completed, last_watched_seconds=EXCLUDED.last_watched_seconds, updated_at=NOW()
      RETURNING lesson_id AS "lessonId", completed, last_watched_seconds AS "lastWatchedSeconds", updated_at AS "updatedAt"
      `,
      [req.user.userId, courseId, String(lessonId), Boolean(completed), Number(lastWatchedSeconds || 0)]
    );
    res.status(201).json({ progress: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: "Failed to save progress", error: error.message });
  }
});

router.get("/v1/learn/courses/:id", authOptional, async (req, res) => {
  try {
    await seedLearnCoursesIfEmpty();
    const id = String(req.params.id || "");
    const result = await query(
      `
      SELECT
        id,
        title,
        category,
        tags,
        level,
        rating::FLOAT AS rating,
        learners_count AS "learnersCount",
        duration_label AS "durationLabel",
        is_free AS "isFree",
        hero_gradient AS "heroGradient",
        instructor,
        syllabus,
        lessons,
        reviews_preview AS "reviewsPreview",
        updated_at AS "updatedAt"
      FROM learn_courses
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );
    if (!result.rows[0]) {
      res.status(404).json({ message: "Course not found" });
      return;
    }

    const course = result.rows[0];
    // Entitlements: locked lessons playable only if enrolled+paid or course is free.
    let canAccessLocked = false;
    if (course.isFree) {
      canAccessLocked = true;
    } else if (req.user?.userId) {
      try {
        await ensureLearnEnrollmentsTable();
        const enr = await query(
          `SELECT is_paid AS "isPaid", status FROM learn_enrollments WHERE user_id=$1 AND course_id=$2 LIMIT 1`,
          [req.user.userId, id]
        );
        canAccessLocked = Boolean(enr.rows[0] && enr.rows[0].status === "active" && enr.rows[0].isPaid);
      } catch (_e) {
        canAccessLocked = false;
      }
    }

    if (Array.isArray(course.lessons)) {
      course.lessons = course.lessons.map((l) => {
        const baseLocked = Boolean(l.locked);
        if (!baseLocked) return l;
        // locked lesson: keep it locked; player screen uses canAccessLocked for enabling playback
        return { ...l, locked: !canAccessLocked };
      });
    }

    res.json({ course, source: "db", canAccessLocked });
  } catch (error) {
    const fallback = learnFallbackCourses().find((c) => c.id === req.params.id);
    if (!fallback) {
      res.status(404).json({ message: "Course not found", source: "fallback", error: error.message });
      return;
    }
    res.json({ course: fallback, source: "fallback", message: error.message });
  }
});

function getRazorpayClient() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) return null;
  try {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const Razorpay = require("razorpay");
    return { instance: new Razorpay({ key_id, key_secret }), keyId: key_id };
  } catch (_e) {
    return null;
  }
}

/** Create a Razorpay order (amount in paise). Returns mock data in non-production when keys are missing. */
router.post("/v1/payments/razorpay/create-order", async (req, res) => {
  const amountPaise = Number(req.body?.amountPaise);
  const receipt = String(req.body?.receipt || `agro_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
  if (!Number.isFinite(amountPaise) || amountPaise < 100) {
    res.status(400).json({ message: "amountPaise must be at least 100 (INR 1.00)" });
    return;
  }
  if (amountPaise > 499_99_900) {
    res.status(400).json({ message: "Amount exceeds allowed maximum" });
    return;
  }

  const rz = getRazorpayClient();
  if (!rz) {
    if (process.env.NODE_ENV === "production") {
      res.status(503).json({ message: "Online payments are not configured on this server." });
      return;
    }
    const id = `mock_order_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
    res.json({
      mock: true,
      keyId: "rzp_test_xxxxxxxx",
      order: { id, amount: amountPaise, currency: "INR", receipt },
      message: "Mock order (set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET for live Razorpay)"
    });
    return;
  }

  try {
    const order = await rz.instance.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt,
      payment_capture: 1
    });
    res.json({ mock: false, keyId: rz.keyId, order });
  } catch (err) {
    const desc = err.error?.description || err.description || err.message || "Razorpay error";
    res.status(502).json({ message: desc });
  }
});

/** Verify Razorpay payment signature after client checkout. */
router.post("/v1/payments/razorpay/verify", (req, res) => {
  const orderId = req.body?.razorpay_order_id;
  const paymentId = req.body?.razorpay_payment_id;
  const signature = req.body?.razorpay_signature;
  const secret = process.env.RAZORPAY_KEY_SECRET;

  if (!orderId || !paymentId || !signature) {
    res.status(400).json({ message: "Missing razorpay_order_id, razorpay_payment_id, or razorpay_signature" });
    return;
  }

  if (String(orderId).startsWith("mock_order_")) {
    if (process.env.NODE_ENV === "production") {
      res.status(400).json({ message: "Invalid order id" });
      return;
    }
    res.json({ ok: true, mock: true });
    return;
  }

  if (!secret) {
    res.status(503).json({ message: "Payment verification unavailable" });
    return;
  }

  const body = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  if (expected !== signature) {
    res.status(400).json({ message: "Payment signature mismatch" });
    return;
  }

  res.json({ ok: true, mock: false });
});

async function handleSharePostPage(req, res, sharePath = "reel") {
  try {
    await ensureHomePostsTable();
    await ensureLearnUsersTable();
    const postId = Number(req.params.postId);
    if (!Number.isFinite(postId) || postId <= 0) {
      res.status(400).send("Invalid link");
      return;
    }
    const result = await query(
      `
      SELECT
        p.id,
        COALESCE(NULLIF(TRIM(owner.full_name), ''), p.user_name) AS "userName",
        p.caption,
        p.video_url AS "videoUrl",
        p.image_url AS "imageUrl",
        p.image_urls AS "image_urls",
        p.thumbnail_url AS "thumbnailUrl"
      FROM home_posts p
      LEFT JOIN learn_users owner ON owner.id = p.user_id
      WHERE p.id = $1
      LIMIT 1
      `,
      [postId]
    );
    if (!result.rows[0]) {
      res.status(404).send("Post not found");
      return;
    }
    const post = sanitizeHomePostRowMedia(normalizeHomePostRow(result.rows[0]));
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(
      buildShareReelHtml(post, {
        postId,
        userAgent: req.headers["user-agent"] || "",
        sharePath
      })
    );
  } catch (error) {
    res.status(500).send("Failed to load post");
  }
}

router.get("/share/reel/:postId", (req, res) => void handleSharePostPage(req, res, "reel"));
router.get("/share/watch/:postId", (req, res) => void handleSharePostPage(req, res, "watch"));

module.exports = router;
