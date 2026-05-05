const express = require("express");
const { query } = require("../db");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { signJwt, authOptional, authRequired, requireRole } = require("../auth");

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
let directMessagesTableReady = false;
const phoneOtpMemory = new Map();
const phoneUserMemory = new Map();

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
  if (fromEnv) return fromEnv;
  // Static OTP fallback for development/testing.
  // If you are using this in production, set STATIC_OTP_CODE explicitly.
  return "525252";
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
  homePostsTableReady = true;
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
    base.imageUrl = base.imageUrl || list[0] || null;
  } else if (list && list.length === 1) {
    base.imageUrl = base.imageUrl || list[0];
  }
  return base;
}

async function ensureHomeStoriesTable() {
  if (homeStoriesTableReady) return;
  await query(
    `
    CREATE TABLE IF NOT EXISTS home_stories (
      id SERIAL PRIMARY KEY,
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
  await query(`ALTER TABLE home_stories ADD COLUMN IF NOT EXISTS video_url TEXT`);
  await query(`ALTER TABLE home_stories ADD COLUMN IF NOT EXISTS image_url TEXT`);
  homeStoriesTableReady = true;
}

async function backfillHomePostUserIds() {
  await ensureHomePostsTable();
  await ensureLearnUsersTable();
  const legacyPosts = await query(
    `
    SELECT id, user_name AS "userName"
    FROM home_posts
    WHERE user_id IS NULL
    ORDER BY id ASC
    `
  );
  if (!legacyPosts.rows.length) return;

  const fallbackPasswordHash = await bcrypt.hash(`legacy-${Date.now()}-${Math.random()}`, 10);
  for (const post of legacyPosts.rows) {
    const displayName = String(post.userName || "").trim() || "Farmer";
    const normalizedName = displayName.toLowerCase();
    let userId = null;

    const existingByName = await query(
      `
      SELECT id
      FROM learn_users
      WHERE LOWER(TRIM(full_name)) = $1
      LIMIT 1
      `,
      [normalizedName]
    );
    if (existingByName.rows[0]?.id) {
      userId = existingByName.rows[0].id;
    }

    if (!userId) {
      const maybeUsername = slugUsernameFromName(displayName) || null;
      if (maybeUsername) {
        const existingByUsername = await query(
          `
          SELECT id
          FROM learn_users
          WHERE LOWER(TRIM(username)) = $1
          LIMIT 1
          `,
          [maybeUsername]
        );
        if (existingByUsername.rows[0]?.id) {
          userId = existingByUsername.rows[0].id;
        }
      }
    }

    if (!userId) {
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

    if (userId) {
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
    res.json({ status: "ok", db: "connected" });
  } catch (error) {
    res.status(500).json({ status: "error", db: "disconnected", message: error.message });
  }
});

router.get("/v1/bootstrap", (_req, res) => {
  res.json({
    app: "Agrovibes",
    modules: ["home", "marketplace", "create", "services", "community", "profile", "wallet", "escrow"]
  });
});

router.post("/v1/auth/register", async (req, res) => {
  try {
    await ensureLearnUsersTable();
    const { email, password, fullName, role, username, phone } = req.body || {};
    let storeEmail = String(email || "").trim().toLowerCase();
    if (storeEmail.endsWith("@phone.agrovibes")) {
      const localDigits = storeEmail.split("@")[0].replace(/\D/g, "");
      if (localDigits.length >= 10) {
        storeEmail = `${localDigits.slice(-10)}@phone.agrovibes`;
      }
    }
    const normalizedUsername = String(username || "").trim().toLowerCase() || null;
    const normalizedPhone = normalizeIndiaPhone(phone || (storeEmail.endsWith("@phone.agrovibes") ? storeEmail.split("@")[0] : null));
    const safeRole = ["student", "instructor", "admin"].includes(String(role)) ? String(role) : "student";

    if (!storeEmail || !password || String(password).length < 6 || !fullName) {
      res.status(400).json({ message: "email, fullName and password (min 6 chars) are required" });
      return;
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const result = await query(
      `
      INSERT INTO learn_users (email, password_hash, full_name, role, username, phone)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, email, full_name AS "fullName", role, phone, username
      `,
      [storeEmail, passwordHash, String(fullName).trim(), safeRole, normalizedUsername, normalizedPhone]
    );

    const user = result.rows[0];
    const token = signJwt({ userId: user.id, email: user.email, role: user.role, fullName: user.fullName });
    res.status(201).json({ token, user });
  } catch (error) {
    const msg = String(error.message || "");
    if (msg.includes("duplicate key") || msg.includes("already exists") || msg.includes("unique")) {
      res.status(409).json({ message: "Email, phone, or username already registered" });
      return;
    }
    res.status(500).json({ message: "Failed to register", error: error.message });
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
      res.status(400).json({ message: "identifier (email/phone/username) and password are required" });
      return;
    }

    const idDigits = phoneIdentifier ? phoneDigitsOnly(phoneIdentifier) : "";
    const phoneDigitsLast10 = idDigits.length >= 10 ? idDigits.slice(-10) : "";

    const syntheticLocal = syntheticPhoneEmail ? syntheticPhoneEmail.split("@")[0] : "";

    const result = await query(
      `
      SELECT id, email, password_hash AS "passwordHash", full_name AS "fullName", role, phone, username
      FROM learn_users
      WHERE LOWER(TRIM(email)) = $1
         OR LOWER(TRIM(username)) = $1
         OR ($2::TEXT IS NOT NULL AND $4::TEXT <> '' AND (
              phone = $2
              OR RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10) = $4
            ))
         OR ($3::TEXT IS NOT NULL AND LOWER(TRIM(email)) = $3)
         OR ($5::TEXT <> '' AND LOWER(TRIM(email)) LIKE '%@phone.agrovibes'
             AND RIGHT(REGEXP_REPLACE(SPLIT_PART(LOWER(TRIM(email)), '@', 1), '[^0-9]', '', 'g'), 10) = $5)
      LIMIT 1
      `,
      [normalizedIdentifier, phoneIdentifier, syntheticPhoneEmail, phoneDigitsLast10, syntheticLocal]
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

    const user = { id: userRow.id, email: userRow.email, fullName: userRow.fullName, role: userRow.role, phone: userRow.phone };
    const token = signJwt({ userId: user.id, email: user.email, role: user.role, fullName: user.fullName });
    res.json({ token, user });
  } catch (error) {
    res.status(500).json({ message: "Failed to login", error: error.message });
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

    const staticCode = staticOtpCode();
    const isStaticOtp = Boolean(staticCode && code === staticCode);

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
        SELECT id, email, full_name AS "fullName", role, phone
        FROM learn_users
        WHERE phone = $1
        LIMIT 1
        `,
        [phone]
      );

      user = lookup.rows[0];
      if (!user) {
        isNewUser = true;
        const tempPassword = crypto.randomBytes(24).toString("hex");
        const passwordHash = await bcrypt.hash(tempPassword, 10);
        const created = await query(
          `
          INSERT INTO learn_users (email, password_hash, full_name, role, phone)
          VALUES ($1, $2, $3, 'student', $4)
          RETURNING id, email, full_name AS "fullName", role, phone
          `,
          [syntheticEmail, passwordHash, "Farmer", phone]
        );
        user = created.rows[0];
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

    const token = signJwt({
      userId: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      phone: user.phone
    });
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

    const staticCode = staticOtpCode();
    const isStaticOtp = Boolean(staticCode && code === staticCode);

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

    if (!isStaticOtp) {
      if (otpRowFromDb && otpRow?.id) {
        await query(`UPDATE phone_otp_codes SET used = true WHERE id = $1`, [otpRow.id]);
      } else if (otpRow) {
        otpRow.used = true;
      }
    }

    await ensureLearnUsersTable();
    const phoneDigits = phone.replace(/\D/g, "");
    const last10 = phoneDigits.length >= 10 ? phoneDigits.slice(-10) : phoneDigits;

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const updated = await query(
      `
      UPDATE learn_users
      SET password_hash = $1
      WHERE phone = $2
         OR ($3 <> '' AND RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10) = $3)
      RETURNING id, email
      `,
      [passwordHash, phone, last10]
    );

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
  res.json({ user: req.user });
});

