import { Ionicons } from "@expo/vector-icons";
import React, { useRef } from "react";
import { Animated, PanResponder, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { APP_LIME } from "../../theme/appColors";

const SWIPE_REPLY_THRESHOLD = 56;
const SWIPE_MAX = 72;
const LONG_PRESS_MS = 320;

type Props = {
  children: React.ReactNode;
  rowStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
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
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      // Don't steal the first touch — only claim after a clear horizontal swipe.
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        enabled && gesture.dx > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4,
      onPanResponderGrant: () => {
        if (!enabled) return;
        longPressFiredRef.current = false;
        clearLongPressTimer();
        longPressTimerRef.current = setTimeout(() => {
          longPressTimerRef.current = null;
          longPressFiredRef.current = true;
          onLongPress();
        }, LONG_PRESS_MS);
      },
      onPanResponderMove: (_evt, gesture) => {
        if (!enabled) return;
        if (Math.abs(gesture.dx) > 8 || Math.abs(gesture.dy) > 8) {
          clearLongPressTimer();
        }
        translateX.setValue(Math.max(0, Math.min(gesture.dx, SWIPE_MAX)));
      },
      onPanResponderRelease: (_evt, gesture) => {
        clearLongPressTimer();
        if (!enabled) return;
        if (!longPressFiredRef.current && gesture.dx >= SWIPE_REPLY_THRESHOLD) onReply();
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 20 }).start();
      },
      onPanResponderTerminate: () => {
        clearLongPressTimer();
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
        <Animated.View style={[contentStyle, { transform: [{ translateX }] }]}>{children}</Animated.View>
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
