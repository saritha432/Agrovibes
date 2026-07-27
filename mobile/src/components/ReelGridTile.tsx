import { Ionicons } from "@expo/vector-icons";
import { ResizeMode, Video, type AVPlaybackStatus } from "expo-av";
import React, { useCallback } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import type { HomePost } from "../services/api";
import { APP_LIME } from "../theme/appColors";
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

  const onPlaybackStatus = useCallback(
    (status: AVPlaybackStatus) => {
      if (!status.isLoaded) return;
      if (status.error) onVideoError?.(post.id);
    },
    [onVideoError, post.id]
  );

  return (
    <Pressable
      style={[styles.tile, { width, height, backgroundColor }]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      {showPlayingVideo ? (
        <Video
          source={{ uri: videoUri! }}
          style={styles.media}
          resizeMode={ResizeMode.COVER}
          isLooping
          isMuted
          shouldPlay
          useNativeControls={false}
          onPlaybackStatusUpdate={onPlaybackStatus}
        />
      ) : stillUri ? (
        <Image source={{ uri: stillUri }} style={styles.media} resizeMode="cover" />
      ) : isVideo ? (
        <Video
          source={{ uri: videoUri }}
          style={styles.media}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isMuted
          isLooping
          useNativeControls={false}
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
