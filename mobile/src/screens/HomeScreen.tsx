import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewToken
} from "react-native";
import { ResizeMode, Video } from "expo-av";
import { AppTopBar } from "../components/AppTopBar";
import { fetchHomePosts, fetchHomeStories, HomePost, HomeStory } from "../services/api";

interface HomeScreenProps {
  refreshToken?: number;
  onOpenCreate?: () => void;
}

const postTints = ["#8a5b00", "#0f5f43", "#8b3a62", "#105f75"];

function postImageGallery(post: HomePost | null | undefined): string[] {
  if (!post) return [];
  if (post.imageUrls?.length) return post.imageUrls;
  if (post.imageUrl) return [post.imageUrl];
  return [];
}

export function HomeScreen({ refreshToken = 0, onOpenCreate }: HomeScreenProps) {
  const { width: windowWidth } = useWindowDimensions();
  const feedMediaWidth = windowWidth - 20;
  const [stories, setStories] = useState<HomeStory[]>([]);
  const [posts, setPosts] = useState<HomePost[]>([]);
  const [viewedStoryIds, setViewedStoryIds] = useState<Set<number>>(new Set());
  const [playingPostId, setPlayingPostId] = useState<number | null>(null);
  const [activePost, setActivePost] = useState<HomePost | null>(null);
  const [isStoryOpen, setStoryOpen] = useState(false);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  const viewabilityConfig = useMemo(
    () => ({ itemVisiblePercentThreshold: 65, minimumViewTime: 200 }),
    []
  );

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const ordered = viewableItems
        .filter((v) => v.isViewable && v.item != null)
        .map((v) => ({ post: v.item as HomePost, index: v.index ?? 0 }))
        .sort((a, b) => a.index - b.index);
      const withVideo = ordered.find((c) => !!c.post.videoUrl);
      setPlayingPostId(withVideo ? withVideo.post.id : null);
    },
    []
  );

  const viewabilityCallbackRef = useRef(onViewableItemsChanged);
  viewabilityCallbackRef.current = onViewableItemsChanged;

  const onViewableItemsChangedRef = useRef(
    (info: { viewableItems: ViewToken[]; changed: ViewToken[] }) => {
      viewabilityCallbackRef.current(info);
    }
  );

  useEffect(() => {
    if (posts.length === 0) {
      setPlayingPostId(null);
      return;
    }
    setPlayingPostId((current) => {
      if (current != null && posts.some((p) => p.id === current)) return current;
      return posts.find((p) => p.videoUrl)?.id ?? null;
    });
  }, [posts]);

  const playableStories = useMemo(() => stories.filter((s) => !!s.videoUrl || !!s.imageUrl), [stories]);
  const otherStories = useMemo(
    () => stories.filter((s) => s.userName.trim().toLowerCase() !== "you"),
    [stories]
  );
  const activeStory = playableStories[activeStoryIndex];

  const applyViewedStories = useCallback(
    (incoming: HomeStory[]) => incoming.map((story) => (viewedStoryIds.has(story.id) ? { ...story, viewed: true } : story)),
    [viewedStoryIds]
  );

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
        setStories(applyViewedStories(data.stories));
      })
      .catch(() => {
        if (!mounted) return;
        setStories(
          applyViewedStories([
          { id: 1, userName: "You", district: "Nashik", avatarLabel: "Y", hasNew: false, viewed: true },
          { id: 2, userName: "Ramesh", district: "Nashik", avatarLabel: "R", hasNew: true, viewed: false },
          { id: 3, userName: "Suresh", district: "Indore", avatarLabel: "S", hasNew: true, viewed: false }
          ])
        );
      });
    return () => {
      mounted = false;
    };
  }, [applyViewedStories, refreshToken]);

  useEffect(() => {
    if (!activeStory?.id || !isStoryOpen) return;
    setViewedStoryIds((prev) => {
      if (prev.has(activeStory.id)) return prev;
      const next = new Set(prev);
      next.add(activeStory.id);
      return next;
    });
    setStories((prev) => prev.map((s) => (s.id === activeStory.id ? { ...s, viewed: true } : s)));
  }, [activeStory?.id, isStoryOpen]);

  useEffect(() => {
    let mounted = true;
    fetchHomePosts()
      .then((data) => {
        if (!mounted) return;
        setPosts(data.posts);
      })
      .catch(() => {
        if (!mounted) return;
        setPosts([]);
      });
    return () => {
      mounted = false;
    };
  }, [refreshToken]);

  const listHeader = useMemo(
    () => (
      <>
        <AppTopBar />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.storyRowWrap}
          contentContainerStyle={styles.storyRow}
        >
          <Pressable style={styles.storyItem} onPress={onOpenCreate}>
            <View style={[styles.storyRing, styles.storyRingViewed]}>
              <View style={styles.storyInner}>
                <View style={styles.storyAvatarFill}>
                  <Text style={styles.storyInitial}>Y</Text>
                </View>
                <View style={styles.yourStoryPlusBadge}>
                  <Ionicons name="add" size={12} color="#fff" />
                </View>
              </View>
            </View>
            <Text style={styles.storyName} numberOfLines={1}>
              Your story
            </Text>
          </Pressable>

          {otherStories.map((story) => (
            <Pressable
              key={story.id}
              style={styles.storyItem}
              onPress={() => {
                if (!story.videoUrl && !story.imageUrl) return;
                setViewedStoryIds((prev) => {
                  if (prev.has(story.id)) return prev;
                  const next = new Set(prev);
                  next.add(story.id);
                  return next;
                });
                setStories((prev) => prev.map((s) => (s.id === story.id ? { ...s, viewed: true } : s)));
                const idx = playableStories.findIndex((s) => s.id === story.id);
                setActiveStoryIndex(Math.max(idx, 0));
                setStoryOpen(true);
              }}
            >
              <View style={[styles.storyRing, story.viewed ? styles.storyRingViewed : styles.storyRingNew]}>
                <View style={styles.storyInner}>
                  <View style={styles.storyAvatarFill}>
                    <Text style={styles.storyInitial}>{story.avatarLabel}</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.storyName} numberOfLines={1}>
                {story.userName}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </>
    ),
    [onOpenCreate, otherStories, playableStories]
  );

  const renderPost = useCallback(
    ({ item: post, index }: { item: HomePost; index: number }) => {
      const isActive = playingPostId === post.id && !!post.videoUrl;
      const gallery = postImageGallery(post);
      const isCarousel = !post.videoUrl && gallery.length > 1;
      return (
        <Pressable style={styles.postCard} onPress={() => setActivePost(post)}>
          <View style={styles.postTop}>
            <View style={styles.postUserRow}>
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>{post.userName[0]}</Text>
              </View>
              <View>
                <Text style={styles.userName}>
                  {post.userName} <Text style={styles.timeText}>• 13h</Text>
                </Text>
              </View>
            </View>
            <Ionicons name="ellipsis-horizontal" size={18} color="#5f6f6a" />
          </View>

          <View style={[styles.postMedia, { backgroundColor: postTints[index % postTints.length] }]}>
            {post.videoUrl ? (
              <Video
                style={styles.video}
                source={{ uri: post.videoUrl }}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay={isActive}
                isLooping
                isMuted
                useNativeControls={false}
              />
            ) : isCarousel ? (
              <FlatList
                data={gallery}
                horizontal
                pagingEnabled
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(uri, i) => `${post.id}-${i}-${uri}`}
                style={{ width: feedMediaWidth, height: 360 }}
                renderItem={({ item: uri }) => (
                  <Image style={{ width: feedMediaWidth, height: 360 }} source={{ uri }} resizeMode="cover" />
                )}
              />
            ) : gallery[0] ? (
              <Image style={styles.video} source={{ uri: gallery[0] }} resizeMode="cover" />
            ) : (
              <Ionicons name="play-circle-outline" size={48} color="#fff" />
            )}
            {isCarousel ? (
              <View style={styles.postCarouselDots} pointerEvents="none">
                {gallery.map((_, i) => (
                  <View key={i} style={styles.postCarouselDot} />
                ))}
              </View>
            ) : null}
            <View style={styles.postActionsRail}>
              <Ionicons name="heart-outline" size={24} color="#1f2c29" />
              <Ionicons name="chatbubble-outline" size={23} color="#1f2c29" />
              <Ionicons name="paper-plane-outline" size={22} color="#1f2c29" />
              <Ionicons name="bookmark-outline" size={22} color="#1f2c29" />
            </View>
          </View>

          <Text style={styles.likes}>{post.likesCount} likes</Text>
          <Text style={styles.caption}>
            <Text style={styles.captionUser}>{post.userName}</Text> {post.caption}
          </Text>
          <Text style={styles.comments}>View all {post.commentsCount} comments</Text>
        </Pressable>
      );
    },
    [playingPostId, feedMediaWidth]
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={posts}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderPost}
        ListHeaderComponent={listHeader}
        contentContainerStyle={styles.feedBottom}
        onViewableItemsChanged={onViewableItemsChangedRef.current}
        viewabilityConfig={viewabilityConfig}
      />

      <Modal
        visible={isStoryOpen}
        animationType="fade"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={closeStory}
      >
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
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay
                isLooping={false}
              />
            ) : activeStory?.imageUrl ? (
              <Image style={styles.storyVideo} source={{ uri: activeStory.imageUrl }} resizeMode="contain" />
            ) : null}

            <View style={styles.storyTapZones}>
              <Pressable style={styles.storyTapZone} onPress={prevStory} />
              <Pressable style={styles.storyTapZone} onPress={nextStory} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!activePost}
        animationType="fade"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={() => setActivePost(null)}
      >
        <View style={styles.postViewerRoot}>
          <View style={styles.postViewerTop}>
            <Pressable onPress={() => setActivePost(null)} hitSlop={10}>
              <Ionicons name="close" size={28} color="#fff" />
            </Pressable>
          </View>
          {activePost?.videoUrl ? (
            <Video
              style={styles.postViewerVideo}
              source={{ uri: activePost.videoUrl }}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
              isMuted={false}
              isLooping
              useNativeControls
            />
          ) : postImageGallery(activePost).length > 1 ? (
            <FlatList
              data={postImageGallery(activePost)}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(uri, i) => `pv-${activePost!.id}-${i}-${uri.slice(-32)}`}
              style={{ flex: 1 }}
              renderItem={({ item: uri }) => (
                <View style={{ width: windowWidth, flex: 1, justifyContent: "center" }}>
                  <Image style={styles.postViewerVideo} source={{ uri }} resizeMode="contain" />
                </View>
              )}
            />
          ) : postImageGallery(activePost)[0] ? (
            <Image style={styles.postViewerVideo} source={{ uri: postImageGallery(activePost)[0] }} resizeMode="contain" />
          ) : (
            <View style={styles.postViewerFallback}>
              <Ionicons name="play-circle-outline" size={62} color="#fff" />
              <Text style={styles.postViewerFallbackText}>No video available for this post</Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f5f7f6" },
  storyRow: {
    paddingHorizontal: 10,
    paddingTop: 0,
    paddingBottom: 10,
    gap: 12
  },
  storyRowWrap: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e8ecea"
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
    justifyContent: "center",
    overflow: "visible"
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
  yourStoryPlusBadge: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#0a9f46",
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center"
  },
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
  postMedia: {
    height: 360,
    alignItems: "center",
    justifyContent: "center",
    position: "relative"
  },
  video: {
    width: "100%",
    height: "100%"
  },
  postActionsRail: {
    position: "absolute",
    right: 10,
    bottom: 16,
    gap: 14,
    alignItems: "center"
  },
  postCarouselDots: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 5
  },
  postCarouselDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.85)"
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
  storyViewerBody: {
    flex: 1,
    marginTop: 10,
    minHeight: 0,
    width: "100%",
    alignSelf: "stretch",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000"
  },
  storyVideo: {
    width: "100%",
    height: "100%",
    ...(Platform.OS === "web" ? ({ maxWidth: "100%" } as const) : null)
  },
  storyTapZones: { ...StyleSheet.absoluteFillObject, flexDirection: "row" },
  storyTapZone: { flex: 1 },
  postViewerRoot: { flex: 1, backgroundColor: "#000" },
  postViewerTop: {
    position: "absolute",
    top: 44,
    right: 14,
    zIndex: 10
  },
  postViewerVideo: { width: "100%", height: "100%" },
  postViewerFallback: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  postViewerFallbackText: { color: "rgba(255,255,255,0.8)" },
  likes: { marginTop: 8, paddingHorizontal: 10, fontWeight: "700", color: "#1f2c29" },
  caption: { marginTop: 6, paddingHorizontal: 10, color: "#1f2c29", lineHeight: 20 },
  captionUser: { fontWeight: "700" },
  comments: { marginTop: 6, paddingHorizontal: 10, color: "#637571" }
});
