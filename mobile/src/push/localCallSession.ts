export type LocalCallSession = {
  roomName: string;
  peerUserId: number;
};

let active: LocalCallSession | null = null;

export function setLocalCallSession(session: LocalCallSession | null) {
  active = session;
}

export function getLocalCallSession() {
  return active;
}

export function isLocalCallActive(roomName?: string) {
  if (!active) return false;
  const room = String(roomName || "").trim();
  if (!room) return true;
  return active.roomName === room;
}