router.get("/v1/social/profile-stats/:userId", authRequired, async (req, res) => {
  try {
    await ensureSocialNotificationsTable();
    const targetUserId = Number(req.params.userId);
    if (!Number.isFinite(targetUserId)) {
      res.status(400).json({ message: "Valid userId is required" });
      return;
    }
    const counts = await socialCountsForUser(targetUserId);
    const relation =
      Number(req.user.userId) === targetUserId
        ? { viewerStatus: "self", reverseStatus: "self", canFollowBack: false }
        : await relationshipForUsers(req.user.userId, targetUserId);
    res.json({ ...counts, ...relation });
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
      SELECT u.id AS "userId", u.full_name AS "fullName"
      FROM social_follows f
      JOIN learn_users u ON u.id = f.follower_id
      WHERE f.following_id = $1 AND f.status = 'accepted'
      ORDER BY u.full_name ASC
      `,
      [targetUserId]
    );
    const followingRes = await query(
      `
      SELECT u.id AS "userId", u.full_name AS "fullName"
      FROM social_follows f
      JOIN learn_users u ON u.id = f.following_id
      WHERE f.follower_id = $1 AND f.status = 'accepted'
      ORDER BY u.full_name ASC
      `,
      [targetUserId]
    );
    const pendingOutRes = await query(
      `
      SELECT u.id AS "userId", u.full_name AS "fullName"
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
        viewerStatus,
        canFollowBack: viewerStatus === "none"
      };
    });

    const following = followingRes.rows.map((row) => ({
      name: row.fullName,
      key: String(row.userId),
      viewerStatus: "accepted",
      canFollowBack: false
    }));

    res.json({ followers, following });
  } catch (error) {
    res.status(500).json({ message: "Failed to load follow network", error: error.message });
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
        COALESCE(f.status, 'pending') AS "followStatus",
        CASE
          WHEN p.video_url IS NOT NULL AND TRIM(COALESCE(p.video_url, '')) <> '' THEN true
          ELSE false
        END AS "postIsReel"
      FROM social_notifications n
      JOIN learn_users u ON u.id = n.actor_id
      LEFT JOIN social_follows f ON f.id = n.follow_id
      LEFT JOIN home_posts p ON p.id = n.post_id
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC
      LIMIT 100
      `,
      [currentUserId]
    );

    const followRequests = result.rows.filter((r) => r.type === "follow_request" && !r.isRead && r.followStatus === "pending");
    const followAccepted = result.rows.filter((r) => r.type === "follow_accept" && !r.isRead);
    const postLikes = result.rows.filter((r) => r.type === "post_like" && !r.isRead);
    const postComments = result.rows.filter(
      (r) => (r.type === "post_comment" || r.type === "comment_reply") && !r.isRead
    );
    res.json({
      followRequests,
      followAccepted,
      postLikes,
      postComments,
      unreadCount: followRequests.length + followAccepted.length + postLikes.length + postComments.length
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load notifications", error: error.message });
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

    const peerRes = await query(`SELECT id, full_name AS "fullName", email FROM learn_users WHERE id = $1 LIMIT 1`, [peerUserId]);
    if (!peerRes.rows[0]) {
      res.status(404).json({ message: "Peer user not found" });
      return;
    }

    await query(`UPDATE direct_messages SET is_read = true WHERE sender_id = $1 AND receiver_id = $2 AND is_read = false`, [peerUserId, me]);

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
      ORDER BY created_at ASC
      LIMIT 500
      `,
      [me, peerUserId]
    );

    res.json({
      peer: { id: peerRes.rows[0].id, fullName: peerRes.rows[0].fullName, email: peerRes.rows[0].email },
      messages: rows.rows
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load message thread", error: error.message });
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

    const peerRes = await query(`SELECT id FROM learn_users WHERE id = $1 LIMIT 1`, [peerUserId]);
    if (!peerRes.rows[0]) {
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
    res.status(201).json({ message: ins.rows[0] });
  } catch (error) {
    res.status(500).json({ message: "Failed to send message", error: error.message });
  }
});

