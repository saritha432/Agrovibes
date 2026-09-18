const { Server } = require("socket.io");
const { verifyJwt } = require("./auth");

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
    lastReceiverId: receiverId
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
  emitDirectMessage,
  emitMessagesRead,
  emitDirectMessageDeleted,
  emitNotificationSync,
  emitStoryViewed
};
