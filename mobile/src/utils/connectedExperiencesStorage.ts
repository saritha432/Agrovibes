import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthUser } from "../auth/AuthContext";
import { CONNECTED_ACCOUNT_SUBTITLES } from "../components/accountCenter/connectedExperiencesData";

const STORAGE_KEY = "agrovibes.connected-experiences";

export type ConnectedPlatform = "cropvibe" | "whatsapp" | "instagram";

export type ConnectedAccount = {
  id: string;
  platform: ConnectedPlatform;
  displayName: string;
  subtitle: string;
  avatarUrl?: string | null;
  linkedAt: string;
};

export type ManagedAvatar = {
  id: string;
  name: string;
  linkedAccountId?: string;
  createdAt: string;
};

export type ConnectedExperiencesState = {
  accounts: ConnectedAccount[];
  sharingFromAccountId: string | null;
  syncedPictureAccountIds: string[];
  showLinksOnAccountIds: string[];
  cropvibeMemoriesShareEnabled: boolean;
  memoriesShareToAccountId: string | null;
  avatars: ManagedAvatar[];
};

const DEFAULT_STATE: ConnectedExperiencesState = {
  accounts: [],
  sharingFromAccountId: null,
  syncedPictureAccountIds: [],
  showLinksOnAccountIds: [],
  cropvibeMemoriesShareEnabled: false,
  memoriesShareToAccountId: null,
  avatars: []
};

function mainAccountId(userId: number) {
  return `cropvibe-${userId}`;
}

function whatsappAccountId(userId: number) {
  return `whatsapp-${userId}`;
}

function instagramAccountId(userId: number) {
  return `instagram-${userId}`;
}

export function buildDefaultAccounts(user: AuthUser): ConnectedAccount[] {
  const displayName = user.fullName || user.username || "Your profile";
  const now = new Date().toISOString();
  return [
    {
      id: mainAccountId(user.id),
      platform: "cropvibe",
      displayName,
      subtitle: CONNECTED_ACCOUNT_SUBTITLES.main,
      avatarUrl: user.avatarUrl,
      linkedAt: now
    },
    {
      id: whatsappAccountId(user.id),
      platform: "whatsapp",
      displayName,
      subtitle: CONNECTED_ACCOUNT_SUBTITLES.whatsapp,
      avatarUrl: user.avatarUrl,
      linkedAt: now
    }
  ];
}

