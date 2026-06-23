import { Ionicons } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { APP_BLACK, APP_LIME } from "../theme/appColors";

const ACCENT = APP_LIME;
const MIN_CROP = 72;
const HANDLE_HIT = 44;
const CORNER = 22;
const CORNER_STROKE = 3;

type Props = {
  visible: boolean;
  sourceUri: string | null;
  onCancel: () => void;
  onDone: (croppedUri: string) => void;
};

type CropRect = { x: number; y: number; size: number };
type Corner = "tl" | "tr" | "bl" | "br";
type ImageLayout = { left: number; top: number; width: number; height: number; scale: number };

function computeContainLayout(naturalW: number, naturalH: number, maxW: number, maxH: number): ImageLayout {
  const scale = Math.min(maxW / naturalW, maxH / naturalH);
  const width = naturalW * scale;
  const height = naturalH * scale;
  return {
    left: (maxW - width) / 2,
    top: (maxH - height) / 2,
    width,
    height,
    scale
  };
}

function defaultCrop(layout: Pick<ImageLayout, "width" | "height">): CropRect {
  const size = Math.min(layout.width, layout.height) * 0.82;
  return {
    x: (layout.width - size) / 2,
    y: (layout.height - size) / 2,
    size
  };
}

function clampCrop(crop: CropRect, layout: Pick<ImageLayout, "width" | "height">): CropRect {
  const maxSize = Math.min(layout.width, layout.height);
  const size = Math.min(maxSize, Math.max(MIN_CROP, crop.size));
  const x = Math.max(0, Math.min(layout.width - size, crop.x));
  const y = Math.max(0, Math.min(layout.height - size, crop.y));
  return { x, y, size };
}

function resizeFromCorner(start: CropRect, corner: Corner, dx: number, dy: number, layout: ImageLayout): CropRect {
  if (corner === "br") {
    const size = start.size + Math.max(dx, dy);
    return clampCrop({ x: start.x, y: start.y, size }, layout);
  }
  if (corner === "tl") {
    const delta = Math.max(dx, dy);
    const size = start.size - delta;
    return clampCrop({ x: start.x + delta, y: start.y + delta, size }, layout);
  }
  if (corner === "tr") {
    const size = start.size + Math.max(dx, -dy);
    return clampCrop({ x: start.x, y: start.y + start.size - size, size }, layout);
  }
  const size = start.size + Math.max(-dx, dy);
  return clampCrop({ x: start.x + start.size - size, y: start.y, size }, layout);
}

async function cropImageUri(sourceUri: string, naturalSize: { width: number; height: number }, layout: ImageLayout, crop: CropRect) {
  // Map crop rect from on-screen image coords → source pixel coords.
  const pixelScaleX = naturalSize.width / layout.width;
  const pixelScaleY = naturalSize.height / layout.height;
  const originX = Math.max(0, Math.round(crop.x * pixelScaleX));
  const originY = Math.max(0, Math.round(crop.y * pixelScaleY));
  const side = Math.min(
    naturalSize.width - originX,
    naturalSize.height - originY,
    Math.round(crop.size * pixelScaleX),
    Math.round(crop.size * pixelScaleY)
  );

  if (side < 1) {
    throw new Error("Invalid crop region");
  }

  const result = await ImageManipulator.manipulateAsync(
    sourceUri,
    [{ crop: { originX, originY, width: side, height: side } }],
    { compress: 0.88, format: ImageManipulator.SaveFormat.WEBP }
  );
  return result.uri;
}

async function cropImageWebFallback(
  sourceUri: string,
  naturalSize: { width: number; height: number },
  layout: ImageLayout,
  crop: CropRect
) {
  const pixelScaleX = naturalSize.width / layout.width;
  const pixelScaleY = naturalSize.height / layout.height;
  const originX = Math.max(0, Math.round(crop.x * pixelScaleX));
  const originY = Math.max(0, Math.round(crop.y * pixelScaleY));
  const side = Math.min(
    naturalSize.width - originX,
    naturalSize.height - originY,
    Math.round(crop.size * pixelScaleX),
    Math.round(crop.size * pixelScaleY)
  );
  return cropImageWeb(sourceUri, originX, originY, side, side);
}

function createHtmlImage(): HTMLImageElement {
  return document.createElement("img");
}

