import { Ionicons } from "@expo/vector-icons";
import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

export type OverlayPoint = { x: number; y: number };

type Props = {
  /** Centre of the item, as a fraction (0–1) of the container. */
  position: OverlayPoint;
  containerWidth: number;
  containerHeight: number;
  onMove?: (next: OverlayPoint) => void;
  onPress?: () => void;
  /** Called when the item is dropped on the trash zone (bottom-centre). */
  onRemove?: () => void;
  onDragActiveChange?: (active: boolean, overTrash: boolean) => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

const TAP_SLOP = 5;

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

export function isOverTrashZone(p: OverlayPoint) {
  return p.y > 0.88 && Math.abs(p.x - 0.5) < 0.16;
}

/** Trash target shown at the bottom-centre while an item is being dragged. */
export function OverlayTrashZone({ visible, active }: { visible: boolean; active: boolean }) {
  if (!visible) return null;
  return (
    <View pointerEvents="none" style={trashStyles.wrap}>
      <View style={[trashStyles.circle, active ? trashStyles.circleActive : null]}>
        <Ionicons name="trash-outline" size={active ? 28 : 24} color="#fff" />
      </View>
    </View>
  );
}

const trashStyles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: "4%", alignItems: "center" },
  circle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.85)",
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center"
  },
  circleActive: { width: 62, height: 62, borderRadius: 31, backgroundColor: "#ff3b30", borderColor: "#ff3b30" }
});

/** Instagram-style draggable sticker/text. Static (still positioned) when `onMove` is omitted. */
export function DraggableOverlay({
  position,
  containerWidth,
  containerHeight,
  onMove,
  onPress,
  onRemove,
  onDragActiveChange,
  style,
  children
}: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const drag = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const latest = useRef({ position, containerWidth, containerHeight, onMove, onPress, onRemove, onDragActiveChange });
  latest.current = { position, containerWidth, containerHeight, onMove, onPress, onRemove, onDragActiveChange };
  const overTrashRef = useRef(false);

  // Clear the drag offset in the same frame the new position is committed (no snap-back flicker).
  useLayoutEffect(() => {
    drag.setValue({ x: 0, y: 0 });
  }, [drag, position.x, position.y]);

  const pointFor = (dx: number, dy: number): OverlayPoint => {
    const { position: p, containerWidth: w, containerHeight: h } = latest.current;
    return {
      x: clamp(p.x + dx / Math.max(1, w), 0.03, 0.97),
      y: clamp(p.y + dy / Math.max(1, h), 0.03, 0.97)
    };
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !!(latest.current.onMove || latest.current.onPress),
        onMoveShouldSetPanResponder: (_, g) =>
          !!latest.current.onMove && (Math.abs(g.dx) > TAP_SLOP || Math.abs(g.dy) > TAP_SLOP),
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          drag.setValue({ x: 0, y: 0 });
          overTrashRef.current = false;
        },
        onPanResponderMove: (_, g) => {
          if (!latest.current.onMove) return;
          drag.setValue({ x: g.dx, y: g.dy });
          if (Math.abs(g.dx) <= TAP_SLOP && Math.abs(g.dy) <= TAP_SLOP) return;
          const over = !!latest.current.onRemove && isOverTrashZone(pointFor(g.dx, g.dy));
          overTrashRef.current = over;
          latest.current.onDragActiveChange?.(true, over);
        },
        onPanResponderRelease: (_, g) => {
          const moved = Math.abs(g.dx) > TAP_SLOP || Math.abs(g.dy) > TAP_SLOP;
          latest.current.onDragActiveChange?.(false, false);
          if (!moved || !latest.current.onMove) {
            drag.setValue({ x: 0, y: 0 });
            latest.current.onPress?.();
            return;
          }
          if (overTrashRef.current && latest.current.onRemove) {
            drag.setValue({ x: 0, y: 0 });
            latest.current.onRemove();
            return;
          }
          const next = pointFor(g.dx, g.dy);
          const cur = latest.current.position;
          if (next.x === cur.x && next.y === cur.y) drag.setValue({ x: 0, y: 0 });
          latest.current.onMove(next);
        },
        onPanResponderTerminate: () => {
          latest.current.onDragActiveChange?.(false, false);
          drag.setValue({ x: 0, y: 0 });
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drag]
  );

  const left = position.x * containerWidth - size.width / 2;
  const top = position.y * containerHeight - size.height / 2;

  return (
    <Animated.View
      {...responder.panHandlers}
      pointerEvents={onMove || onPress ? "auto" : "none"}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
      }}
      style={[
        {
          position: "absolute",
          left,
          top,
          maxWidth: Math.max(80, containerWidth - 24),
          opacity: size.width > 0 ? 1 : 0,
          transform: drag.getTranslateTransform()
        },
        style
      ]}
    >
      {children}
    </Animated.View>
  );
}
