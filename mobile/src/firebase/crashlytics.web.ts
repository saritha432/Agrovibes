export async function setCrashlyticsUserId(_userId: string | null) {
  // no-op on web
}

export function logCrashlyticsMessage(_message: string) {
  // no-op on web
}

export function recordCrashlyticsError(_error: unknown, _context?: string) {
  // no-op on web
}

export function installGlobalCrashHandler() {
  // no-op on web
}
