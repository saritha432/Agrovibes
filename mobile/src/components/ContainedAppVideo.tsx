import React, { useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, View, type ImageStyle, type ViewStyle } from "react-native";
import { FeedImage } from "./FeedImage";
import { AppVideo, type AppVideoHandle } from "./AppVideo";
import { computeReelVideoFrame } from "../utils/reelGrid";
import { isOversizedFeedVideo, readVideoSizeFromPlaybackStatus } from "../utils/feedVideoLimits";
import {
  nextVideoErrorAction,
  normalizeVideoPlaybackUri,
  videoPlaybackSources
} from "../utils/videoPlaybackUrl";
import type { AppPlaybackStatus } from "../utils/videoPlaybackStatus";

export type ContainedAppVideoHandle = {
  seekToRatio: (ratio: number) => Promise<void>;
};

export type ContainedAppVideoProps = {
  uri: string;
  hlsUrl?: string | null;
  playbackUrl?: string | null;
  shouldPlay: boolean;
  preloadOnly?: boolean;
  containerWidth: number;
  containerHeight: number;
  fit?: "contain" | "cover" | "auto";
  isLooping?: boolean;
  isMuted?: boolean;
  posterUri?: string;
  useNativeControls?: boolean;
  playbackKey?: string;
  onStatusUpdate?: (status: AppPlaybackStatus) => void;
};

export const ContainedAppVideo = React.forwardRef<ContainedAppVideoHandle, ContainedAppVideoProps>(
  function ContainedAppVideo(
    {
      uri,
      hlsUrl,
      playbackUrl,
      shouldPlay,
      preloadOnly = false,
      containerWidth,
      containerHeight,
      fit = "auto",
      isLooping = true,
      isMuted = false,
      posterUri,
      useNativeControls = false,
      playbackKey,
      onStatusUpdate
    },
    ref
  ) {
    const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
    const [playbackBlocked, setPlaybackBlocked] = useState(false);
    const videoRef = useRef<AppVideoHandle | null>(null);
    const sourceIndexRef = useRef(0);
    const durationRef = useRef(0);
    const playbackSources = useMemo(
      () => videoPlaybackSources(uri, hlsUrl, playbackUrl),
      [uri, hlsUrl, playbackUrl]
    );
    const [sourceIndex, setSourceIndex] = useState(0);
    sourceIndexRef.current = sourceIndex;

    const activeUri = useMemo(() => {
      const picked = playbackSources[sourceIndex] ?? uri;
      return normalizeVideoPlaybackUri(picked);
    }, [playbackSources, sourceIndex, uri]);

    const videoFrame = useMemo(() => {
      if (fit === "cover") {
        return { width: containerWidth, height: containerHeight };
      }
      if (fit === "contain") {
        const vw = videoSize.width > 0 ? videoSize.width : 9;
        const vh = videoSize.height > 0 ? videoSize.height : 16;
        const aspect = vw / vh;
        const cw = Math.max(1, containerWidth);
        const ch = Math.max(1, containerHeight);
        const heightAtFullWidth = cw / aspect;
        if (heightAtFullWidth <= ch) {
          return { width: cw, height: heightAtFullWidth };
        }
        return { width: ch * aspect, height: ch };
      }
      const vw = videoSize.width > 0 ? videoSize.width : 9;
      const vh = videoSize.height > 0 ? videoSize.height : 16;
      return computeReelVideoFrame(vw, vh, containerWidth, containerHeight);
    }, [containerHeight, containerWidth, fit, videoSize.height, videoSize.width]);

    const contentFit = fit === "contain" ? "contain" : "cover";

    useEffect(() => {
      setPlaybackBlocked(false);
      setSourceIndex(0);
      sourceIndexRef.current = 0;
      setVideoSize({ width: 0, height: 0 });
    }, [uri, hlsUrl, playbackUrl, playbackKey]);

    useEffect(() => {
      if (playbackSources.length === 0) {
        setPlaybackBlocked(true);
      }
    }, [playbackSources.length]);

    React.useImperativeHandle(
      ref,
      () => ({
        seekToRatio: async (ratio: number) => {
          const target = Math.max(0, Math.min(1, ratio));
          let dur = durationRef.current;
          if (!dur || !Number.isFinite(dur)) {
            const status = await videoRef.current?.getStatusAsync();
            if (status?.isLoaded) {
              dur = Number(status.durationMillis || 0);
              durationRef.current = dur;
            }
          }
          if (!dur || !Number.isFinite(dur)) return;
          await videoRef.current?.setPositionAsync(Math.round(dur * target));
        }
      }),
      []
    );

    if (playbackBlocked) {
      return (
        <View
          style={{
            width: containerWidth,
            height: containerHeight,
            backgroundColor: "#000",
            justifyContent: "center",
            alignItems: "center"
          }}
        >
          {posterUri ? (
            <FeedImage
              source={{ uri: posterUri }}
              style={{ width: videoFrame.width, height: videoFrame.height } as ImageStyle}
              contentFit="cover"
              recyclingKey={posterUri}
            />
          ) : null}
        </View>
      );
    }
    
    const videoStyle: ViewStyle = { width: videoFrame.width, height: videoFrame.height };

    return (
      <View
        collapsable={false}
        style={{
          width: containerWidth,
          height: containerHeight,
          overflow: "hidden",
          backgroundColor: "#000",
          justifyContent: "center",
          alignItems: "center"
        }}
      >
        {posterUri ? (
          <FeedImage
            source={{ uri: posterUri }}
            style={{ width: videoFrame.width, height: videoFrame.height, position: "absolute" } as ImageStyle}
            contentFit="cover"
            recyclingKey={posterUri}
          />
        ) : null}
        <AppVideo
          key={`${playbackKey || uri}-${sourceIndex}`}
          ref={(r) => {
            videoRef.current = r;
          }}
          source={activeUri}
          shouldPlay={shouldPlay}
          isLooping={isLooping}
          isMuted={isMuted || preloadOnly}
          warmBuffer={preloadOnly}
          nativeControls={useNativeControls}
          staysActiveInBackground
          contentFit={contentFit}
          style={videoStyle}
          timeUpdateIntervalMs={preloadOnly ? 4000 : 800}
          onPlaybackStatusUpdate={(status) => {
            if (!preloadOnly) onStatusUpdate?.(status);
            if (status.isLoaded) {
              durationRef.current = Number(status.durationMillis || 0);
              const { width: w, height: h } = readVideoSizeFromPlaybackStatus(status);
              if (w > 0 && h > 0) {
                setVideoSize((prev) =>
                  prev.width === w && prev.height === h ? prev : { width: w, height: h }
                );
              }
              if (isOversizedFeedVideo(w, h)) {
                setPlaybackBlocked(true);
                void videoRef.current?.pauseAsync().catch(() => {});
                void videoRef.current?.unloadAsync().catch(() => {});
              }
              return;
            }
            if (status.error) {
              const idx = sourceIndexRef.current;
              const action = nextVideoErrorAction(status.error, idx, playbackSources.length);
              if (action === "next-source") {
                const next = idx + 1;
                if (next < playbackSources.length) {
                  sourceIndexRef.current = next;
                  setSourceIndex(next);
                } else {
                  setPlaybackBlocked(true);
                  void videoRef.current?.pauseAsync().catch(() => {});
                  void videoRef.current?.unloadAsync().catch(() => {});
                }
              } else if (idx >= playbackSources.length - 1) {
                setPlaybackBlocked(true);
                void videoRef.current?.pauseAsync().catch(() => {});
                void videoRef.current?.unloadAsync().catch(() => {});
              }
            }
          }}
        />
      </View>
    );
  }
);
