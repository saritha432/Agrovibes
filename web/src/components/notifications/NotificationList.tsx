import type { SocialNotificationItem, SocialPostActivityNotification } from "../../api/social";
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
        if (item.kind === "pending") {
          const req = n as SocialNotificationItem;
          return (
            <div key={item.key} className="notification-list__row">
              <p>
                <strong>{req.actorName}</strong> requested to follow you
              </p>
              <div className="notification-list__actions">
                <button type="button" className="notification-list__accept" onClick={() => void onRespond(req, "accept")}>
                  Accept
                </button>
                <button type="button" className="notification-list__decline" onClick={() => void onRespond(req, "decline")}>
                  Decline
                </button>
              </div>
            </div>
          );
        }
        if (item.kind === "accepted") {
          const acc = n as SocialNotificationItem;
          const fb = followBackIds[acc.actorId] || "none";
          return (
            <div key={item.key} className="notification-list__row">
              <p>
                <strong>{acc.actorName}</strong> started following you
              </p>
              <div className="notification-list__actions">
                {fb === "accepted" ? (
                  <span className="notification-list__pill">Following</span>
                ) : fb === "pending" ? (
                  <span className="notification-list__pill">Requested</span>
                ) : (
                  <button type="button" className="notification-list__follow-back" onClick={() => void onFollowBack(acc.actorId)}>
                    Follow back
                  </button>
                )}
                <button type="button" className="notification-list__dismiss" onClick={() => onDismiss(acc)}>
                  Dismiss
                </button>
              </div>
            </div>
          );
        }
        const act = n as SocialPostActivityNotification;
        return (
          <div key={item.key} className="notification-list__row">
            <p>{activityLabel(act)}</p>
            <div className="notification-list__actions">
              <button type="button" className="notification-list__dismiss" onClick={() => onDismiss(act)}>
                Dismiss
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
