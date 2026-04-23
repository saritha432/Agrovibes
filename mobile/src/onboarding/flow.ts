import { OnboardingState } from "./types";

export type OnboardingDestination =
  | "AuthChoice"
  | "PersonalInfo"
  | "RoleSelection"
  | "BuyerInterests"
  | "BuyerDelivery"
  | "BuyerWalkthrough"
  | "SellerFarm"
  | "SellerKYC"
  | "SellerBank"
  | "ExpertDomain"
  | "ExpertCredentials"
  | "ExpertVerification"
  | "SecurityVerification"
  | "Main";

export function resolveOnboardingDestination(hasToken: boolean, ob: OnboardingState): OnboardingDestination {
  if (!hasToken) return "AuthChoice";
  if (!ob.personalInfoCompleted) return "PersonalInfo";
  return "Main";
}
