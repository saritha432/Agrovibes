import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchProviderKycStatus, fetchProviderListings, submitProviderKyc, submitProviderListing } from "./api";

export type ProviderApprovalStatus = "not_submitted" | "pending" | "approved" | "rejected";
export type ListingApprovalStatus = "pending" | "approved" | "rejected";
export type ProviderTrack = "rental" | "service" | "both";
export type ProviderRegistrationType = "individual" | "business";

export type ProviderKycDocument = {
  key: string;
  label: string;
  /** Local file URI until uploaded; remote https URL after upload/submit. */
  uri: string;
};

export type ProviderRegistrationDraft = {
  track: ProviderTrack;
  registrationType: ProviderRegistrationType;
  fullName: string;
  phone: string;
  email: string;
  businessName: string;
  street: string;
  village: string;
  district: string;
  state: string;
  gstNumber: string;
  yearsExperience: string;
  holderName?: string;
  bankName?: string;
  bankBranch?: string;
  bankLocation?: string;
  accountNumber?: string;
  ifsc?: string;
  upi?: string;
  documentLabels: string[];
  documents: ProviderKycDocument[];
  /** Full Aadhaar is kept only until KYC submit, then cleared. */
  aadhaarNumber?: string;
  panNumber?: string;
  panName?: string;
  kycAadhaarVerified?: boolean;
  digilockerVerified?: boolean;
  aadhaarName?: string;
  aadhaarMasked?: string;
  panMatched?: boolean;
  bankVerified?: boolean;
};

export type ProviderListingRecord = {
  id: string;
  title: string;
  category: string;
  channel: string;
  status: ListingApprovalStatus;
  createdAt: string;
  approvedAt?: string;
  /** Local photo. The listings API does not store images. */
  imageUri?: string;
  /** Set when this phone copy has not been inserted into provider_listings. */
  serverError?: string;
};

export type ProviderBookingRecord = {
  id: string;
  listingId: string;
  listingTitle: string;
  customerName: string;
  customerPhone: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  duration: string;
  pickupLocation: string;
  notes?: string;
  createdAt: string;
};

type WorkflowNotification = {
  id: string;
  target: "admin" | "provider";
  title: string;
  body: string;
  createdAt: string;
};

type ProviderWorkflowState = {
  registrationStatus: ProviderApprovalStatus;
  registrationDraft: ProviderRegistrationDraft | null;
  listings: ProviderListingRecord[];
  bookings: ProviderBookingRecord[];
  notifications: WorkflowNotification[];
};

const STORAGE_KEY = "agrovibes.provider.workflow.v1";

const DEFAULT_STATE: ProviderWorkflowState = {
  registrationStatus: "not_submitted",
  registrationDraft: null,
  listings: [],
  bookings: [],
  notifications: []
};

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function isServerListingId(id: unknown): boolean {
  return /^\d+$/.test(String(id ?? ""));
}

function uploadFailureMessage(error: unknown): string {
  const err = error as { message?: string; payload?: { error?: string } };
  const message = error instanceof Error ? error.message : "Could not reach the server.";
  const detail = typeof err?.payload?.error === "string" ? err.payload.error.trim() : "";
  if (detail && !message.includes(detail)) return `${message} (${detail})`;
  return message;
}

export function listingReachedServer(listing: Pick<ProviderListingRecord, "id">): boolean {
  return isServerListingId(listing.id);
}

export function listingStatusText(listing: ProviderListingRecord): string {
  if (!isServerListingId(listing.id)) {
    return listing.serverError
      ? `Not sent to admin. ${listing.serverError}`
      : "Saved on this phone only. It is not in the admin list yet.";
  }
  if (listing.status === "approved") return "Approved";
  if (listing.status === "rejected") return "Rejected";
  return "Waiting for admin approval";
}

