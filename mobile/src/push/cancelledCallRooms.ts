const endedRooms = new Map<string, number>();
const ENDED_TTL_MS = 15 * 60 * 1000;

function pruneEndedRooms() {
  const now = Date.now();
  for (const [room, at] of endedRooms) {
    if (now - at > ENDED_TTL_MS) endedRooms.delete(room);
  }
}

export function markCallRoomEnded(roomName: string) {
  const room = String(roomName || "").trim();
  if (!room) return;
  pruneEndedRooms();
  endedRooms.set(room, Date.now());
}

export function isCallRoomEnded(roomName: string) {
  const room = String(roomName || "").trim();
  if (!room) return false;
  pruneEndedRooms();
  return endedRooms.has(room);
}
