import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import type { DmMediaItem } from "../screens/messaging/dmMessageFormats";
import { APP_LIME } from "../theme/appColors";
import { AppVideo } from "./AppVideo";
import { videoPlaybackUrl } from "../utils/videoPlaybackUrl";

type ChatMediaBubbleProps = {
  media: DmMediaItem;
  isSelf: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
};

export function ChatMediaBubble({ media, onPress, onLongPress }: ChatMediaBubbleProps) {
  const openMedia = () => {
    onPress?.();
  };

  return (
    <Pressable style={styles.card} onPress={openMedia} onLongPress={onLongPress} delayLongPress={280}>
      {media.kind === "image" ? (
        <Image source={{ uri: media.url }} style={styles.media} resizeMode="cover" />
      ) : (
        <AppVideo
          source={videoPlaybackUrl(media.url)}
          style={styles.media}
          contentFit="cover"
          shouldPlay={false}
          isMuted
          nativeControls={false}
        />
      )}
      {media.kind === "video" ? (
        <View style={styles.playBadge}>
          <Ionicons name="play" size={16} color="#111" />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 200,
    height: 260,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)"
  },
  media: { width: "100%", height: "100%" },
  playBadge: {
    position: "absolute",
    left: 10,
    bottom: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: APP_LIME,
    alignItems: "center",
    justifyContent: "center"
  }
});
