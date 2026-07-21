import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle
} from "react-native";

export type SwipeAction = {
  key: string;
  label: string;
  backgroundColor: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
};

const ACTION_WIDTH = 72;
const OPEN_SPRING = { tension: 180, friction: 22, useNativeDriver: true as const };
const CLOSE_SPRING = { tension: 200, friction: 24, useNativeDriver: true as const };

/** Close any previously open swipe row when another opens. */
let closeActiveSwipeRow: (() => void) | null = null;

type SwipeActionsRowProps = {
  children: React.ReactNode;
  actions: SwipeAction[];
  style?: ViewStyle;
  onSwipeActiveChange?: (active: boolean) => void;
};

function isHorizontalSwipe(dx: number, dy: number, open: boolean) {
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  if (absDx < 4) return false;
  if (absDx <= absDy * 0.85) return false;
  if (!open && dx > 0) return false;
  return true;
}

/** Swipe left anywhere on the row to reveal actions (Instagram-style). */
export function SwipeActionsRow({ children, actions, style, onSwipeActiveChange }: SwipeActionsRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const openRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const openWidth = Math.max(1, actions.length) * ACTION_WIDTH;

  const handlersRef = useRef({
    openWidth,
    onSwipeActiveChange,
    claimAsActive: () => {},
    snapOpen: () => {},
    snapClosed: () => {},
    clampX: (v: number) => v
  });

  const setDragging = useCallback((active: boolean) => {
    if (draggingRef.current === active) return;
    draggingRef.current = active;
    handlersRef.current.onSwipeActiveChange?.(active);
  }, []);

  const snapOpen = useCallback(() => {
    openRef.current = true;
    setIsOpen(true);
    Animated.spring(translateX, { ...OPEN_SPRING, toValue: -openWidth }).start(() => setDragging(false));
  }, [openWidth, setDragging, translateX]);

  const snapClosed = useCallback(() => {
    openRef.current = false;
    setIsOpen(false);
    Animated.spring(translateX, { ...CLOSE_SPRING, toValue: 0 }).start(() => setDragging(false));
  }, [setDragging, translateX]);

  const snapClosedImmediate = useCallback(() => {
    openRef.current = false;
    setIsOpen(false);
    setDragging(false);
    translateX.setValue(0);
  }, [setDragging, translateX]);

  const clampX = useCallback(
    (value: number) => {
      if (value > 0) return value * 0.18;
      if (value < -openWidth) {
        const over = value + openWidth;
        return -openWidth + over * 0.22;
      }
      return value;
    },
    [openWidth]
  );

  const claimAsActive = useCallback(() => {
    if (closeActiveSwipeRow && closeActiveSwipeRow !== snapClosed) {
      closeActiveSwipeRow();
    }
    closeActiveSwipeRow = snapClosed;
  }, [snapClosed]);

  handlersRef.current = {
    openWidth,
    onSwipeActiveChange,
    claimAsActive,
    snapOpen,
    snapClosed,
    clampX
  };

  useEffect(() => {
    return () => {
      if (closeActiveSwipeRow === snapClosed) closeActiveSwipeRow = null;
      setDragging(false);
    };
  }, [setDragging, snapClosed]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => openRef.current,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_evt, g) => isHorizontalSwipe(g.dx, g.dy, openRef.current),
        onMoveShouldSetPanResponderCapture: (_evt, g) => isHorizontalSwipe(g.dx, g.dy, openRef.current),
        onPanResponderTerminationRequest: () => !draggingRef.current,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: () => {
          handlersRef.current.claimAsActive();
          if (!draggingRef.current) {
            draggingRef.current = true;
            handlersRef.current.onSwipeActiveChange?.(true);
          }
          startXRef.current = openRef.current ? -handlersRef.current.openWidth : 0;
          translateX.stopAnimation((value) => {
            startXRef.current = typeof value === "number" ? value : startXRef.current;
          });
        },
        onPanResponderMove: (_evt, g) => {
          translateX.setValue(handlersRef.current.clampX(startXRef.current + g.dx));
        },
        onPanResponderRelease: (_evt, g) => {
          const { openWidth: width, snapOpen: open, snapClosed: close, claimAsActive: claim } =
            handlersRef.current;
          const projected = startXRef.current + g.dx + g.vx * 90;
          if (projected < -width * 0.35 || (g.vx < -0.55 && g.dx < -8)) {
            claim();
            open();
          } else {
            if (closeActiveSwipeRow === close) closeActiveSwipeRow = null;
            close();
          }
        },
        onPanResponderTerminate: () => {
          const close = handlersRef.current.snapClosed;
          if (closeActiveSwipeRow === close) closeActiveSwipeRow = null;
          close();
        }
      }),
    [translateX]
  );

  if (!actions.length) {
    return <View style={style}>{children}</View>;
  }

  const actionsOpacity = translateX.interpolate({
    inputRange: [-openWidth, -12, 0],
    outputRange: [1, 0.55, 0],
    extrapolate: "clamp"
  });

  return (
    <View style={[styles.shell, style]} collapsable={false} {...panResponder.panHandlers}>
      <View style={styles.actionsTrack} pointerEvents="box-none">
        <Animated.View style={[styles.actionsRow, { width: openWidth, opacity: actionsOpacity }]}>
          {actions.map((action) => (
            <Pressable
              key={action.key}
              style={[styles.actionBtn, { backgroundColor: action.backgroundColor, width: ACTION_WIDTH }]}
              onPress={() => {
                snapClosedImmediate();
                if (closeActiveSwipeRow === snapClosed) closeActiveSwipeRow = null;
                action.onPress();
              }}
              accessibilityRole="button"
              accessibilityLabel={action.label}
            >
              {action.icon ? (
                <Ionicons name={action.icon} size={24} color="#fff" />
              ) : (
                <Text style={styles.actionText}>{action.label}</Text>
              )}
            </Pressable>
          ))}
        </Animated.View>
      </View>

      <Animated.View style={[styles.content, { transform: [{ translateX }] }]} collapsable={false} pointerEvents="box-none">
        {children}
        {isOpen ? (
          <Pressable
            style={styles.closeHit}
            onPress={() => {
              if (closeActiveSwipeRow === snapClosed) closeActiveSwipeRow = null;
              snapClosed();
            }}
            accessibilityLabel="Close swipe actions"
          />
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: "hidden",
    position: "relative"
  },
  actionsTrack: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "stretch"
  },
  actionsRow: {
    flexDirection: "row",
    height: "100%",
    alignSelf: "stretch"
  },
  actionBtn: {
    height: "100%",
    alignItems: "center",
    justifyContent: "center"
  },
  actionText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 12,
    textAlign: "center",
    paddingHorizontal: 4
  },
  content: {
    width: "100%",
    backgroundColor: "#303132"
  },
  closeHit: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2
  }
});
