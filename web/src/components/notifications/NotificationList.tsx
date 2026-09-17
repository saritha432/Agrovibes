import { Link } from "react-router-dom";
import type { SocialNotificationItem, SocialPostActivityNotification } from "../../api/social";
import { UserAvatar } from "../messages/UserAvatar";
import "./NotificationList.css";

export type NotificationFeedItem = {
  key: string;
  kind: string;
  createdAt: string;
  entry: SocialNotificationItem | SocialPostActivityNotification;
};

type Props = {
  items: NotificationFeedItem[];
  followBackIds: Record<number, "none" | "pending" | "accepted">;
  onRespond: (entry: SocialNotificationItem, action: "accept" | "decline") => void;
  onFollowBack: (actorId: number) => void;
  onDismiss: (entry: SocialNotificationItem | SocialPostActivityNotification) => void;
  activityLabel: (entry: SocialPostActivityNotification) => string;
};

function relativeTimeLabel(iso: string) {
  const ts = Date.parse(iso || "");
  if (!Number.isFinite(ts)) return "";
  const diff = Math.max(0, Date.now() - ts);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

import { webProfilePath } from "../../utils/profilePath";

function profilePath(actorId: number, viewerId?: number | null) {
  return webProfilePath(actorId, viewerId);
}

function postPath(entry: SocialPostActivityNotification) {
  const postId = Number(entry.postId);
  if (!Number.isFinite(postId) || postId <= 0) return profilePath(entry.actorId);
  if (entry.postIsReel || String(entry.type || "").startsWith("live_")) return `/watch/${postId}`;
  return `/profile/${entry.actorId}`;
}

function postThumb(entry: SocialPostActivityNotification) {
  return String(entry.postThumbnailUrl || entry.postImageUrl || "").trim() || null;
}

export function NotificationList({
  items,
  followBackIds,
  onRespond,
  onFollowBack,
  onDismiss,
  activityLabel
}: Props) {
  if (items.length === 0) {
    return <p className="notification-list__empty">No notifications yet.</p>;
  }

  return (
    <div className="notification-list">
      {items.map((item) => {
        const n = item.entry;
        const actorId = Number(n.actorId);
        const actorName = n.actorName || "Someone";
        const avatarUrl = "actorAvatarUrl" in n ? n.actorAvatarUrl : null;
        const toProfile = profilePath(actorId);

        if (item.kind === "pending") {
          const req = n as SocialNotificationItem;
          return (
            <div key={item.key} className="notification-list__row">
              {toProfile ? (
                <Link to={toProfile} className="notification-list__avatar-link">
                  <UserAvatar uri={avatarUrl} name={actorName} size={44} />
                </Link>
              ) : (
                <UserAvatar uri={avatarUrl} name={actorName} size={44} />
              )}
              <div className="notification-list__body">
                <p>
                  <strong>{actorName}</strong> requested to follow you
                </p>
                <time>{relativeTimeLabel(item.createdAt)}</time>
                <div className="notification-list__actions">
                  <button type="button" className="notification-list__accept" onClick={() => void onRespond(req, "accept")}>
                    Accept
                  </button>
                  <button type="button" className="notification-list__decline" onClick={() => void onRespond(req, "decline")}>
                    Decline
                  </button>
                </div>
              </div>
            </div>
          );
        }

        if (item.kind === "accepted") {
          const acc = n as SocialNotificationItem;
          return (
            <div key={item.key} className="notification-list__row">
              {toProfile ? (
                <Link to={toProfile} className="notification-list__avatar-link">
                  <UserAvatar uri={avatarUrl} name={actorName} size={44} />
                </Link>
              ) : (
                <UserAvatar uri={avatarUrl} name={actorName} size={44} />
              )}
              <div className="notification-list__body">
                <p>
                  <strong>{acc.actorName}</strong> accepted your follow request
                </p>
                <time>{relativeTimeLabel(item.createdAt)}</time>
              </div>
              <button type="button" className="notification-list__dismiss" onClick={() => onDismiss(acc)}>
                Dismiss
              </button>
            </div>
          );
        }

        if (item.kind === "new_follow") {
          const follow = n as SocialNotificationItem;
          const fb = followBackIds[follow.actorId] || "none";
          return (
            <div key={item.key} className="notification-list__row">
              {toProfile ? (
                <Link to={toProfile} className="notification-list__avatar-link">
                  <UserAvatar uri={avatarUrl} name={actorName} size={44} />
                </Link>
              ) : (
                <UserAvatar uri={avatarUrl} name={actorName} size={44} />
              )}
              <div className="notification-list__body">
                <p>
                  <strong>{follow.actorName}</strong> started following you
                </p>
                <time>{relativeTimeLabel(item.createdAt)}</time>
              </div>
              <div className="notification-list__actions">
                {fb === "accepted" ? (
                  <span className="notification-list__pill">Following</span>
                ) : fb === "pending" ? (
                  <span className="notification-list__pill">Requested</span>
                ) : (
                  <button type="button" className="notification-list__follow-back" onClick={() => void onFollowBack(follow.actorId)}>
                    Follow back
                  </button>
                )}
              </div>
            </div>
          );
        }

        const act = n as SocialPostActivityNotification;
        const thumb = postThumb(act);
        const dest = postPath(act);
        return (
          <div key={item.key} className="notification-list__row">
            {toProfile ? (
              <Link to={toProfile} className="notification-list__avatar-link">
                <UserAvatar uri={avatarUrl} name={actorName} size={44} />
              </Link>
            ) : (
              <UserAvatar uri={avatarUrl} name={actorName} size={44} />
            )}
            <div className="notification-list__body">
              {dest ? (
                <Link to={dest} className="notification-list__copy">
                  {activityLabel(act)}
                </Link>
              ) : (
                <p>{activityLabel(act)}</p>
              )}
              <time>{relativeTimeLabel(item.createdAt)}</time>
            </div>
            {thumb && dest ? (
              <Link to={dest} className="notification-list__thumb">
                <img src={thumb} alt="" />
              </Link>
            ) : (
              <button type="button" className="notification-list__dismiss" onClick={() => onDismiss(act)}>
                Dismiss
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
