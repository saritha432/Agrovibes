import { useEffect } from "react";
import { useNotificationPanel } from "../context/NotificationPanelContext";
import { NotificationList } from "../components/notifications/NotificationList";
import "./NotificationsPage.css";

export function NotificationsPage() {
  const {
    items,
    followBackIds,
    respond,
    followBack,
    dismiss,
    activityLabel,
    loadNotifications
  } = useNotificationPanel();

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  return (
    <div className="notifications-page">
      <header className="notifications-page__head">
        <h1>Notifications</h1>
      </header>
      <NotificationList
        items={items}
        followBackIds={followBackIds}
        onRespond={respond}
        onFollowBack={followBack}
        onDismiss={dismiss}
        activityLabel={activityLabel}
      />
    </div>
  );
}
