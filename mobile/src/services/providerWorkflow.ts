import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchProviderKycStatus, submitProviderKyc, uploadImageFile } from "./api";

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
};

export type ProviderListingRecord = {
  id: string;
  title: string;
  category: string;
  channel: string;
  status: ListingApprovalStatus;
  createdAt: string;
  approvedAt?: string;
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
              : []
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
    let nextStatus: ProviderApprovalStatus = state.registrationStatus;
    if (remoteStatus === "pending" || remoteStatus === "approved" || remoteStatus === "rejected") {
      nextStatus = remoteStatus;
    } else if (remoteStatus === "not_submitted") {
      nextStatus = state.registrationStatus === "pending" ? "pending" : "not_submitted";
    }
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
    documents: []
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
  const localDocs = Array.isArray(draft?.documents) ? draft.documents : [];
  if (localDocs.length === 0) {
    throw new Error("Upload KYC documents before submitting for review.");
  }
  if (!token) {
    throw new Error("Please sign in again, then submit for review.");
  }

  const uploadedDocs: Array<{ key: string; label: string; url: string }> = [];
  for (const doc of localDocs) {
    const label = String(doc.label || "Document").trim();
    const key = String(doc.key || "document").trim();
    const uri = String(doc.uri || "").trim();
    if (!uri) continue;
    if (/^https?:\/\//i.test(uri)) {
      uploadedDocs.push({ key, label, url: uri });
      continue;
    }
    const uploaded = await uploadImageFile(uri);
    if (!uploaded?.url) {
      throw new Error(`Failed to upload ${label}. Please try again.`);
    }
    uploadedDocs.push({ key, label, url: uploaded.url });
  }
  if (uploadedDocs.length === 0) {
    throw new Error("Upload KYC documents before submitting for review.");
  }

  const documentSummary =
    (draft?.documentLabels || []).join(", ").trim() || uploadedDocs.map((d) => d.label).join(", ");
  const address = [draft?.street, draft?.village, draft?.district, draft?.state]
    .filter(Boolean)
    .join(", ");
  await submitProviderKyc(token, {
    applicantName: draft?.fullName || "Provider",
    role: draft?.track || "rental",
    registrationType: draft?.registrationType || "individual",
    documentSummary,
    documents: uploadedDocs,
    businessName: draft?.businessName || undefined,
    gstNumber: draft?.gstNumber || undefined,
    email: draft?.email || undefined,
    phone: draft?.phone || undefined,
    address: address || undefined,
    priority: "Medium"
  });

  let next = {
    ...state,
    registrationStatus: "pending" as ProviderApprovalStatus,
    registrationDraft: draft
      ? {
          ...draft,
          documents: uploadedDocs.map((d) => ({ key: d.key, label: d.label, uri: d.url })),
          documentLabels: uploadedDocs.map((d) => d.label)
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
}): Promise<string> {
  let state = await readState();
  const listingId = makeId("listing");
  const listing: ProviderListingRecord = {
    id: listingId,
    title: input.title,
    category: input.category,
    channel: input.channel,
    status: "pending",
    createdAt: new Date().toISOString()
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

export async function getProviderListings(): Promise<ProviderListingRecord[]> {
  const state = await readState();
  return state.listings;
}

export async function getProviderBookings(): Promise<ProviderBookingRecord[]> {
  const state = await readState();
  return state.bookings;
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
