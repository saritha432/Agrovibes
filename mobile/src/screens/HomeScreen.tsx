import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ResizeMode, Video } from "expo-av";
import { AppTopBar } from "../components/AppTopBar";
import { fetchHomePosts, fetchHomeStories, HomePost, HomeStory } from "../services/api";

interface HomeScreenProps {
  refreshToken?: number;
  onOpenCreate?: () => void;
}

const postTints = ["#8a5b00", "#0f5f43", "#8b3a62", "#105f75"];

export function HomeScreen({ refreshToken = 0, onOpenCreate }: HomeScreenProps) {
  const [stories, setStories] = useState<HomeStory[]>([]);
  const [posts, setPosts] = useState<HomePost[]>([]);
  const [isStoryOpen, setStoryOpen] = useState(false);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  const playableStories = useMemo(() => stories.filter((s) => !!s.videoUrl), [stories]);
  const activeStory = playableStories[activeStoryIndex];

  const closeStory = () => {
    setStoryOpen(false);
    progress.stopAnimation();
    progress.setValue(0);
  };

  const nextStory = () => {
    if (activeStoryIndex >= playableStories.length - 1) {
      closeStory();
      return;
    }
    progress.stopAnimation();
    progress.setValue(0);
    setActiveStoryIndex((v) => v + 1);
  };

  const prevStory = () => {
    if (activeStoryIndex <= 0) return;
    progress.stopAnimation();
    progress.setValue(0);
    setActiveStoryIndex((v) => v - 1);
  };

  useEffect(() => {
    if (!isStoryOpen) return;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 7000,
      useNativeDriver: false
    }).start(({ finished }) => {
      if (finished) nextStory();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStoryOpen, activeStoryIndex]);

  useEffect(() => {
    let mounted = true;
    fetchHomeStories()
      .then((data) => {
        if (!mounted) return;
        setStories(data.stories);
      })
      .catch(() => {
        if (!mounted) return;
        setStories([
          { id: 1, userName: "You", district: "Nashik", avatarLabel: "Y", hasNew: false, viewed: true },
          { id: 2, userName: "Ramesh", district: "Nashik", avatarLabel: "R", hasNew: true, viewed: false },
          { id: 3, userName: "Suresh", district: "Indore", avatarLabel: "S", hasNew: true, viewed: false }
        ]);
      });
    return () => {
      mounted = false;
    };
  }, [refreshToken]);

  useEffect(() => {
    let mounted = true;
    fetchHomePosts()
      .then((data) => {
        if (!mounted) return;
        setPosts(data.posts);
      })
      .catch(() => {
        if (!mounted) return;
        setPosts([
          {
            id: 1,
            userName: "Ramesh Patel",
            location: "Nashik",
            caption: "Fresh tomatoes available this week at Rs35/kg. Contact us now!",
            likesCount: 1284,
            commentsCount: 92,
            videoUrl: "https://example.com/video.mp4",
            thumbnailUrl: "",
            createdAt: new Date().toISOString()
          }
        ]);
      });
    return () => {
      mounted = false;
    };
  }, [refreshToken]);

  return (
    <View style={styles.screen}>
      <AppTopBar />

      <View style={styles.appHeader}>
        <Text style={styles.appTitle}>AgroGram</Text>
        <View style={styles.headerIcons}>
          <Pressable style={styles.iconBtn}><Ionicons name="heart-outline" size={22} color="#1f2c29" /></Pressable>
          <Pressable style={styles.iconBtn}><Ionicons name="chatbubble-outline" size={21} color="#1f2c29" /></Pressable>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storyRow}>
        {stories.map((story) => (
          <Pressable
            key={story.id}
            style={styles.storyItem}
            onPress={() => {
              if (story.videoUrl) {
                const idx = playableStories.findIndex((s) => s.id === story.id);
                setActiveStoryIndex(Math.max(idx, 0));
                setStoryOpen(true);
              } else {
                onOpenCreate?.();
              }
            }}
          >
            <View style={[styles.storyRing, story.viewed ? styles.storyRingViewed : styles.storyRingNew]}>
              <View style={styles.storyInner}>
                <View style={styles.storyAvatarFill}>
                  <Text style={styles.storyInitial}>{story.avatarLabel}</Text>
                </View>
              </View>
            </View>
            <Text style={styles.storyName} numberOfLines={1}>{story.userName}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Modal visible={isStoryOpen} animationType="fade" onRequestClose={closeStory}>
        <View style={styles.storyViewerRoot}>
          <View style={styles.storyProgressRow}>
            {playableStories.map((s, idx) => {
              const isPast = idx < activeStoryIndex;
              const isActive = idx === activeStoryIndex;
              const width = isActive
                ? progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] })
                : "100%";
              return (
                <View key={s.id} style={styles.storyProgressTrack}>
                  <Animated.View
                    style={[
                      styles.storyProgressFill,
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

          <View style={styles.storyViewerTopRow}>
            <View style={styles.storyViewerUser}>
              <View style={styles.storyViewerAvatar}>
                <Text style={styles.storyViewerAvatarText}>{activeStory?.avatarLabel ?? "U"}</Text>
              </View>
              <View>
                <Text style={styles.storyViewerName}>{activeStory?.userName ?? ""}</Text>
                <Text style={styles.storyViewerSub}>{activeStory?.district ?? ""}</Text>
              </View>
            </View>
            <Pressable onPress={closeStory} hitSlop={10}>
              <Ionicons name="close" size={26} color="#fff" />
            </Pressable>
          </View>

          <View style={styles.storyViewerBody}>
            {activeStory?.videoUrl ? (
              <Video
                style={styles.storyVideo}
                source={{ uri: activeStory.videoUrl }}
                resizeMode={ResizeMode.COVER}
                shouldPlay
                isLooping={false}
              />
            ) : null}

            <View style={styles.storyTapZones}>
              <Pressable style={styles.storyTapZone} onPress={prevStory} />
              <Pressable style={styles.storyTapZone} onPress={nextStory} />
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={styles.feedBottom}>
        {posts.map((post, index) => (
          <View key={post.id} style={styles.postCard}>
            <View style={styles.postTop}>
              <View style={styles.postUserRow}>
                <View style={styles.userAvatar}><Text style={styles.userAvatarText}>{post.userName[0]}</Text></View>
                <View>
                  <Text style={styles.userName}>{post.userName} <Text style={styles.timeText}>• 13h</Text></Text>
                  <Text style={styles.userLoc}>{post.location}</Text>
                </View>
              </View>
              <Ionicons name="ellipsis-horizontal" size={18} color="#5f6f6a" />
            </View>

            <View style={[styles.postMedia, { backgroundColor: postTints[index % postTints.length] }]}>
              {post.videoUrl ? (
                <Video
                  style={styles.video}
                  source={{ uri: post.videoUrl }}
                  useNativeControls
                  resizeMode={ResizeMode.COVER}
                  isLooping
                />
              ) : (
                <Ionicons name="play-circle-outline" size={48} color="#fff" />
              )}
            </View>

            <View style={styles.postActions}>
              <View style={styles.postActionsLeft}>
                <Ionicons name="heart-outline" size={24} color="#1f2c29" />
                <Ionicons name="chatbubble-outline" size={23} color="#1f2c29" />
                <Ionicons name="paper-plane-outline" size={22} color="#1f2c29" />
              </View>
              <Ionicons name="bookmark-outline" size={22} color="#1f2c29" />
            </View>

            <Text style={styles.likes}>{post.likesCount} likes</Text>
            <Text style={styles.caption}><Text style={styles.captionUser}>{post.userName}</Text> {post.caption}</Text>
            <Text style={styles.comments}>View all {post.commentsCount} comments</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f5f7f6" },
  appHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    marginBottom: 4
  },
  appTitle: { fontSize: 26, fontWeight: "700", color: "#1a2522" },
  headerIcons: { flexDirection: "row", gap: 14, alignItems: "center" },
  iconBtn: { padding: 2 },
  storyRow: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e8ecea",
    backgroundColor: "#fff"
  },
  storyItem: { alignItems: "center", width: 70 },
  storyRing: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center"
  },
  storyRingNew: { backgroundColor: "#16a34a" },
  storyRingViewed: { backgroundColor: "#9ca3af" },
  storyInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center"
  },
  storyAvatarFill: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#d4dce0",
    alignItems: "center",
    justifyContent: "center"
  },
  storyInitial: { fontSize: 18, fontWeight: "700", color: "#1f2c29" },
  storyName: { fontSize: 12, color: "#2f3e3a", marginTop: 6, fontWeight: "500", textAlign: "center", width: "100%" },
  feedBottom: { paddingBottom: 100 },
  postCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dfe5e3",
    borderRadius: 8,
    overflow: "hidden",
    marginHorizontal: 10,
    marginTop: 10,
    paddingBottom: 10,
    marginBottom: 2
  },
  postTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8
  },
  postUserRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  userAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center"
  },
  userAvatarText: { color: "#fff", fontWeight: "700" },
  userName: { color: "#1f2c29", fontWeight: "700", fontSize: 14 },
  timeText: { color: "#6d7d79", fontWeight: "500" },
  userLoc: { color: "#687975", fontSize: 12 },
  postMedia: {
    height: 360,
    alignItems: "center",
    justifyContent: "center"
  },
  video: {
    width: "100%",
    height: "100%"
  },
  storyViewerRoot: { flex: 1, backgroundColor: "#000" },
  storyProgressRow: { flexDirection: "row", gap: 6, paddingHorizontal: 10, paddingTop: 12 },
  storyProgressTrack: { flex: 1, height: 2.5, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 2, overflow: "hidden" },
  storyProgressFill: { height: "100%", backgroundColor: "#fff" },
  storyViewerTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10, paddingTop: 10 },
  storyViewerUser: { flexDirection: "row", alignItems: "center", gap: 10 },
  storyViewerAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#22c55e", alignItems: "center", justifyContent: "center" },
  storyViewerAvatarText: { color: "#fff", fontWeight: "800" },
  storyViewerName: { color: "#fff", fontWeight: "800" },
  storyViewerSub: { color: "rgba(255,255,255,0.75)", marginTop: 1, fontSize: 12 },
  storyViewerBody: { flex: 1, marginTop: 10 },
  storyVideo: { width: "100%", height: "100%" },
  storyTapZones: { ...StyleSheet.absoluteFillObject, flexDirection: "row" },
  storyTapZone: { flex: 1 },
  postActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingTop: 10
  },
  postActionsLeft: { flexDirection: "row", gap: 14, alignItems: "center" },
  likes: { marginTop: 8, paddingHorizontal: 10, fontWeight: "700", color: "#1f2c29" },
  caption: { marginTop: 6, paddingHorizontal: 10, color: "#1f2c29", lineHeight: 20 },
  captionUser: { fontWeight: "700" },
  comments: { marginTop: 6, paddingHorizontal: 10, color: "#637571" }
});
