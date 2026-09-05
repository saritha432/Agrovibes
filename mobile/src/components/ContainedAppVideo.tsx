import React, { useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View, type ImageStyle, type ViewStyle } from "react-native";
import { FeedImage } from "./FeedImage";
import { AppVideo, type AppVideoHandle } from "./AppVideo";
import { pickReelVideoFit } from "../utils/reelGrid";
import { isOversizedFeedVideo, readVideoSizeFromPlaybackStatus } from "../utils/feedVideoLimits";
import { nextVideoErrorAction, videoPlaybackSources, videoPlaybackUrl } from "../utils/videoPlaybackUrl";
import type { AppPlaybackStatus } from "../utils/videoPlaybackStatus";

export type ContainedAppVideoHandle = {
  seekToRatio: (ratio: number) => Promise<void>;
};

export type ContainedAppVideoProps = {
  uri: string;
  hlsUrl?: string | null;
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
    const isWeb = Platform.OS === "web";
    const effectiveFit = useMemo((): "contain" | "cover" => {
      if (fit === "cover" || fit === "contain") return fit;
      return pickReelVideoFit(9, 16, containerWidth, containerHeight);
    }, [fit, containerWidth, containerHeight]);
    const isCover = effectiveFit === "cover";
    const [playbackBlocked, setPlaybackBlocked] = useState(false);
    const videoRef = useRef<AppVideoHandle | null>(null);
    const durationRef = useRef(0);
    const playbackSources = useMemo(() => videoPlaybackSources(uri, hlsUrl), [uri, hlsUrl]);
    const [sourceIndex, setSourceIndex] = useState(0);
    const activeUri = useMemo(
      () => videoPlaybackUrl(playbackSources[sourceIndex] ?? uri),
      [playbackSources, sourceIndex, uri]
    );

    useEffect(() => {
      setPlaybackBlocked(false);
      setSourceIndex(0);
    }, [uri, playbackKey]);

    const videoOuterStyle: ViewStyle = useMemo(
      () => (isWeb ? { width: "100%", height: "100%" } : StyleSheet.absoluteFillObject),
      [isWeb]
    );

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
              style={{ width: containerWidth, height: containerHeight } as ImageStyle}
              contentFit="contain"
              recyclingKey={posterUri}
            />
          ) : null}
          <Text style={{ position: "absolute", bottom: 48, color: "rgba(255,255,255,0.75)", fontSize: 13 }}>
            Video unavailable
          </Text>
        </View>
      );
    }

    return (
      <View
        collapsable={false}
        style={{
          width: containerWidth,
          height: containerHeight,
          overflow: "hidden",
          backgroundColor: "#000"
        }}
      >
        <AppVideo
          key={playbackKey ? `${playbackKey}::${activeUri}` : activeUri}
          ref={(r) => {
            videoRef.current = r;
          }}
          source={activeUri}
          shouldPlay={shouldPlay}
          isLooping={isLooping}
          isMuted={isMuted || preloadOnly}
          nativeControls={useNativeControls}
          staysActiveInBackground
          contentFit={isCover ? "cover" : "contain"}
          style={videoOuterStyle}
          timeUpdateIntervalMs={preloadOnly ? 4000 : 500}
          onPlaybackStatusUpdate={(status) => {
            onStatusUpdate?.(status);
            if (status.isLoaded) {
              durationRef.current = Number(status.durationMillis || 0);
              const { width: w, height: h } = readVideoSizeFromPlaybackStatus(status);
              if (isOversizedFeedVideo(w, h)) {
                setPlaybackBlocked(true);
                void videoRef.current?.pauseAsync().catch(() => {});
                void videoRef.current?.unloadAsync().catch(() => {});
              }
              return;
            }
            if (status.error) {
              console.warn("[Cropvibe Video]", activeUri.slice(0, 160), status.error);
              const action = nextVideoErrorAction(status.error, sourceIndex, playbackSources.length);
              if (action === "next-source") setSourceIndex((i) => i + 1);
            }
          }}
        />
      </View>
    );
  }
);
