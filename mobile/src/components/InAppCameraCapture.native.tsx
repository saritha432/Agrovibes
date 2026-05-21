import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import type { ImagePickerAsset } from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatReelCountdown, REEL_MAX_RECORD_SECONDS } from "./storyCameraTypes";

export type InAppCameraCaptureMode = "photo" | "video" | "any";
export type CameraFacing = "front" | "back";

type Props = {
  visible: boolean;
  onClose: () => void;
  onCapture: (asset: ImagePickerAsset) => void;
  onUnavailable?: () => void;
  initialFacing?: CameraFacing;
  mode?: InAppCameraCaptureMode;
  /** Cap for recordAsync (reels use 3 minutes). */
  maxVideoDurationSec?: number;
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

export function isInAppCameraSupported() {
  return true;
}

export function InAppCameraCapture({
  visible,
  onClose,
  onCapture,
  onUnavailable,
  initialFacing = "front",
  mode = "any",
  maxVideoDurationSec = REEL_MAX_RECORD_SECONDS
}: Props) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const recordingPromiseRef = useRef<Promise<{ uri: string } | undefined> | null>(null);
  const recordingStartedAtRef = useRef<number>(0);
  const recordingActiveRef = useRef(false);
  const longPressCaptureRef = useRef(false);
  const unavailableNotifiedRef = useRef(false);
  const maxDuration = Math.min(Math.max(maxVideoDurationSec, 1), REEL_MAX_RECORD_SECONDS);

  /** Release APK builds need the native camera in video mode before recordAsync (picture mode records no frames). */
  const waitForNativeRecordReady = useCallback(async () => {
    if (Platform.OS === "android") {
      await new Promise<void>((resolve) => setTimeout(resolve, 280));
      return;
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }, []);

  const [facing, setFacing] = useState<CameraFacing>(initialFacing);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [recordSecondsLeft, setRecordSecondsLeft] = useState(maxVideoDurationSec);

  useEffect(() => {
    if (!visible) return;
    setFacing(initialFacing);
    setErrorText("");
    setRecording(false);
    setBusy(false);
    setCameraReady(false);
    recordingActiveRef.current = false;
    recordingPromiseRef.current = null;
    recordingStartedAtRef.current = 0;
    unavailableNotifiedRef.current = false;
    setRecordSecondsLeft(maxVideoDurationSec);
  }, [initialFacing, maxVideoDurationSec, visible]);

  React.useEffect(() => {
    if (!recording || mode !== "video") return;
    const timer = setInterval(() => {
      setRecordSecondsLeft((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [mode, recording]);

  useEffect(() => {
    if (!visible) return;
    void (async () => {
      if (!cameraPermission?.granted) await requestCameraPermission();
    })();
  }, [cameraPermission?.granted, requestCameraPermission, visible]);

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
    if (recording || recordingActiveRef.current) {
      setBusy(true);
      try {
        if (!recordingPromiseRef.current) {
          throw new Error("Recording did not start. Try again.");
        }
        // expo-camera can fail with "stopped before any data could be produced"
        // if stop is requested too quickly after start. Wait a short minimum window.
        const elapsed = Date.now() - (recordingStartedAtRef.current || 0);
        const minMs = Platform.OS === "android" ? 1000 : 650;
        if (elapsed > 0 && elapsed < minMs) {
          await new Promise((resolve) => setTimeout(resolve, minMs - elapsed));
        }
        cameraRef.current.stopRecording();
        const video = await recordingPromiseRef.current;
        recordingPromiseRef.current = null;
        recordingStartedAtRef.current = 0;
        recordingActiveRef.current = false;
        setRecording(false);
        setBusy(false);
        if (!video?.uri) {
          setErrorText("Could not record video.");
          return;
        }
        onCapture(toPickerAsset({ uri: video.uri, type: "video", duration: null }));
        onClose();
      } catch (e) {
        recordingPromiseRef.current = null;
        recordingStartedAtRef.current = 0;
        recordingActiveRef.current = false;
        setRecording(false);
        setBusy(false);
        const msg = e instanceof Error ? e.message : "Video recording failed.";
        if (/before any data could be produced|did not start/i.test(msg)) {
          setErrorText("Recording failed to start. Wait a second, then tap record again.");
        } else {
          setErrorText(msg);
        }
      }
      return;
    }
    if (busy || !cameraReady) {
      if (!cameraReady) setErrorText("Camera is still starting. Try again in a moment.");
      return;
    }
    recordingActiveRef.current = true;
    setRecording(true);
    setRecordSecondsLeft(maxDuration);
    try {
      // mode "any" switches picture → video on this render; native layer must settle before recordAsync.
      if (mode === "any") {
        await waitForNativeRecordReady();
      } else if (Platform.OS === "android") {
        await waitForNativeRecordReady();
      }
      if (!cameraRef.current) {
        throw new Error("Camera unavailable.");
      }
      recordingStartedAtRef.current = Date.now();
      const recordPromise = cameraRef.current.recordAsync({ maxDuration });
      recordingPromiseRef.current = recordPromise;
      void recordPromise
        .then((video) => {
          if (!recordingActiveRef.current) return;
          recordingPromiseRef.current = null;
          recordingStartedAtRef.current = 0;
          recordingActiveRef.current = false;
          longPressCaptureRef.current = false;
          setRecording(false);
          setBusy(false);
          if (!video?.uri) return;
          onCapture(toPickerAsset({ uri: video.uri, type: "video", duration: null }));
          onClose();
        })
        .catch(() => {
          /* manual stop handled in toggleVideoRecording */
        });
    } catch (e) {
      recordingStartedAtRef.current = 0;
      recordingActiveRef.current = false;
      recordingPromiseRef.current = null;
      setRecording(false);
      setErrorText(e instanceof Error ? e.message : "Could not start recording.");
    }
  }, [
    busy,
    cameraReady,
    micPermission?.granted,
    mode,
    onCapture,
    onClose,
    recording,
    requestMicPermission,
    waitForNativeRecordReady
  ]);

  const startRecordingFromHold = useCallback(async () => {
    longPressCaptureRef.current = true;
    if (!recording && !recordingActiveRef.current) {
      await toggleVideoRecording();
    }
  }, [recording, toggleVideoRecording]);

  const stopRecordingFromHold = useCallback(async () => {
    longPressCaptureRef.current = false;
    if (mode === "video") return;
    if (recording || recordingActiveRef.current) {
      await toggleVideoRecording();
    }
  }, [mode, recording, toggleVideoRecording]);

  const onShutterPress = () => {
    if (longPressCaptureRef.current) {
      longPressCaptureRef.current = false;
      return;
    }
    if (mode === "video") {
      void toggleVideoRecording();
      return;
    }
    void takePhoto();
  };

  if (!visible) return null;

  const wantsVideo = mode === "video" || mode === "any";
  // Reels use mode="video" — must stay in video mode before recordAsync (release APKs record zero frames in picture mode).
  const cameraViewMode: "picture" | "video" =
    mode === "video" || (recording && wantsVideo) ? "video" : "picture";

  const permissionLoading = cameraPermission == null;
  const permissionDenied = cameraPermission != null && !cameraPermission.granted;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.root}>
        {permissionLoading ? (
          <View style={styles.centerWrap}>
            <ActivityIndicator size="large" color="#C9FF35" />
            <Text style={styles.loadingText}>Starting camera…</Text>
          </View>
        ) : permissionDenied ? (
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
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing={facing}
              mode={cameraViewMode}
              active={visible}
              onCameraReady={() => setCameraReady(true)}
              onMountError={() => {
                setErrorText("Camera could not start.");
                if (!unavailableNotifiedRef.current) {
                  unavailableNotifiedRef.current = true;
                  onUnavailable?.();
                  onClose();
                }
              }}
            />
            {!cameraReady ? (
              <View style={styles.centerWrap} pointerEvents="none">
                <ActivityIndicator size="large" color="#C9FF35" />
              </View>
            ) : null}
            <View style={[styles.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
              <Pressable style={styles.iconBtn} onPress={onClose} hitSlop={12}>
                <Ionicons name="close" size={28} color="#fff" />
              </Pressable>
              {mode === "video" && recording ? (
                <View style={styles.fsCountdownBadge} pointerEvents="none">
                  <View style={styles.fsCountdownDot} />
                  <Text style={styles.fsCountdownText}>{formatReelCountdown(recordSecondsLeft)}</Text>
                </View>
              ) : (
                <View style={styles.topBarSpacer} />
              )}
              <Pressable
                style={styles.iconBtn}
                onPress={() => setFacing((f) => (f === "front" ? "back" : "front"))}
                hitSlop={12}
              >
                <Ionicons name="camera-reverse-outline" size={28} color="#C9FF35" />
              </Pressable>
            </View>

            {errorText ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{errorText}</Text>
              </View>
            ) : null}

            <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              {wantsVideo ? (
                <View style={styles.modeHint}>
                  <Text style={styles.modeHintText}>
                    {mode === "video" ? "Tap or hold to record (max 3 min)" : "Tap for photo · hold for video"}
                  </Text>
                </View>
              ) : null}
              <Pressable
                style={[styles.shutterOuter, recording ? styles.shutterOuterRecording : null]}
                onPress={onShutterPress}
                onLongPress={wantsVideo ? () => void startRecordingFromHold() : undefined}
                onPressOut={wantsVideo ? () => void stopRecordingFromHold() : undefined}
                delayLongPress={280}
                disabled={(busy && !recording) || !cameraReady}
              >
                {busy && !recording ? (
                  <ActivityIndicator color="#111" />
                ) : (
                  <View style={[styles.shutterInner, recording ? styles.shutterInnerRecording : null]} />
                )}
              </Pressable>
              <Text style={styles.captureLabel}>
                {mode === "video" ? (recording ? "Recording…" : "Tap or hold to record") : "Tap for photo"}
              </Text>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#000"
  },
  loadingText: { color: "#9ca3af", fontWeight: "600" },
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
    backgroundColor: "#C9FF35",
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginBottom: 14
  },
  permissionBtnText: { color: "#111", fontWeight: "800", fontSize: 15 },
  permissionCancel: { color: "#C9FF35", fontWeight: "700" },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14
  },
  topBarSpacer: { flex: 1 },
  fsCountdownBadge: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.5)"
  },
  fsCountdownDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ef4444" },
  fsCountdownText: { color: "#fff", fontSize: 17, fontWeight: "800" },
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
    borderColor: "#C9FF35",
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
