export type QueuedIncomingCall = {
  callerId: number;
  callerName: string;
  callerAvatarUrl?: string | null;
  roomName: string;
  mode: "voice" | "video";
  autoAccept?: boolean;
};

let pendingCall: QueuedIncomingCall | null = null;
const listeners = new Set<(call: QueuedIncomingCall | null) => void>();

function emit() {
  for (const listener of listeners) {
    listener(pendingCall);
  }
}

export function getPendingIncomingCall() {
  return pendingCall;
}

export function queueIncomingCall(call: QueuedIncomingCall) {
  pendingCall = call;
  emit();
}

export function clearIncomingCall() {
  if (!pendingCall) return;
  pendingCall = null;
  emit();
}

export function subscribeIncomingCall(listener: (call: QueuedIncomingCall | null) => void) {
  listeners.add(listener);
  listener(pendingCall);
  return () => {
    listeners.delete(listener);
  };
}
