import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { fetchHomePost, type HomePost } from "../services/api";
import { reelGridStillUri } from "../utils/reelGrid";
import { resolveReelPreviewUri, staticReelPreviewUri } from "../utils/reelPreviewThumb";
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

/** Notification reel/post thumb — one still at a time; extracts a video frame only when no image URL exists. */
export function NotificationPostThumb(props: NotificationPostThumbProps) {
  const post = React.useMemo(() => toPreviewPost(props), [
    props.postId,
    props.postThumbnailUrl,
    props.postImageUrl,
    props.postVideoUrl
  ]);
  const [previewUri, setPreviewUri] = React.useState<string | null>(() => stillFromPost(post));

  React.useEffect(() => {
    let cancelled = false;

    const applyUri = (uri: string | null) => {
      if (!cancelled && uri) setPreviewUri(uri);
    };

    const load = async () => {
      if (!post) {
        setPreviewUri(null);
        return;
      }

      const staticUri = stillFromPost(post);
      if (staticUri) {
        setPreviewUri(staticUri);
        return;
      }

      if (String(post.videoUrl || "").trim()) {
        const fromVideo = await resolveReelPreviewUri(post);
        if (fromVideo) {
          applyUri(fromVideo);
          return;
        }
      }

      const id = Number(props.postId);
      if (!Number.isFinite(id) || id <= 0) return;
      try {
        const { post: loaded } = await fetchHomePost(props.token ?? null, id);
        if (cancelled) return;
        const sanitized = sanitizeHomePost(loaded);
        const fromLoaded = stillFromPost(sanitized) || (await resolveReelPreviewUri(sanitized));
        applyUri(fromLoaded);
      } catch {
        // unavailable
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [post, props.postId, props.postThumbnailUrl, props.postImageUrl, props.postVideoUrl, props.token]);

  if (!post) return null;

  const content = (
    <>
      {previewUri ? (
        <Image source={{ uri: previewUri }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.image, styles.placeholder]}>
          <Ionicons
            name={props.postIsReel || post.videoUrl ? "play" : "image-outline"}
            size={18}
            color="rgba(255,255,255,0.45)"
          />
        </View>
      )}
      {props.postIsReel || post.videoUrl ? (
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
    width: 18,
    height: 18,
    borderRadius: 5,
    backgroundColor: "#c9ff35",
    alignItems: "center",
    justifyContent: "center"
  }
});
