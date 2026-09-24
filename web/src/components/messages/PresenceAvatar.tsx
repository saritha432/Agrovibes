import "./PresenceAvatar.css";
import { useAuth } from "../../auth/AuthContext";
import { useIsOnline } from "../../context/PresenceContext";
import { UserAvatar } from "./UserAvatar";

function parseUserId(value: number | null | undefined) {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : 0;
}

function dotSizeFor(avatarSize: number) {
  return Math.max(10, Math.round(avatarSize * 0.22));
}

export function PresenceDot({
  userId,
  size = 12,
  className
}: {
  userId?: number | null;
  size?: number;
  className?: string;
}) {
  const { user } = useAuth();
  const online = useIsOnline(userId);
  const id = parseUserId(userId);
  const isSelf = id > 0 && id === parseUserId(user?.id);
  if (!online || isSelf) return null;
  return (
    <span
      className={className ? `presence-dot ${className}` : "presence-dot"}
      style={{ width: size, height: size }}
      title="Active now"
      aria-label="Active now"
    />
  );
}

export function PresenceAvatar({
  userId,
  uri,
  name,
  size = 48
}: {
  userId?: number | null;
  uri?: string | null;
  name: string;
  size?: number;
}) {
  return (
    <span className="presence-avatar" style={{ width: size, height: size }}>
      <UserAvatar uri={uri} name={name} size={size} />
      <PresenceDot userId={userId} size={dotSizeFor(size)} />
    </span>
  );
}
