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
  if (!ob.appRole) return "RoleSelection";

  if (ob.appRole === "buyer") {
    if (!ob.buyer.interests) return "BuyerInterests";
    if (!ob.buyer.delivery) return "BuyerDelivery";
    if (!ob.buyer.walkthrough) return "BuyerWalkthrough";
  } else if (ob.appRole === "seller") {
    if (!ob.seller.farm) return "SellerFarm";
    if (!ob.seller.kyc) return "SellerKYC";
    if (!ob.seller.bank) return "SellerBank";
  } else if (ob.appRole === "expert") {
    if (!ob.expert.domain) return "ExpertDomain";
    if (!ob.expert.credentials) return "ExpertCredentials";
    if (!ob.expert.verification) return "ExpertVerification";
  }

  if (!ob.securityCompleted) return "SecurityVerification";
  return "Main";
}
