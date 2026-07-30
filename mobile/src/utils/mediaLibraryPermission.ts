import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";

export type MediaLibraryAccess = {
  granted: boolean;
  canAskAgain: boolean;
  /** iOS only: true when the user chose "Select Photos" (limited access). */
  limited: boolean;
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

function isLimitedPerm(perm: PermissionLike | null | undefined): boolean {
  if (!perm) return false;
  const access = String(perm.accessPrivileges || "").toLowerCase();
  return access === "limited";
}

const PERMISSION_CACHE_MS = 8_000;
let permissionCache: { value: MediaLibraryAccess; at: number } | null = null;

export function clearMediaLibraryPermissionCache() {
  permissionCache = null;
}

export async function ensureMediaLibraryAccess(force = false): Promise<MediaLibraryAccess> {
  if (Platform.OS === "web") {
    return { granted: true, canAskAgain: false, limited: false };
  }

  if (!force && permissionCache && Date.now() - permissionCache.at < PERMISSION_CACHE_MS) {
    return permissionCache.value;
  }

  let canAskAgain = true;

  try {
    const existing = await MediaLibrary.getPermissionsAsync();
    if (hasMediaLibraryAccess(existing)) {
      const value = { granted: true, canAskAgain: existing.canAskAgain ?? true, limited: isLimitedPerm(existing) };
      permissionCache = { value, at: Date.now() };
      return value;
    }
    canAskAgain = existing.canAskAgain ?? true;

    const requested = await MediaLibrary.requestPermissionsAsync();
    if (hasMediaLibraryAccess(requested)) {
      const value = { granted: true, canAskAgain: requested.canAskAgain ?? true, limited: isLimitedPerm(requested) };
      permissionCache = { value, at: Date.now() };
      return value;
    }
    canAskAgain = requested.canAskAgain ?? canAskAgain;
  } catch {
    // Fall through to image-picker permission APIs.
  }

  try {
    const pickerExisting = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (hasMediaLibraryAccess(pickerExisting)) {
      const value = {
        granted: true,
        canAskAgain: pickerExisting.canAskAgain ?? true,
        limited: isLimitedPerm(pickerExisting)
      };
      permissionCache = { value, at: Date.now() };
      return value;
    }

    const pickerRequested = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (hasMediaLibraryAccess(pickerRequested)) {
      const value = {
        granted: true,
        canAskAgain: pickerRequested.canAskAgain ?? true,
        limited: isLimitedPerm(pickerRequested)
      };
      permissionCache = { value, at: Date.now() };
      return value;
    }
    canAskAgain = pickerRequested.canAskAgain ?? canAskAgain;
  } catch {
    // ignore
  }

  const denied = { granted: false, canAskAgain, limited: false };
  permissionCache = { value: denied, at: Date.now() };
  return denied;
}
