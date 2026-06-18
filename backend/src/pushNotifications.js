const admin = require("firebase-admin");
const fs = require("fs");
const { query } = require("./db");

let pushDeviceTokensTableReady = false;
let firebaseReady = false;

function stripEnv(value) {
  return String(value || "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

function readFirebaseServiceAccount() {
  const inline = stripEnv(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (inline) {
    try {
      return JSON.parse(inline);
    } catch {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON");
    }
  }
  const filePath = stripEnv(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
  if (filePath) {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  }
  return null;
}

function initFirebaseAdmin() {
  if (firebaseReady) return true;
  if (admin.apps.length > 0) {
    firebaseReady = true;
    return true;
  }
  const serviceAccount = readFirebaseServiceAccount();
  if (!serviceAccount) return false;
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  firebaseReady = true;
  return true;
}

function isPushConfigured() {
  try {
    return initFirebaseAdmin();
  } catch {
    return false;
  }
}

async function ensurePushDeviceTokensTable() {
  if (pushDeviceTokensTableReady) return;
  await query(
    `
    CREATE TABLE IF NOT EXISTS push_device_tokens (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES learn_users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      platform TEXT NOT NULL DEFAULT 'android',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    `
  );
  await query(`CREATE INDEX IF NOT EXISTS idx_push_device_tokens_user_id ON push_device_tokens(user_id)`);
  pushDeviceTokensTableReady = true;
}

async function registerPushDeviceToken({ userId, token, platform }) {
  await ensurePushDeviceTokensTable();
  const cleanToken = String(token || "").trim();
  if (!cleanToken) throw new Error("token is required");
  const cleanPlatform = String(platform || "android").trim().slice(0, 16) || "android";
  await query(
    `
    INSERT INTO push_device_tokens (user_id, token, platform, updated_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (token) DO UPDATE
      SET user_id = EXCLUDED.user_id,
          platform = EXCLUDED.platform,
          updated_at = NOW()
    `,
    [userId, cleanToken, cleanPlatform]
  );
  return { ok: true };
}

async function unregisterPushDeviceToken({ userId, token }) {
  await ensurePushDeviceTokensTable();
  const cleanToken = String(token || "").trim();
  if (!cleanToken) return { ok: true, removed: 0 };
  const result = await query(`DELETE FROM push_device_tokens WHERE user_id = $1 AND token = $2`, [userId, cleanToken]);
  return { ok: true, removed: result.rowCount || 0 };
}

async function listTokensForUser(userId) {
  await ensurePushDeviceTokensTable();
  const result = await query(`SELECT token FROM push_device_tokens WHERE user_id = $1`, [userId]);
  return result.rows.map((row) => String(row.token || "").trim()).filter(Boolean);
}

async function removeInvalidTokens(tokens) {
  if (!tokens?.length) return;
  await ensurePushDeviceTokensTable();
  await query(`DELETE FROM push_device_tokens WHERE token = ANY($1::text[])`, [tokens]);
}

function socialPushCopy({ type, actorName, commentExcerpt }) {
  const actor = String(actorName || "Someone").trim() || "Someone";
  const excerpt = String(commentExcerpt || "").trim();
  switch (type) {
    case "follow_request":
      return { title: "New follow request", body: `${actor} requested to follow you` };
    case "follow_accept":
      return { title: "Follow accepted", body: `${actor} accepted your follow request` };
    case "post_like":
      return { title: "New like", body: `${actor} liked your post` };
    case "post_comment":
      return { title: "New comment", body: excerpt ? `${actor}: ${excerpt}` : `${actor} commented on your post` };
    case "comment_reply":
      return { title: "New reply", body: excerpt ? `${actor}: ${excerpt}` : `${actor} replied to your comment` };
    case "live_start":
      return { title: "Live now", body: `${actor} started a live stream` };
    case "live_scheduled":
      return { title: "Live scheduled", body: `${actor} scheduled a live stream` };
    case "live_reminder":
      return { title: "Live reminder", body: `${actor}'s live starts in 10 minutes` };
    case "live_host_reminder":
      return { title: "Your live starts soon", body: "Your scheduled live starts in 10 minutes" };
    case "direct_message":
      return { title: actor, body: excerpt || "Sent you a message" };
    case "live_share":
      return { title: actor, body: excerpt || "Shared a live video" };
    default:
      return { title: "Cropvibe", body: `${actor} sent you a notification` };
  }
}

async function sendPushToUser(userId, { title, body, data }) {
  if (!initFirebaseAdmin()) return { sent: 0, skipped: "not_configured" };
  const tokens = await listTokensForUser(userId);
  if (!tokens.length) return { sent: 0, skipped: "no_tokens" };

  const payloadData = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (value == null) continue;
    payloadData[String(key)] = String(value);
  }

  const response = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: {
      title: String(title || "Cropvibe"),
      body: String(body || "")
    },
    data: payloadData,
    android: {
      priority: "high",
      notification: {
        channelId: "default",
        priority: "max",
        visibility: "public",
        defaultSound: true,
        defaultVibrateTimings: true
      }
    },
    apns: {
      headers: {
        "apns-priority": "10"
      },
      payload: {
        aps: {
          sound: "default"
        }
      }
    }
  });

  const invalidTokens = [];
  response.responses.forEach((item, index) => {
    if (item.success) return;
    const code = item.error?.code || "";
    if (
      code === "messaging/registration-token-not-registered" ||
      code === "messaging/invalid-registration-token"
    ) {
      invalidTokens.push(tokens[index]);
    }
  });
  if (invalidTokens.length) {
    await removeInvalidTokens(invalidTokens);
  }

  return { sent: response.successCount, failed: response.failureCount };
}

async function sendSocialPushToUser({ userId, type, actorName, actorId, postId, commentExcerpt, followId }) {
  const copy = socialPushCopy({ type, actorName, commentExcerpt });
  return sendPushToUser(userId, {
    title: copy.title,
    body: copy.body,
    data: {
      type: type || "generic",
      actorId: actorId != null ? String(actorId) : "",
      postId: postId != null ? String(postId) : "",
      followId: followId != null ? String(followId) : ""
    }
  });
}

async function sendIncomingCallPush({ userId, callerName, mode, roomName, callerId }) {
  const label = mode === "video" ? "Incoming video call" : "Incoming voice call";
  return sendPushToUser(userId, {
    title: String(callerName || "Someone").trim() || "Someone",
    body: label,
    data: {
      type: "incoming_call",
      mode: mode === "video" ? "video" : "voice",
      roomName: String(roomName || ""),
      callerId: callerId != null ? String(callerId) : ""
    }
  });
}

async function sendSocialPushToFollowers({ hostUserId, type, postId, commentExcerpt }) {
  const hostRes = await query(`SELECT full_name FROM learn_users WHERE id = $1 LIMIT 1`, [hostUserId]);
  const actorName = String(hostRes.rows[0]?.full_name || "Someone").trim() || "Someone";
  const followers = await query(
    `
    SELECT follower_id
    FROM social_follows
    WHERE following_id = $1
      AND status = 'accepted'
      AND follower_id <> $1
    `,
    [hostUserId]
  );
  let sent = 0;
  for (const row of followers.rows) {
    const result = await sendSocialPushToUser({
      userId: Number(row.follower_id),
      type,
      actorName,
      postId,
      commentExcerpt
    });
    sent += Number(result?.sent || 0);
  }
  return { sent, followers: followers.rows.length };
}

module.exports = {
  ensurePushDeviceTokensTable,
  isPushConfigured,
  registerPushDeviceToken,
  unregisterPushDeviceToken,
  sendPushToUser,
  sendIncomingCallPush,
  sendSocialPushToUser,
  sendSocialPushToFollowers
};