async function readRawState(): Promise<ConnectedExperiencesState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as ConnectedExperiencesState & { instagramMemoriesEnabled?: boolean };
    return {
      ...DEFAULT_STATE,
      ...parsed,
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
      syncedPictureAccountIds: Array.isArray(parsed.syncedPictureAccountIds) ? parsed.syncedPictureAccountIds : [],
      showLinksOnAccountIds: Array.isArray(parsed.showLinksOnAccountIds) ? parsed.showLinksOnAccountIds : [],
      avatars: Array.isArray(parsed.avatars) ? parsed.avatars : [],
      cropvibeMemoriesShareEnabled:
        parsed.cropvibeMemoriesShareEnabled ?? parsed.instagramMemoriesEnabled ?? false
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

async function writeState(state: ConnectedExperiencesState) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export async function loadConnectedExperiences(user: AuthUser | null): Promise<ConnectedExperiencesState> {
  if (!user) return { ...DEFAULT_STATE };

  const state = await readRawState();
  const defaults = buildDefaultAccounts(user);
  const byId = new Map<string, ConnectedAccount>();

  for (const account of state.accounts) {
    byId.set(account.id, account);
  }
  for (const account of defaults) {
    if (!byId.has(account.id)) {
      byId.set(account.id, account);
    } else {
      const existing = byId.get(account.id)!;
      byId.set(account.id, {
        ...existing,
        displayName: account.displayName,
        avatarUrl: account.avatarUrl ?? existing.avatarUrl
      });
    }
  }

  const accounts = Array.from(byId.values()).sort((a, b) => {
    const order: Record<ConnectedPlatform, number> = { cropvibe: 0, whatsapp: 1, instagram: 2 };
    return order[a.platform] - order[b.platform];
  });

  const mainId = mainAccountId(user.id);
  const sharingFromAccountId =
    state.sharingFromAccountId && accounts.some((a) => a.id === state.sharingFromAccountId)
      ? state.sharingFromAccountId
      : mainId;

  const syncedPictureAccountIds = state.syncedPictureAccountIds.filter((id) => accounts.some((a) => a.id === id));
  const showLinksOnAccountIds = state.showLinksOnAccountIds.filter((id) => accounts.some((a) => a.id === id));

  const whatsappId = whatsappAccountId(user.id);
  const memoriesShareToAccountId =
    state.memoriesShareToAccountId && accounts.some((a) => a.id === state.memoriesShareToAccountId)
      ? state.memoriesShareToAccountId
      : accounts.some((a) => a.id === whatsappId)
        ? whatsappId
        : null;

  return {
    ...state,
    accounts,
    sharingFromAccountId,
    syncedPictureAccountIds,
    showLinksOnAccountIds,
    memoriesShareToAccountId
  };
}

export async function saveConnectedExperiences(state: ConnectedExperiencesState) {
  await writeState(state);
}

export async function setSharingFromAccount(user: AuthUser, accountId: string) {
  const state = await loadConnectedExperiences(user);
  if (!state.accounts.some((a) => a.id === accountId)) return state;
  const next = { ...state, sharingFromAccountId: accountId };
  await writeState(next);
  return next;
}

export async function toggleSyncedPictureAccount(user: AuthUser, accountId: string) {
  const state = await loadConnectedExperiences(user);
  const has = state.syncedPictureAccountIds.includes(accountId);
  const syncedPictureAccountIds = has
    ? state.syncedPictureAccountIds.filter((id) => id !== accountId)
    : [...state.syncedPictureAccountIds, accountId];
  const next = { ...state, syncedPictureAccountIds };
  await writeState(next);
  return next;
}

export async function syncAllAccounts(user: AuthUser) {
  const state = await loadConnectedExperiences(user);
  const next = {
    ...state,
    syncedPictureAccountIds: state.accounts.map((a) => a.id)
  };
  await writeState(next);
  return next;
}

export async function toggleShowLinksOnAccount(user: AuthUser, accountId: string) {
  const state = await loadConnectedExperiences(user);
  const has = state.showLinksOnAccountIds.includes(accountId);
  const showLinksOnAccountIds = has
    ? state.showLinksOnAccountIds.filter((id) => id !== accountId)
    : [...state.showLinksOnAccountIds, accountId];
  const next = { ...state, showLinksOnAccountIds };
  await writeState(next);
  return next;
}

export async function setCropvibeMemoriesShareEnabled(user: AuthUser, enabled: boolean) {
  const state = await loadConnectedExperiences(user);
  const whatsappId = whatsappAccountId(user.id);
  const next = {
    ...state,
    cropvibeMemoriesShareEnabled: enabled,
    memoriesShareToAccountId:
      enabled && !state.memoriesShareToAccountId && state.accounts.some((a) => a.id === whatsappId)
        ? whatsappId
        : state.memoriesShareToAccountId
  };
  await writeState(next);
  return next;
}

export async function setMemoriesShareToAccount(user: AuthUser, accountId: string) {
  const state = await loadConnectedExperiences(user);
  if (!state.accounts.some((a) => a.id === accountId)) return state;
  const next = { ...state, memoriesShareToAccountId: accountId, cropvibeMemoriesShareEnabled: true };
  await writeState(next);
  return next;
}

/** @deprecated Use setCropvibeMemoriesShareEnabled */
export async function setInstagramMemoriesEnabled(user: AuthUser, enabled: boolean) {
  return setCropvibeMemoriesShareEnabled(user, enabled);
}

export async function addLinkedAccount(user: AuthUser, platform: Exclude<ConnectedPlatform, "cropvibe">) {
  const state = await loadConnectedExperiences(user);
  const displayName = user.fullName || user.username || "Your profile";
  const id = platform === "whatsapp" ? whatsappAccountId(user.id) : instagramAccountId(user.id);

  if (state.accounts.some((a) => a.id === id)) {
    return state;
  }

  const account: ConnectedAccount = {
    id,
    platform,
    displayName,
    subtitle: platform === "whatsapp" ? CONNECTED_ACCOUNT_SUBTITLES.whatsapp : CONNECTED_ACCOUNT_SUBTITLES.instagram,
    avatarUrl: user.avatarUrl,
    linkedAt: new Date().toISOString()
  };

  const next = { ...state, accounts: [...state.accounts, account] };
  await writeState(next);
  return next;
}

export async function addManagedAvatar(user: AuthUser, name: string) {
  const state = await loadConnectedExperiences(user);
  const avatar: ManagedAvatar = {
    id: `avatar-${Date.now()}`,
    name: name.trim(),
    createdAt: new Date().toISOString()
  };
  const next = { ...state, avatars: [avatar, ...state.avatars] };
  await writeState(next);
  return next;
}

export async function removeManagedAvatar(user: AuthUser, avatarId: string) {
  const state = await loadConnectedExperiences(user);
  const next = { ...state, avatars: state.avatars.filter((a) => a.id !== avatarId) };
  await writeState(next);
  return next;
}
