type HomeReelImmersiveListener = (active: boolean) => void;

let immersiveActive = false;
let exitHandler: (() => void) | null = null;
const listeners = new Set<HomeReelImmersiveListener>();

/** Home feed reel fullscreen (in-place immersive — not a Modal). */
export function setHomeReelImmersiveActive(active: boolean) {
  if (immersiveActive === active) return;
  immersiveActive = active;
  listeners.forEach((listener) => listener(active));
}

export function isHomeReelImmersiveActive() {
  return immersiveActive;
}

export function subscribeHomeReelImmersive(listener: HomeReelImmersiveListener) {
  listeners.add(listener);
  listener(immersiveActive);
  return () => {
    listeners.delete(listener);
  };
}

/** HomeScreen registers how to exit immersive mode (hardware back). */
export function registerHomeReelImmersiveExit(handler: () => void) {
  exitHandler = handler;
  return () => {
    if (exitHandler === handler) exitHandler = null;
  };
}

export function tryExitHomeReelImmersive(): boolean {
  if (!immersiveActive || !exitHandler) return false;
  exitHandler();
  return true;
}