router.get("/v1/marketplace/listings", async (_req, res) => {
  try {
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

    res.json({ listings: result.rows });
  } catch (error) {
    res.json({
      listings: [
        { id: 1, cropName: "Tomato", district: "Nashik", pricePerKg: 28, verifiedOnly: true, listingType: "produce" },
        { id: 2, cropName: "Onion", district: "Nagpur", pricePerKg: 25, verifiedOnly: true, listingType: "produce" },
        { id: 3, cropName: "Soybean", district: "Indore", pricePerKg: 42, verifiedOnly: false, listingType: "produce" }
      ],
      source: "fallback",
      message: error.message
    });
  }
});

router.get("/v1/community/questions", async (_req, res) => {
  try {
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

    res.json({ questions: result.rows });
  } catch (error) {
    res.json({
      questions: [
        {
          id: 1,
          userName: "Mahesh Rao",
          district: "Nagpur",
          textContent: "The leaves on my orange trees are turning yellow. Any remedy?",
          upvotes: 45,
          answersCount: 2,
          isResolved: true,
          createdAt: new Date().toISOString()
        },
        {
          id: 2,
          userName: "Pradeep Kumar",
          district: "Indore",
          textContent: "Heavy whitefly infestation on soybean. How to control organically?",
          upvotes: 21,
          answersCount: 3,
          isResolved: false,
          createdAt: new Date().toISOString()
        }
      ],
      source: "fallback",
      message: error.message
    });
  }
});

