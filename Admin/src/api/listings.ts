const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
  "https://cropvibe-api-production.up.railway.app/api";

export type AdminListingRow = {
  id: number;
  category: "Products" | "Services" | "Education";
  title: string;
  subtitle: string;
  submitterName: string;
  submitterEmail: string;
  submitterAvatarUrl?: string | null;
  date: string | null;
  flags: number;
  status: "Pending" | "Approved" | "Unpublished";
};

async function parseJsonOrThrow(response: Response) {
  const body = (await response.json().catch(() => ({}))) as { message?: string };
  if (!response.ok) {
    throw new Error(body.message || `Request failed (${response.status})`);
  }
  return body;
}

export async function fetchAdminListings(token: string) {
  const response = await fetch(`${API_BASE}/v1/admin/listings`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return (await parseJsonOrThrow(response)) as { listings: AdminListingRow[] };
}

export async function respondAdminListing(token: string, listingId: number, action: "approve" | "unpublish") {
  const response = await fetch(`${API_BASE}/v1/admin/listings/${listingId}/respond`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ action })
  });
  return (await parseJsonOrThrow(response)) as { listing: { id: number; status: AdminListingRow["status"] } };
}
