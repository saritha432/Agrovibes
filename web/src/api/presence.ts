import { API_BASE_URL, fetchWithAuth } from "./client";

export type PresenceEntry = {
  userId: number;
  online: boolean;
  lastSeenAt: string | null;
};

export async function fetchPresence(token: string, userIds: number[]): Promise<PresenceEntry[]> {
  const ids = [...new Set(userIds.map((id) => Number(id)))]
    .filter((id) => Number.isFinite(id) && id > 0)
    .slice(0, 100);
  if (!ids.length) return [];
  const data = (await fetchWithAuth(
    `${API_BASE_URL}/v1/presence?userIds=${ids.join(",")}`,
    token
  )) as { presence?: PresenceEntry[] };
  return Array.isArray(data?.presence) ? data.presence : [];
}