const STORY_TTL_SQL = "24 hours";

router.get("/v1/home/stories", async (_req, res) => {
  try {
    await ensureHomeStoriesTable();
    // Stories expire after 24 hours (Instagram-style). Remove expired rows so they no longer appear.
    await query(`DELETE FROM home_stories WHERE created_at < NOW() - INTERVAL '${STORY_TTL_SQL}'`);
    const result = await query(
      `
      SELECT
        id,
        user_id AS "userId",
        user_name AS "userName",
        district,
        avatar_label AS "avatarLabel",
        has_new AS "hasNew",
        viewed,
        video_url AS "videoUrl",
        image_url AS "imageUrl"
      FROM home_stories
      WHERE created_at >= NOW() - INTERVAL '${STORY_TTL_SQL}'
      ORDER BY created_at DESC
      LIMIT 40
      `
    );

    if (result.rows.length === 0) {
      res.json({
        stories: [
          { id: 1, userName: "You", district: "Nashik", avatarLabel: "Y", hasNew: false, viewed: true },
          { id: 2, userName: "Ramesh", district: "Nashik", avatarLabel: "R", hasNew: true, viewed: false },
          { id: 3, userName: "Suresh", district: "Indore", avatarLabel: "S", hasNew: true, viewed: false },
          { id: 4, userName: "Meena", district: "Ludhiana", avatarLabel: "M", hasNew: true, viewed: false },
          { id: 5, userName: "Kisan Hub", district: "Pune", avatarLabel: "K", hasNew: false, viewed: true },
          { id: 6, userName: "Agri News", district: "Delhi", avatarLabel: "A", hasNew: true, viewed: false }
        ]
      });
      return;
    }

    res.json({ stories: result.rows });
  } catch (error) {
    res.json({
      stories: [
        { id: 1, userName: "You", district: "Nashik", avatarLabel: "Y", hasNew: false, viewed: true },
        { id: 2, userName: "Ramesh", district: "Nashik", avatarLabel: "R", hasNew: true, viewed: false }
      ],
      source: "fallback",
      message: error.message
    });
  }
});