async function readState(): Promise<ProviderWorkflowState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<ProviderWorkflowState>;
    return {
      registrationStatus: parsed.registrationStatus ?? "not_submitted",
      registrationDraft: parsed.registrationDraft
        ? {
            ...parsed.registrationDraft,
            registrationType:
              parsed.registrationDraft.registrationType === "business" ? "business" : "individual",
            state: parsed.registrationDraft.state || "",
            gstNumber: parsed.registrationDraft.gstNumber || "",
            email: parsed.registrationDraft.email || "",
            documentLabels: Array.isArray(parsed.registrationDraft.documentLabels)
              ? parsed.registrationDraft.documentLabels
              : [],
            documents: Array.isArray(parsed.registrationDraft.documents)
              ? parsed.registrationDraft.documents
              : [],
            aadhaarNumber: parsed.registrationDraft.aadhaarNumber || "",
            panNumber: parsed.registrationDraft.panNumber || "",
            panName: parsed.registrationDraft.panName || "",
            kycAadhaarVerified: Boolean(parsed.registrationDraft.kycAadhaarVerified),
            digilockerVerified: Boolean(parsed.registrationDraft.digilockerVerified),
            aadhaarName: parsed.registrationDraft.aadhaarName || "",
            aadhaarMasked: parsed.registrationDraft.aadhaarMasked || "",
            panMatched: Boolean(parsed.registrationDraft.panMatched),
            bankVerified: Boolean(parsed.registrationDraft.bankVerified)
          }
        : null,
      listings: Array.isArray(parsed.listings) ? parsed.listings : [],
      bookings: Array.isArray(parsed.bookings) ? parsed.bookings : [],
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications : []
    };
  } catch {
    return DEFAULT_STATE;
  }
}

async function writeState(state: ProviderWorkflowState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function pushNotification(
  state: ProviderWorkflowState,
  target: "admin" | "provider",
  title: string,
  body: string
): ProviderWorkflowState {
  return {
    ...state,
    notifications: [
      {
        id: makeId("notif"),
        target,
        title,
        body,
        createdAt: new Date().toISOString()
      },
      ...state.notifications
    ]
  };
}

export async function getProviderRegistrationStatus(): Promise<ProviderApprovalStatus> {
  const state = await readState();
  return state.registrationStatus;
}

/** Pull latest KYC decision from API into local workflow state. */
export async function syncProviderRegistrationFromApi(token?: string | null): Promise<ProviderApprovalStatus> {
  const state = await readState();
  if (!token) return state.registrationStatus;
  try {
    const remote = await fetchProviderKycStatus(token);
    const remoteStatus = String(remote.status || "not_submitted").toLowerCase();
    const nextStatus: ProviderApprovalStatus =
      remoteStatus === "pending" || remoteStatus === "approved" || remoteStatus === "rejected"
        ? remoteStatus
        : "not_submitted";
    if (nextStatus !== state.registrationStatus) {
      let next = { ...state, registrationStatus: nextStatus };
      if (nextStatus === "approved") {
        next = pushNotification(
          next,
          "provider",
          "Registration Approved",
          "Admin approved your profile. You can now start your business."
        );
      } else if (nextStatus === "rejected") {
        next = pushNotification(
          next,
          "provider",
          "Registration Rejected",
          "Admin rejected your KYC. Please review documents and resubmit."
        );
      }
      await writeState(next);
      return nextStatus;
    }
  } catch {
    // Keep local status if API is unreachable.
  }
  return state.registrationStatus;
}

export async function updateProviderRegistrationDraft(
  patch: Partial<ProviderRegistrationDraft>
): Promise<void> {
  const state = await readState();
  const current = state.registrationDraft ?? {
    track: "rental",
    registrationType: "individual",
    fullName: "",
    phone: "",
    email: "",
    businessName: "",
    street: "",
    village: "",
    district: "",
    state: "",
    gstNumber: "",
    yearsExperience: "",
    documentLabels: [],
    documents: [],
    aadhaarNumber: "",
    panNumber: "",
    kycAadhaarVerified: false
  };
  await writeState({
    ...state,
    registrationDraft: {
      ...current,
      ...patch,
      documentLabels: patch.documentLabels ?? current.documentLabels,
      documents: patch.documents ?? current.documents ?? []
    }
  });
}

export async function getProviderRegistrationDraft(): Promise<ProviderRegistrationDraft | null> {
  const state = await readState();
  return state.registrationDraft;
}

export async function submitProviderRegistrationForApproval(token?: string | null): Promise<void> {
  const state = await readState();
  const draft = state.registrationDraft;
  const panNumber = String(draft?.panNumber || "").trim().toUpperCase();
  const gstRaw = String(draft?.gstNumber || "").trim().toUpperCase();
  const gstValid = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstRaw);
  const isBusiness = draft?.registrationType === "business";
  if (!draft?.digilockerVerified) {
    throw new Error("Verify Aadhaar with DigiLocker before submitting.");
  }
  if (gstRaw && !gstValid) {
    throw new Error("Enter a valid GST number.");
  }
  if (isBusiness && !draft?.panMatched && !gstValid) {
    throw new Error("A business needs a verified PAN or a GST number.");
  }
  if (!token) {
    throw new Error("Please sign in again, then submit for review.");
  }

  const address = [draft?.street, draft?.village, draft?.district, draft?.state]
    .filter(Boolean)
    .join(", ");
  await submitProviderKyc(token, {
    applicantName: draft?.fullName || "Provider",
    role: draft?.track || "rental",
    registrationType: draft?.registrationType || "individual",
    documentSummary: isBusiness
      ? `DigiLocker Aadhaar${draft?.panMatched ? ", PAN" : ""}${gstValid ? ", GST" : ""}`
      : "DigiLocker Aadhaar",
    documents: [],
    businessName: draft?.businessName || undefined,
    gstNumber: gstValid ? gstRaw : undefined,
    email: draft?.email || undefined,
    phone: draft?.phone || undefined,
    address: address || undefined,
    priority: "Medium",
    otpVerified: true,
    panNumber
  });

  let next = {
    ...state,
    registrationStatus: "pending" as ProviderApprovalStatus,
    registrationDraft: draft
      ? {
          ...draft,
          aadhaarNumber: ""
        }
      : draft
  };
  next = pushNotification(
    next,
    "admin",
    "Provider Registration Submitted",
    "A provider has submitted KYC and profile details for approval."
  );
  await writeState(next);
}

