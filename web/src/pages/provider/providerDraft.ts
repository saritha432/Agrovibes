export type ProviderTrack = "rental" | "service" | "both";
export type ProviderRegistrationType = "individual" | "business";

export type ProviderJoinDraft = {
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
  kycProvider?: string;
  digilockerVerified: boolean;
  aadhaarName: string;
  aadhaarMasked: string;
  panNumber: string;
  panName: string;
  panMatched: boolean;
  bankVerified: boolean;
  holderName: string;
  bankName: string;
  bankBranch: string;
  bankLocation: string;
  accountNumber: string;
  ifsc: string;
};

const STORAGE_KEY = "cropvibe.provider.join.v1";

export const EMPTY_PROVIDER_DRAFT: ProviderJoinDraft = {
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
  digilockerVerified: false,
  aadhaarName: "",
  aadhaarMasked: "",
  panNumber: "",
  panName: "",
  panMatched: false,
  bankVerified: false,
  holderName: "",
  bankName: "",
  bankBranch: "",
  bankLocation: "",
  accountNumber: "",
  ifsc: ""
};

export function readProviderDraft(): ProviderJoinDraft {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_PROVIDER_DRAFT;
    const saved = { ...EMPTY_PROVIDER_DRAFT, ...(JSON.parse(raw) as Partial<ProviderJoinDraft>) };
    if (saved.kycProvider === "sandbox") return saved;
    return {
      ...saved,
      digilockerVerified: false,
      aadhaarName: "",
      aadhaarMasked: "",
      panNumber: "",
      panName: "",
      panMatched: false,
      bankVerified: false,
      holderName: ""
    };
  } catch {
    return EMPTY_PROVIDER_DRAFT;
  }
}

export function writeProviderDraft(draft: ProviderJoinDraft) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}
