/** Tracks an in-app host session so feed taps do not open a second LiveKit connection. */
let activeHostRoomName: string | null = null;

export function setActiveHostRoomName(roomName: string | null) {
  activeHostRoomName = roomName?.trim() || null;
}

export function getActiveHostRoomName() {
  return activeHostRoomName;
}

export function isAlreadyHostingRoom(roomName: string) {
  const room = roomName?.trim();
  return !!room && activeHostRoomName === room;
}
