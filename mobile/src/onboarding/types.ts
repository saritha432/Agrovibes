export type AppRole = "buyer" | "seller" | "expert";

export interface BuyerWizardProgress {
  interests: boolean;
  delivery: boolean;
  walkthrough: boolean;
}

export interface SellerWizardProgress {
  farm: boolean;
  kyc: boolean;
  bank: boolean;
}

export interface ExpertWizardProgress {
  domain: boolean;
  credentials: boolean;
  verification: boolean;
}

export interface OnboardingState {
  personalInfoCompleted: boolean;
  appRole: AppRole | null;
  buyer: BuyerWizardProgress;
  seller: SellerWizardProgress;
  expert: ExpertWizardProgress;
  securityCompleted: boolean;
}

export function defaultOnboardingState(): OnboardingState {
  return {
    personalInfoCompleted: false,
    appRole: null,
    buyer: { interests: false, delivery: false, walkthrough: false },
    seller: { farm: false, kyc: false, bank: false },
    expert: { domain: false, credentials: false, verification: false },
    securityCompleted: false
  };
}
