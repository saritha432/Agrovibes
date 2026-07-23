export type KycStatus = "Verified" | "Pending" | "Rejected";
export type AccountStatus = "Active" | "Suspended" | "Banned" | "Pending";

export type AdminUserFlag = {
  id: string;
  label: string;
  when: string;
};

export type AdminUserKycItem = {
  id: string;
  label: string;
  value: string;
  status: "Verified" | "Pending" | "Rejected";
};

export type AdminUserProfile = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  userId: string;
  role: string;
  region: string;
  joined: string;
  kycStatus: KycStatus;
  flags: number;
  accountStatus: AccountStatus;
  phone?: string;
  location?: string;
  farmerId?: string;
  pan?: string;
  aadhaar?: string;
  flagItems?: AdminUserFlag[];
  kycItems?: AdminUserKycItem[];
};
