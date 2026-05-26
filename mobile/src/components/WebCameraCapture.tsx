import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { ImagePickerAsset } from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type WebCameraFacing = "front" | "back";

type Props = {
  visible: boolean;
  onClose: () => void;
  onCapture: (asset: ImagePickerAsset) => void;
  initialFacing?: WebCameraFacing;
  allowVideo?: boolean;
  mode?: "any" | "video";
  autoStartVideo?: boolean;
};

function stopStream(stream: MediaStream | null) {
  if (!stream) return;
  for (const track of stream.getTracks()) track.stop();
}

export function WebCameraCapture({
  visible,
  onClose,
  onCapture,
  initialFacing = "front",
  allowVideo = true,
  mode = "any",
  autoStartVideo = false
}: Props) {
  const insets = useSafeAreaInsets();
  const hostRef = useRef<View>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [facing, setFacing] = useState<WebCameraFacing>(initialFacing);
  const [ready, setReady] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);

  const startCamera = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setErrorText("Camera is not supported in this browser. Use Chrome or Edge over HTTPS/localhost.");
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
        audio: allowVideo
      });
      streamRef.current = stream;
      video.srcObject = stream;
      video.style.transform = facing === "front" ? "scaleX(-1)" : "none";
      await video.play();
      setReady(true);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Could not access camera. Allow permission in the browser.");
    }
  }, [allowVideo, facing]);

  useEffect(() => {
    if (!visible) {
      stopStream(streamRef.current);
      streamRef.current = null;
      const host = hostRef.current as unknown as HTMLElement | null;
      if (host && videoRef.current && host.contains(videoRef.current)) {
        host.removeChild(videoRef.current);
      }
      videoRef.current = null;
      setReady(false);
      setRecording(false);
      return;
    }
    setFacing(initialFacing);
    const t = setTimeout(() => void startCamera(), 50);
    return () => {
      clearTimeout(t);
      stopStream(streamRef.current);
      streamRef.current = null;
    };
  }, [initialFacing, startCamera, visible]);

  useEffect(() => {
    if (!visible) return;
    void startCamera();
  }, [facing, startCamera, visible]);

  const takePhoto = async () => {
    const video = videoRef.current;
    if (!video || !ready || busy) return;
    setBusy(true);
    try {
      const w = video.videoWidth || 720;
      const h = video.videoHeight || 1280;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not available");
      if (facing === "front") {
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, w, h);
      const uri = canvas.toDataURL("image/jpeg", 0.92);
      onCapture({
        uri,
        type: "image",
        width: w,
        height: h,
        mimeType: "image/jpeg"
      });
      onClose();
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Could not capture photo.");
    } finally {
      setBusy(false);
    }
  };

  const toggleRecording = async () => {
    const stream = streamRef.current;
    if (!stream || !allowVideo) return;
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setErrorText("Video recording is not supported in this browser.");
      return;
    }
    try {
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      recorderRef.current = recorder;
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        setRecording(false);
        setBusy(false);
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const uri = URL.createObjectURL(blob);
        onCapture({
          uri,
          type: "video",
          width: videoRef.current?.videoWidth ?? 0,
          height: videoRef.current?.videoHeight ?? 0,
          mimeType: "video/webm"
        });
        onClose();
      };
      recorder.start();
      setRecording(true);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Could not start recording.");
    }
  };

  useEffect(() => {
    if (!visible || !ready || !allowVideo || !autoStartVideo || recording || busy) return;
    const timer = setTimeout(() => void toggleRecording(), 120);
    return () => clearTimeout(timer);
  }, [allowVideo, autoStartVideo, busy, ready, recording, visible]);

  if (!visible || typeof document === "undefined") return null;

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.root}>
        <View ref={hostRef} style={styles.videoHost} />

        {!ready && !errorText ? (
          <View style={styles.centerWrap}>
            <ActivityIndicator size="large" color="#C9FF35" />
            <Text style={styles.loadingText}>Starting camera…</Text>
          </View>
        ) : null}

        {errorText ? (
          <View style={styles.centerWrap}>
            <Text style={styles.errorText}>{errorText}</Text>
            <Pressable style={styles.retryBtn} onPress={() => void startCamera()}>
              <Text style={styles.retryBtnText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
          <Pressable style={styles.iconBtn} onPress={onClose}>
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => setFacing((f) => (f === "front" ? "back" : "front"))}>
            <Ionicons name="camera-reverse-outline" size={28} color="#C9FF35" />
          </Pressable>
        </View>

        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {allowVideo ? (
            <Text style={styles.hint}>
              {recording ? "Live recording · tap to stop" : mode === "video" ? "Starting live video..." : "Tap photo · long-press for video"}
            </Text>
          ) : null}
          <Pressable
            style={[styles.shutterOuter, recording ? styles.shutterOuterRec : null]}
            onPress={() => {
              if (mode === "video") void toggleRecording();
              else void takePhoto();
            }}
            onLongPress={allowVideo && mode !== "video" ? () => void toggleRecording() : undefined}
            delayLongPress={300}
            disabled={!ready || busy}
          >
            <View style={[styles.shutterInner, recording ? styles.shutterInnerRec : null]} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", width: "100%", height: "100%" },
  videoHost: { ...StyleSheet.absoluteFillObject, overflow: "hidden", backgroundColor: "#000" },
  centerWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    zIndex: 2
  },
  loadingText: { color: "#C9FF35", fontWeight: "600" },
  errorText: { color: "#fecaca", textAlign: "center", paddingHorizontal: 24, fontWeight: "600" },
  retryBtn: {
    marginTop: 12,
    backgroundColor: "#C9FF35",
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10
  },
  retryBtnText: { color: "#111", fontWeight: "800" },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 3,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center"
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 3,
    alignItems: "center",
    gap: 10
  },
  hint: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "600" },
  shutterOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: "#C9FF35",
    alignItems: "center",
    justifyContent: "center"
  },
  shutterOuterRec: { borderColor: "#ef4444" },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#fff" },
  shutterInnerRec: { width: 32, height: 32, borderRadius: 6, backgroundColor: "#ef4444" }
});
