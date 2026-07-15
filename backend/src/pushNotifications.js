const admin = require("firebase-admin");
const fs = require("fs");
const { query } = require("./db");

let pushDeviceTokensTableReady = false;
let pushUserSettingsTableReady = false;
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

async function ensurePushUserSettingsTable() {
  if (pushUserSettingsTableReady) return;
  await query(
    `
    CREATE TABLE IF NOT EXISTS push_user_settings (
      user_id INT PRIMARY KEY REFERENCES learn_users(id) ON DELETE CASCADE,
      push_enabled BOOLEAN NOT NULL DEFAULT true,
      messages_enabled BOOLEAN NOT NULL DEFAULT true,
      activity_enabled BOOLEAN NOT NULL DEFAULT true,
      sleep_mode BOOLEAN NOT NULL DEFAULT false,
      pause_aii BOOLEAN NOT NULL DEFAULT false,
      following_and_followers_enabled BOOLEAN NOT NULL DEFAULT true,
      live_and_drops_enabled BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    `
  );
  await query(`ALTER TABLE push_user_settings ADD COLUMN IF NOT EXISTS sleep_mode BOOLEAN NOT NULL DEFAULT false`);
  await query(`ALTER TABLE push_user_settings ADD COLUMN IF NOT EXISTS pause_aii BOOLEAN NOT NULL DEFAULT false`);
  await query(`ALTER TABLE push_user_settings ADD COLUMN IF NOT EXISTS following_and_followers_enabled BOOLEAN NOT NULL DEFAULT true`);
  await query(`ALTER TABLE push_user_settings ADD COLUMN IF NOT EXISTS live_and_drops_enabled BOOLEAN NOT NULL DEFAULT true`);
  pushUserSettingsTableReady = true;
}

async function getPushSettings(userId) {
  await ensurePushUserSettingsTable();
  const result = await query(
    `
    SELECT
      push_enabled,
      messages_enabled,
      activity_enabled,
      sleep_mode,
      pause_aii,
      following_and_followers_enabled,
      live_and_drops_enabled
    FROM push_user_settings
    WHERE user_id = $1
    LIMIT 1
    `,
    [userId]
  );
  if (!result.rows[0]) {
    return {
      pushEnabled: true,
      messagesEnabled: true,
      activityEnabled: true,
      sleepMode: false,
      pauseAii: false,
      followingAndFollowers: true,
      liveAndDrops: true
    };
  }
  const row = result.rows[0];
  return {
    pushEnabled: Boolean(row.push_enabled),
    messagesEnabled: Boolean(row.messages_enabled),
    activityEnabled: Boolean(row.activity_enabled),
    sleepMode: Boolean(row.sleep_mode),
    pauseAii: Boolean(row.pause_aii),
    followingAndFollowers: Boolean(row.following_and_followers_enabled),
    liveAndDrops: Boolean(row.live_and_drops_enabled)
  };
}

async function setPushSettings(userId, settings) {
  await ensurePushUserSettingsTable();
  const pushEnabled = Boolean(settings?.pushEnabled);
  const messagesEnabled = Boolean(settings?.messagesEnabled);
  const activityEnabled = Boolean(settings?.activityEnabled);
  const sleepMode = Boolean(settings?.sleepMode);
  const pauseAii = Boolean(settings?.pauseAii);
  const followingAndFollowers = Boolean(settings?.followingAndFollowers);
  const liveAndDrops = Boolean(settings?.liveAndDrops);
  const result = await query(
    `
    INSERT INTO push_user_settings (
      user_id,
      push_enabled,
      messages_enabled,
      activity_enabled,
      sleep_mode,
      pause_aii,
      following_and_followers_enabled,
      live_and_drops_enabled,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    ON CONFLICT (user_id) DO UPDATE
      SET push_enabled = EXCLUDED.push_enabled,
          messages_enabled = EXCLUDED.messages_enabled,
          activity_enabled = EXCLUDED.activity_enabled,
          sleep_mode = EXCLUDED.sleep_mode,
          pause_aii = EXCLUDED.pause_aii,
          following_and_followers_enabled = EXCLUDED.following_and_followers_enabled,
          live_and_drops_enabled = EXCLUDED.live_and_drops_enabled,
          updated_at = NOW()
    RETURNING
      push_enabled,
      messages_enabled,
      activity_enabled,
      sleep_mode,
      pause_aii,
      following_and_followers_enabled,
      live_and_drops_enabled
    `,
    [userId, pushEnabled, messagesEnabled, activityEnabled, sleepMode, pauseAii, followingAndFollowers, liveAndDrops]
  );
  const row = result.rows[0];
  return {
    pushEnabled: Boolean(row.push_enabled),
    messagesEnabled: Boolean(row.messages_enabled),
    activityEnabled: Boolean(row.activity_enabled),
    sleepMode: Boolean(row.sleep_mode),
    pauseAii: Boolean(row.pause_aii),
    followingAndFollowers: Boolean(row.following_and_followers_enabled),
    liveAndDrops: Boolean(row.live_and_drops_enabled)
  };
}

