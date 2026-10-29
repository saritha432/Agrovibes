import { API_BASE_URL, fetchWithAuth, fetchWithRetry, parseJsonOrThrow } from "./client";

export async function startProviderDigilocker(
  token: string,
  payload: { fullName?: string; phone?: string }
) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/provider/kyc/digilocker/start`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })) as { sessionId: string; provider: string; gatewayUrl: string };
}

export async function fetchProviderDigilockerResult(token: string, sessionId: string) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/provider/kyc/digilocker/result`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId })
  })) as {
    status: "pending" | "verified" | "failed";
    name?: string;
    maskedAadhaar?: string;
    dob?: string;
    message?: string;
  };
}

export async function verifyProviderPan(
  token: string,
  payload: { panNumber: string; fullName: string; dob: string }
) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/provider/kyc/pan/verify`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })) as { pan: string; panName: string; aadhaarName: string; matched: boolean };
}

export async function verifyProviderBankAccount(
  token: string,
  payload: {
    accountNumber: string;
    ifsc: string;
    ifscDetails?: boolean;
    applicantName?: string;
    role?: string;
    registrationType?: "individual" | "business";
    businessName?: string;
    gstNumber?: string;
    email?: string;
    phone?: string;
    address?: string;
  }
) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/provider/kyc/bank/verify`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })) as {
    holderName: string;
    aadhaarName: string;
    matched: boolean;
    ifsc: string;
    bankName?: string;
    bankBranch?: string;
    submitted?: boolean;
    submissionId?: number | null;
  };
}

export type ProviderListing = {
  id: number;
  title: string;
  category: string;
  channel: string;
  status: string;
  rcNumber?: string | null;
  createdAt: string;
};

export async function fetchProviderListings(token: string) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/provider/listings`, token)) as {
    listings: ProviderListing[];
  };
}

export async function submitProviderListing(
  token: string,
  payload: { title: string; category: string; channel: string; rcNumber?: string }
) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/provider/listings`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })) as { listing: ProviderListing };
}

export type ProviderBooking = {
  id: number;
  title: string;
  category: string;
  location: string;
  date: string;
  note: string;
  status: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
};

export async function fetchProviderBookings(token: string) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/provider/bookings`, token)) as {
    bookings: ProviderBooking[];
  };
}

export async function sendProviderPhoneOtp(token: string, payload: { phone: string }) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/auth/phone/send-otp`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, purpose: "provider" })
  })) as { success: boolean; phone: string; provider?: string; channel?: string };
}

export async function confirmProviderPhone(token: string, payload: { phone: string; code: string }) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/provider/phone/confirm`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })) as { verified: boolean };
}

export async function createProviderRazorpayAccount(
  token: string,
  payload: {
    accountNumber: string;
    ifsc: string;
    holderName: string;
    email?: string;
    phone?: string;
    businessName?: string;
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  }
) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/provider/payouts/razorpay`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })) as { linked: boolean; accountId?: string; message?: string };
}

export async function fetchProviderKycStatus(token: string) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/provider/kyc/status`, token)) as {
    status: "not_submitted" | "pending" | "approved" | "rejected" | string;
  };
}

export async function fetchProviderEquipment(token: string) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/provider/equipment`, token)) as {
    equipment: Array<{ id: number; name: string; category: string; dailyRate?: string | null }>;
  };
}

export async function addProviderEquipment(
  token: string,
  payload: { name: string; category: string; dailyRate?: string }
) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/provider/equipment`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })) as { equipment: { id: number; name: string; category: string; dailyRate?: string | null } };
}

export async function submitProviderKyc(
  token: string,
  payload: {
    applicantName: string;
    role: string;
    registrationType?: "individual" | "business";
    documentSummary: string;
    documents?: unknown[];
    businessName?: string;
    gstNumber?: string;
    email?: string;
    phone?: string;
    address?: string;
    priority?: "High" | "Medium" | "Low";
    otpVerified?: boolean;
    panNumber?: string;
  }
) {
  return fetchWithAuth(`${API_BASE_URL}/v1/provider/kyc/submit`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export type IfscLookupResult = {
  ifsc: string;
  bank: string;
  branch: string;
  address?: string;
  city?: string;
  district?: string;
  state?: string;
};

export async function lookupIfsc(ifsc: string) {
  const code = String(ifsc || "").trim().toUpperCase();
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(code)) {
    throw new Error("Enter a valid 11-character IFSC code.");
  }
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/v1/bank/ifsc/${encodeURIComponent(code)}`);
    if (response.ok) return (await parseJsonOrThrow(response)) as IfscLookupResult;
  } catch {
    // Public directory is the fallback when the app API is unavailable.
  }
  const publicRes = await fetch(`https://ifsc.razorpay.com/${code}`);
  if (!publicRes.ok) throw new Error("IFSC not found. Check the code and try again.");
  const data = (await publicRes.json()) as {
    IFSC?: string;
    BANK?: string;
    BRANCH?: string;
    ADDRESS?: string;
    CITY?: string;
    DISTRICT?: string;
    STATE?: string;
  };
  return {
    ifsc: data.IFSC || code,
    bank: data.BANK || "",
    branch: data.BRANCH || "",
    address: data.ADDRESS,
    city: data.CITY,
    district: data.DISTRICT,
    state: data.STATE
  } satisfies IfscLookupResult;
}
