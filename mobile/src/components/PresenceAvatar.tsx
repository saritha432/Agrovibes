import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { useIsOnline } from "../context/PresenceContext";
import { APP_BLACK, APP_LIME } from "../theme/appColors";
import { UserAvatar } from "./UserAvatar";

type AvatarProps = React.ComponentProps<typeof UserAvatar>;

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
  style
}: {
  userId?: number | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { user } = useAuth();
  const online = useIsOnline(userId);
  const id = parseUserId(userId);
  const isSelf = id > 0 && id === parseUserId(user?.id);
  if (!online || isSelf) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityLabel="Active now"
      style={[
        styles.dot,
        { width: size, height: size, borderRadius: size / 2 },
        style
      ]}
    />
  );
}

export function PresenceAvatar({
  userId,
  style,
  ...avatarProps
}: AvatarProps & { userId?: number | null }) {
  const size = avatarProps.size;
  return (
    <View style={[{ width: size, height: size }, style]}>
      <UserAvatar {...avatarProps} />
      <PresenceDot userId={userId} size={dotSizeFor(size)} />
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    position: "absolute",
    right: 0,
    bottom: 0,
    backgroundColor: APP_LIME,
    borderWidth: 2,
    borderColor: APP_BLACK,
    zIndex: 2
  }
});
