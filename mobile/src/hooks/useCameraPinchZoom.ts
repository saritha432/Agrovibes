import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GestureResponderEvent, ViewProps } from "react-native";
import { storyZoomToExpoRatio, type StoryCameraZoomLevel } from "../components/storyCameraTypes";

const DEFAULT_MIN = 0;
const DEFAULT_MAX = 1;
/** How strongly pinch distance maps into CameraView zoom (0–1). */
const PINCH_SENSITIVITY = 0.85;

function touchDistance(event: GestureResponderEvent): number {
  const touches = event.nativeEvent.touches;
  if (!touches || touches.length < 2) return 0;
  const a = touches[0];
  const b = touches[1];
  const dx = a.pageX - b.pageX;
  const dy = a.pageY - b.pageY;
  return Math.hypot(dx, dy);
}

function clampZoom(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

type Options = {
  /** Discrete Create UI step (1x / 2x) — applied when the control changes. */
  zoomLevel?: StoryCameraZoomLevel;
  min?: number;
  max?: number;
  enabled?: boolean;
  onZoomChange?: (zoom: number) => void;
};

export type CameraPinchHandlers = Pick<
  ViewProps,
  "onTouchStart" | "onTouchMove" | "onTouchEnd" | "onTouchCancel"
>;

/**
 * Pinch-in / pinch-out camera zoom for expo-camera `CameraView` (`zoom` 0–1).
 * Uses onTouch* (not PanResponder) so the second finger is tracked reliably.
 */
export function useCameraPinchZoom({
  zoomLevel,
  min = DEFAULT_MIN,
  max = DEFAULT_MAX,
  enabled = true,
  onZoomChange
}: Options = {}) {
  const initial = zoomLevel != null ? storyZoomToExpoRatio(zoomLevel) : 0;
  const [zoom, setZoomState] = useState(initial);
  const zoomRef = useRef(initial);
  const startZoomRef = useRef(initial);
  const startDistanceRef = useRef(0);
  const lastZoomLevelRef = useRef<StoryCameraZoomLevel | undefined>(zoomLevel);
  const pinchingRef = useRef(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const onZoomChangeRef = useRef(onZoomChange);
  onZoomChangeRef.current = onZoomChange;

  const setZoom = useCallback(
    (next: number) => {
      const clamped = clampZoom(next, min, max);
      if (Math.abs(clamped - zoomRef.current) < 0.001) return;
      zoomRef.current = clamped;
      setZoomState(clamped);
      onZoomChangeRef.current?.(clamped);
    },
    [max, min]
  );

  useEffect(() => {
    if (zoomLevel == null) return;
    if (lastZoomLevelRef.current === zoomLevel) return;
    lastZoomLevelRef.current = zoomLevel;
    if (pinchingRef.current) return;
    setZoom(storyZoomToExpoRatio(zoomLevel));
  }, [setZoom, zoomLevel]);

  const endPinch = useCallback(() => {
    startDistanceRef.current = 0;
    pinchingRef.current = false;
  }, []);

  const onTouchStart = useCallback(
    (evt: GestureResponderEvent) => {
      if (!enabledRef.current) return;
      const touches = evt.nativeEvent.touches?.length ?? 0;
      if (touches < 2) return;
      const distance = touchDistance(evt);
      if (distance <= 0) return;
      pinchingRef.current = true;
      startDistanceRef.current = distance;
      startZoomRef.current = zoomRef.current;
    },
    []
  );

  const onTouchMove = useCallback(
    (evt: GestureResponderEvent) => {
      if (!enabledRef.current) return;
      const touches = evt.nativeEvent.touches?.length ?? 0;
      if (touches < 2) {
        if (pinchingRef.current) endPinch();
        return;
      }
      const distance = touchDistance(evt);
      if (distance <= 0) return;
      if (!pinchingRef.current || startDistanceRef.current <= 0) {
        pinchingRef.current = true;
        startDistanceRef.current = distance;
        startZoomRef.current = zoomRef.current;
        return;
      }
      const scale = distance / startDistanceRef.current;
      // Pinch out (scale > 1) zooms in; pinch in zooms out.
      setZoom(startZoomRef.current + (scale - 1) * PINCH_SENSITIVITY);
    },
    [endPinch, setZoom]
  );

  const onTouchEnd = useCallback(
    (evt: GestureResponderEvent) => {
      const touches = evt.nativeEvent.touches?.length ?? 0;
      if (touches < 2) endPinch();
    },
    [endPinch]
  );

  const pinchHandlers: CameraPinchHandlers = useMemo(
    () => ({
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel: endPinch
    }),
    [endPinch, onTouchEnd, onTouchMove, onTouchStart]
  );

  /** Approximate display multiplier for UI (1.0x … ~3.0x). */
  const zoomDisplay = useMemo(() => 1 + zoom * 2, [zoom]);

  return {
    zoom,
    setZoom,
    zoomDisplay,
    pinchHandlers
  };
}
