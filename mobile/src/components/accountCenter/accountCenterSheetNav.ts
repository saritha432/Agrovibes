import React, { createContext, useContext } from "react";
import type { RootStackParamList } from "../../navigation/rootStackTypes";

export type AccountCenterSheetRoute =
  | "main"
  | "ProfilesPersonalDetails"
  | "PasswordSecurity"
  | "ChangePassword"
  | "ConnectedExperiences"
  | "SharingAcrossProfiles"
  | "SyncingProfilePictures"
  | "ShowingProfileLinks"
  | "MemoriesFromInstagram"
  | "YourInformationPermissions"
  | "SearchHistory"
  | "AutoClearSearchHistory"
  | "HowAutoClearingWorks"
  | "ActivityOffCropvibe"
  | "ManageAccounts"
  | "ManageAccountOptions"
  | "DeactivateDeleteChoice"
  | "DeactivateDeleteContinue"
  | "DeactivateDeleteConfirmPassword"
  | "DeactivateDeleteSuccess";

export type SheetNavContextValue = {
  push: (route: AccountCenterSheetRoute) => void;
  pop: () => void;
  close: () => void;
  navigateStack: (screen: keyof RootStackParamList) => void;
};

export const SheetNavContext = createContext<SheetNavContextValue | null>(null);

export function useAccountCenterSheetNav() {
  const ctx = useContext(SheetNavContext);
  if (!ctx) throw new Error("useAccountCenterSheetNav must be used within AccountCenterBottomSheet");
  return ctx;
}
