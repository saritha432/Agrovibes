type ScreenBackHandler = () => boolean;

let focusedHandler: ScreenBackHandler | null = null;

/** Focused screen registers the same back action its header button uses. */
export function registerFocusedScreenBack(handler: ScreenBackHandler): () => void {
  focusedHandler = handler;
  return () => {
    if (focusedHandler === handler) focusedHandler = null;
  };
}

export function tryFocusedScreenBack(): boolean {
  if (!focusedHandler) return false;
  return focusedHandler();
}

export function hasFocusedScreenBack(): boolean {
  return focusedHandler != null;
}
