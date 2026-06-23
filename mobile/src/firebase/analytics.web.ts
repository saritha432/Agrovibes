export async function logAnalyticsEvent(
  _name: string,
  _params?: Record<string, string | number | boolean | null | undefined>
) {
  // no-op on web
}

export async function logAnalyticsScreen(_screenName: string) {
  // no-op on web
}

export async function setAnalyticsUserId(_userId: string | null) {
  // no-op on web
}
