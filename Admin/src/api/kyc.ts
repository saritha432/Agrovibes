const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
  "https://cropvibe-api-production.up.railway.app/api";

export type AdminKycDocument = {
  key: string;
  label: string;
  url: string;
};

export type AdminKycRow = {
  id: number;
  applicant: string;
  role: string;
  registrationType?: "individual" | "business" | string;
  document: string;
  documents?: AdminKycDocument[];
  priority: string;
  status: "pending" | "approved" | "rejected" | string;
  submitted?: string | null;
  businessName?: string | null;
  gstNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  applicantEmail?: string | null;
};

async function parseJsonOrThrow(response: Response) {
  const body = (await response.json().catch(() => ({}))) as { message?: string };
  if (!response.ok) {
    throw new Error(body.message || `Request failed (${response.status})`);
  }
  return body;
}

export async function fetchAdminKyc(token: string) {
  const response = await fetch(`${API_BASE}/v1/admin/kyc`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return (await parseJsonOrThrow(response)) as {
    submissions: AdminKycRow[];
    pendingCount: number;
  };
}

export async function respondAdminKyc(token: string, submissionId: number, action: "approve" | "reject") {
  const response = await fetch(`${API_BASE}/v1/admin/kyc/${submissionId}/respond`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ action })
  });
  return (await parseJsonOrThrow(response)) as { submission: AdminKycRow };
}
