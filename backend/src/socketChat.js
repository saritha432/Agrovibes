const { Server } = require("socket.io");
const { verifyJwt } = require("./auth");
const { query } = require("./db");

/** @type {import("socket.io").Server | null} */
let io = null;

function userRoom(userId) {
  return `user:${userId}`;
}

function threadRoom(userId, peerUserId) {
  const low = Math.min(userId, peerUserId);
  const high = Math.max(userId, peerUserId);
  return `dm:${low}:${high}`;
}

/** True when at least one socket for this user is connected to this process. */
function isUserConnected(userId) {
  if (!io) return false;
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) return false;
  const room = io.sockets.adapter.rooms.get(userRoom(id));
  return Boolean(room && room.size > 0);
}

const PRESENCE_GRACE_MS = 8000;
/** Users currently using the app (foreground + connected). */
const activeUsers = new Set();
/** Last seen ISO timestamps for recently-offline users in this process. */
const lastSeenAt = new Map();
/** @type {Map<number, NodeJS.Timeout>} */
const disconnectTimers = new Map();

function socketsForUser(userId) {
  if (!io) return [];
  const room = io.sockets.adapter.rooms.get(userRoom(userId));
  if (!room) return [];
  const sockets = [];
  for (const socketId of room) {
    const sock = io.sockets.sockets.get(socketId);
    if (sock) sockets.push(sock);
  }
  return sockets;
}

function userHasForegroundSocket(userId) {
  return socketsForUser(userId).some((sock) => sock.presenceActive !== false);
}

function emitPresenceUpdate(userId, online) {
  if (!io) return;
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) return;
  io.emit("presence:update", {
    userId: id,
    online: Boolean(online),
    lastSeenAt: online ? null : lastSeenAt.get(id) || null
  });
}

async function persistLastSeen(userId) {
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) return;
  try {
    await query(`UPDATE learn_users SET last_seen_at = NOW() WHERE id = $1`, [id]);
  } catch {
    // Column may not exist until ensureLearnUsersTable ran.
  }
}

function markActive(userId) {
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) return;
  const timer = disconnectTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    disconnectTimers.delete(id);
  }
  const wasActive = activeUsers.has(id);
  activeUsers.add(id);
  lastSeenAt.delete(id);
  if (!wasActive) emitPresenceUpdate(id, true);
}

function markInactive(userId, { persist = true } = {}) {
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) return;
  if (!activeUsers.has(id)) return;
  activeUsers.delete(id);
  const at = new Date().toISOString();
  lastSeenAt.set(id, at);
  emitPresenceUpdate(id, false);
  if (persist) void persistLastSeen(id);
}

function scheduleInactive(userId) {
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) return;
  if (disconnectTimers.has(id)) return;
  const timer = setTimeout(() => {
    disconnectTimers.delete(id);
    if (isUserConnected(id) && userHasForegroundSocket(id)) {
      markActive(id);
      return;
    }
    if (isUserConnected(id)) return;
    markInactive(id);
  }, PRESENCE_GRACE_MS);
  disconnectTimers.set(id, timer);
}

async function getPresenceForUserIds(userIds) {
  const ids = [...new Set((Array.isArray(userIds) ? userIds : []).map((id) => Number(id)))]
    .filter((id) => Number.isFinite(id) && id > 0)
    .slice(0, 100);
  /** @type {Map<number, string|null>} */
  const dbLastSeen = new Map();
  if (ids.length) {
    try {
      const result = await query(
        `SELECT id, last_seen_at AS "lastSeenAt" FROM learn_users WHERE id = ANY($1::int[])`,
        [ids]
      );
      for (const row of result.rows || []) {
        const id = Number(row.id);
        if (!Number.isFinite(id)) continue;
        dbLastSeen.set(id, row.lastSeenAt ? new Date(row.lastSeenAt).toISOString() : null);
      }
    } catch {
      // ignore missing column
    }
  }
  return ids.map((id) => {
    const online = activeUsers.has(id);
    return {
      userId: id,
      online,
      lastSeenAt: online ? null : lastSeenAt.get(id) || dbLastSeen.get(id) || null
    };
  });
}

