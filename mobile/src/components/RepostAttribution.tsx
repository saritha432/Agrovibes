import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { APP_BLACK, APP_LIME } from "../theme/appColors";
import { UserAvatar } from "./UserAvatar";

export type ResharerPerson = {
  userId?: number;
  fullName: string;
  avatarUrl?: string | null;
};

type RepostAttributionProps = {
  /** Latest resharers (newest first). Shows up to 4 overlapping circles. */
  people?: ResharerPerson[];
  /** Fallback single person when `people` is empty. */
  byUserName?: string;
  byAvatarUrl?: string | null;
  /** Kept for callers / a11y; not shown in UI (Instagram-style). */
  actionLabel?: string;
  onPress?: () => void;
  onPressPerson?: (person: ResharerPerson) => void;
  /** Reel overlay on dark video vs light feed card */
  variant?: "reel" | "feed";
};

const MAX_SHOWN = 4;

/**
 * Instagram-style reshare mark: overlapping small circular avatars (latest sharers)
 * with lime ↻ badge — no “Name reposted” text.
 */
export function RepostAttribution({
  people,
  byUserName,
  byAvatarUrl,
  actionLabel = "reposted",
  onPress,
  onPressPerson,
  variant = "reel"
}: RepostAttributionProps) {
  const isReel = variant === "reel";
  const list: ResharerPerson[] = (people?.length
    ? people
    : byUserName
      ? [{ fullName: byUserName, avatarUrl: byAvatarUrl }]
      : []
  )
    .filter((p) => String(p.fullName || "").trim())
    .slice(0, MAX_SHOWN);

  if (!list.length) return null;

  const size = isReel ? 34 : 28;
  const badge = isReel ? 14 : 12;
  const icon = isReel ? 8 : 7;
  const overlap = Math.round(size * 0.38);
  const stackWidth = size + (list.length - 1) * (size - overlap);
  const action = String(actionLabel || "reposted").trim() || "reposted";
  const a11y = `${list.map((p) => p.fullName).join(", ")} ${action}`;

  return (
    <Pressable
      style={[styles.wrap, isReel ? styles.wrapReel : styles.wrapFeed]}
      onPress={onPress}
      disabled={!onPress && !onPressPerson}
      hitSlop={10}
      accessibilityRole={onPress || onPressPerson ? "button" : undefined}
      accessibilityLabel={a11y}
    >
      <View style={[styles.stack, { width: stackWidth, height: size }]}>
        {list.map((person, index) => {
          const name = String(person.fullName || "").trim() || "Someone";
          return (
            <Pressable
              key={`${person.userId || name}-${index}`}
              style={[
                styles.avatarShell,
                {
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  left: index * (size - overlap),
                  zIndex: list.length - index
                }
              ]}
              onPress={() => {
                if (onPressPerson) onPressPerson(person);
                else onPress?.();
              }}
              disabled={!onPressPerson && !onPress}
              hitSlop={4}
            >
              <UserAvatar
                uri={person.avatarUrl}
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
                    borderWidth: isReel ? 2 : 1.5,
                    borderColor: isReel ? "#000" : "#fff"
                  }
                ]}
              >
                <Ionicons name="repeat" size={icon} color={APP_BLACK} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: "flex-start"
  },
  wrapReel: {
    marginBottom: 10
  },
  wrapFeed: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4
  },
  stack: {
    position: "relative"
  },
  avatarShell: {
    position: "absolute",
    top: 0
  },
  badge: {
    position: "absolute",
    right: -1,
    bottom: -1,
    backgroundColor: APP_LIME,
    alignItems: "center",
    justifyContent: "center"
  }
});
