import React from "react";
import { UserAvatar } from "../UserAvatar";

export function AccountCenterAvatar({ label, avatarUrl }: { label: string; avatarUrl?: string | null }) {
  return <UserAvatar uri={avatarUrl} name={label || "?"} size={40} borderRadius={20} />;
}
