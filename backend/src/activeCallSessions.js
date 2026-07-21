/** In-memory DM call presence (ringing / active) for busy detection. */
const sessions = new Map();

const RINGING_TTL_MS = 90 * 1000;
const ACTIVE_TTL_MS = 2 * 60 * 60 * 1000;

function ttlForState(state) {
  return state === "active" ? ACTIVE_TTL_MS : RINGING_TTL_MS;
}

function isStale(entry) {
  if (!entry) return true;
  return Date.now() - entry.updatedAt > ttlForState(entry.state);
}

function removeUser(userId) {
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) return;
  sessions.delete(id);
}

function clearPair(userId, roomName) {
  const id = Number(userId);
  const entry = sessions.get(id);
  if (!entry) return;
  if (roomName && entry.roomName !== roomName) return;
  removeUser(id);
  removeUser(entry.peerUserId);
}

function setCallSession(userId, peerUserId, roomName, state) {
  const me = Number(userId);
  const peer = Number(peerUserId);
  const room = String(roomName || "").trim();
  if (!Number.isFinite(me) || me <= 0 || !Number.isFinite(peer) || peer <= 0 || !room) return;
  const normalized = state === "active" ? "active" : "ringing";
  const now = Date.now();
  const payload = { peerUserId: peer, roomName: room, state: normalized, updatedAt: now };
  sessions.set(me, payload);
  sessions.set(peer, { peerUserId: me, roomName: room, state: normalized, updatedAt: now });
}

function isUserBusy(userId) {
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) return false;
  const entry = sessions.get(id);
  if (!entry || isStale(entry)) {
    if (entry) clearPair(id, entry.roomName);
    return false;
  }
  return entry.state === "ringing" || entry.state === "active";
}

module.exports = {
  setCallSession,
  clearCallSession: clearPair,
  isUserBusy
};