function cropImageWeb(sourceUri: string, originX: number, originY: number, width: number, height: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = createHtmlImage();
    const isLocalUri = sourceUri.startsWith("blob:") || sourceUri.startsWith("data:");
    if (!isLocalUri) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas unavailable"));
        return;
      }
      ctx.drawImage(img, originX, originY, width, height, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = sourceUri;
  });
}

function useDragGesture(onStart: () => void, onMove: (dx: number, dy: number) => void, onEnd: () => void) {
  const originRef = useRef<{ x: number; y: number } | null>(null);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (evt) => {
          onStart();
          const touch = evt.nativeEvent.touches[0];
          originRef.current = { x: touch.pageX, y: touch.pageY };
        },
        onPanResponderMove: (_evt, gesture) => {
          onMove(gesture.dx, gesture.dy);
        },
        onPanResponderRelease: () => {
          originRef.current = null;
          onEnd();
        },
        onPanResponderTerminate: () => {
          originRef.current = null;
          onEnd();
        }
      }),
    [onEnd, onMove, onStart]
  );

  const webProps =
    Platform.OS === "web"
      ? ({
          onMouseDown: (event: any) => {
            onStart();
            originRef.current = { x: event.clientX, y: event.clientY };
          },
          onMouseMove: (event: any) => {
            if (!originRef.current || event.buttons !== 1) return;
            onMove(event.clientX - originRef.current.x, event.clientY - originRef.current.y);
          },
          onMouseUp: () => {
            originRef.current = null;
            onEnd();
          },
          onTouchStart: (event: any) => {
            onStart();
            const touch = event.nativeEvent.touches?.[0];
            if (!touch) return;
            originRef.current = { x: touch.pageX, y: touch.pageY };
          },
          onTouchMove: (event: any) => {
            const touch = event.nativeEvent.touches?.[0];
            if (!touch || !originRef.current) return;
            onMove(touch.pageX - originRef.current.x, touch.pageY - originRef.current.y);
          },
          onTouchEnd: () => {
            originRef.current = null;
            onEnd();
          }
        } as object)
      : null;

  return { panHandlers: pan.panHandlers, webProps };
}

