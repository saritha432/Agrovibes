import { Ionicons } from "@expo/vector-icons";
import React, { useRef } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { APP_LIME } from "../../theme/appColors";

const SWIPE_REPLY_THRESHOLD = 56;
const SWIPE_MAX = 72;

type Props = {
  children: React.ReactNode;
  rowStyle?: ViewStyle;
  contentStyle?: ViewStyle;
  onReply: () => void;
  onLongPress: () => void;
  enabled?: boolean;
};

export function SwipeReplyMessageRow({
  children,
  rowStyle,
  contentStyle,
  onReply,
  onLongPress,
  enabled = true
}: Props) {
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        enabled && gesture.dx > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
      onPanResponderMove: (_evt, gesture) => {
        if (!enabled) return;
        translateX.setValue(Math.max(0, Math.min(gesture.dx, SWIPE_MAX)));
      },
      onPanResponderRelease: (_evt, gesture) => {
        if (!enabled) return;
        if (gesture.dx >= SWIPE_REPLY_THRESHOLD) onReply();
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 20 }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
      }
    })
  ).current;

  const replyOpacity = translateX.interpolate({
    inputRange: [0, SWIPE_REPLY_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: "clamp"
  });

  return (
    <View style={[styles.wrap, rowStyle]}>
      <Animated.View style={[styles.replyHint, { opacity: replyOpacity }]}>
        <Ionicons name="arrow-undo" size={18} color={APP_LIME} />
      </Animated.View>
      <Animated.View style={styles.slideArea} {...panResponder.panHandlers}>
        <Animated.View style={{ transform: [{ translateX }] }}>
          <Pressable
            style={contentStyle}
            onLongPress={enabled ? onLongPress : undefined}
            delayLongPress={280}
          >
            {children}
          </Pressable>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "relative", width: "100%" },
  slideArea: { flex: 1, width: "100%" },
  replyHint: {
    position: "absolute",
    left: 4,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    width: 28
  }
});
