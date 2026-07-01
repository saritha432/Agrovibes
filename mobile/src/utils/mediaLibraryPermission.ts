import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";

export type MediaLibraryAccess = {
  granted: boolean;
  canAskAgain: boolean;
};

type PermissionLike = {
  granted?: boolean;
  canAskAgain?: boolean;
  status?: string;
  accessPrivileges?: string;
};

/** iOS "Select Photos" / limited library still allows picking media. */
export function hasMediaLibraryAccess(perm: PermissionLike | null | undefined): boolean {
  if (!perm) return false;
  if (perm.granted) return true;
  if (perm.status === "granted") return true;
  const access = String(perm.accessPrivileges || "").toLowerCase();
  if (access === "limited" || access === "all") return true;
  return false;
}

export async function ensureMediaLibraryAccess(): Promise<MediaLibraryAccess> {
  if (Platform.OS === "web") {
    return { granted: true, canAskAgain: false };
  }

  let canAskAgain = true;

  try {
    const existing = await MediaLibrary.getPermissionsAsync();
    if (hasMediaLibraryAccess(existing)) {
      return { granted: true, canAskAgain: existing.canAskAgain ?? true };
    }
    canAskAgain = existing.canAskAgain ?? true;

    const requested = await MediaLibrary.requestPermissionsAsync();
    if (hasMediaLibraryAccess(requested)) {
      return { granted: true, canAskAgain: requested.canAskAgain ?? true };
    }
    canAskAgain = requested.canAskAgain ?? canAskAgain;
  } catch {
    // Fall through to image-picker permission APIs.
  }

  try {
    const pickerExisting = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (hasMediaLibraryAccess(pickerExisting)) {
      return { granted: true, canAskAgain: pickerExisting.canAskAgain ?? true };
    }

    const pickerRequested = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (hasMediaLibraryAccess(pickerRequested)) {
      return { granted: true, canAskAgain: pickerRequested.canAskAgain ?? true };
    }
    canAskAgain = pickerRequested.canAskAgain ?? canAskAgain;
  } catch {
    // ignore
  }

  return { granted: false, canAskAgain };
}
