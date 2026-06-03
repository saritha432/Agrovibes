export type OpenLiveCreatePayload = {
  liveTopic?: string;
  scheduledLiveId?: number;
  autoStartLive?: boolean;
};

type OpenLiveCreateListener = (payload: OpenLiveCreatePayload) => void;

let pending: OpenLiveCreatePayload | null = null;
const listeners = new Set<OpenLiveCreateListener>();

export function queueOpenLiveCreate(payload: OpenLiveCreatePayload) {
  pending = payload;
  listeners.forEach((listener) => listener(payload));
}

export function takePendingOpenLiveCreate(): OpenLiveCreatePayload | null {
  const next = pending;
  pending = null;
  return next;
}

export function subscribeOpenLiveCreate(listener: OpenLiveCreateListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
