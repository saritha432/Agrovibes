import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import type { HomePost } from "../services/api";
import { APP_LIME } from "../theme/appColors";
import { AppVideo } from "./AppVideo";
import { reelGridStillUri } from "../utils/reelGrid";
import { videoPlaybackUrl } from "../utils/videoPlaybackUrl";

type ReelGridTileProps = {
  post: HomePost;
  width: number;
  height: number;
  backgroundColor: string;
  previewUri?: string | null;
  isPlaying?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  onVideoError?: (postId: number) => void;
};

export function ReelGridTile({
  post,
  width,
  height,
  backgroundColor,
  previewUri,
  isPlaying = false,
  onPress,
  onLongPress,
  onVideoError
}: ReelGridTileProps) {
  const stillUri = reelGridStillUri(post) || previewUri || null;
  const videoUri = post.videoUrl ? videoPlaybackUrl(post.videoUrl, post.hlsUrl) : null;
  const isVideo = !!videoUri;
  const showPlayingVideo = isPlaying && isVideo;
  const playbackUri = useMemo(() => videoUri, [videoUri]);

  return (
    <Pressable
      style={[styles.tile, { width, height, backgroundColor }]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      {showPlayingVideo && playbackUri ? (
        <AppVideo
          source={playbackUri}
          style={styles.media}
          contentFit="cover"
          isLooping
          isMuted
          shouldPlay
          nativeControls={false}
          onPlaybackStatusUpdate={(status) => {
            if (!status.isLoaded && status.error) onVideoError?.(post.id);
          }}
        />
      ) : stillUri ? (
        <Image source={{ uri: stillUri }} style={styles.media} resizeMode="cover" />
      ) : playbackUri ? (
        <AppVideo
          source={playbackUri}
          style={styles.media}
          contentFit="cover"
          shouldPlay
          isMuted
          isLooping
          nativeControls={false}
        />
      ) : (
        <View style={[styles.media, styles.placeholder, { backgroundColor }]} />
      )}
      {isVideo ? (
        <View style={styles.playBadge} pointerEvents="none">
          <Ionicons name="videocam" size={20} color={APP_LIME} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { overflow: "hidden", position: "relative" },
  media: { width: "100%", height: "100%" },
  placeholder: {},
  playBadge: {
    position: "absolute",
    top: 8,
    right: 8
  }
});