export async function submitListingForApproval(input: {
  title: string;
  category: string;
  channel: string;
  imageUri?: string;
  token?: string | null;
}): Promise<string> {
  if (!input.token) {
    throw new Error("Please sign in again, then submit the listing.");
  }
  const created = await submitProviderListing(input.token, {
    title: input.title,
    category: input.category,
    channel: input.channel
  });
  const serverId = Number(created?.listing?.id);
  if (!Number.isFinite(serverId) || serverId <= 0) {
    throw new Error("The server did not save this listing.");
  }
  let state = await readState();
  const listingId = String(serverId);
  const listing: ProviderListingRecord = {
    id: listingId,
    title: input.title,
    category: input.category,
    channel: input.channel,
    status: "pending",
    imageUri: input.imageUri,
    createdAt: created.listing?.createdAt || new Date().toISOString()
  };
  state = {
    ...state,
    listings: [listing, ...state.listings]
  };
  state = pushNotification(
    state,
    "admin",
    "Listing Submitted For Approval",
    `${input.title} was submitted and is waiting for admin approval.`
  );
  await writeState(state);
  return listingId;
}

/**
 * Local helper for listing approvals demo. KYC approval now comes from Admin API.
 */
export async function processAdminApprovals(): Promise<{ registrationApproved: boolean; listingsApproved: number }> {
  let state = await readState();
  let registrationApproved = false;
  let listingsApproved = 0;

  const updatedListings = state.listings.map((listing) => {
    if (listing.status !== "pending") return listing;
    listingsApproved += 1;
    return {
      ...listing,
      status: "approved" as ListingApprovalStatus,
      approvedAt: new Date().toISOString()
    };
  });
  if (listingsApproved > 0) {
    state = {
      ...state,
      listings: updatedListings
    };
    state = pushNotification(
      state,
      "provider",
      "Listing Approved",
      `${listingsApproved} listing(s) approved by admin and ready for customers.`
    );
  }

  await writeState(state);
  return { registrationApproved, listingsApproved };
}

export async function markProviderRegistrationApprovedLocally(): Promise<void> {
  let state = await readState();
  state = { ...state, registrationStatus: "approved" };
  state = pushNotification(
    state,
    "provider",
    "Registration Approved",
    "Admin approved your profile. You can now start your business."
  );
  await writeState(state);
}

