import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Image, Platform, Pressable, StyleSheet, View } from "react-native";
import { AppVideo, type AppVideoHandle } from "./AppVideo";
import { fetchHomePost, type HomePost } from "../services/api";
import { APP_LIME } from "../theme/appColors";
import { reelGridStillUri } from "../utils/reelGrid";
import { resolveNotificationVideoThumbnail, staticReelPreviewUri } from "../utils/reelPreviewThumb";
import { sanitizeHomePost } from "../utils/mediaUrls";

type NotificationPostThumbProps = {
  postId?: number | null;
  postThumbnailUrl?: string | null;
  postImageUrl?: string | null;
  postVideoUrl?: string | null;
  postIsReel?: boolean;
  token?: string | null;
  onPress?: () => void;
};

function stillFromPost(post: HomePost | null): string | null {
  if (!post) return null;
  return staticReelPreviewUri(post) || reelGridStillUri(post);
}

function toPreviewPost(props: NotificationPostThumbProps): HomePost | null {
  const id = Number(props.postId);
  if (!Number.isFinite(id) || id <= 0) return null;
  return sanitizeHomePost({
    id,
    userName: "",
    location: "",
    caption: "",
    likesCount: 0,
    commentsCount: 0,
    thumbnailUrl: props.postThumbnailUrl || undefined,
    imageUrl: props.postImageUrl || undefined,
    videoUrl: props.postVideoUrl || undefined
  });
}

export function NotificationPostThumb(props: NotificationPostThumbProps) {
  const post = React.useMemo(() => toPreviewPost(props), [
    props.postId,
    props.postThumbnailUrl,
    props.postImageUrl,
    props.postVideoUrl
  ]);
  const [imageUri, setImageUri] = React.useState<string | null>(() => stillFromPost(post));
  const [hasVideo, setHasVideo] = React.useState(() => !!String(post?.videoUrl || "").trim());

  React.useEffect(() => {
    let cancelled = false;

    const applyPost = (next: HomePost | null) => {
      if (!next || cancelled) return;
      const still = stillFromPost(next);
      const video = String(next.videoUrl || "").trim();
      if (still) setImageUri(still);
      if (video) setHasVideo(true);
      return { still, video };
    };

    applyPost(post);

    const id = Number(props.postId);
    if (!Number.isFinite(id) || id <= 0) {
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      let still = stillFromPost(post);
      let video = String(post?.videoUrl || "").trim();

      // Always hydrate from API when we don't have a still — reels often lack thumbnail on the notification payload.
      if (!still) {
        try {
          const { post: loaded } = await fetchHomePost(props.token ?? null, id);
          if (cancelled) return;
          const applied = applyPost(sanitizeHomePost(loaded));
          still = applied?.still || null;
          video = applied?.video || video;
        } catch {
          // unavailable
        }
      }

      if (cancelled || still || !video) return;

      // Native: extract a frame. Never mount a Video player in the notification list.
      if (Platform.OS === "web") return;
      try {
        const thumb = await resolveNotificationVideoThumbnail(video, id);
        if (!cancelled && thumb) setImageUri(thumb);
      } catch {
        // keep placeholder
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [post, props.postId, props.postThumbnailUrl, props.postImageUrl, props.postVideoUrl, props.token]);

  if (!post) return null;

  const isReel = props.postIsReel || hasVideo;
  // Never mount expo-av Video in the notification list — it makes the sheet open painfully slow.
  const content = (
    <>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.image, styles.placeholder]}>
          <Ionicons
            name={isReel ? "play" : "image-outline"}
            size={18}
            color="rgba(255,255,255,0.45)"
          />
        </View>
      )}
      {isReel ? (
        <View style={styles.playBadge} pointerEvents="none">
          <Ionicons name="play" size={10} color="#111" />
        </View>
      ) : null}
    </>
  );

  if (props.onPress) {
    return (
      <Pressable
        style={styles.wrap}
        onPress={props.onPress}
        delayPressIn={80}
        accessibilityRole="button"
        accessibilityLabel="Open post"
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.wrap}>{content}</View>;
}

const styles = StyleSheet.create({
  wrap: {
    width: 52,
    height: 66,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "#111"
  },
  image: {
    width: "100%",
    height: "100%"
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1a1a1a"
  },
  playBadge: {
    position: "absolute",
    left: 5,
    bottom: 5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: APP_LIME,
    alignItems: "center",
    justifyContent: "center"
  }
});
