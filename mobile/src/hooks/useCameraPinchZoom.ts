import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, type GestureResponderEvent } from "react-native";
import { storyZoomToExpoRatio, type StoryCameraZoomLevel } from "../components/storyCameraTypes";

const DEFAULT_MIN = 0;
const DEFAULT_MAX = 1;
/** How strongly pinch distance maps into CameraView zoom (0–1). */
const PINCH_SENSITIVITY = 0.65;

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

/**
 * Pinch-in / pinch-out camera zoom for expo-camera `CameraView` (`zoom` 0–1).
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
  const onZoomChangeRef = useRef(onZoomChange);
  onZoomChangeRef.current = onZoomChange;

  const setZoom = useCallback(
    (next: number) => {
      const clamped = clampZoom(next, min, max);
      zoomRef.current = clamped;
      setZoomState(clamped);
      onZoomChangeRef.current?.(clamped);
    },
    [max, min]
  );

  useEffect(() => {
    if (zoomLevel == null) return;
    // Only snap when the discrete control changes — never while a pinch is active.
    if (lastZoomLevelRef.current === zoomLevel) return;
    lastZoomLevelRef.current = zoomLevel;
    if (pinchingRef.current) return;
    setZoom(storyZoomToExpoRatio(zoomLevel));
  }, [setZoom, zoomLevel]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (evt) => enabled && (evt.nativeEvent.touches?.length ?? 0) >= 2,
        onMoveShouldSetPanResponder: (evt) => enabled && (evt.nativeEvent.touches?.length ?? 0) >= 2,
        onStartShouldSetPanResponderCapture: (evt) => enabled && (evt.nativeEvent.touches?.length ?? 0) >= 2,
        onMoveShouldSetPanResponderCapture: (evt) => enabled && (evt.nativeEvent.touches?.length ?? 0) >= 2,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (evt) => {
          if (!enabled) return;
          const distance = touchDistance(evt);
          if (distance <= 0) return;
          pinchingRef.current = true;
          startDistanceRef.current = distance;
          startZoomRef.current = zoomRef.current;
        },
        onPanResponderMove: (evt) => {
          if (!enabled) return;
          const distance = touchDistance(evt);
          if (distance <= 0) return;
          if (startDistanceRef.current <= 0) {
            startDistanceRef.current = distance;
            startZoomRef.current = zoomRef.current;
            return;
          }
          const scale = distance / startDistanceRef.current;
          // Pinch out (scale > 1) zooms in; pinch in zooms out.
          setZoom(startZoomRef.current + (scale - 1) * PINCH_SENSITIVITY);
        },
        onPanResponderRelease: () => {
          startDistanceRef.current = 0;
          pinchingRef.current = false;
        },
        onPanResponderTerminate: () => {
          startDistanceRef.current = 0;
          pinchingRef.current = false;
        }
      }),
    [enabled, setZoom]
  );

  /** Approximate display multiplier for UI (1.0x … ~3.0x). */
  const zoomDisplay = useMemo(() => 1 + zoom * 2, [zoom]);

  return {
    zoom,
    setZoom,
    zoomDisplay,
    pinchHandlers: enabled ? panResponder.panHandlers : {}
  };
}