router.post("/v1/home/stories", async (req, res) => {
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
    const result = await query(
      `
      INSERT INTO home_stories (user_name, district, avatar_label, has_new, viewed, video_url, image_url)
      VALUES ($1, $2, $3, true, false, $4, $5)
      RETURNING
        id,
        user_name AS "userName",
        district,
        avatar_label AS "avatarLabel",
        has_new AS "hasNew",
        viewed,
        video_url AS "videoUrl",
        image_url AS "imageUrl"
      `,
      [userName, district, avatarLabel, videoUrl || null, imageUrl || null]
    );

    res.status(201).json({ story: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: "Failed to create story", error: error.message });
  }
});

router.delete("/v1/home/stories/:storyId", async (req, res) => {
  try {
    await ensureHomeStoriesTable();
    const storyId = Number(req.params.storyId);
    const userName = String((req.body || {}).userName || "").trim();
    if (!Number.isFinite(storyId) || storyId <= 0 || !userName) {
      res.status(400).json({ message: "Valid storyId and userName are required" });
      return;
    }
    const deleted = await query(
      `
      DELETE FROM home_stories
      WHERE id = $1 AND LOWER(TRIM(user_name)) = LOWER(TRIM($2))
      RETURNING id
      `,
      [storyId, userName]
    );
    if (!deleted.rows[0]) {
      res.status(404).json({ message: "Story not found or not owned by user" });
      return;
    }
    res.json({ ok: true, deletedId: Number(deleted.rows[0].id) });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete story", error: error.message });
  }
});

router.get("/v1/home/posts", authOptional, async (req, res) => {
  try {
    await backfillHomePostUserIds();
    await ensureHomePostsTable();
    await ensureLearnUsersTable();
    await ensureHomePostLikesTable();
    const viewerIdRaw = req.user && req.user.userId != null ? Number(req.user.userId) : null;
    const viewerId = Number.isFinite(viewerIdRaw) ? viewerIdRaw : null;
    const result = await query(
      `
      SELECT
        p.id,
        COALESCE(p.user_id, u.id) AS "userId",
        p.user_name AS "userName",
        p.location,
        p.caption,
        p.likes_count AS "likesCount",
        p.comments_count AS "commentsCount",
        p.video_url AS "videoUrl",
        p.image_url AS "imageUrl",
        p.image_urls AS "image_urls",
        p.thumbnail_url AS "thumbnailUrl",
        p.created_at AS "createdAt",
        CASE
          WHEN $1::integer IS NULL THEN false
          ELSE EXISTS (
            SELECT 1 FROM home_post_likes hpl
            WHERE hpl.post_id = p.id AND hpl.user_id = $1::integer
          )
        END AS "viewerHasLiked"
      FROM home_posts p
      LEFT JOIN learn_users u ON LOWER(TRIM(u.full_name)) = LOWER(TRIM(p.user_name))
      ORDER BY p.created_at DESC
      LIMIT 50
      `,
      [viewerId]
    );

    if (result.rows.length === 0) {
      res.json({
        posts: [
          {
            id: 1,
            userName: "Ramesh Patel",
            location: "Nashik",
            caption: "Fresh tomatoes available this week at Rs35/kg. Contact us now!",
            likesCount: 1284,
            commentsCount: 92,
            videoUrl: "https://example.com/video/tomato.mp4",
            thumbnailUrl: null,
            createdAt: new Date().toISOString(),
            viewerHasLiked: false
          }
        ]
      });
      return;
    }

    res.json({ posts: result.rows.map(normalizeHomePostRow) });
  } catch (error) {
    res.json({
      posts: [
        {
          id: 1,
          userName: "Ramesh Patel",
          location: "Nashik",
          caption: "Fresh tomatoes available this week at Rs35/kg. Contact us now!",
          likesCount: 1284,
          commentsCount: 92,
          videoUrl: "https://example.com/video/tomato.mp4",
          thumbnailUrl: null,
          createdAt: new Date().toISOString(),
          viewerHasLiked: false
        }
      ],
      source: "fallback",
      message: error.message
    });
  }
});

