import { Ionicons } from "@expo/vector-icons";
import React, { useRef } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";
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
  const swipingRef = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      // Don't steal the first touch — only claim after a clear horizontal swipe.
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        enabled && gesture.dx > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4,
      onPanResponderGrant: () => {
        swipingRef.current = true;
      },
      onPanResponderMove: (_evt, gesture) => {
        if (!enabled) return;
        translateX.setValue(Math.max(0, Math.min(gesture.dx, SWIPE_MAX)));
      },
      onPanResponderRelease: (_evt, gesture) => {
        const wasSwipe = swipingRef.current;
        swipingRef.current = false;
        if (!enabled) return;
        if (wasSwipe && gesture.dx >= SWIPE_REPLY_THRESHOLD) onReply();
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 20 }).start();
      },
      onPanResponderTerminate: () => {
        swipingRef.current = false;
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
      <Animated.View style={[styles.replyHint, { opacity: replyOpacity }]} pointerEvents="none">
        <Ionicons name="arrow-undo" size={18} color={APP_LIME} />
      </Animated.View>
      <Animated.View style={styles.slideArea} {...panResponder.panHandlers}>
        <Pressable
          disabled={!enabled}
          delayLongPress={LONG_PRESS_MS}
          onLongPress={() => {
            if (!enabled || swipingRef.current) return;
            onLongPress();
          }}
        >
          <Animated.View style={[contentStyle, { transform: [{ translateX }] }]}>{children}</Animated.View>
        </Pressable>
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
