import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { StoryCameraPreviewHandle, StoryCameraZoomLevel } from "./storyCameraTypes";
import { REEL_MAX_RECORD_SECONDS } from "./storyCameraTypes";

type Props = {
  facing?: "front" | "back";
  active?: boolean;
  flashOn?: boolean;
  zoomLevel?: StoryCameraZoomLevel;
  mode?: "picture" | "video";
  onPress?: () => void;
  onRecordingChange?: (recording: boolean) => void;
  onAutoRecordFinished?: (payload: { uri: string }) => void;
};

type VideoTrackCaps = MediaTrackCapabilities & {
  zoom?: { min?: number; max?: number; step?: number };
  torch?: boolean;
};

async function applyWebCameraControls(
  stream: MediaStream | null,
  options: { flashOn: boolean; zoomLevel: StoryCameraZoomLevel; facing: "front" | "back" }
) {
  const track = stream?.getVideoTracks()[0];
  if (!track?.getCapabilities) return;
  const caps = track.getCapabilities() as VideoTrackCaps;
  const next: MediaTrackConstraints & { torch?: boolean; zoom?: number } = {};

  if (caps.zoom && typeof caps.zoom === "object") {
    const min = caps.zoom.min ?? 1;
    const max = caps.zoom.max ?? min;
    next.zoom = options.zoomLevel === 2 ? Math.min(max, Math.max(min, min * 2)) : min;
  }

  if (caps.torch && options.flashOn && options.facing === "back") {
    next.torch = true;
  } else if (caps.torch) {
    next.torch = false;
  }

  if (!Object.keys(next).length) return;
  try {
    await track.applyConstraints(next);
  } catch {
    // Hardware zoom/torch may be unavailable; CSS preview zoom still applies.
  }
}

function applyVideoPresentation(video: HTMLVideoElement, facing: "front" | "back", zoomLevel: StoryCameraZoomLevel) {
  const scale = zoomLevel === 2 ? 2 : 1;
  video.style.transformOrigin = "center center";
  if (facing === "front") {
    video.style.transform = scale === 1 ? "scaleX(-1)" : `scaleX(-1) scale(${scale})`;
    return;
  }
  video.style.transform = scale === 1 ? "none" : `scale(${scale})`;
}

function stopStream(stream: MediaStream | null) {
  if (!stream) return;
  for (const track of stream.getTracks()) track.stop();
}

