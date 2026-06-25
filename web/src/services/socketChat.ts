import { io, type Socket } from "socket.io-client";
import type { DirectMessageItem } from "../api/messages";
import { API_BASE_URL } from "../api/client";

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

type DmMessageHandler = (payload: DmMessageSocketPayload) => void;
type DmThreadHandler = (payload: DmThreadSocketUpdate) => void;
type ConnectionHandler = (connected: boolean) => void;

let socket: Socket | null = null;
let authToken: string | null = null;
const joinedThreadPeers = new Set<number>();
const messageHandlers = new Set<DmMessageHandler>();
const threadHandlers = new Set<DmThreadHandler>();
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

function rejoinActiveThreads() {
  if (!socket?.connected) return;
  joinedThreadPeers.forEach((peerUserId) => {
    socket?.emit("dm:join", { peerUserId });
  });
}

function bindSocketEvents(sock: Socket) {
  sock.on("connect", () => {
    rejoinActiveThreads();
    notifyConnection(true);
  });
  sock.on("disconnect", () => notifyConnection(false));
  sock.on("dm:message", (payload: DmMessageSocketPayload) => {
    messageHandlers.forEach((handler) => handler(payload));
  });
  sock.on("dm:thread", (payload: DmThreadSocketUpdate) => {
    threadHandlers.forEach((handler) => handler(payload));
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
  joinedThreadPeers.clear();
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
  notifyConnection(false);
}

export function joinDirectThread(peerUserId: number) {
  if (!Number.isFinite(peerUserId) || peerUserId <= 0) return;
  joinedThreadPeers.add(peerUserId);
  socket?.emit("dm:join", { peerUserId });
}

export function leaveDirectThread(peerUserId: number) {
  if (!Number.isFinite(peerUserId) || peerUserId <= 0) return;
  joinedThreadPeers.delete(peerUserId);
  socket?.emit("dm:leave", { peerUserId });
}

export function onDirectMessage(handler: DmMessageHandler) {
  messageHandlers.add(handler);
  return () => messageHandlers.delete(handler);
}

export function onDirectThreadUpdate(handler: DmThreadHandler) {
  threadHandlers.add(handler);
  return () => threadHandlers.delete(handler);
}

export function onSocketConnectionChange(handler: ConnectionHandler) {
  connectionHandlers.add(handler);
  handler(Boolean(socket?.connected));
  return () => connectionHandlers.delete(handler);
}
