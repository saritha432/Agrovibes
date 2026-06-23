import { io, type Socket } from "socket.io-client";
import type { DirectMessageItem } from "./api";
import { API_BASE_URL } from "./api";

export type DmThreadSocketUpdate = {
  peerUserId: number;
  lastMessage: string;
  lastAt: string;
  lastSenderId: number;
  lastReceiverId: number;
  unreadDelta?: number;
};

export type DmMessageSocketPayload = {
  message: DirectMessageItem;
  peerUserId: number;
};

export type DmReadSocketPayload = {
  readerId: number;
  peerUserId: number;
};

type DmMessageHandler = (payload: DmMessageSocketPayload) => void;
type DmThreadHandler = (payload: DmThreadSocketUpdate) => void;
type DmTypingHandler = (payload: { peerUserId: number; isTyping: boolean }) => void;
type DmReadHandler = (payload: DmReadSocketPayload) => void;
type ConnectionHandler = (connected: boolean) => void;

let socket: Socket | null = null;
let authToken: string | null = null;
const messageHandlers = new Set<DmMessageHandler>();
const threadHandlers = new Set<DmThreadHandler>();
const typingHandlers = new Set<DmTypingHandler>();
const readHandlers = new Set<DmReadHandler>();
const connectionHandlers = new Set<ConnectionHandler>();

export function resolveSocketBaseUrl() {
  const base = API_BASE_URL.replace(/\/+$/, "");
  if (base.endsWith("/api")) {
    return base.slice(0, -"/api".length);
  }
  return base;
}

function notifyConnection(connected: boolean) {
  connectionHandlers.forEach((handler) => handler(connected));
}

function bindSocketEvents(sock: Socket) {
  sock.on("connect", () => notifyConnection(true));
  sock.on("disconnect", () => notifyConnection(false));
  sock.on("dm:message", (payload: DmMessageSocketPayload) => {
    messageHandlers.forEach((handler) => handler(payload));
  });
  sock.on("dm:thread", (payload: DmThreadSocketUpdate) => {
    threadHandlers.forEach((handler) => handler(payload));
  });
  sock.on("dm:typing", (payload: { peerUserId: number; isTyping: boolean }) => {
    typingHandlers.forEach((handler) => handler(payload));
  });
  sock.on("dm:read", (payload: DmReadSocketPayload) => {
    readHandlers.forEach((handler) => handler(payload));
  });
}

export function connectSocketChat(token: string) {
  const cleanToken = String(token || "").trim();
  if (!cleanToken) return;
  if (socket && authToken === cleanToken && socket.connected) return;

  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  authToken = cleanToken;
  socket = io(resolveSocketBaseUrl(), {
    path: "/socket.io",
    auth: { token: cleanToken },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 12,
    reconnectionDelay: 1200,
    timeout: 12000
  });
  bindSocketEvents(socket);
}

export function disconnectSocketChat() {
  authToken = null;
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
  notifyConnection(false);
}

export function isSocketChatConnected() {
  return Boolean(socket?.connected);
}

export function joinDirectThread(peerUserId: number) {
  socket?.emit("dm:join", { peerUserId });
}

export function leaveDirectThread(peerUserId: number) {
  socket?.emit("dm:leave", { peerUserId });
}

export function emitDirectTyping(peerUserId: number, isTyping = true) {
  socket?.emit("dm:typing", { peerUserId, isTyping });
}

export function onDirectMessage(handler: DmMessageHandler) {
  messageHandlers.add(handler);
  return () => messageHandlers.delete(handler);
}

export function onDirectThreadUpdate(handler: DmThreadHandler) {
  threadHandlers.add(handler);
  return () => threadHandlers.delete(handler);
}

export function onDirectTyping(handler: DmTypingHandler) {
  typingHandlers.add(handler);
  return () => typingHandlers.delete(handler);
}

export function onDirectRead(handler: DmReadHandler) {
  readHandlers.add(handler);
  return () => readHandlers.delete(handler);
}

export function onSocketConnectionChange(handler: ConnectionHandler) {
  connectionHandlers.add(handler);
  handler(isSocketChatConnected());
  return () => connectionHandlers.delete(handler);
}
