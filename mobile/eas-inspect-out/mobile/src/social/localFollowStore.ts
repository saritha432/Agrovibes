import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "agrovibes.local-follow.v1";

type LocalFollowRecord = {
  id: string;
  actorName: string;
  actorKey?: string;
  targetName: string;
  targetKey?: string;
  status: "pending" | "accepted" | "declined";
  createdAt: string;
  respondedAt?: string;
  acceptedSeenByActor?: boolean;
  declinedSeenByActor?: boolean;
};

function normalizeName(value: string) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

async function readAll(): Promise<LocalFollowRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as LocalFollowRecord[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(records: LocalFollowRecord[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export async function sendLocalFollowRequest(actorName: string, targetName: string) {
  const actor = normalizeName(actorName);
  const target = normalizeName(targetName);
  if (!actor || !target) return null;

  const records = await readAll();
  const existingIdx = records.findIndex((r) => normalizeName(r.actorName) === actor && normalizeName(r.targetName) === target);
  const now = new Date().toISOString();
  if (existingIdx >= 0) {
    records[existingIdx] = { ...records[existingIdx], status: "pending", createdAt: now, respondedAt: undefined, acceptedSeenByActor: false };
    await writeAll(records);
    return records[existingIdx];
  }
  const created: LocalFollowRecord = {
    id: `lf-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    actorName: actorName.trim(),
    targetName: targetName.trim(),
    status: "pending",
    createdAt: now,
    acceptedSeenByActor: false
  };
  records.push(created);
  await writeAll(records);
  return created;
}

export async function getLocalFollowNotifications(currentUserName: string) {
  const current = normalizeName(currentUserName);
  const records = await readAll();
  const pendingRequests = records.filter((r) => normalizeName(r.targetName) === current && r.status === "pending");
  const acceptedForActor = records.filter((r) => normalizeName(r.actorName) === current && r.status === "accepted" && !r.acceptedSeenByActor);
  return { pendingRequests, acceptedForActor };
}

export async function sendLocalFollowRequestByIdentity(
  actor: { name: string; key?: string },
  target: { name: string; key?: string }
) {
  const actorName = normalizeName(actor.name);
  const targetName = normalizeName(target.name);
  const actorKey = String(actor.key || "").trim().toLowerCase();
  const targetKey = String(target.key || "").trim().toLowerCase();
  if (!actorName || !targetName) return null;
  if (actorKey && targetKey && actorKey === targetKey) return null;

  const records = await readAll();
  const existingIdx = records.findIndex((r) => {
    const sameActor = actorKey ? String(r.actorKey || "").toLowerCase() === actorKey : normalizeName(r.actorName) === actorName;
    const sameTarget = targetKey ? String(r.targetKey || "").toLowerCase() === targetKey : normalizeName(r.targetName) === targetName;
    return sameActor && sameTarget;
  });
  const now = new Date().toISOString();
  if (existingIdx >= 0) {
    records[existingIdx] = {
      ...records[existingIdx],
      actorName: actor.name.trim() || records[existingIdx].actorName,
      targetName: target.name.trim() || records[existingIdx].targetName,
      actorKey: actorKey || records[existingIdx].actorKey,
      targetKey: targetKey || records[existingIdx].targetKey,
      status: "pending",
      createdAt: now,
      respondedAt: undefined,
      acceptedSeenByActor: false,
      declinedSeenByActor: false
    };
    await writeAll(records);
    return records[existingIdx];
  }
  const created: LocalFollowRecord = {
    id: `lf-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    actorName: actor.name.trim(),
    actorKey: actorKey || undefined,
    targetName: target.name.trim(),
    targetKey: targetKey || undefined,
    status: "pending",
    createdAt: now,
    acceptedSeenByActor: false,
    declinedSeenByActor: false
  };
  records.push(created);
  await writeAll(records);
  return created;
}

export async function getLocalFollowNotificationsByIdentity(current: { name: string; key?: string }) {
  const currentName = normalizeName(current.name);
  const currentKey = String(current.key || "").trim().toLowerCase();
  const records = await readAll();
  const pendingRequests = records.filter((r) => {
    if (currentKey && r.targetKey) return String(r.targetKey).toLowerCase() === currentKey && r.status === "pending";
    return normalizeName(r.targetName) === currentName && r.status === "pending";
  });
  const acceptedForActor = records.filter((r) => {
    if (currentKey && r.actorKey) return String(r.actorKey).toLowerCase() === currentKey && r.status === "accepted" && !r.acceptedSeenByActor;
    return normalizeName(r.actorName) === currentName && r.status === "accepted" && !r.acceptedSeenByActor;
  });
  const declinedForActor = records.filter((r) => {
    if (currentKey && r.actorKey) return String(r.actorKey).toLowerCase() === currentKey && r.status === "declined" && !r.declinedSeenByActor;
    return normalizeName(r.actorName) === currentName && r.status === "declined" && !r.declinedSeenByActor;
  });
  return { pendingRequests, acceptedForActor, declinedForActor };
}

export async function getLocalFollowCountsByIdentity(current: { name: string; key?: string }) {
  const currentName = normalizeName(current.name);
  const currentKey = String(current.key || "").trim().toLowerCase();
  const records = await readAll();
  const followersCount = records.filter((r) => {
    if (currentKey && r.targetKey) return String(r.targetKey).toLowerCase() === currentKey && r.status === "accepted";
    return normalizeName(r.targetName) === currentName && r.status === "accepted";
  }).length;
  const followingCount = records.filter((r) => {
    if (currentKey && r.actorKey) return String(r.actorKey).toLowerCase() === currentKey && r.status === "accepted";
    return normalizeName(r.actorName) === currentName && r.status === "accepted";
  }).length;
  return { followersCount, followingCount };
}

export async function getLocalRelationshipMapByNames(
  current: { name: string; key?: string },
  targetNames: string[]
) {
  const currentName = normalizeName(current.name);
  const currentKey = String(current.key || "").trim().toLowerCase();
  const targets = [...new Set(targetNames.map(normalizeName).filter(Boolean))];
  const records = await readAll();
  const out: Record<string, { viewerStatus: "none" | "pending" | "accepted"; canFollowBack: boolean }> = {};

  for (const target of targets) {
    const viewerToTarget = records
      .filter((r) => {
        const actorMatch = currentKey && r.actorKey ? String(r.actorKey).toLowerCase() === currentKey : normalizeName(r.actorName) === currentName;
        const targetMatch = normalizeName(r.targetName) === target;
        return actorMatch && targetMatch;
      })
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];

    const targetToViewerAccepted = records.some((r) => {
      const actorMatch = normalizeName(r.actorName) === target;
      const targetMatch = currentKey && r.targetKey ? String(r.targetKey).toLowerCase() === currentKey : normalizeName(r.targetName) === currentName;
      return actorMatch && targetMatch && r.status === "accepted";
    });

    const viewerStatus = viewerToTarget?.status === "accepted" ? "accepted" : viewerToTarget?.status === "pending" ? "pending" : "none";
    const canFollowBack = targetToViewerAccepted && viewerStatus === "none";
    out[target] = { viewerStatus, canFollowBack };
  }

  return out;
}

export async function getLocalFollowNetworkByIdentity(current: { name: string; key?: string }) {
  const currentName = normalizeName(current.name);
  const currentKey = String(current.key || "").trim().toLowerCase();
  const records = await readAll();

  const acceptedFollowers = records.filter((r) => {
    const targetMatch = currentKey && r.targetKey ? String(r.targetKey).toLowerCase() === currentKey : normalizeName(r.targetName) === currentName;
    return targetMatch && r.status === "accepted";
  });
  const acceptedFollowing = records.filter((r) => {
    const actorMatch = currentKey && r.actorKey ? String(r.actorKey).toLowerCase() === currentKey : normalizeName(r.actorName) === currentName;
    return actorMatch && r.status === "accepted";
  });
  const pendingFollowing = records.filter((r) => {
    const actorMatch = currentKey && r.actorKey ? String(r.actorKey).toLowerCase() === currentKey : normalizeName(r.actorName) === currentName;
    return actorMatch && r.status === "pending";
  });

  const followersMap = new Map<
    string,
    {
      name: string;
      key?: string;
      viewerStatus: "none" | "pending" | "accepted";
      canFollowBack: boolean;
    }
  >();

  for (const r of acceptedFollowers) {
    const personName = String(r.actorName || "").trim();
    const personKey = String(r.actorKey || "").trim().toLowerCase() || undefined;
    const dedupeKey = personKey || `name:${normalizeName(personName)}`;

    const meAcceptedThem = acceptedFollowing.some((f) => {
      const sameTarget = personKey && f.targetKey ? String(f.targetKey).toLowerCase() === personKey : normalizeName(f.targetName) === normalizeName(personName);
      return sameTarget;
    });
    const mePendingThem = pendingFollowing.some((f) => {
      const sameTarget = personKey && f.targetKey ? String(f.targetKey).toLowerCase() === personKey : normalizeName(f.targetName) === normalizeName(personName);
      return sameTarget;
    });

    followersMap.set(dedupeKey, {
      name: personName,
      key: personKey,
      viewerStatus: meAcceptedThem ? "accepted" : mePendingThem ? "pending" : "none",
      canFollowBack: !meAcceptedThem && !mePendingThem
    });
  }

  const followingMap = new Map<
    string,
    {
      name: string;
      key?: string;
      viewerStatus: "accepted";
      canFollowBack: false;
    }
  >();
  for (const r of acceptedFollowing) {
    const personName = String(r.targetName || "").trim();
    const personKey = String(r.targetKey || "").trim().toLowerCase() || undefined;
    const dedupeKey = personKey || `name:${normalizeName(personName)}`;
    followingMap.set(dedupeKey, {
      name: personName,
      key: personKey,
      viewerStatus: "accepted",
      canFollowBack: false
    });
  }

  return {
    followers: Array.from(followersMap.values()),
    following: Array.from(followingMap.values())
  };
}

export async function removeLocalFollowByIdentity(
  actor: { name: string; key?: string },
  target: { name: string; key?: string }
) {
  const actorName = normalizeName(actor.name);
  const targetName = normalizeName(target.name);
  const actorKey = String(actor.key || "").trim().toLowerCase();
  const targetKey = String(target.key || "").trim().toLowerCase();
  const records = await readAll();
  let changed = false;

  const next = records.map((r) => {
    const sameActor = actorKey && r.actorKey ? String(r.actorKey).toLowerCase() === actorKey : normalizeName(r.actorName) === actorName;
    const sameTarget = targetKey && r.targetKey ? String(r.targetKey).toLowerCase() === targetKey : normalizeName(r.targetName) === targetName;
    if (!sameActor || !sameTarget) return r;
    if (r.status !== "accepted" && r.status !== "pending") return r;
    changed = true;
    return {
      ...r,
      status: "declined" as const,
      respondedAt: new Date().toISOString(),
      acceptedSeenByActor: true,
      declinedSeenByActor: true
    };
  });

  if (changed) {
    await writeAll(next);
  }
  return changed;
}

export async function respondLocalFollowRequest(recordId: string, action: "accept" | "decline") {
  const records = await readAll();
  const idx = records.findIndex((r) => r.id === recordId);
  if (idx < 0) return null;
  records[idx] = {
    ...records[idx],
    status: action === "accept" ? "accepted" : "declined",
    respondedAt: new Date().toISOString(),
    acceptedSeenByActor: action === "accept" ? false : true,
    declinedSeenByActor: action === "decline" ? false : true
  };
  await writeAll(records);
  return records[idx];
}

export async function markLocalAcceptedSeen(recordId: string) {
  const records = await readAll();
  const idx = records.findIndex((r) => r.id === recordId);
  if (idx < 0) return;
  records[idx] = { ...records[idx], acceptedSeenByActor: true };
  await writeAll(records);
}

export async function markLocalDeclinedSeen(recordId: string) {
  const records = await readAll();
  const idx = records.findIndex((r) => r.id === recordId);
  if (idx < 0) return;
  records[idx] = { ...records[idx], declinedSeenByActor: true };
  await writeAll(records);
}

export async function getLocalFollowCounts(currentUserName: string) {
  const current = normalizeName(currentUserName);
  const records = await readAll();
  const followersCount = records.filter((r) => normalizeName(r.targetName) === current && r.status === "accepted").length;
  const followingCount = records.filter((r) => normalizeName(r.actorName) === current && r.status === "accepted").length;
  return { followersCount, followingCount };
}

export type LocalFollowEdgeForSync = {
  localId: string;
  peerFullName: string;
  relation: "i_follow" | "follows_me";
  status: "accepted" | "pending";
};

/** Maps stored name-based follow rows into API upserts (peer matched by full_name on server). */
export async function getLocalFollowEdgesForServerSync(current: { name: string; key?: string }): Promise<LocalFollowEdgeForSync[]> {
  const currentName = normalizeName(current.name);
  const currentKey = String(current.key || "").trim().toLowerCase();
  const records = await readAll();
  const out: LocalFollowEdgeForSync[] = [];

  const iAmActor = (r: LocalFollowRecord) =>
    currentKey && r.actorKey ? String(r.actorKey).toLowerCase() === currentKey : normalizeName(r.actorName) === currentName;
  const iAmTarget = (r: LocalFollowRecord) =>
    currentKey && r.targetKey ? String(r.targetKey).toLowerCase() === currentKey : normalizeName(r.targetName) === currentName;

  for (const r of records) {
    if (r.status !== "accepted" && r.status !== "pending") continue;
    const a = iAmActor(r);
    const t = iAmTarget(r);
    if (a && !t) {
      out.push({
        localId: r.id,
        peerFullName: String(r.targetName || "").trim(),
        relation: "i_follow",
        status: r.status
      });
    } else if (t && !a) {
      out.push({
        localId: r.id,
        peerFullName: String(r.actorName || "").trim(),
        relation: "follows_me",
        status: r.status
      });
    }
  }
  return out;
}

export async function removeLocalFollowRecordsByIds(ids: string[]) {
  const idSet = new Set(ids.map(String).filter(Boolean));
  if (!idSet.size) return;
  const records = await readAll();
  const next = records.filter((r) => !idSet.has(r.id));
  await writeAll(next);
}
