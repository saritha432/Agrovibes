import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { APP_BLACK, APP_LIME } from "../theme/appColors";
import { UserAvatar } from "./UserAvatar";

export type ResharerPerson = {
  userId?: number;
  fullName: string;
  avatarUrl?: string | null;
};

type RepostAttributionProps = {
  /** Latest resharers (newest first). Shows up to 4 avatars. */
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

type AvatarLayout = {
  left: number;
  top: number;
};

/** Straight row for 1–2; upward arch for 3–4 (edges lower, center higher). */
function layoutAvatars(count: number, size: number, gap: number, isReel: boolean): { positions: AvatarLayout[]; width: number; height: number } {
  const span = size + gap;
  if (count < 3) {
    const width = count * size + Math.max(0, count - 1) * gap;
    return {
      positions: Array.from({ length: count }, (_, i) => ({ left: i * span, top: 0 })),
      width,
      height: size
    };
  }

  const archLift = isReel ? 14 : 11;
  const width = count * size + (count - 1) * gap;
  const positions: AvatarLayout[] = [];

  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const left = i * span;
    // Parabola: edges sit lower, center rises on the arch.
    const top = Math.round(archLift * (1 - 4 * t * (1 - t)));
    positions.push({ left, top });
  }

  return {
    positions,
    width,
    height: size + archLift
  };
}

/**
 * Reshare mark: resharer avatars (arch when 3+) with lime ↻ badge on each.
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

  const size = isReel ? 34 : 28;
  const badge = isReel ? 14 : 12;
  const icon = isReel ? 8 : 7;
  const borderW = isReel ? 2 : 2;
  const gap = isReel ? 8 : 6;
  const ringColor = isReel ? "#000" : "#fff";

  const layout = useMemo(
    () => layoutAvatars(list.length, size, gap, isReel),
    [gap, isReel, list.length, size]
  );

  if (!list.length) return null;

  const action = String(actionLabel || "reposted").trim() || "reposted";
  const a11y = `${list.map((p) => p.fullName).join(", ")} ${action}`;
  const useArch = list.length >= 3;

  return (
    <Pressable
      style={[styles.wrap, isReel ? styles.wrapReel : styles.wrapFeed]}
      onPress={onPress}
      disabled={!onPress && !onPressPerson}
      hitSlop={10}
      accessibilityRole={onPress || onPressPerson ? "button" : undefined}
      accessibilityLabel={a11y}
    >
      <View
        style={[
          useArch ? styles.stackArch : styles.stackRow,
          useArch
            ? { width: layout.width, height: layout.height }
            : { gap }
        ]}
      >
        {list.map((person, index) => {
          const name = String(person.fullName || "").trim() || "Someone";
          const pos = layout.positions[index];
          return (
            <Pressable
              key={`${person.userId || name}-${index}`}
              style={[
                styles.avatarShell,
                useArch ? styles.avatarArch : null,
                {
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  borderWidth: borderW,
                  borderColor: ringColor,
                  backgroundColor: ringColor,
                  ...(useArch ? { left: pos.left, top: pos.top } : null)
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
                size={size - borderW * 2}
                borderRadius={(size - borderW * 2) / 2}
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
                    borderColor: ringColor
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
    marginBottom: 12
  },
  wrapFeed: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4
  },
  stackRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  stackArch: {
    position: "relative"
  },
  avatarShell: {
    alignItems: "center",
    justifyContent: "center"
  },
  avatarArch: {
    position: "absolute"
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
