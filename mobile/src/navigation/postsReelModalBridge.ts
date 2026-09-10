let isVisible = false;
let requestClose: (() => void) | null = null;

export function registerPostsReelModalBack(visible: boolean, close: (() => void) | null) {
  isVisible = visible;
  requestClose = visible && close ? close : null;
}

export function tryClosePostsReelModal(): boolean {
  if (!isVisible || !requestClose) return false;
  requestClose();
  return true;
}