function shouldSendPushForType(settings, type) {
  if (!settings.pushEnabled) return false;
  if (settings.sleepMode) return false;
  const normalizedType = String(type || "").trim();
  const isMessageType = normalizedType === "direct_message" || normalizedType === "live_share";
  const isFollowType = normalizedType === "follow_request" || normalizedType === "follow_accept";
  const isLiveType =
    normalizedType === "live_start" ||
    normalizedType === "live_scheduled" ||
    normalizedType === "live_reminder" ||
    normalizedType === "live_host_reminder";
  if (settings.pauseAii) return isMessageType && settings.messagesEnabled;
  if (isMessageType) return settings.messagesEnabled;
  if (isFollowType) return settings.followingAndFollowers;
  if (isLiveType) return settings.liveAndDrops;
  return settings.activityEnabled;
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

async function listTokenEntriesForUser(userId) {
  await ensurePushDeviceTokensTable();
  const result = await query(`SELECT token, platform FROM push_device_tokens WHERE user_id = $1`, [userId]);
  return result.rows
    .map((row) => ({
      token: String(row.token || "").trim(),
      platform: String(row.platform || "android").trim().toLowerCase() || "android"
    }))
    .filter((row) => row.token);
}

async function sendMulticastAndCleanup(tokens, message) {
  if (!tokens.length) return { sent: 0, failed: 0 };
  const response = await admin.messaging().sendEachForMulticast({
    tokens,
    ...message
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

async function removeInvalidTokens(tokens) {
  if (!tokens?.length) return;
  await ensurePushDeviceTokensTable();
  await query(`DELETE FROM push_device_tokens WHERE token = ANY($1::text[])`, [tokens]);
}

function formatVoiceDuration(ms) {
  const totalSec = Math.max(0, Math.round((Number(ms) || 0) / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function directMessagePushPayload(body) {
  const text = String(body || "").trim();
  if (!text) return { excerpt: "Message", imageUrl: null };

  if (text.startsWith("[Cropvibe Live]")) {
    return { excerpt: "Live video", imageUrl: null };
  }

  if (text.startsWith("[Cropvibe Media]")) {
    const jsonText = text.slice("[Cropvibe Media]".length).trim();
    if (jsonText.startsWith("{")) {
      try {
        const parsed = JSON.parse(jsonText);
        const url = String(parsed?.url || "").trim();
        if (parsed?.kind === "video") return { excerpt: "Video", imageUrl: null };
        if (parsed?.kind === "image") {
          return {
            excerpt: "Photo",
            imageUrl: /^https?:\/\//i.test(url) ? url : null
          };
        }
      } catch {
        // fall through
      }
    }
    return { excerpt: "Photo", imageUrl: null };
  }

  if (text.startsWith("[Cropvibe Reply]")) {
    const jsonText = text.slice("[Cropvibe Reply]".length).trim();
    if (jsonText.startsWith("{")) {
      try {
        const parsed = JSON.parse(jsonText);
        const replyText = String(parsed?.text || "").trim();
        if (replyText) {
          const excerpt = replyText.length > 120 ? `${replyText.slice(0, 117)}...` : replyText;
          return { excerpt, imageUrl: null };
        }
      } catch {
        // fall through
      }
    }
  }

  if (text.startsWith("[Cropvibe Voice]")) {
    const jsonText = text.slice("[Cropvibe Voice]".length).trim();
    let excerpt = "Voice message";
    if (jsonText.startsWith("{")) {
      try {
        const parsed = JSON.parse(jsonText);
        const durationMs = Number(parsed?.durationMs);
        if (Number.isFinite(durationMs) && durationMs > 0) {
          excerpt = `Voice message (${formatVoiceDuration(durationMs)})`;
        }
      } catch {
        // fall through
      }
    }
    return { excerpt, imageUrl: null };
  }

  if (text.startsWith("[Cropvibe Call]")) {
    const jsonText = text.slice("[Cropvibe Call]".length).trim();
    let excerpt = "Call";
    if (jsonText.startsWith("{")) {
      try {
        const parsed = JSON.parse(jsonText);
        const kind = parsed?.mode === "video" ? "Video call" : "Audio call";
        const status = String(parsed?.status || "");
        if (status === "completed") {
          const durationSec = Number(parsed?.durationSec);
          excerpt =
            Number.isFinite(durationSec) && durationSec > 0
              ? `${kind} (${formatVoiceDuration(durationSec * 1000)})`
              : kind;
        } else if (status === "missed") excerpt = `Missed ${kind.toLowerCase()}`;
        else if (status === "declined") excerpt = `Declined ${kind.toLowerCase()}`;
        else excerpt = `Cancelled ${kind.toLowerCase()}`;
      } catch {
        // fall through
      }
    }
    return { excerpt, imageUrl: null };
  }

  if (text.startsWith("[Cropvibe Reel]") || text.startsWith("[AgroVibe Reel]")) {
    return { excerpt: "Reel", imageUrl: null };
  }

  if (text.startsWith("[Cropvibe Post]")) {
    return { excerpt: "Post", imageUrl: null };
  }

  if (text.startsWith("[Cropvibe Profile]")) {
    return { excerpt: "Profile", imageUrl: null };
  }

  const excerpt = text.length > 120 ? `${text.slice(0, 117)}...` : text;
  return { excerpt, imageUrl: null };
}

function formatDirectMessagePushExcerpt(body) {
  return directMessagePushPayload(body).excerpt;
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
      return { title: actor, body: excerpt || "Message" };
    case "live_share":
      return { title: actor, body: excerpt || "Live video" };
    default:
      return { title: "Cropvibe", body: `${actor} sent you a notification` };
  }
}

async function sendPushToUser(userId, { title, body, data, imageUrl, categoryId }) {
  if (!initFirebaseAdmin()) return { sent: 0, skipped: "not_configured" };
  const tokens = await listTokensForUser(userId);
  if (!tokens.length) return { sent: 0, skipped: "no_tokens" };

  const payloadData = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (value == null) continue;
    payloadData[String(key)] = String(value);
  }

  const pushTitle = String(title || "Cropvibe");
  const pushBody = String(body || "");
  const image = String(imageUrl || "").trim();
  const hasImage = /^https?:\/\//i.test(image);

  // Chat reply actions use category payloads on iOS. On Android, also send a visible
  // notification payload so FCM shows alerts when the app is backgrounded/killed.
  const isIncomingCallCategory =
    categoryId === "INCOMING_VOICE_CALL" || categoryId === "INCOMING_VIDEO_CALL";
  if (categoryId === "DIRECT_MESSAGE" || isIncomingCallCategory) {
    payloadData.title = pushTitle;
    payloadData.message = pushBody;
    payloadData.type = String((data || {}).type || payloadData.type || "direct_message");
    payloadData.categoryId = String(categoryId);
    payloadData.channelId = isIncomingCallCategory ? "incoming_calls_v4" : "direct_messages_v4";
    payloadData.priority = isIncomingCallCategory ? "max" : "high";
    if (isIncomingCallCategory) {
      payloadData.sticky = "true";
      payloadData.vibrate = JSON.stringify([0, 800, 400, 800, 400, 800]);
    }
    if (hasImage) payloadData.image = image;

    if (categoryId === "DIRECT_MESSAGE") {
      const entries = await listTokenEntriesForUser(userId);
      if (!entries.length) return { sent: 0, skipped: "no_tokens" };

      const androidTokens = entries.filter((entry) => entry.platform === "android").map((entry) => entry.token);
      const iosTokens = entries.filter((entry) => entry.platform !== "android").map((entry) => entry.token);

      let sent = 0;
      let failed = 0;

      if (androidTokens.length) {
        const androidResult = await sendMulticastAndCleanup(androidTokens, {
          data: payloadData,
          android: {
            priority: "high",
            ttl: 60 * 1000
          }
        });
        sent += androidResult.sent;
        failed += androidResult.failed;
      }

      if (iosTokens.length) {
        const iosResult = await sendMulticastAndCleanup(iosTokens, {
          data: payloadData,
          apns: {
            headers: {
              "apns-priority": "10"
            },
            payload: {
              aps: {
                alert: {
                  title: pushTitle,
                  body: pushBody
                },
                sound: "default",
                category: String(categoryId),
                ...(hasImage ? { "mutable-content": 1 } : {})
              }
            },
            ...(hasImage ? { fcm_options: { image } } : {})
          }
        });
        sent += iosResult.sent;
        failed += iosResult.failed;
      }

      return { sent, failed };
    }

    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      data: payloadData,
      android: {
        priority: "high"
      },
      apns: {
        headers: {
          "apns-priority": "10",
          ...(isIncomingCallCategory ? { "apns-push-type": "alert" } : {})
        },
        payload: {
          aps: {
            alert: {
              title: pushTitle,
              body: pushBody
            },
            sound: "default",
            category: String(categoryId),
            ...(isIncomingCallCategory ? { "interruption-level": "time-sensitive" } : {}),
            ...(hasImage ? { "mutable-content": 1 } : {})
          }
        },
        ...(hasImage ? { fcm_options: { image } } : {})
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

  if (categoryId) {
    payloadData.categoryId = String(categoryId);
  }

  const notification = {
    title: pushTitle,
    body: pushBody
  };
  if (hasImage) notification.imageUrl = image;

  const response = await admin.messaging().sendEachForMulticast({
    tokens,
    notification,
    data: payloadData,
    android: {
      priority: "high",
      notification: {
        channelId: "general_v4",
        priority: "max",
        visibility: "public",
        defaultSound: true,
        defaultVibrateTimings: true,
        sound: "default",
        ...(hasImage ? { imageUrl: image } : {})
      }
    },
    apns: {
      headers: {
        "apns-priority": "10"
      },
      payload: {
        aps: {
          sound: "default",
          ...(categoryId ? { category: String(categoryId) } : {}),
          ...(hasImage ? { "mutable-content": 1 } : {})
        }
      },
      ...(hasImage ? { fcm_options: { image } } : {})
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

async function sendSocialPushToUser({ userId, type, actorName, actorId, postId, commentExcerpt, followId, imageUrl }) {
  const settings = await getPushSettings(Number(userId));
  if (!shouldSendPushForType(settings, String(type || ""))) {
    return { sent: 0, skipped: "user_settings" };
  }
  const copy = socialPushCopy({ type, actorName, commentExcerpt });
  return sendPushToUser(userId, {
    title: copy.title,
    body: copy.body,
    imageUrl,
    categoryId: type === "direct_message" ? "DIRECT_MESSAGE" : undefined,
    data: {
      type: type || "generic",
      actorId: actorId != null ? String(actorId) : "",
      actorName: String(actorName || "").trim(),
      senderName: String(actorName || "").trim(),
      senderId: actorId != null ? String(actorId) : "",
      postId: postId != null ? String(postId) : "",
      followId: followId != null ? String(followId) : ""
    }
  });
}

async function sendIncomingCallPush({ userId, callerName, mode, roomName, callerId, callerAvatarUrl }) {
  const settings = await getPushSettings(Number(userId));
  if (!settings.pushEnabled || settings.sleepMode || !settings.messagesEnabled) {
    return { sent: 0, skipped: "user_settings" };
  }
  if (!initFirebaseAdmin()) return { sent: 0, skipped: "not_configured" };

  const entries = await listTokenEntriesForUser(userId);
  if (!entries.length) return { sent: 0, skipped: "no_tokens" };

  const isVideo = mode === "video";
  const label = isVideo ? "Incoming video call" : "Incoming voice call";
  const categoryId = isVideo ? "INCOMING_VIDEO_CALL" : "INCOMING_VOICE_CALL";
  const name = String(callerName || "Someone").trim() || "Someone";
  const avatar = String(callerAvatarUrl || "").trim();
  const imageUrl = /^https?:\/\//i.test(avatar) ? avatar : null;

  const androidTokens = entries.filter((entry) => entry.platform === "android").map((entry) => entry.token);
  const iosTokens = entries.filter((entry) => entry.platform !== "android").map((entry) => entry.token);

  let sent = 0;
  let failed = 0;

  if (androidTokens.length) {
    const androidData = {
      type: "incoming_call",
      mode: isVideo ? "video" : "voice",
      roomName: String(roomName || ""),
      callerId: callerId != null ? String(callerId) : "",
      callerName: name,
      callerAvatarUrl: avatar,
      title: name,
      message: label,
      categoryId,
      channelId: "incoming_calls_v4",
      priority: "max",
      sticky: "true",
      vibrate: JSON.stringify([0, 800, 400, 800, 400, 800])
    };
    if (imageUrl) androidData.image = imageUrl;

    const androidResult = await sendMulticastAndCleanup(androidTokens, {
      data: androidData,
      android: {
        priority: "high",
        ttl: 45 * 1000,
        collapseKey: "incoming_call"
      }
    });
    sent += androidResult.sent;
    failed += androidResult.failed;
  }

  if (iosTokens.length) {
    const payloadData = {
      type: "incoming_call",
      mode: isVideo ? "video" : "voice",
      roomName: String(roomName || ""),
      callerId: callerId != null ? String(callerId) : "",
      callerAvatarUrl: avatar,
      title: name,
      message: label,
      categoryId,
      channelId: "incoming_calls_v4",
      priority: "max",
      sticky: "true",
      vibrate: JSON.stringify([0, 800, 400, 800, 400, 800])
    };
    if (imageUrl) payloadData.image = imageUrl;

    const iosResult = await sendMulticastAndCleanup(iosTokens, {
      data: payloadData,
      apns: {
        headers: {
          "apns-priority": "10",
          "apns-push-type": "alert"
        },
        payload: {
          aps: {
            alert: {
              title: name,
              body: label
            },
            sound: "default",
            category: categoryId,
            "interruption-level": "time-sensitive",
            ...(imageUrl ? { "mutable-content": 1 } : {})
          }
        },
        ...(imageUrl ? { fcm_options: { image: imageUrl } } : {})
      }
    });
    sent += iosResult.sent;
    failed += iosResult.failed;
  }

  return { sent, failed };
}

async function sendCallCancelledPush({ userId, roomName, callerId }) {
  const settings = await getPushSettings(Number(userId));
  if (!settings.pushEnabled || settings.sleepMode || !settings.messagesEnabled) {
    return { sent: 0, skipped: "user_settings" };
  }
  if (!initFirebaseAdmin()) return { sent: 0, skipped: "not_configured" };

  const entries = await listTokenEntriesForUser(userId);
  if (!entries.length) return { sent: 0, skipped: "no_tokens" };

  const androidTokens = entries.filter((entry) => entry.platform === "android").map((entry) => entry.token);
  const iosTokens = entries.filter((entry) => entry.platform !== "android").map((entry) => entry.token);

  const payloadData = {
    type: "call_cancelled",
    roomName: String(roomName || ""),
    callerId: callerId != null ? String(callerId) : "",
    channelId: "incoming_calls_v4"
  };

  let sent = 0;
  let failed = 0;

  if (androidTokens.length) {
    const androidResult = await sendMulticastAndCleanup(androidTokens, {
      data: payloadData,
      android: {
        priority: "high",
        ttl: 30 * 1000,
        collapseKey: "call_cancelled"
      }
    });
    sent += androidResult.sent;
    failed += androidResult.failed;
  }

  if (iosTokens.length) {
    const iosResult = await sendMulticastAndCleanup(iosTokens, {
      data: payloadData,
      apns: {
        headers: {
          "apns-priority": "10",
          "apns-push-type": "background"
        },
        payload: {
          aps: {
            "content-available": 1
          }
        }
      }
    });
    sent += iosResult.sent;
    failed += iosResult.failed;
  }

  return { sent, failed };
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
  ensurePushUserSettingsTable,
  isPushConfigured,
  registerPushDeviceToken,
  unregisterPushDeviceToken,
  getPushSettings,
  setPushSettings,
  formatDirectMessagePushExcerpt,
  directMessagePushPayload,
  sendPushToUser,
  sendIncomingCallPush,
  sendCallCancelledPush,
  sendSocialPushToUser,
  sendSocialPushToFollowers
};
