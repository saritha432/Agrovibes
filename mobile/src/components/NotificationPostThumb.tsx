import { Ionicons } from "@expo/vector-icons";
import { ResizeMode, Video } from "expo-av";
import React from "react";
import { Image, Platform, Pressable, StyleSheet, View } from "react-native";
import { fetchHomePost, type HomePost } from "../services/api";
import { APP_LIME } from "../theme/appColors";
import { reelGridStillUri } from "../utils/reelGrid";
import { resolveNotificationVideoThumbnail, staticReelPreviewUri } from "../utils/reelPreviewThumb";
import { sanitizeHomePost } from "../utils/mediaUrls";
import { videoPlaybackUrl } from "../utils/videoPlaybackUrl";

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

/** Last-resort paused video frame (web / when no still image exists). */
function NotificationVideoFrame({ uri }: { uri: string }) {
  const videoRef = React.useRef<Video | null>(null);
  const [ready, setReady] = React.useState(false);
  const playback = videoPlaybackUrl(uri);

  React.useEffect(() => {
    setReady(false);
  }, [playback]);

  const primeFrame = React.useCallback(async () => {
    const player = videoRef.current;
    if (!player) return;
    try {
      await player.setPositionAsync(400);
      await player.pauseAsync();
      setReady(true);
    } catch {
      setReady(true);
    }
  }, []);

  if (!playback) {
    return (
      <View style={[styles.image, styles.placeholder]}>
        <Ionicons name="play" size={18} color="rgba(255,255,255,0.45)" />
      </View>
    );
  }

  return (
    <View style={styles.image}>
      {!ready ? (
        <View style={[StyleSheet.absoluteFillObject, styles.placeholder]}>
          <Ionicons name="play" size={18} color="rgba(255,255,255,0.45)" />
        </View>
      ) : null}
      <Video
        ref={videoRef}
        source={{ uri: playback }}
        style={[StyleSheet.absoluteFillObject, ready ? null : styles.hiddenVideo]}
        resizeMode={ResizeMode.COVER}
        isMuted
        shouldPlay={false}
        isLooping={false}
        useNativeControls={false}
        onLoad={() => {
          void primeFrame();
        }}
        onReadyForDisplay={() => {
          void primeFrame();
        }}
        onError={() => setReady(false)}
      />
    </View>
  );
}

export function NotificationPostThumb(props: NotificationPostThumbProps) {
  const post = React.useMemo(() => toPreviewPost(props), [
    props.postId,
    props.postThumbnailUrl,
    props.postImageUrl,
    props.postVideoUrl
  ]);
  const [imageUri, setImageUri] = React.useState<string | null>(() => stillFromPost(post));
  const [videoUri, setVideoUri] = React.useState<string | null>(() => String(post?.videoUrl || "").trim() || null);

  React.useEffect(() => {
    let cancelled = false;

    const applyPost = (next: HomePost | null) => {
      if (!next || cancelled) return;
      const still = stillFromPost(next);
      const video = String(next.videoUrl || "").trim();
      if (still) setImageUri(still);
      if (video) setVideoUri(video);
      return { still, video };
    };

    applyPost(post);

    const id = Number(props.postId);
    if (!Number.isFinite(id) || id <= 0) {
      return () => {
        cancelled = true;
      };
    };

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

      // Native: extract a frame. Web falls through to NotificationVideoFrame.
      if (Platform.OS === "web") return;
      try {
        const thumb = await resolveNotificationVideoThumbnail(video, id);
        if (!cancelled && thumb) setImageUri(thumb);
      } catch {
        // keep placeholder / video frame fallback
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [post, props.postId, props.postThumbnailUrl, props.postImageUrl, props.postVideoUrl, props.token]);

  if (!post) return null;

  const isReel = props.postIsReel || !!videoUri;
  const content = (
    <>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
      ) : videoUri ? (
        <NotificationVideoFrame uri={videoUri} />
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
  hiddenVideo: {
    opacity: 0
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
    backgroundColor: APP_LIME,
    alignItems: "center",
    justifyContent: "center"
  }
});
