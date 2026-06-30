import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Image, StyleSheet, View } from "react-native";
import type { HomePost } from "../services/api";
import { resolveReelPreviewUri, staticReelPreviewUri } from "../utils/reelPreviewThumb";

type NotificationPostThumbProps = {
  postId?: number | null;
  postThumbnailUrl?: string | null;
  postImageUrl?: string | null;
  postVideoUrl?: string | null;
  postIsReel?: boolean;
};

function toPreviewPost(props: NotificationPostThumbProps): HomePost | null {
  const id = Number(props.postId);
  if (!Number.isFinite(id) || id <= 0) return null;
  return {
    id,
    userName: "",
    location: "",
    caption: "",
    likesCount: 0,
    commentsCount: 0,
    thumbnailUrl: props.postThumbnailUrl || undefined,
    imageUrl: props.postImageUrl || undefined,
    videoUrl: props.postVideoUrl || undefined
  };
}

export function NotificationPostThumb(props: NotificationPostThumbProps) {
  const post = React.useMemo(() => toPreviewPost(props), [props]);
  const [previewUri, setPreviewUri] = React.useState<string | null>(() =>
    post ? staticReelPreviewUri(post) : null
  );

  React.useEffect(() => {
    if (!post) {
      setPreviewUri(null);
      return;
    }
    const staticUri = staticReelPreviewUri(post);
    if (staticUri) {
      setPreviewUri(staticUri);
      return;
    }
    if (!String(post.videoUrl || "").trim()) {
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
  }, [post?.id, post?.thumbnailUrl, post?.imageUrl, post?.videoUrl]);

  if (!post) return null;

  return (
    <View style={styles.wrap} accessibilityIgnoresInvertColors>
      {previewUri ? (
        <Image source={{ uri: previewUri }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.image, styles.placeholder]}>
          <Ionicons
            name={props.postIsReel || post.videoUrl ? "play" : "image-outline"}
            size={16}
            color="rgba(255,255,255,0.45)"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 44,
    height: 56,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
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
  }
});
