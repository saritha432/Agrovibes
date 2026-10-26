const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
  "https://cropvibe-api-production.up.railway.app/api";

export type AdminBookingRow = {
  id: number;
  title: string;
  category: string;
  location: string;
  date: string;
  note: string;
  status: "Pending" | "Approved";
  createdAt: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
};

async function parseJsonOrThrow(response: Response) {
  const body = (await response.json().catch(() => ({}))) as { message?: string };
  if (!response.ok) {
    throw new Error(body.message || `Request failed (${response.status})`);
  }
  return body;
}

export async function fetchAdminBookings(token: string) {
  const response = await fetch(`${API_BASE}/v1/admin/bookings`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return (await parseJsonOrThrow(response)) as { bookings: AdminBookingRow[] };
}