function detachVideo(video: HTMLVideoElement | null) {
  if (!video) return;
  try {
    video.pause();
  } catch {
    // no-op
  }
  video.srcObject = null;
}

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
  const hostRef = useRef<View>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingActiveRef = useRef(false);
  const activeRef = useRef(active);
  const startTokenRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    activeRef.current = active;
    if (!active) {
      // Invalidate any in-flight getUserMedia request.
      startTokenRef.current += 1;
    }
  }, [active]);

  const startCamera = useCallback(async () => {
    const startToken = ++startTokenRef.current;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setErrorText("Camera is not supported in this browser.");
      return;
    }
    setErrorText("");
    setReady(false);
    stopStream(streamRef.current);
    streamRef.current = null;

    const host = hostRef.current as unknown as HTMLElement | null;
    if (!host) return;

    let video = videoRef.current;
    if (!video) {
      video = document.createElement("video");
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      video.style.width = "100%";
      video.style.height = "100%";
      video.style.objectFit = "cover";
      video.style.backgroundColor = "#000";
      host.appendChild(video);
      videoRef.current = video;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing === "front" ? "user" : "environment" },
        audio: mode === "video" || recordingActiveRef.current
      });
      if (!activeRef.current || startToken !== startTokenRef.current) {
        stopStream(stream);
        return;
      }
      streamRef.current = stream;
      video.srcObject = stream;
      applyVideoPresentation(video, facing, zoomLevel);
      await applyWebCameraControls(stream, { flashOn, zoomLevel, facing });
      await video.play();
      setReady(true);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Could not access camera.");
    }
  }, [facing, flashOn, mode, zoomLevel]);

  useEffect(() => {
    if (!ready || !streamRef.current || !videoRef.current) return;
    applyVideoPresentation(videoRef.current, facing, zoomLevel);
    void applyWebCameraControls(streamRef.current, { flashOn, zoomLevel, facing });
  }, [ready, flashOn, zoomLevel, facing]);

  useEffect(() => {
    if (!active) {
      if (recorderRef.current?.state === "recording") {
        try {
          recorderRef.current.stop();
        } catch {
          // no-op
        }
      }
      recorderRef.current = null;
      stopStream(streamRef.current);
      streamRef.current = null;
      const host = hostRef.current as unknown as HTMLElement | null;
      if (host && videoRef.current && host.contains(videoRef.current)) {
        detachVideo(videoRef.current);
        host.removeChild(videoRef.current);
      }
      videoRef.current = null;
      recordingActiveRef.current = false;
      setReady(false);
      setRecording(false);
      onRecordingChange?.(false);
      return;
    }
    const t = setTimeout(() => void startCamera(), 50);
    return () => clearTimeout(t);
  }, [active, facing, mode, onRecordingChange, startCamera]);

  useEffect(() => {
    return () => {
      startTokenRef.current += 1;
      if (recorderRef.current?.state === "recording") {
        try {
          recorderRef.current.stop();
        } catch {
          // no-op
        }
      }
      recorderRef.current = null;
      stopStream(streamRef.current);
      streamRef.current = null;
      const host = hostRef.current as unknown as HTMLElement | null;
      if (host && videoRef.current && host.contains(videoRef.current)) {
        detachVideo(videoRef.current);
        host.removeChild(videoRef.current);
      }
      videoRef.current = null;
      recordingActiveRef.current = false;
    };
  }, []);

  const takePictureAsync = useCallback(
    async (options?: { quality?: number }) => {
      const video = videoRef.current;
      if (!video || !ready || busy || recordingActiveRef.current) return null;
      setBusy(true);
      try {
        const w = video.videoWidth || 720;
        const h = video.videoHeight || 1280;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        const zoomScale = zoomLevel === 2 ? 2 : 1;
        const sw = w / zoomScale;
        const sh = h / zoomScale;
        const sx = (w - sw) / 2;
        const sy = (h - sh) / 2;
        if (facing === "front") {
          ctx.translate(w, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
        const quality = Math.min(Math.max(options?.quality ?? 0.9, 0.1), 1);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        return { uri: dataUrl, width: w, height: h };
      } finally {
        setBusy(false);
      }
    },
    [busy, facing, ready, zoomLevel]
  );

  const startRecording = useCallback(
    async (options?: { maxDurationSec?: number }) => {
      const video = videoRef.current;
      if (!video || !ready || recordingActiveRef.current || busy) return;
      if (!streamRef.current) await startCamera();
      const stream = streamRef.current;
      if (!stream) throw new Error("Camera unavailable.");
      if (!stream.getAudioTracks().length) {
        stopStream(streamRef.current);
        streamRef.current = null;
        await startCamera();
      }
      const activeStream = streamRef.current;
      if (!activeStream) throw new Error("Microphone permission is required for video.");

      recordingActiveRef.current = true;
      setRecording(true);
      onRecordingChange?.(true);
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : MediaRecorder.isTypeSupported("video/webm")
          ? "video/webm"
          : "";
      const recorder = mimeType ? new MediaRecorder(activeStream, { mimeType }) : new MediaRecorder(activeStream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
        const uri = URL.createObjectURL(blob);
        recordingActiveRef.current = false;
        setRecording(false);
        onRecordingChange?.(false);
        onAutoRecordFinished?.({ uri });
      };
      recorder.start(250);

      const maxDuration = Math.min(Math.max(options?.maxDurationSec ?? 60, 1), REEL_MAX_RECORD_SECONDS);
      setTimeout(() => {
        if (recorderRef.current?.state === "recording") {
          try {
            recorderRef.current.stop();
          } catch {
            //
          }
        }
      }, maxDuration * 1000);
    },
    [busy, onAutoRecordFinished, onRecordingChange, ready, startCamera]
  );

  const stopRecording = useCallback(async () => {
    if (!recordingActiveRef.current || !recorderRef.current) return null;
    setBusy(true);
    try {
      if (recorderRef.current.state === "recording") {
        recorderRef.current.stop();
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 120));
      return null;
    } finally {
      recorderRef.current = null;
      recordingActiveRef.current = false;
      setRecording(false);
      onRecordingChange?.(false);
      setBusy(false);
    }
  }, [onRecordingChange]);

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

  if (errorText) {
    return (
      <Pressable style={styles.fallback} onPress={onPress ?? (() => void startCamera())}>
        <Ionicons name="camera-outline" size={36} color="#C9FF35" />
        <Text style={styles.hint}>{errorText}</Text>
        <Text style={styles.hintSub}>Tap to retry</Text>
      </Pressable>
    );
  }

  return (
    <View ref={hostRef} style={styles.wrap} collapsable={false}>
      {!ready ? (
        <View style={styles.loading}>
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
    gap: 8,
    paddingHorizontal: 24
  },
  hint: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "600", textAlign: "center" },
  hintSub: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "600" },
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
    borderRadius: 16,
    zIndex: 2
  },
  recordingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ef4444" },
  recordingText: { color: "#fff", fontSize: 12, fontWeight: "700" }
});
