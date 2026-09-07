/** Lets the reel viewer show/hide the notifications sheet without flashing Home. */

type Opener = () => void;
type Closer = () => void;
type Suppress = (hidden: boolean) => void;

let opener: Opener | null = null;
let closer: Closer | null = null;
let suppressHandler: Suppress | null = null;

export function registerNotificationSheetOpener(fn: Opener | null) {
  opener = fn;
}

export function registerNotificationSheetCloser(fn: Closer | null) {
  closer = fn;
}

export function registerNotificationSheetSuppress(fn: Suppress | null) {
  suppressHandler = fn;
}

export function requestOpenNotificationSheet() {
  suppressHandler?.(false);
  opener?.();
}

export function requestCloseNotificationSheet() {
  closer?.();
}

/** Hide the notifications overlay while a reel Modal is on top (keeps it mounted). */
export function suppressNotificationSheet(hidden: boolean) {
  suppressHandler?.(hidden);
}
