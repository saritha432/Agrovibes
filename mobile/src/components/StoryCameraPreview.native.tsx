import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { StoryCameraPreviewHandle, StoryCameraZoomLevel } from "./storyCameraTypes";
import { REEL_MAX_RECORD_SECONDS, storyZoomToExpoRatio } from "./storyCameraTypes";

type Props = {
  facing?: "front" | "back";
  active?: boolean;
  flashOn?: boolean;
  zoomLevel?: StoryCameraZoomLevel;
  /** `video` keeps preview in video mode (required for reliable recording on Android). */
  mode?: "picture" | "video";
  onPress?: () => void;
  onRecordingChange?: (recording: boolean) => void;
  /** Fired when recording ends (manual stop or max duration). */
  onAutoRecordFinished?: (payload: { uri: string }) => void;
};

export const StoryCameraPreview = forwardRef<StoryCameraPreviewHandle, Props>(function StoryCameraPreview(
  {
    facing = "front",
    active = false,
    flashOn = false,
    zoomLevel = 1,
    mode = "picture",
    onPress,
    onRecordingChange,
    onAutoRecordFinished
  },
  ref
) {
  const cameraRef = useRef<CameraView>(null);
  const recordingPromiseRef = useRef<Promise<{ uri: string } | undefined> | null>(null);
  const recordingStartedAtRef = useRef(0);
  const recordingActiveRef = useRef(false);

  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!active || permission?.granted) return;
    void requestPermission();
  }, [active, permission?.granted, requestPermission]);

  useEffect(() => {
    if (!active) {
      setReady(false);
      recordingActiveRef.current = false;
      recordingPromiseRef.current = null;
      recordingStartedAtRef.current = 0;
      setRecording(false);
      onRecordingChange?.(false);
    }
  }, [active, onRecordingChange]);

  const waitBeforeRecord = useCallback(async () => {
    if (Platform.OS === "android") {
      await new Promise<void>((resolve) => setTimeout(resolve, 280));
      return;
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }, []);

  const startRecording = useCallback(
    async (options?: { maxDurationSec?: number }) => {
      if (!cameraRef.current || !ready || recordingActiveRef.current || busy) return;
      if (!micPermission?.granted) {
        const res = await requestMicPermission();
        if (!res.granted) throw new Error("Microphone permission is required for video.");
      }
      const maxDuration = Math.min(Math.max(options?.maxDurationSec ?? 60, 1), REEL_MAX_RECORD_SECONDS);
      recordingActiveRef.current = true;
      setRecording(true);
      onRecordingChange?.(true);
      await waitBeforeRecord();
      if (!cameraRef.current) throw new Error("Camera unavailable.");
      recordingStartedAtRef.current = Date.now();
      const recordPromise = cameraRef.current.recordAsync({ maxDuration });
      recordingPromiseRef.current = recordPromise;
      void recordPromise.then((video) => {
        if (!recordingActiveRef.current) return;
        recordingPromiseRef.current = null;
        recordingStartedAtRef.current = 0;
        recordingActiveRef.current = false;
        setRecording(false);
        onRecordingChange?.(false);
        setBusy(false);
        if (!video?.uri) return;
        onAutoRecordFinished?.({ uri: video.uri });
      });
    },
    [busy, micPermission?.granted, onAutoRecordFinished, onRecordingChange, ready, requestMicPermission, waitBeforeRecord]
  );

  const stopRecording = useCallback(async () => {
    if (!cameraRef.current || !recordingActiveRef.current) return null;
    setBusy(true);
    try {
      if (!recordingPromiseRef.current) throw new Error("Recording did not start.");
      const elapsed = Date.now() - (recordingStartedAtRef.current || 0);
      const minMs = Platform.OS === "android" ? 1000 : 650;
      if (elapsed > 0 && elapsed < minMs) {
        await new Promise((resolve) => setTimeout(resolve, minMs - elapsed));
      }
      cameraRef.current.stopRecording();
      const video = await recordingPromiseRef.current;
      if (!video?.uri) return null;
      return { uri: video.uri };
    } finally {
      recordingPromiseRef.current = null;
      recordingStartedAtRef.current = 0;
      recordingActiveRef.current = false;
      setRecording(false);
      onRecordingChange?.(false);
      setBusy(false);
    }
  }, [onRecordingChange]);

  const takePictureAsync = useCallback(
    async (options?: { quality?: number }) => {
      if (!cameraRef.current || !ready || busy || recordingActiveRef.current) return null;
      setBusy(true);
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: options?.quality ?? 0.9,
          flash: flashOn && facing === "back" ? "on" : "off"
        });
        if (!photo?.uri) return null;
        return { uri: photo.uri, width: photo.width, height: photo.height };
      } finally {
        setBusy(false);
      }
    },
    [busy, facing, flashOn, ready]
  );

  const torchOn = flashOn && facing === "back" && ready;
  const cameraZoom = storyZoomToExpoRatio(zoomLevel);

  useImperativeHandle(
    ref,
    () => ({
      takePictureAsync,
      startRecording,
      stopRecording,
      isRecording: () => recordingActiveRef.current
    }),
    [startRecording, stopRecording, takePictureAsync]
  );

  if (!active) {
    return <View style={styles.wrap} />;
  }

  if (!permission?.granted) {
    return (
      <Pressable style={styles.fallback} onPress={onPress ?? (() => void requestPermission())}>
        <Ionicons name="camera-outline" size={36} color="#C9FF35" />
        <Text style={styles.hint}>
          {permission == null ? "Starting camera…" : "Tap to allow camera"}
        </Text>
        {permission == null ? <ActivityIndicator color="#C9FF35" style={{ marginTop: 8 }} /> : null}
      </Pressable>
    );
  }

  const cameraViewMode: "picture" | "video" = mode === "video" || recording ? "video" : "picture";

  return (
    <View style={styles.wrap}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        mode={cameraViewMode}
        active={active}
        zoom={cameraZoom}
        enableTorch={torchOn}
        onCameraReady={() => setReady(true)}
      />
      {!ready ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color="#C9FF35" />
        </View>
      ) : null}
      {recording ? (
        <View style={styles.recordingBadge} pointerEvents="none">
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>Recording</Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: "hidden", backgroundColor: "#000" },
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2e2e2e",
    gap: 8
  },
  hint: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "600" },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  recordingBadge: {
    position: "absolute",
    top: 12,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16
  },
  recordingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ef4444" },
  recordingText: { color: "#fff", fontSize: 12, fontWeight: "700" }
});
