import React, { useCallback, useMemo, useRef } from "react";
import { GestureResponderEvent, LayoutChangeEvent, PanResponder, StyleSheet, View } from "react-native";
import { APP_LIME } from "../theme/appColors";

type ReelSeekBarProps = {
  progressRatio: number;
  onSeek?: (ratio: number) => void;
};

export function ReelSeekBar({ progressRatio, onSeek }: ReelSeekBarProps) {
  const trackRef = useRef<View>(null);
  const trackWidthRef = useRef(0);
  const safeRatio = Math.max(0, Math.min(1, progressRatio));

  const seekAtPageX = useCallback(
    (pageX: number) => {
      if (!onSeek) return;
      const width = trackWidthRef.current;
      if (width <= 0) {
        trackRef.current?.measureInWindow((x, _y, measuredWidth) => {
          if (measuredWidth <= 0) return;
          trackWidthRef.current = measuredWidth;
          onSeek(Math.max(0, Math.min(1, (pageX - x) / measuredWidth)));
        });
        return;
      }
      trackRef.current?.measureInWindow((x, _y, measuredWidth) => {
        const w = measuredWidth > 0 ? measuredWidth : width;
        onSeek(Math.max(0, Math.min(1, (pageX - x) / w)));
      });
    },
    [onSeek]
  );

  const seekFromEvent = useCallback(
    (event: GestureResponderEvent) => {
      const pageX = event.nativeEvent.pageX;
      if (typeof pageX === "number" && Number.isFinite(pageX)) {
        seekAtPageX(pageX);
        return;
      }
      const width = trackWidthRef.current;
      const locationX = event.nativeEvent.locationX;
      if (width > 0 && typeof locationX === "number") {
        onSeek?.(Math.max(0, Math.min(1, locationX / width)));
      }
    },
    [onSeek, seekAtPageX]
  );

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    trackWidthRef.current = event.nativeEvent.layout.width;
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !!onSeek,
        onMoveShouldSetPanResponder: () => !!onSeek,
        onPanResponderGrant: (event) => seekFromEvent(event),
        onPanResponderMove: (event) => seekFromEvent(event)
      }),
    [onSeek, seekFromEvent]
  );

  return (
    <View
      ref={trackRef}
      style={styles.hitArea}
      onLayout={onLayout}
      accessibilityRole="adjustable"
      accessibilityLabel="Video progress"
      {...(onSeek ? panResponder.panHandlers : {})}
    >
      <View style={styles.track} pointerEvents="none">
        <View style={[styles.fill, { width: `${safeRatio * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hitArea: {
    width: "100%",
    paddingVertical: 12,
    justifyContent: "flex-end"
  },
  track: {
    width: "100%",
    height: 4,
    backgroundColor: "rgba(0,0,0,0.42)",
    overflow: "hidden"
  },
  fill: {
    height: "100%",
    backgroundColor: APP_LIME
  }
});
