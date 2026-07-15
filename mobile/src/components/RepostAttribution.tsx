import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { APP_BLACK, APP_LIME } from "../theme/appColors";
import { UserAvatar } from "./UserAvatar";

type RepostAttributionProps = {
  byUserName: string;
  byAvatarUrl?: string | null;
  /** Kept for callers / a11y; not shown in UI (Instagram-style). */
  actionLabel?: string;
  onPress?: () => void;
  /** Reel overlay on dark video vs light feed card */
  variant?: "reel" | "feed";
};

/**
 * Instagram-style repost mark: large avatar with lemon-yellow ↻ badge — no “Name reposted” text.
 */
export function RepostAttribution({
  byUserName,
  byAvatarUrl,
  actionLabel = "reposted",
  onPress,
  variant = "reel"
}: RepostAttributionProps) {
  const isReel = variant === "reel";
  const name = String(byUserName || "").trim() || "Someone";
  const action = String(actionLabel || "reposted").trim() || "reposted";
  const size = isReel ? 52 : 40;
  const badge = isReel ? 22 : 18;
  const icon = isReel ? 12 : 11;

  return (
    <Pressable
      style={[styles.wrap, isReel ? styles.wrapReel : styles.wrapFeed]}
      onPress={onPress}
      disabled={!onPress}
      hitSlop={10}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${name} ${action}`}
    >
      <View style={[styles.avatarShell, { width: size, height: size, borderRadius: size / 2 }]}>
        <UserAvatar
          uri={byAvatarUrl}
          name={name}
          size={size}
          borderRadius={size / 2}
          fallbackBackgroundColor={isReel ? "rgba(255,255,255,0.22)" : "#d1d5db"}
          initialsColor={isReel ? "#fff" : "#374151"}
        />
        <View
          style={[
            styles.badge,
            {
              width: badge,
              height: badge,
              borderRadius: badge / 2,
              borderWidth: isReel ? 2.5 : 2,
              borderColor: isReel ? "#000" : "#fff"
            }
          ]}
        >
          <Ionicons name="repeat" size={icon} color={APP_BLACK} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: "flex-start"
  },
  wrapReel: {
    marginBottom: 12
  },
  wrapFeed: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4
  },
  avatarShell: {
    position: "relative"
  },
  badge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    backgroundColor: APP_LIME,
    alignItems: "center",
    justifyContent: "center"
  }
});