async function markMessagesDeliveredByIds(receiverId, messageIds) {
  const rid = Number(receiverId);
  const ids = (Array.isArray(messageIds) ? messageIds : [messageIds])
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0);
  if (!Number.isFinite(rid) || rid <= 0 || !ids.length) return [];
  try {
    const result = await query(
      `
      UPDATE direct_messages
      SET is_delivered = TRUE
      WHERE receiver_id = $1
        AND id = ANY($2::bigint[])
        AND COALESCE(is_delivered, FALSE) = FALSE
      RETURNING id, sender_id AS "senderId"
      `,
      [rid, ids]
    );
    notifySendersOfDelivery(rid, result.rows);
    return result.rows;
  } catch {
    // Fallback without array binding (some drivers mishandle ANY).
    const rows = [];
    for (const id of ids) {
      try {
        const one = await query(
          `
          UPDATE direct_messages
          SET is_delivered = TRUE
          WHERE receiver_id = $1
            AND id = $2
            AND COALESCE(is_delivered, FALSE) = FALSE
          RETURNING id, sender_id AS "senderId"
          `,
          [rid, id]
        );
        rows.push(...one.rows);
      } catch {
        // ignore
      }
    }
    notifySendersOfDelivery(rid, rows);
    return rows;
  }
}

function notifySendersOfDelivery(receiverId, rows) {
  if (!rows?.length) return;
  /** @type {Map<number, number[]>} */
  const bySender = new Map();
  for (const row of rows) {
    const senderId = Number(row.senderId);
    const messageId = Number(row.id);
    if (!Number.isFinite(senderId) || !Number.isFinite(messageId)) continue;
    const list = bySender.get(senderId) || [];
    list.push(messageId);
    bySender.set(senderId, list);
  }
  for (const [senderId, messageIds] of bySender) {
    emitMessagesDelivered({
      receiverId: Number(receiverId),
      peerUserId: senderId,
      messageIds
    });
  }
}

function initSocketChat(httpServer, { corsOrigins = [] } = {}) {
  const allowAll = !corsOrigins.length || corsOrigins.includes("*");
  io = new Server(httpServer, {
    path: "/socket.io",
    cors: {
      origin: allowAll ? true : corsOrigins,
      credentials: true
    },
    transports: ["websocket", "polling"]
  });

  io.use((socket, next) => {
    const raw =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token ||
      socket.handshake.headers?.authorization;
    const token =
      typeof raw === "string" && raw.startsWith("Bearer ")
        ? raw.slice("Bearer ".length).trim()
        : String(raw || "").trim();
    if (!token) {
      next(new Error("unauthorized"));
      return;
    }
    try {
      socket.user = verifyJwt(token);
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = Number(socket.user?.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      socket.disconnect(true);
      return;
    }

    socket.join(userRoom(userId));
    socket.presenceActive = true;
    markActive(userId);
    // Device came online → any pending DMs to this user are now delivered.
    void flushDeliveriesForReceiver(userId);

    socket.on("presence:active", () => {
      socket.presenceActive = true;
      markActive(userId);
    });

    socket.on("presence:away", () => {
      socket.presenceActive = false;
      if (!userHasForegroundSocket(userId)) {
        markInactive(userId);
      }
    });

    socket.on("disconnect", () => {
      socket.presenceActive = false;
      const remaining = socketsForUser(userId).filter((sock) => sock.id !== socket.id);
      if (remaining.length > 0) {
        if (!remaining.some((sock) => sock.presenceActive !== false)) markInactive(userId);
        return;
      }
      scheduleInactive(userId);
    });

    socket.on("dm:join", (payload) => {
      const peerUserId = Number(payload?.peerUserId);
      if (!Number.isFinite(peerUserId) || peerUserId <= 0 || peerUserId === userId) return;
      socket.join(threadRoom(userId, peerUserId));
    });

    socket.on("dm:leave", (payload) => {
      const peerUserId = Number(payload?.peerUserId);
      if (!Number.isFinite(peerUserId) || peerUserId <= 0) return;
      socket.leave(threadRoom(userId, peerUserId));
    });

    socket.on("dm:typing", (payload) => {
      const peerUserId = Number(payload?.peerUserId);
      if (!Number.isFinite(peerUserId) || peerUserId <= 0 || peerUserId === userId) return;
      io.to(userRoom(peerUserId)).emit("dm:typing", {
        peerUserId: userId,
        isTyping: payload?.isTyping !== false
      });
    });

    // Peer device confirms it received specific message(s) → double ticks for sender.
    socket.on("dm:ack", (payload) => {
      void markMessagesDeliveredByIds(userId, payload?.messageIds);
    });
  });

  return io;
}

function getSocketIo() {
  return io;
}

function emitDirectMessage({ senderId, receiverId, message }) {
  if (!io || !message) return;
  // Deliver to both people so an open chat updates immediately, including the sender's other tabs.
  io.to(userRoom(receiverId)).emit("dm:message", { message, peerUserId: senderId });
  io.to(userRoom(senderId)).emit("dm:message", { message, peerUserId: receiverId });

  const threadBase = {
    lastMessage: message.body,
    lastAt: message.createdAt,
    lastSenderId: senderId,
    lastReceiverId: receiverId,
    lastMessageIsRead: false
  };
  io.to(userRoom(receiverId)).emit("dm:thread", {
    ...threadBase,
    peerUserId: senderId,
    unreadDelta: 1
  });
  io.to(userRoom(senderId)).emit("dm:thread", {
    ...threadBase,
    peerUserId: receiverId,
    unreadDelta: 0
  });

  // Socket reached their connected device → double ticks (even before they open the thread).
  if (isUserConnected(receiverId) && message?.id) {
    void markMessagesDeliveredByIds(receiverId, [message.id]);
  }
}

function emitMessagesRead({ readerId, peerUserId }) {
  if (!io) return;
  // Sender: read receipts / ticks.
  io.to(userRoom(peerUserId)).emit("dm:read", {
    readerId,
    peerUserId: readerId
  });
  // Reader's other devices: clear this thread's unread badge.
  io.to(userRoom(readerId)).emit("dm:read", {
    readerId,
    peerUserId,
    selfRead: true
  });
}

function emitNotificationSync(userId, payload = {}) {
  if (!io) return;
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) return;
  io.to(userRoom(id)).emit("notif:sync", payload);
}

