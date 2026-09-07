import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { AppVideo } from "./AppVideo";
import type { AppLanguage } from "../localization/translations";
import { formatDisplayName, sharedReelCardCaption } from "../localization/feedDisplay";
import type { HomePost } from "../services/api";
import { APP_LIME } from "../theme/appColors";
import { resolveReelPreviewUri, staticReelPreviewUri } from "../utils/reelPreviewThumb";
import { videoPlaybackUrl } from "../utils/videoPlaybackUrl";

const CARD_WIDTH = 172;
const CARD_HEIGHT = 306;

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

type SharedReelChatCardProps = {
  post: HomePost;
  onPress: () => void;
  onLongPress?: () => void;
  language: AppLanguage;
  t: TranslateFn;
};

export function SharedReelChatCard({ post, onPress, onLongPress, language, t }: SharedReelChatCardProps) {
  const videoUrl = String(post.videoUrl || "").trim();
  const isVideo = !!videoUrl;
  const [previewUri, setPreviewUri] = React.useState<string | null>(() => staticReelPreviewUri(post));

  React.useEffect(() => {
    const staticUri = staticReelPreviewUri(post);
    if (staticUri) {
      setPreviewUri(staticUri);
      return;
    }
    if (!videoUrl) {
      setPreviewUri(null);
      return;
    }
    let cancelled = false;
    void resolveReelPreviewUri(post).then((uri) => {
      if (!cancelled && uri) setPreviewUri(uri);
    });
    return () => {
      cancelled = true;
    };
  }, [post.id, post.thumbnailUrl, post.imageUrl, post.imageUrls, post.videoUrl, videoUrl]);

  const author = formatDisplayName(post.userName, language, t);
  const label = sharedReelCardCaption(post.caption);

  return (
    <Pressable style={styles.card} onPress={onPress} onLongPress={onLongPress} delayLongPress={280} accessibilityRole="button">
      <View style={styles.mediaWrap}>
        {previewUri ? (
          <Image source={{ uri: previewUri }} style={styles.media} resizeMode="cover" />
        ) : videoUrl ? (
          <AppVideo
            source={videoPlaybackUrl(videoUrl)}
            style={styles.media}
            contentFit="cover"
            shouldPlay={false}
            isMuted
            isLooping={false}
            nativeControls={false}
          />
        ) : (
          <View style={[styles.media, styles.placeholder]}>
            <Ionicons
              name={isVideo ? "videocam-outline" : "images-outline"}
              size={32}
              color="rgba(255,255,255,0.35)"
            />
          </View>
        )}

        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.15)", "rgba(0,0,0,0.82)"]}
          locations={[0.35, 0.62, 1]}
          style={styles.gradient}
          pointerEvents="none"
        />

        {isVideo ? (
          <>
            <View style={styles.centerPlay} pointerEvents="none">
              <View style={styles.centerPlayCircle}>
                <Ionicons name="play" size={34} color="#fff" style={styles.centerPlayIcon} />
              </View>
            </View>
            <View style={styles.cornerPlay} pointerEvents="none">
              <Ionicons name="play" size={13} color="#111" />
            </View>
          </>
        ) : null}

        <View style={styles.bottomMeta} pointerEvents="none">
          <Text style={styles.author} numberOfLines={1}>
            {author}
          </Text>
          <Text style={styles.caption} numberOfLines={2}>
            {label}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)"
  },
  mediaWrap: {
    flex: 1,
    backgroundColor: "#111"
  },
  media: {
    width: "100%",
    height: "100%"
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#262626"
  },
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "52%"
  },
  centerPlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center"
  },
  centerPlayCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)"
  },
  centerPlayIcon: {
    marginLeft: 3
  },
  cornerPlay: {
    position: "absolute",
    left: 10,
    bottom: 10,
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: APP_LIME,
    alignItems: "center",
    justifyContent: "center"
  },
  bottomMeta: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 42
  },
  author: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900"
  },
  caption: {
    marginTop: 3,
    color: "rgba(255,255,255,0.9)",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15
  }
});