export function ProfilePhotoAdjustModal({ visible, sourceUri, onCancel, onDone }: Props) {
  const insets = useSafeAreaInsets();
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [workingUri, setWorkingUri] = useState<string | null>(null);
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, size: MIN_CROP });
  const [busy, setBusy] = useState(false);

  const cropStartRef = useRef<CropRect>(crop);
  const activeCornerRef = useRef<Corner | null>(null);

  const screenSize = Dimensions.get("window");
  const stageHeight = screenSize.height - insets.top - insets.bottom - 150;
  const stageWidth = screenSize.width;

  const layout = useMemo(() => {
    if (!naturalSize) return null;
    return computeContainLayout(naturalSize.width, naturalSize.height, stageWidth - 24, stageHeight - 24);
  }, [naturalSize, stageHeight, stageWidth]);

  useEffect(() => {
    if (!visible || !sourceUri) return;
    setWorkingUri(sourceUri);
    setNaturalSize(null);
    setBusy(false);
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const img = createHtmlImage();
      img.onload = () => {
        setNaturalSize({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
      };
      img.onerror = () => setNaturalSize({ width: 1080, height: 1080 });
      img.src = sourceUri;
      return;
    }
    Image.getSize(
      sourceUri,
      (width, height) => setNaturalSize({ width, height }),
      () => setNaturalSize({ width: 1080, height: 1080 })
    );
  }, [sourceUri, visible]);

  useEffect(() => {
    if (!layout) return;
    setCrop(defaultCrop(layout));
  }, [layout]);

  const frameScreen = useMemo(() => {
    if (!layout) return null;
    return {
      left: layout.left + crop.x,
      top: layout.top + crop.y,
      size: crop.size
    };
  }, [crop, layout]);

  const beginCorner = useCallback(
    (corner: Corner) => {
      activeCornerRef.current = corner;
      cropStartRef.current = crop;
    },
    [crop]
  );

  const beginMove = useCallback(() => {
    activeCornerRef.current = null;
    cropStartRef.current = crop;
  }, [crop]);

  const onDragMove = useCallback(
    (dx: number, dy: number) => {
      if (!layout) return;
      const start = cropStartRef.current;
      if (activeCornerRef.current) {
        setCrop(resizeFromCorner(start, activeCornerRef.current, dx, dy, layout));
        return;
      }
      setCrop(clampCrop({ x: start.x + dx, y: start.y + dy, size: start.size }, layout));
    },
    [layout]
  );

  const onDragEnd = useCallback(() => {
    activeCornerRef.current = null;
  }, []);

  const tlDrag = useDragGesture(() => beginCorner("tl"), onDragMove, onDragEnd);
  const trDrag = useDragGesture(() => beginCorner("tr"), onDragMove, onDragEnd);
  const blDrag = useDragGesture(() => beginCorner("bl"), onDragMove, onDragEnd);
  const brDrag = useDragGesture(() => beginCorner("br"), onDragMove, onDragEnd);
  const moveDrag = useDragGesture(beginMove, onDragMove, onDragEnd);

  const cornerDragByKey: Record<Corner, ReturnType<typeof useDragGesture>> = {
    tl: tlDrag,
    tr: trDrag,
    bl: blDrag,
    br: brDrag
  };

  const handleStyles: Record<Corner, object> = {
    tl: styles.handle_tl,
    tr: styles.handle_tr,
    bl: styles.handle_bl,
    br: styles.handle_br
  };

  const cornerStyles: Record<Corner, object> = {
    tl: styles.corner_tl,
    tr: styles.corner_tr,
    bl: styles.corner_bl,
    br: styles.corner_br
  };

  const rotateImage = async () => {
    if (!workingUri || busy) return;
    setBusy(true);
    try {
      if (Platform.OS === "web") {
        const rotated = await rotateImageWeb(workingUri, 90);
        setWorkingUri(rotated);
        Image.getSize(
          rotated,
          (width, height) => setNaturalSize({ width, height }),
          () => setNaturalSize({ width: 1080, height: 1080 })
        );
      } else {
        const result = await ImageManipulator.manipulateAsync(workingUri, [{ rotate: 90 }], {
          compress: 0.92,
          format: ImageManipulator.SaveFormat.WEBP
        });
        setWorkingUri(result.uri);
        Image.getSize(
          result.uri,
          (width, height) => setNaturalSize({ width, height }),
          () => setNaturalSize({ width: 1080, height: 1080 })
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDone = async () => {
    if (!workingUri || !naturalSize || !layout || busy) return;
    setBusy(true);
    try {
      const cropped = await cropImageUri(workingUri, naturalSize, layout, crop);
      onDone(cropped);
    } catch {
      try {
        const cropped = await cropImageWebFallback(workingUri, naturalSize, layout, crop);
        onDone(cropped);
      } catch {
        onDone(workingUri);
      }
    } finally {
      setBusy(false);
    }
  };

  if (!visible || !workingUri) return null;

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onCancel}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={[styles.stage, { height: stageHeight }]}>
          {!naturalSize || !layout || !frameScreen ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={ACCENT} />
            </View>
          ) : (
            <>
              <Image
                source={{ uri: workingUri }}
                style={[
                  styles.photo,
                  {
                    left: layout.left,
                    top: layout.top,
                    width: layout.width,
                    height: layout.height
                  }
                ]}
                resizeMode="contain"
              />

              <View style={[styles.mask, { top: 0, left: 0, right: 0, height: frameScreen.top }]} pointerEvents="none" />
              <View
                style={[styles.mask, { top: frameScreen.top + frameScreen.size, left: 0, right: 0, bottom: 0 }]}
                pointerEvents="none"
              />
              <View
                style={[
                  styles.mask,
                  { top: frameScreen.top, left: 0, width: frameScreen.left, height: frameScreen.size }
                ]}
                pointerEvents="none"
              />
              <View
                style={[
                  styles.mask,
                  { top: frameScreen.top, left: frameScreen.left + frameScreen.size, right: 0, height: frameScreen.size }
                ]}
                pointerEvents="none"
              />

              <View
                style={[
                  styles.frame,
                  {
                    left: frameScreen.left,
                    top: frameScreen.top,
                    width: frameScreen.size,
                    height: frameScreen.size
                  }
                ]}
                pointerEvents="box-none"
              >
                <View
                  style={styles.moveArea}
                  {...(Platform.OS === "web" ? moveDrag.webProps : moveDrag.panHandlers)}
                />
                <View style={[styles.gridLine, styles.gridLineH, { top: "33.33%" }]} pointerEvents="none" />
                <View style={[styles.gridLine, styles.gridLineH, { top: "66.66%" }]} pointerEvents="none" />
                <View style={[styles.gridLine, styles.gridLineV, { left: "33.33%" }]} pointerEvents="none" />
                <View style={[styles.gridLine, styles.gridLineV, { left: "66.66%" }]} pointerEvents="none" />
                {(["tl", "tr", "bl", "br"] as Corner[]).map((corner) => {
                  const drag = cornerDragByKey[corner];
                  return (
                    <View
                      key={corner}
                      style={[styles.handleHit, handleStyles[corner]]}
                      {...(Platform.OS === "web" ? drag.webProps : drag.panHandlers)}
                    >
                      <View style={[styles.corner, cornerStyles[corner]]} pointerEvents="none" />
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </View>

        <Text style={styles.hint}>Drag frame corners to resize · Drag center to move</Text>

        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Pressable onPress={onCancel} hitSlop={12} disabled={busy}>
            <Text style={styles.bottomAction}>Cancel</Text>
          </Pressable>
          <Pressable onPress={() => void rotateImage()} hitSlop={12} disabled={busy || !naturalSize} style={styles.rotateBtn}>
            <Ionicons name="refresh-outline" size={28} color="#fff" />
          </Pressable>
          <Pressable onPress={() => void handleDone()} hitSlop={12} disabled={busy || !naturalSize}>
            {busy ? <ActivityIndicator color={ACCENT} /> : <Text style={styles.bottomAction}>Done</Text>}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function rotateImageWeb(sourceUri: string, rotation: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = createHtmlImage();
    const isLocalUri = sourceUri.startsWith("blob:") || sourceUri.startsWith("data:");
    if (!isLocalUri) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => {
      const radians = (rotation * Math.PI) / 180;
      const canvas = document.createElement("canvas");
      const sin = Math.abs(Math.sin(radians));
      const cos = Math.abs(Math.cos(radians));
      canvas.width = img.width * cos + img.height * sin;
      canvas.height = img.width * sin + img.height * cos;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas unavailable"));
        return;
      }
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(radians);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.onerror = () => reject(new Error("Could not rotate image"));
    img.src = sourceUri;
  });
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: APP_BLACK },
  stage: { width: "100%", position: "relative" },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  photo: { position: "absolute" },
  mask: { position: "absolute", backgroundColor: "rgba(0,0,0,0.62)" },
  frame: {
    position: "absolute",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.95)"
  },
  moveArea: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    ...(Platform.OS === "web" ? ({ cursor: "move" } as object) : null)
  },
  gridLine: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.35)",
    zIndex: 2
  },
  gridLineH: { left: 0, right: 0, height: StyleSheet.hairlineWidth },
  gridLineV: { top: 0, bottom: 0, width: StyleSheet.hairlineWidth },
  handleHit: {
    position: "absolute",
    width: HANDLE_HIT,
    height: HANDLE_HIT,
    zIndex: 5,
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "web" ? ({ cursor: "nwse-resize" } as object) : null)
  },
  handle_tl: { top: -HANDLE_HIT / 2, left: -HANDLE_HIT / 2 },
  handle_tr: { top: -HANDLE_HIT / 2, right: -HANDLE_HIT / 2 },
  handle_bl: { bottom: -HANDLE_HIT / 2, left: -HANDLE_HIT / 2 },
  handle_br: { bottom: -HANDLE_HIT / 2, right: -HANDLE_HIT / 2 },
  corner: {
    width: CORNER,
    height: CORNER,
    borderColor: "#fff"
  },
  corner_tl: { borderTopWidth: CORNER_STROKE, borderLeftWidth: CORNER_STROKE },
  corner_tr: { borderTopWidth: CORNER_STROKE, borderRightWidth: CORNER_STROKE },
  corner_bl: { borderBottomWidth: CORNER_STROKE, borderLeftWidth: CORNER_STROKE },
  corner_br: { borderBottomWidth: CORNER_STROKE, borderRightWidth: CORNER_STROKE },
  hint: {
    textAlign: "center",
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 20,
    paddingBottom: 6
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 28,
    paddingTop: 12,
    backgroundColor: APP_BLACK
  },
  bottomAction: { color: ACCENT, fontSize: 17, fontWeight: "800", minWidth: 72 },
  rotateBtn: { padding: 8 }
});
