import React, { useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { Platform, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { ResizeMode, Video, type AVPlaybackStatus } from "expo-av";
import { expoAvVideoSource } from "../utils/videoPlaybackUrl";
import type { AppPlaybackStatus } from "../utils/videoPlaybackStatus";

export type AppVideoHandle = {
  playAsync: () => Promise<void>;
  pauseAsync: () => Promise<void>;
  unloadAsync: () => Promise<void>;
  getStatusAsync: () => Promise<AppPlaybackStatus>;
  setPositionAsync: (millis: number) => Promise<void>;
};

export type AppVideoProps = {
  source: string | { uri: string };
  style?: StyleProp<ViewStyle>;
  contentFit?: "contain" | "cover" | "fill";
  shouldPlay?: boolean;
  isLooping?: boolean;
  isMuted?: boolean;
  nativeControls?: boolean;
  staysActiveInBackground?: boolean;
  /** Play muted until the first frame, then pause at 0 so swipe-in is instant. */
  warmBuffer?: boolean;
  timeUpdateIntervalMs?: number;
  onPlaybackStatusUpdate?: (status: AppPlaybackStatus) => void;
  onLoad?: () => void;
  onError?: () => void;
  onFirstFrameRender?: () => void;
};

function sourceUri(source: AppVideoProps["source"]): string {
  if (typeof source === "string") return source;
  return String(source?.uri || "");
}

function mapStatus(status: AVPlaybackStatus): AppPlaybackStatus {
  if (!status.isLoaded) {
    return { isLoaded: false, error: "error" in status ? String(status.error || "") : undefined };
  }
  return {
    isLoaded: true,
    isPlaying: !!status.isPlaying,
    positionMillis: Number(status.positionMillis || 0),
    durationMillis: Number(status.durationMillis || 0),
    didJustFinish: !!status.didJustFinish,
    naturalSize: status.naturalSize
      ? { width: Number(status.naturalSize.width || 0), height: Number(status.naturalSize.height || 0) }
      : undefined
  };
}

function resizeModeForFit(fit: "contain" | "cover" | "fill"): ResizeMode {
  if (fit === "cover") return ResizeMode.COVER;
  if (fit === "fill") return ResizeMode.STRETCH;
  return ResizeMode.CONTAIN;
}

export const AppVideo = React.forwardRef<AppVideoHandle, AppVideoProps>(function AppVideo(
  {
    source,
    style,
    contentFit = "contain",
    shouldPlay = false,
    isLooping = false,
    isMuted = false,
    nativeControls = false,
    staysActiveInBackground = false,
    warmBuffer = false,
    timeUpdateIntervalMs = 500,
    onPlaybackStatusUpdate,
    onLoad,
    onError,
    onFirstFrameRender
  },
  ref
) {
  const videoRef = useRef<Video | null>(null);
  const loadedRef = useRef(false);
  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onStatusRef = useRef(onPlaybackStatusUpdate);
  onStatusRef.current = onPlaybackStatusUpdate;
  const onFirstFrameRef = useRef(onFirstFrameRender);
  onFirstFrameRef.current = onFirstFrameRender;
  const shouldPlayRef = useRef(shouldPlay);
  shouldPlayRef.current = shouldPlay;
  const warmBufferRef = useRef(warmBuffer);
  warmBufferRef.current = warmBuffer;
  const warmedRef = useRef(false);
  const uri = sourceUri(source);
  const avSource = useMemo(() => expoAvVideoSource(uri), [uri]);

  useEffect(() => {
    loadedRef.current = false;
    warmedRef.current = false;
  }, [uri]);

  useEffect(() => {
    let cancelled = false;
    const kick = () => {
      if (cancelled) return;
      if (shouldPlay || warmBuffer) {
        void videoRef.current?.playAsync().catch(() => {});
      }
    };
    const t = setTimeout(kick, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [shouldPlay, warmBuffer, uri]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined" || !uri) return;
    const hint = () => {
      const videos = document.querySelectorAll("video");
      videos.forEach((node) => {
        const src = String(node.currentSrc || node.src || "");
        if (!src || !uri || !src.includes(uri.slice(0, 48))) return;
        node.preload = "auto";
        node.setAttribute("preload", "auto");
      });
    };
    const t = setTimeout(hint, 30);
    return () => clearTimeout(t);
  }, [uri]);

  useEffect(() => {
    if (!warmBuffer || shouldPlay) return;
    const t = setTimeout(() => {
      if (shouldPlayRef.current || warmedRef.current) return;
      warmedRef.current = true;
      void videoRef.current?.pauseAsync().catch(() => {});
      void videoRef.current?.setPositionAsync(0).catch(() => {});
    }, 1400);
    return () => clearTimeout(t);
  }, [warmBuffer, shouldPlay, uri]);

  const isWeb = Platform.OS === "web";
  const isCover = contentFit === "cover";
  const webVideoStyle: ViewStyle | undefined = isWeb
    ? ({
        position: "relative",
        left: undefined,
        top: undefined,
        right: undefined,
        bottom: undefined,
        width: "100%",
        height: "100%",
        objectFit: contentFit === "fill" ? "fill" : isCover ? "cover" : "contain"
      } as ViewStyle)
    : undefined;

  useImperativeHandle(
    ref,
    () => ({
      playAsync: async () => {
        await videoRef.current?.playAsync();
      },
      pauseAsync: async () => {
        await videoRef.current?.pauseAsync();
      },
      unloadAsync: async () => {
        await videoRef.current?.unloadAsync();
      },
      getStatusAsync: async () => {
        const status = await videoRef.current?.getStatusAsync();
        if (!status) return { isLoaded: false };
        return mapStatus(status);
      },
      setPositionAsync: async (millis: number) => {
        await videoRef.current?.setPositionAsync(Math.max(0, millis));
      }
    }),
    []
  );

  return (
    <Video
      ref={(r) => {
        videoRef.current = r;
      }}
      source={avSource}
      style={style ?? styles.fill}
      videoStyle={webVideoStyle}
      shouldPlay={shouldPlay}
      isLooping={isLooping}
      isMuted={isMuted}
      rate={1}
      shouldCorrectPitch
      staysActiveInBackground={staysActiveInBackground}
      useNativeControls={nativeControls}
      usePoster={false}
      resizeMode={resizeModeForFit(contentFit)}
      progressUpdateIntervalMillis={Math.max(400, timeUpdateIntervalMs)}
      onReadyForDisplay={() => {
        onFirstFrameRef.current?.();
        if (shouldPlayRef.current || !warmBufferRef.current || warmedRef.current) return;
        warmedRef.current = true;
        void videoRef.current?.pauseAsync().catch(() => {});
        void videoRef.current?.setPositionAsync(0).catch(() => {});
      }}
      onPlaybackStatusUpdate={(status) => {
        const mapped = mapStatus(status);
        onStatusRef.current?.(mapped);
        if (mapped.isLoaded) {
          if (!loadedRef.current) {
            loadedRef.current = true;
            onLoadRef.current?.();
          }
        } else {
          loadedRef.current = false;
          if (mapped.error) onErrorRef.current?.();
        }
      }}
    />
  );
});

const styles = StyleSheet.create({
  fill: {
    width: "100%",
    height: "100%"
  }
});
