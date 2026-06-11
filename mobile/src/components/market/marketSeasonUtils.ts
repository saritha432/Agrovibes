export type MarketSeasonTag =
  | "summer"
  | "winter"
  | "rain"
  | "spring"
  | "kharif"
  | "rabi"
  | "zaid";

/** Month-day string "MM-DD" for yearly recurring windows. */
export function monthDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}-${day}`;
}

export function isInMonthDayRange(now: Date, start: string, end: string): boolean {
  const cur = monthDayKey(now);
  if (start <= end) return cur >= start && cur <= end;
  return cur >= start || cur <= end;
}

/** Calendar + Indian farm seasons active for the given date. */
export function getCurrentSeasonTags(now = new Date()): MarketSeasonTag[] {
  const month = now.getMonth() + 1;
  const tags = new Set<MarketSeasonTag>();

  if (month >= 3 && month <= 5) tags.add("summer");
  if (month >= 6 && month <= 9) tags.add("rain");
  if (month >= 10 || month <= 2) tags.add("winter");
  if (month >= 2 && month <= 4) tags.add("spring");

  if (month >= 6 && month <= 10) tags.add("kharif");
  if (month >= 11 || month <= 3) tags.add("rabi");
  if (month >= 4 && month <= 6) tags.add("zaid");

  return [...tags];
}

export function matchesSeasonFilter(
  seasons: MarketSeasonTag[] | undefined,
  activeSeasons: MarketSeasonTag[]
): boolean {
  if (!seasons || seasons.length === 0) return true;
  return seasons.some((season) => activeSeasons.includes(season));
}
