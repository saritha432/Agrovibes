import { Ionicons } from "@expo/vector-icons";
import { AppVideo } from "./AppVideo";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { HomeStory } from "../services/api";
import { APP_LIME } from "../theme/appColors";
import { videoPlaybackUrl } from "../utils/videoPlaybackUrl";
import { UserAvatar } from "./UserAvatar";

const STORY_IMAGE_MS = 5000;
const APP_DARK_BG = "#0b0b0b";

function formatStoryRelativeTime(createdAt?: string | null) {
  const createdMs = Date.parse(String(createdAt || ""));
  if (!Number.isFinite(createdMs)) return "";
  const diffMs = Math.max(0, Date.now() - createdMs);
  const mins = Math.floor(diffMs / (60 * 1000));
  if (mins < 1) return "Just now";
  if (mins < 60) return mins === 1 ? "1min ago" : `${mins}mins ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours === 1 ? "1hr ago" : `${hours}hrs ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1day ago" : `${days}days ago`;
}

type Props = {
  visible: boolean;
  stories: HomeStory[];
  initialIndex?: number;
  onClose: () => void;
};

export function StoryViewerModal({ visible, stories, initialIndex = 0, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  const playable = useMemo(
    () => stories.filter((s) => !!(s.videoUrl || s.imageUrl)),
    [stories]
  );
  const activeStory = playable[activeIndex];
  const activeStoryTimeLabel = activeStory ? formatStoryRelativeTime(activeStory.createdAt) : "";

  useEffect(() => {
    if (!visible) return;
    const idx = Math.max(0, Math.min(initialIndex, Math.max(0, playable.length - 1)));
    setActiveIndex(idx);
  }, [visible, initialIndex, playable.length]);

  const close = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    animRef.current?.stop();
    progress.setValue(0);
    onClose();
  }, [onClose, progress]);

  const goNext = useCallback(() => {
    if (activeIndex >= playable.length - 1) {
      close();
      return;
    }
    setActiveIndex((i) => i + 1);
  }, [activeIndex, playable.length, close]);

  const goPrev = useCallback(() => {
    if (activeIndex <= 0) return;
    setActiveIndex((i) => i - 1);
  }, [activeIndex]);

  useEffect(() => {
    if (!visible || !activeStory || activeStory.videoUrl) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    animRef.current?.stop();
    progress.setValue(0);

    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: STORY_IMAGE_MS,
      useNativeDriver: false
    });
    animRef.current = anim;
    anim.start(({ finished }) => {
      if (finished) goNext();
    });
    timerRef.current = setTimeout(goNext, STORY_IMAGE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      animRef.current?.stop();
    };
  }, [visible, activeStory?.id, activeStory?.videoUrl, goNext, progress]);

  if (!visible || !playable.length) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={close}
    >
      <View style={styles.root}>
        <View style={[styles.topChrome, { paddingTop: Math.max(insets.top, 8) }]}>
          <View style={styles.progressRow}>
            {playable.map((s, idx) => {
              const isPast = idx < activeIndex;
              const isActive = idx === activeIndex;
              const width = isActive
                ? progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] })
                : "100%";
              return (
                <View key={s.id} style={styles.progressTrack}>
                  <Animated.View
                    style={[
                      styles.progressFill,
                      {
                        width,
                        opacity: isPast || isActive ? 1 : 0.35
                      }
                    ]}
                  />
                </View>
              );
            })}
          </View>

          <View style={styles.topRow}>
            <View style={styles.userRow}>
              <UserAvatar
                uri={activeStory?.avatarUrl}
                name={activeStory?.userName || "U"}
                size={34}
                fallbackBackgroundColor={APP_LIME}
                initialsColor="#fff"
              />
              <View style={styles.meta}>
                <Text style={styles.name} numberOfLines={1}>
                  {activeStory?.userName || ""}
                </Text>
                {activeStoryTimeLabel ? <Text style={styles.time}>{activeStoryTimeLabel}</Text> : null}
              </View>
            </View>
            <Pressable onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close story">
              <Ionicons name="close" size={26} color="#fff" />
            </Pressable>
          </View>
        </View>

        <View style={styles.body}>
          {activeStory?.videoUrl ? (
            <AppVideo
              source={videoPlaybackUrl(activeStory.videoUrl)}
              style={styles.media}
              contentFit="contain"
              shouldPlay
              isLooping={false}
              nativeControls={false}
              onPlaybackStatusUpdate={(status) => {
                if (!status.isLoaded) return;
                if (status.didJustFinish) goNext();
              }}
            />
          ) : activeStory?.imageUrl ? (
            <Image source={{ uri: activeStory.imageUrl }} style={styles.media} resizeMode="contain" />
          ) : null}

          <View style={styles.tapZones} pointerEvents="box-none">
            <Pressable style={styles.tapZone} onPress={goPrev} />
            <Pressable style={styles.tapZone} onPress={goNext} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: APP_DARK_BG },
  topChrome: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 4,
    backgroundColor: "rgba(0,0,0,0.35)"
  },
  progressRow: { flexDirection: "row", gap: 6, paddingHorizontal: 10, paddingTop: 4 },
  progressTrack: {
    flex: 1,
    height: 2.5,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 2,
    overflow: "hidden"
  },
  progressFill: { height: "100%", backgroundColor: "#fff" },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8
  },
  userRow: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  meta: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 },
  name: { color: "#fff", fontWeight: "800", flexShrink: 1 },
  time: { color: "rgba(255,255,255,0.72)", fontWeight: "600", fontSize: 13, flexShrink: 0 },
  body: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: APP_DARK_BG
  },
  media: { width: "100%", height: "100%" },
  tapZones: { ...StyleSheet.absoluteFillObject, flexDirection: "row" },
  tapZone: { flex: 1 }
});