export async function uploadLocalListings(token?: string | null): Promise<ProviderListingRecord[]> {
  const state = await readState();
  if (!token) {
    return state.listings.map((row) =>
      isServerListingId(row.id)
        ? row
        : { ...row, serverError: "Sign in again so this listing can be sent to admin." }
    );
  }
  let listings = [...state.listings];
  let changed = false;
  for (let index = 0; index < listings.length; index += 1) {
    const row = listings[index];
    if (isServerListingId(row.id)) continue;
    try {
      const created = await submitProviderListing(token, {
        title: row.title,
        category: row.category,
        channel: row.channel
      });
      const serverId = Number(created?.listing?.id);
      if (!Number.isFinite(serverId) || serverId <= 0) {
        throw new Error("The server did not save this listing.");
      }
      listings[index] = {
        ...row,
        id: String(serverId),
        createdAt: created.listing?.createdAt || row.createdAt,
        status: "pending",
        serverError: undefined
      };
      changed = true;
    } catch (error) {
      const serverError = uploadFailureMessage(error);
      if (row.serverError !== serverError) {
        listings[index] = { ...row, serverError };
        changed = true;
      }
    }
  }
  if (changed) {
    const latest = await readState();
    await writeState({ ...latest, listings });
  }
  const remote = await syncProviderListingsFromApi(token);
  const localOnly = (await readState()).listings.filter((row) => !isServerListingId(row.id));
  if (!remote.length) return (await readState()).listings;
  const remoteIds = new Set(remote.map((row) => row.id));
  return [...remote.filter((row) => isServerListingId(row.id)), ...localOnly.filter((row) => !remoteIds.has(row.id))];
}

export async function syncProviderListingsFromApi(token?: string | null): Promise<ProviderListingRecord[]> {
  const state = await readState();
  if (!token) return state.listings;
  try {
    const remote = await fetchProviderListings(token);
    const imageById = new Map(state.listings.filter((row) => row.imageUri).map((row) => [row.id, row.imageUri]));
    const imageByTitle = new Map(state.listings.filter((row) => row.imageUri).map((row) => [row.title, row.imageUri]));
    const remoteRows: ProviderListingRecord[] = (remote.listings || []).map((row) => ({
      id: String(row.id),
      title: row.title,
      category: row.category,
      channel: row.channel,
      status: row.status === "approved" ? "approved" : row.status === "rejected" ? "rejected" : "pending",
      imageUri: imageById.get(String(row.id)) || imageByTitle.get(row.title),
      createdAt: row.createdAt
    }));
    const localOnly = state.listings.filter((row) => !isServerListingId(row.id));
    if (!remoteRows.length && state.listings.length) return state.listings;
    const listings = [...remoteRows, ...localOnly];
    await writeState({ ...state, listings });
    return listings;
  } catch {
    return state.listings;
  }
}

export async function getProviderListings(): Promise<ProviderListingRecord[]> {
  const state = await readState();
  return state.listings;
}

export async function getProviderBookings(): Promise<ProviderBookingRecord[]> {
  const { getCustomerRentalBookings } = await import("../screens/rental/customerRentalBookings");
  const customerBookings = await getCustomerRentalBookings();
  const state = await readState();
  const known = new Set(state.bookings.map((booking) => `${booking.listingTitle}|${booking.bookingDate}`));
  const imported: ProviderBookingRecord[] = customerBookings
    .filter((booking) => !known.has(`${booking.title}|${booking.date}`))
    .map((booking) => ({
      id: booking.id,
      listingId: booking.listingId,
      listingTitle: booking.title,
      customerName: "Customer",
      customerPhone: "",
      bookingDate: booking.date,
      startTime: "",
      endTime: "",
      duration: "",
      pickupLocation: booking.location,
      notes: booking.note,
      createdAt: booking.createdAt
    }));
  if (!imported.length) return state.bookings;
  const bookings = [...imported, ...state.bookings];
  await writeState({ ...state, bookings });
  return bookings;
}

export async function addCustomerBooking(input: Omit<ProviderBookingRecord, "id" | "createdAt">): Promise<void> {
  const state = await readState();
  const booking: ProviderBookingRecord = {
    ...input,
    id: makeId("booking"),
    createdAt: new Date().toISOString()
  };
  const next = {
    ...state,
    bookings: [booking, ...state.bookings]
  };
  await writeState(next);
}