function emitStoryViewed({ viewerId, storyId, storyUserId }) {
  if (!io) return;
  const id = Number(viewerId);
  const sid = Number(storyId);
  if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(sid) || sid <= 0) return;
  io.to(userRoom(id)).emit("story:viewed", {
    storyId: sid,
    storyUserId: Number(storyUserId) || null
  });
}

function emitMessagesDelivered({ receiverId, peerUserId, messageIds }) {
  if (!io) return;
  const ids = (messageIds || []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
  if (!ids.length) return;
  // Notify the sender that the peer received these messages.
  io.to(userRoom(peerUserId)).emit("dm:delivered", {
    peerUserId: receiverId,
    messageIds: ids
  });
}

/**
 * Mark all undelivered DMs for this receiver as delivered and notify each sender.
 * Call when their device is connected / inbox syncs (WhatsApp-style double ticks).
 */
async function flushDeliveriesForReceiver(receiverId) {
  const rid = Number(receiverId);
  if (!Number.isFinite(rid) || rid <= 0) return [];
  try {
    const result = await query(
      `
      UPDATE direct_messages
      SET is_delivered = TRUE
      WHERE receiver_id = $1
        AND COALESCE(is_delivered, FALSE) = FALSE
      RETURNING id, sender_id AS "senderId"
      `,
      [rid]
    );
    notifySendersOfDelivery(rid, result.rows);
    return result.rows;
  } catch {
    return [];
  }
}

function emitDirectMessageDeleted({ messageId, senderId, receiverId, onlyUserId, scope = "everyone" }) {
  if (!io || !messageId) return;
  const payload = { messageId: Number(messageId), scope };
  const onlyId = Number(onlyUserId);
  if (Number.isFinite(onlyId) && onlyId > 0) {
    const peerUserId = onlyId === Number(senderId) ? receiverId : senderId;
    io.to(userRoom(onlyId)).emit("dm:deleted", { ...payload, peerUserId });
    return;
  }
  io.to(userRoom(senderId)).emit("dm:deleted", { ...payload, peerUserId: receiverId });
  io.to(userRoom(receiverId)).emit("dm:deleted", { ...payload, peerUserId: senderId });
}

module.exports = {
  initSocketChat,
  getSocketIo,
  isUserConnected,
  getPresenceForUserIds,
  emitDirectMessage,
  emitMessagesRead,
  emitMessagesDelivered,
  emitDirectMessageDeleted,
  emitNotificationSync,
  emitStoryViewed,
  flushDeliveriesForReceiver,
  markMessagesDeliveredByIds
};
