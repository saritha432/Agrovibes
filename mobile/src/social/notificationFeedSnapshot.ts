import { fetchSocialNotifications } from "../services/api";
import { getLocalFollowNotificationsByIdentity } from "./localFollowStore";
import { getLocalEngagementNotificationsForViewer } from "./localEngagementStore";

/** Same merge as AppTopBar `loadNotifications` (social + local follow + local engagement). */
export type NotificationFeedSnapshot = {
  pending: any[];
  accepted: any[];
  declined: any[];
  postLikes: any[];
  postComments: any[];
  liveStarts: any[];
};

export async function fetchNotificationFeedSnapshot(params: {
  token: string | null;
  userFullName: string;
  userEmail?: string | null;
  userId?: string | number | null;
}): Promise<NotificationFeedSnapshot> {
  const { token, userFullName, userEmail, userId } = params;
  const identity = { name: userFullName, key: userEmail || String(userId || "") };

  const [local, localEng, remote] = await Promise.all([
    getLocalFollowNotificationsByIdentity(identity),
    getLocalEngagementNotificationsForViewer(userFullName),
    token
      ? fetchSocialNotifications(token).catch(() => null)
      : Promise.resolve(null)
  ]);

  const remoteReq = remote?.followRequests || [];
  const remoteAccepted = remote?.followAccepted || [];
  const remotePostLikes = remote?.postLikes || [];
  const remotePostComments = remote?.postComments || [];
  const remoteLiveStarts = remote?.liveStarts || [];

  const mergedPending = [
    ...(remoteReq || []),
    ...(local.pendingRequests || []).map((n) => ({ ...n, isLocal: true, actorName: n.actorName, followId: n.id, id: n.id }))
  ];
  const accepted = [
    ...(remoteAccepted || []),
    ...(local.acceptedForActor || []).map((n) => ({ ...n, isLocal: true, actorName: n.targetName, id: n.id }))
  ];
  const declined = [...(local.declinedForActor || []).map((n) => ({ ...n, isLocal: true, actorName: n.targetName, id: n.id }))];
  const postLikes = [
    ...remotePostLikes,
    ...localEng.postLikes.map((n) => ({
      ...n,
      isLocal: true,
      id: n.id,
      type: "post_like",
      postIsReel: n.isReel,
      postId: n.postId,
      postThumbnailUrl: n.postThumbnailUrl,
      postImageUrl: n.postImageUrl,
      postVideoUrl: n.postVideoUrl
    }))
  ];
  const postComments = [
    ...remotePostComments,
    ...localEng.postComments.map((n) => ({
      ...n,
      isLocal: true,
      id: n.id,
      type: n.type,
      postIsReel: n.isReel,
      postId: n.postId,
      postThumbnailUrl: n.postThumbnailUrl,
      postImageUrl: n.postImageUrl,
      postVideoUrl: n.postVideoUrl,
      commentExcerpt: n.commentExcerpt
    }))
  ];

  return { pending: mergedPending, accepted, declined, postLikes, postComments, liveStarts: remoteLiveStarts };
}

export function flattenNotificationFeedSnapshot(snap: NotificationFeedSnapshot): any[] {
  return [...snap.pending, ...snap.accepted, ...snap.declined, ...snap.postLikes, ...snap.postComments, ...snap.liveStarts];
}

/** Badge = notifications newer than when the user last closed the panel (not full history). */
export function countUnreadSocialNotifications(entries: any[], lastSeenMs: number): number {
  if (!Number.isFinite(lastSeenMs) || lastSeenMs <= 0) return 0;
  return entries.filter((n) => {
    const ts = Date.parse(String(n?.createdAt || ""));
    return Number.isFinite(ts) && ts > lastSeenMs;
  }).length;
}
