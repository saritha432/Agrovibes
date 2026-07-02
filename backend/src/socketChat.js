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
  const payload = { message, peerUserId: senderId };
  // Deliver once per recipient — user room covers inbox + open chat.
  io.to(userRoom(receiverId)).emit("dm:message", payload);

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
  io.to(userRoom(peerUserId)).emit("dm:read", {
    readerId,
    peerUserId
  });
}

function emitDirectMessageDeleted({ messageId, senderId, receiverId }) {
  if (!io || !messageId) return;
  const payload = { messageId: Number(messageId) };
  io.to(userRoom(senderId)).emit("dm:deleted", { ...payload, peerUserId: receiverId });
  io.to(userRoom(receiverId)).emit("dm:deleted", { ...payload, peerUserId: senderId });
}

module.exports = {
  initSocketChat,
  getSocketIo,
  emitDirectMessage,
  emitMessagesRead,
  emitDirectMessageDeleted
};