router.post("/v1/home/posts", async (req, res) => {
  try {
    await ensureHomePostsTable();
    const { userId, userName, location, caption, videoUrl, imageUrl, imageUrls, thumbnailUrl } = req.body || {};

    const urlList = Array.isArray(imageUrls) ? imageUrls.filter((u) => typeof u === "string" && u.trim()) : [];
    const primaryImage = urlList[0] || (typeof imageUrl === "string" && imageUrl.trim() ? imageUrl.trim() : null);
    const imageUrlsJson = urlList.length > 1 ? JSON.stringify(urlList) : null;
    const hasVideo = !!(videoUrl && String(videoUrl).trim());
    const hasImage = !!primaryImage;

    if (!userName || !location || !caption || (!hasVideo && !hasImage)) {
      res.status(400).json({ message: "userName, location, caption and one of videoUrl/imageUrl/imageUrls are required" });
      return;
    }
    if (hasVideo && hasImage) {
      res.status(400).json({ message: "Send either a video or images for one post, not both" });
      return;
    }

    const result = await query(
      `
      INSERT INTO home_posts (user_id, user_name, location, caption, video_url, image_url, image_urls, thumbnail_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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
        created_at AS "createdAt"
      `,
      [userId || null, userName, location, caption, videoUrl || null, primaryImage, imageUrlsJson, thumbnailUrl || null]
    );

    res.status(201).json({ post: normalizeHomePostRow(result.rows[0]) });
  } catch (error) {
    res.status(500).json({ message: "Failed to create home post", error: error.message });
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
    }
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
        c.created_at AS "createdAt",
        c.parent_comment_id AS "parentCommentId"
      FROM home_post_comments c
      JOIN learn_users u ON u.id = c.user_id
      WHERE c.post_id = $1
      ORDER BY c.created_at ASC
      `,
      [postId]
    );
    res.json({
      comments: result.rows.map((row) => ({
        id: String(row.id),
        user: row.user,
        text: row.text,
        likes: 0,
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
      }
    }

    const actor = await query(`SELECT full_name AS "fullName" FROM learn_users WHERE id = $1`, [actorUserId]);
    const row = ins.rows[0];
    const cc = await query(`SELECT comments_count AS "commentsCount" FROM home_posts WHERE id = $1`, [postId]);
    res.status(201).json({
      comment: {
        id: String(row.id),
        user: actor.rows[0]?.fullName || "Member",
        text: row.body,
        likes: 0,
        createdAt: row.createdAt,
        parentCommentId: row.parentCommentId != null ? String(row.parentCommentId) : undefined
      },
      commentsCount: Number(cc.rows[0]?.commentsCount ?? 0)
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to add comment", error: error.message });
  }
});

router.post("/v1/media/cloudinary-sign", (req, res) => {
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  const apiKey = String(process.env.CLOUDINARY_API_KEY || "").trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || "").trim();

  if (!cloudName || !apiKey || !apiSecret) {
    res.status(500).json({ message: "Cloudinary credentials are not configured on server" });
    return;
  }

  const folder = String(req.body?.folder || "agrovibes").trim() || "agrovibes";
  const timestamp = Math.floor(Date.now() / 1000);
  const signaturePayload = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash("sha1").update(signaturePayload).digest("hex");

  res.json({
    cloudName,
    apiKey,
    timestamp,
    folder,
    signature
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
    res.json({ courses: result.rows, source: "db" });
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

module.exports = router;
