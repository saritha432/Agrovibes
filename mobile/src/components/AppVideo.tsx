import React, { useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { Platform, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useVideoPlayer, VideoView, type VideoSource } from "expo-video";
import { normalizeVideoPlaybackUri } from "../utils/videoPlaybackUrl";
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
  /** Load the source into the native player without playing (next-reel prefetch). */
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

function toVideoSource(uri: string): VideoSource | null {
  const clean = normalizeVideoPlaybackUri(uri);
  if (!clean) return null;
  const path = clean.split("?")[0].split("#")[0].toLowerCase();
  const isHls = /\.m3u8$/i.test(path);
  return {
    uri: clean,
    contentType: isHls ? "hls" : "auto",
    // iOS cannot cache HLS; MP4 cache makes swipe-back instant like Instagram.
    useCaching: Platform.OS !== "web" && !isHls && /^https?:\/\//i.test(clean)
  };
}

function replacePlayerSource(player: ReturnType<typeof useVideoPlayer>, source: VideoSource | null) {
  const anyPlayer = player as typeof player & {
    replaceAsync?: (next: VideoSource | null) => Promise<void>;
  };
  if (typeof anyPlayer.replaceAsync === "function") {
    return anyPlayer.replaceAsync(source);
  }
  player.replace(source);
  return Promise.resolve();
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
  const uri = sourceUri(source);
  const videoSource = useMemo(() => toVideoSource(uri), [uri]);
  const loadedRef = useRef(false);
  const sizeRef = useRef<{ width: number; height: number } | undefined>(undefined);
  const finishedRef = useRef(false);
  const lastUriRef = useRef(uri);
  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onStatusRef = useRef(onPlaybackStatusUpdate);
  onStatusRef.current = onPlaybackStatusUpdate;

  const player = useVideoPlayer(videoSource, (next) => {
    next.loop = isLooping;
    next.muted = isMuted;
    next.staysActiveInBackground = staysActiveInBackground;
    try {
      next.bufferOptions = {
        preferredForwardBufferDuration: warmBuffer && !shouldPlay ? 4 : 10,
        minBufferForPlayback: 0.5,
        waitsToMinimizeStalling: true
      };
    } catch {
      // Older expo-video builds may not expose bufferOptions.
    }
    try {
      (next as { timeUpdateEventInterval?: number }).timeUpdateEventInterval = Math.max(
        0.4,
        timeUpdateIntervalMs / 1000
      );
    } catch {
      // ignore
    }
    if (shouldPlay) next.play();
  });

  const emitStatus = (error?: string) => {
    const status = player.status;
    if (status === "error" || error) {
      loadedRef.current = false;
      const mapped: AppPlaybackStatus = { isLoaded: false, error: error || "playback error" };
      onStatusRef.current?.(mapped);
      return mapped;
    }
    const durationSec = Number(player.duration || 0);
    const canReportLoaded =
      status === "readyToPlay" || player.playing || (Number.isFinite(durationSec) && durationSec > 0);
    if (!canReportLoaded) {
      const mapped: AppPlaybackStatus = { isLoaded: false };
      onStatusRef.current?.(mapped);
      return mapped;
    }
    const mapped: AppPlaybackStatus = {
      isLoaded: true,
      isPlaying: !!player.playing,
      positionMillis: Math.max(0, Number(player.currentTime || 0) * 1000),
      durationMillis: Math.max(0, durationSec * 1000),
      didJustFinish: finishedRef.current,
      naturalSize: sizeRef.current
    };
    onStatusRef.current?.(mapped);
    if (!loadedRef.current && (status === "readyToPlay" || durationSec > 0 || player.playing)) {
      loadedRef.current = true;
      onLoadRef.current?.();
    }
    return mapped;
  };

  useEffect(() => {
    if (lastUriRef.current === uri) return;
    lastUriRef.current = uri;
    loadedRef.current = false;
    finishedRef.current = false;
    sizeRef.current = undefined;
    void replacePlayerSource(player, videoSource).catch(() => {
      onErrorRef.current?.();
    });
  }, [player, uri, videoSource]);

  useEffect(() => {
    player.loop = isLooping;
  }, [player, isLooping]);

  useEffect(() => {
    player.muted = isMuted;
  }, [player, isMuted]);

  useEffect(() => {
    player.staysActiveInBackground = staysActiveInBackground;
  }, [player, staysActiveInBackground]);

  useEffect(() => {
    if (shouldPlay) {
      finishedRef.current = false;
      player.play();
      return;
    }
    player.pause();
  }, [player, shouldPlay]);

  useEffect(() => {
    const subs: Array<{ remove: () => void }> = [];
    const listen = (event: string, handler: (payload: unknown) => void) => {
      try {
        subs.push(player.addListener(event as "statusChange", handler as never));
      } catch {
        // Event not available on this platform / expo-video version.
      }
    };
    listen("statusChange", (payload) => {
      const { status, error } = payload as { status?: string; error?: { message?: string } | string };
      if (status === "error") {
        loadedRef.current = false;
        const message = error ? String(typeof error === "string" ? error : error.message || error) : "playback error";
        onErrorRef.current?.();
        emitStatus(message);
        return;
      }
      if (status === "readyToPlay" && !loadedRef.current) {
        loadedRef.current = true;
        onLoadRef.current?.();
      }
      emitStatus();
    });
    listen("playingChange", () => emitStatus());
    listen("playToEnd", () => {
      finishedRef.current = true;
      emitStatus();
    });
    listen("sourceLoad", (payload) => {
      const tracks = (payload as { availableVideoTracks?: Array<{ width?: number; height?: number }> })
        .availableVideoTracks;
      const track = tracks?.[0];
      const width = Number(track?.width || 0);
      const height = Number(track?.height || 0);
      if (width > 0 && height > 0) sizeRef.current = { width, height };
      if (!loadedRef.current) {
        loadedRef.current = true;
        onLoadRef.current?.();
      }
      emitStatus();
    });
    listen("timeUpdate", () => {
      finishedRef.current = false;
      emitStatus();
    });
    const poll = setInterval(() => emitStatus(), Math.max(400, timeUpdateIntervalMs));
    return () => {
      clearInterval(poll);
      subs.forEach((sub) => {
        try {
          sub.remove();
        } catch {
          // ignore
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, timeUpdateIntervalMs]);

  useImperativeHandle(
    ref,
    () => ({
      playAsync: async () => {
        player.play();
      },
      pauseAsync: async () => {
        player.pause();
      },
      unloadAsync: async () => {
        player.pause();
        await replacePlayerSource(player, null).catch(() => {});
      },
      getStatusAsync: async () => emitStatus(),
      setPositionAsync: async (millis: number) => {
        player.currentTime = Math.max(0, millis) / 1000;
      }
    }),
    [player]
  );

  if (!uri) return null;

  return (
    <VideoView
      player={player}
      style={style ?? styles.fill}
      contentFit={contentFit}
      nativeControls={nativeControls}
      playsInline
      onFirstFrameRender={onFirstFrameRender}
    />
  );
});

const styles = StyleSheet.create({
  fill: {
    width: "100%",
    height: "100%"
  }
});
