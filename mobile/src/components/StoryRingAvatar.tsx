import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { APP_LIME } from "../theme/appColors";
import { UserAvatar } from "./UserAvatar";
import {
  queueOpenUserStories,
  subscribeStoryActivity,
  userHasActiveStory,
  userHasUnviewedStory
} from "../navigation/storyActivityBridge";

type Props = {
  uri?: string | null;
  name: string;
  size: number;
  userId?: number | null;
  userName?: string | null;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  fallbackBackgroundColor?: string;
  initialsColor?: string;
  colorizeInitials?: boolean;
  /** When there is no active story, or as long-press. */
  onPressFallback?: () => void;
  /** Force-disable story open (e.g. own avatar preview on profile). */
  disableStoryOpen?: boolean;
  accessibilityLabel?: string;
};

export function StoryRingAvatar({
  uri,
  name,
  size,
  userId,
  userName,
  borderRadius,
  style,
  fallbackBackgroundColor,
  initialsColor,
  colorizeInitials,
  onPressFallback,
  disableStoryOpen,
  accessibilityLabel
}: Props) {
  const [, bump] = useState(0);
  useEffect(() => subscribeStoryActivity(() => bump((n) => n + 1)), []);

  const hasStory = userHasActiveStory(userId, userName || name);
  const unviewed = hasStory && userHasUnviewedStory(userId, userName || name);
  const ringPad = hasStory ? Math.max(2, Math.round(size * 0.06)) : 0;
  const outer = size + ringPad * 2;
  const avatarRadius = borderRadius ?? size / 2;
  const outerRadius = avatarRadius + ringPad;

  const onPress = () => {
    if (hasStory && !disableStoryOpen) {
      queueOpenUserStories({ userId, userName: userName || name });
      return;
    }
    onPressFallback?.();
  };

  const avatar = (
    <UserAvatar
      uri={uri}
      name={name}
      size={size}
      borderRadius={avatarRadius}
      fallbackBackgroundColor={fallbackBackgroundColor}
      initialsColor={initialsColor}
      colorizeInitials={colorizeInitials}
    />
  );

  if (!onPressFallback && !(hasStory && !disableStoryOpen)) {
    return (
      <View style={style}>
        <View
          style={[
            styles.ring,
            {
              width: outer,
              height: outer,
              borderRadius: outerRadius,
              padding: ringPad,
              backgroundColor: hasStory ? (unviewed ? APP_LIME : "rgba(255,255,255,0.28)") : "transparent"
            }
          ]}
        >
          <View
            style={{
              width: size,
              height: size,
              borderRadius: avatarRadius,
              overflow: "hidden",
              backgroundColor: "#111"
            }}
          >
            {avatar}
          </View>
        </View>
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={style}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || name}
    >
      <View
        style={[
          styles.ring,
          {
            width: outer,
            height: outer,
            borderRadius: outerRadius,
            padding: ringPad,
            backgroundColor: hasStory ? (unviewed ? APP_LIME : "rgba(255,255,255,0.28)") : "transparent"
          }
        ]}
      >
        <View
          style={{
            width: size,
            height: size,
            borderRadius: avatarRadius,
            overflow: "hidden",
            backgroundColor: "#111"
          }}
        >
          {avatar}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ring: {
    alignItems: "center",
    justifyContent: "center"
  }
});
