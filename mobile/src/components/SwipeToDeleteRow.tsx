import React, { useRef } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";

const DELETE_WIDTH = 76;

type SwipeToDeleteRowProps = {
  children: React.ReactNode;
  onDelete: () => void;
  deleteLabel?: string;
  style?: ViewStyle;
};

/** Swipe left to reveal a delete action on the right (Instagram-style). */
export function SwipeToDeleteRow({ children, onDelete, deleteLabel = "Delete", style }: SwipeToDeleteRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const openRef = useRef(false);
  const deleteOpacity = translateX.interpolate({
    inputRange: [-DELETE_WIDTH, -10, 0],
    outputRange: [1, 0, 0],
    extrapolate: "clamp"
  });

  const snapOpen = () => {
    openRef.current = true;
    Animated.spring(translateX, {
      toValue: -DELETE_WIDTH,
      useNativeDriver: true,
      tension: 120,
      friction: 14
    }).start();
  };

  const snapClosed = () => {
    openRef.current = false;
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      tension: 120,
      friction: 14
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
      onMoveShouldSetPanResponderCapture: (_evt, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
      onPanResponderMove: (_evt, g) => {
        const base = openRef.current ? -DELETE_WIDTH : 0;
        const next = base + g.dx;
        if (next <= 0 && next >= -DELETE_WIDTH) {
          translateX.setValue(next);
        } else if (next > 0) {
          translateX.setValue(0);
        } else {
          translateX.setValue(-DELETE_WIDTH);
        }
      },
      onPanResponderRelease: (_evt, g) => {
        const base = openRef.current ? -DELETE_WIDTH : 0;
        const projected = base + g.dx + g.vx * 40;
        if (projected < -DELETE_WIDTH * 0.45) snapOpen();
        else snapClosed();
      },
      onPanResponderTerminate: snapClosed
    })
  ).current;

  const handleDelete = () => {
    snapClosed();
    onDelete();
  };

  return (
    <View style={[styles.shell, style]}>
      <View style={styles.deleteSlot}>
        <Animated.View style={{ opacity: deleteOpacity }}>
          <Pressable
            style={styles.deleteBtn}
            onPress={handleDelete}
            accessibilityRole="button"
            accessibilityLabel={deleteLabel}
          >
            <Text style={styles.deleteText}>{deleteLabel}</Text>
          </Pressable>
        </Animated.View>
      </View>
      <Animated.View style={[styles.content, { transform: [{ translateX }] }]} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: "hidden",
    borderRadius: 10
  },
  deleteSlot: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "flex-end",
    justifyContent: "center"
  },
  deleteBtn: {
    width: DELETE_WIDTH,
    height: "100%",
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6
  },
  deleteText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 12
  },
  content: {
    width: "100%",
    backgroundColor: "transparent"
  }
});
