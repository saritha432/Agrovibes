import type { RootStackParamList } from "../../navigation/rootStackTypes";
import type { AccountCenterSheetRoute } from "./accountCenterSheetNav";

const STACK_TO_SHEET: Partial<Record<keyof RootStackParamList, AccountCenterSheetRoute>> = {
  ProfilesPersonalDetails: "ProfilesPersonalDetails",
  PasswordSecurity: "PasswordSecurity",
  ConnectedExperiences: "ConnectedExperiences",
  SharingAcrossProfiles: "SharingAcrossProfiles",
  SyncingProfilePictures: "SyncingProfilePictures",
  ShowingProfileLinks: "ShowingProfileLinks",
  MemoriesFromInstagram: "MemoriesFromInstagram",
  YourInformationPermissions: "YourInformationPermissions",
  SearchHistory: "SearchHistory",
  AutoClearSearchHistory: "AutoClearSearchHistory",
  HowAutoClearingWorks: "HowAutoClearingWorks",
  ActivityOffCropvibe: "ActivityOffCropvibe",
  ManageAccounts: "ManageAccounts",
  ManageAccountOptions: "ManageAccountOptions",
  DeactivateDeleteChoice: "DeactivateDeleteChoice",
  DeactivateDeleteContinue: "DeactivateDeleteContinue"
};

export function resolveAccountCenterSheetRoute(
  screen: keyof RootStackParamList
): AccountCenterSheetRoute | null {
  return STACK_TO_SHEET[screen] ?? null;
}

export function isAccountCenterSheetScreen(screen: keyof RootStackParamList): boolean {
  return screen in STACK_TO_SHEET;
}
