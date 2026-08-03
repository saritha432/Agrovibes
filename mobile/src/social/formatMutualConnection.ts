import type { MutualConnectionInfo } from "../services/api";

/**
 * Instagram-style social context under a profile bio.
 * Prefer "Followed by …" when mutuals exist. "Follows you" is only used alone
 * (no mutual avatars) so we never imply the wrong person follows the viewer.
 */
export function formatMutualConnectionLabel(
  info: MutualConnectionInfo | undefined,
  t: (key: string, params?: Record<string, string | number>) => string
): string {
  if (!info) return "";

  const names = info.mutual.map((m) => String(m.fullName || "").trim()).filter(Boolean);
  const total = info.mutualCount || names.length;

  if (total > 0) {
    if (total === 1 && names[0]) {
      return t("followedByOne", { name: names[0] });
    }
    if (total === 2 && names.length >= 2) {
      return t("followedByTwo", { name1: names[0], name2: names[1] });
    }
    if (names[0] && total > 1) {
      return t("followedByAndOthers", { name: names[0], count: total - 1 });
    }
    return t("mutualFriends", { count: total });
  }

  if (info.followsYou) return t("followsYou");
  return "";
}
