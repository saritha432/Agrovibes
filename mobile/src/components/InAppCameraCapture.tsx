import { Ionicons } from "@expo/vector-icons";
import { CameraType, CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import type { ImagePickerAsset } from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type InAppCameraCaptureMode = "photo" | "video" | "any";

type Props = {
  visible: boolean;
  onClose: () => void;
  onCapture: (asset: ImagePickerAsset) => void;
  initialFacing?: CameraType;
  mode?: InAppCameraCaptureMode;
};

function toPickerAsset(payload: {
  uri: string;
  type: "image" | "video";
  width?: number;
  height?: number;
  duration?: number | null;
}): ImagePickerAsset {
  return {
    uri: payload.uri,
    type: payload.type,
    width: payload.width ?? 0,
    height: payload.height ?? 0,
    duration: payload.duration ?? undefined,
    mimeType: payload.type === "video" ? "video/mp4" : "image/jpeg"
  };
}

export function InAppCameraCapture({
  visible,
  onClose,
  onCapture,
  initialFacing = CameraType.front,
  mode = "any"
}: Props) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const recordingPromiseRef = useRef<Promise<{ uri: string } | undefined> | null>(null);
  const [facing, setFacing] = useState<CameraType>(initialFacing);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    if (!visible) return;
    setFacing(initialFacing);
    setErrorText("");
    setRecording(false);
    setBusy(false);
  }, [initialFacing, visible]);

  useEffect(() => {
    if (!visible) return;
    void (async () => {
      if (!cameraPermission?.granted) await requestCameraPermission();
      if (mode !== "photo" && !micPermission?.granted) await requestMicPermission();
    })();
  }, [cameraPermission?.granted, micPermission?.granted, mode, requestCameraPermission, requestMicPermission, visible]);

  const wantsVideo = mode === "video" || mode === "any";
  const wantsPhoto = mode === "photo" || mode === "any";

  const takePhoto = useCallback(async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    setErrorText("");
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (!photo?.uri) {
        setErrorText("Could not capture photo.");
        return;
      }
      onCapture(
        toPickerAsset({
          uri: photo.uri,
          type: "image",
          width: photo.width,
          height: photo.height
        })
      );
      onClose();
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Photo capture failed.");
    } finally {
      setBusy(false);
    }
  }, [busy, onCapture, onClose]);

  const toggleVideoRecording = useCallback(async () => {
    if (!cameraRef.current) return;
    if (!micPermission?.granted) {
      const res = await requestMicPermission();
      if (!res.granted) {
        setErrorText("Microphone permission is required for video.");
        return;
      }
    }
    setErrorText("");
    if (recording) {
      setBusy(true);
      try {
        cameraRef.current.stopRecording();
        const video = await recordingPromiseRef.current;
        recordingPromiseRef.current = null;
        setRecording(false);
        setBusy(false);
        if (!video?.uri) {
          setErrorText("Could not record video.");
          return;
        }
        onCapture(toPickerAsset({ uri: video.uri, type: "video", duration: null }));
        onClose();
      } catch (e) {
        setRecording(false);
        setBusy(false);
        setErrorText(e instanceof Error ? e.message : "Video recording failed.");
      }
      return;
    }
    if (busy) return;
    setRecording(true);
    try {
      recordingPromiseRef.current = cameraRef.current.recordAsync({ maxDuration: 60 });
    } catch (e) {
      setRecording(false);
      setErrorText(e instanceof Error ? e.message : "Could not start recording.");
    }
  }, [busy, micPermission?.granted, onCapture, onClose, recording, requestMicPermission]);

  const onShutterPress = () => {
    if (mode === "video") {
      void toggleVideoRecording();
      return;
    }
    if (mode === "photo") {
      void takePhoto();
      return;
    }
    void takePhoto();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.root}>
        {!cameraPermission?.granted ? (
          <View style={styles.permissionWrap}>
            <Text style={styles.permissionTitle}>Camera access</Text>
            <Text style={styles.permissionSub}>
              Allow camera{mode !== "photo" ? " and microphone" : ""} to capture {mode === "video" ? "videos" : "photos"}.
            </Text>
            <Pressable
              style={styles.permissionBtn}
              onPress={async () => {
                await requestCameraPermission();
                if (mode !== "photo") await requestMicPermission();
              }}
            >
              <Text style={styles.permissionBtnText}>Continue</Text>
            </Pressable>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={styles.permissionCancel}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} mode={wantsVideo ? "video" : "picture"} />
            <View style={[styles.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
              <Pressable style={styles.iconBtn} onPress={onClose} hitSlop={12}>
                <Ionicons name="close" size={28} color="#fff" />
              </Pressable>
              <Pressable
                style={styles.iconBtn}
                onPress={() => setFacing((f) => (f === CameraType.front ? CameraType.back : CameraType.front))}
                hitSlop={12}
              >
                <Ionicons name="camera-reverse-outline" size={28} color="#d8ff37" />
              </Pressable>
            </View>

            {errorText ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{errorText}</Text>
              </View>
            ) : null}

            <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              {wantsVideo && mode === "any" ? (
                <Pressable style={styles.modeHint} onPress={() => void toggleVideoRecording()} disabled={busy}>
                  <Text style={styles.modeHintText}>{recording ? "Tap to stop" : "Hold for video — tap shutter for photo"}</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={[styles.shutterOuter, recording ? styles.shutterOuterRecording : null]}
                onPress={onShutterPress}
                onLongPress={wantsVideo && mode === "any" ? () => void toggleVideoRecording() : undefined}
                delayLongPress={280}
                disabled={busy && !recording}
              >
                {busy && !recording ? (
                  <ActivityIndicator color="#111" />
                ) : (
                  <View style={[styles.shutterInner, recording ? styles.shutterInnerRecording : null]} />
                )}
              </Pressable>
              {mode === "video" ? (
                <Text style={styles.captureLabel}>{recording ? "Recording…" : "Tap to record"}</Text>
              ) : (
                <Text style={styles.captureLabel}>Tap to capture</Text>
              )}
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  permissionWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    backgroundColor: "#111"
  },
  permissionTitle: { color: "#fff", fontSize: 20, fontWeight: "800", marginBottom: 8 },
  permissionSub: { color: "#9ca3af", textAlign: "center", lineHeight: 20, marginBottom: 20 },
  permissionBtn: {
    backgroundColor: "#d8ff37",
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginBottom: 14
  },
  permissionBtnText: { color: "#111", fontWeight: "800", fontSize: 15 },
  permissionCancel: { color: "#d8ff37", fontWeight: "700" },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center"
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    alignItems: "center",
    gap: 10
  },
  modeHint: { paddingHorizontal: 16, paddingVertical: 6 },
  modeHintText: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "600" },
  shutterOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: "#d8ff37",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)"
  },
  shutterOuterRecording: { borderColor: "#ef4444" },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#fff"
  },
  shutterInnerRecording: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "#ef4444"
  },
  captureLabel: { color: "#fff", fontSize: 12, fontWeight: "600" },
  errorBanner: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 140,
    zIndex: 3,
    backgroundColor: "rgba(127,29,29,0.92)",
    borderRadius: 10,
    padding: 10
  },
  errorText: { color: "#fecaca", textAlign: "center", fontWeight: "600", fontSize: 13 }
});
