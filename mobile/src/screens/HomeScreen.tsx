import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
const homeTopTabs = ["Feed", "Reels", "Friends", "live"] as const;

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
  const [activeCommentsPost, setActiveCommentsPost] = useState<HomePost | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentsByPost, setCommentsByPost] = useState<Record<number, { id: string; user: string; text: string; likes: number }[]>>({});
  const [isStoryOpen, setStoryOpen] = useState(false);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [activeHomeTab, setActiveHomeTab] = useState<(typeof homeTopTabs)[number]>("Feed");
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

  const openCommentsForPost = useCallback((post: HomePost) => {
    setActiveCommentsPost(post);
    setCommentsByPost((prev) => {
      if (prev[post.id]) return prev;
      return {
        ...prev,
        [post.id]: [
          { id: `seed-${post.id}-1`, user: "sowndherya", text: "Super post 👏", likes: 12 },
          { id: `seed-${post.id}-2`, user: "AgroRoots", text: "Very useful info!", likes: 8 }
        ]
      };
    });
  }, []);

  const submitComment = useCallback(() => {
    const text = commentDraft.trim();
    if (!text || !activeCommentsPost) return;
    setCommentsByPost((prev) => {
      const list = prev[activeCommentsPost.id] ?? [];
      return {
        ...prev,
        [activeCommentsPost.id]: [
          ...list,
          { id: `c-${Date.now()}`, user: "You", text, likes: 0 }
        ]
      };
    });
    setCommentDraft("");
  }, [activeCommentsPost, commentDraft]);

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
        <View style={styles.homeTopTabsRow}>
          {homeTopTabs.map((tab) => (
            <Pressable key={tab} onPress={() => setActiveHomeTab(tab)} style={styles.homeTopTabPressable}>
              <View style={[styles.homeTopTabPill, activeHomeTab === tab ? styles.homeTopTabPillActive : null]}>
                <Text style={[styles.homeTopTabText, activeHomeTab === tab ? styles.homeTopTabTextActive : null]}>{tab}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </>
    ),
    [activeHomeTab, onOpenCreate, otherStories, playableStories]
  );

  const renderPost = useCallback(
    ({ item: post, index }: { item: HomePost; index: number }) => {
      const isActive = playingPostId === post.id && !!post.videoUrl;
      const gallery = postImageGallery(post);
      const isCarousel = !post.videoUrl && gallery.length > 1;
      const postComments = commentsByPost[post.id] ?? [];
      const shownCommentsCount = postComments.length > 0 ? postComments.length : post.commentsCount;
      return (
        <View style={styles.postCard}>
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
              <Pressable style={styles.videoTapArea} onPress={() => setActivePost(post)}>
                <Video
                  style={styles.video}
                  source={{ uri: post.videoUrl }}
                  resizeMode={ResizeMode.COVER}
                  shouldPlay={isActive}
                  isLooping
                  isMuted
                  useNativeControls={false}
                />
              </Pressable>
            ) : isCarousel ? (
              <FlatList
                data={gallery}
                horizontal
                pagingEnabled
                nestedScrollEnabled
                scrollEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(uri, i) => `${post.id}-${i}-${uri}`}
                style={{ width: feedMediaWidth, height: feedMediaWidth }}
                renderItem={({ item: uri }) => (
                  <Image style={{ width: feedMediaWidth, height: feedMediaWidth }} source={{ uri }} resizeMode="cover" />
                )}
              />
            ) : gallery[0] ? (
              <Pressable style={styles.videoTapArea} onPress={() => setActivePost(post)}>
                <Image style={styles.video} source={{ uri: gallery[0] }} resizeMode="cover" />
              </Pressable>
            ) : (
              <Pressable style={styles.videoTapArea} onPress={() => setActivePost(post)}>
                <Ionicons name="play-circle-outline" size={48} color="#fff" />
              </Pressable>
            )}
            {isCarousel ? (
              <View style={styles.postCarouselDots} pointerEvents="none">
                {gallery.map((_, i) => (
                  <View key={i} style={styles.postCarouselDot} />
                ))}
              </View>
            ) : null}
          </View>

          <View style={styles.postActionsRow}>
            <View style={styles.postActionsLeft}>
              <Pressable style={styles.postActionIconBtn}>
                <Ionicons name="heart-outline" size={25} color="#111" />
              </Pressable>
              <Pressable style={styles.postActionIconBtn} onPress={() => openCommentsForPost(post)}>
                <Ionicons name="chatbubble-outline" size={23} color="#111" />
              </Pressable>
              <Pressable style={styles.postActionIconBtn}>
                <Ionicons name="paper-plane-outline" size={22} color="#111" />
              </Pressable>
            </View>
            <Pressable style={styles.postActionIconBtn}>
              <Ionicons name="bookmark-outline" size={22} color="#111" />
            </Pressable>
          </View>

          <Text style={styles.likes}>{post.likesCount} likes</Text>
          <Text style={styles.caption}>
            <Text style={styles.captionUser}>{post.userName}</Text> {post.caption}
          </Text>
          <Pressable onPress={() => openCommentsForPost(post)}>
            <Text style={styles.comments}>View all {shownCommentsCount} comments</Text>
          </Pressable>
        </View>
      );
    },
    [commentsByPost, feedMediaWidth, openCommentsForPost, playingPostId]
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

      <Modal visible={!!activeCommentsPost} transparent animationType="slide" onRequestClose={() => setActiveCommentsPost(null)}>
        <Pressable style={styles.commentsBackdrop} onPress={() => setActiveCommentsPost(null)}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.commentsKeyboardWrap}>
            <Pressable style={styles.commentsSheet} onPress={(e) => e.stopPropagation?.()}>
              <View style={styles.commentsHandle} />
              <Text style={styles.commentsTitle}>Comments</Text>

              <ScrollView style={styles.commentsList} contentContainerStyle={styles.commentsListInner}>
                {(activeCommentsPost ? commentsByPost[activeCommentsPost.id] ?? [] : []).length === 0 ? (
                  <Text style={styles.noCommentsText}>No Comments</Text>
                ) : (
                  (activeCommentsPost ? commentsByPost[activeCommentsPost.id] ?? [] : []).map((c) => (
                    <View key={c.id} style={styles.commentRow}>
                      <View style={styles.commentAvatar}>
                        <Text style={styles.commentAvatarText}>{c.user[0].toUpperCase()}</Text>
                      </View>
                      <View style={styles.commentBody}>
                        <Text style={styles.commentUser}>{c.user}</Text>
                        <Text style={styles.commentText}>{c.text}</Text>
                      </View>
                      <View style={styles.commentLikeWrap}>
                        <Ionicons name="heart-outline" size={14} color="#9ca3af" />
                        <Text style={styles.commentLikeCount}>{c.likes}</Text>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>

              <View style={styles.emojiRow}>
                {["😀", "😍", "🔥", "👏", "💯", "😅", "😎", "🥳"].map((emoji) => (
                  <Pressable key={emoji} onPress={() => setCommentDraft((v) => `${v}${emoji}`)}>
                    <Text style={styles.emojiText}>{emoji}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.commentInputRow}>
                <View style={styles.commentInputAvatar}>
                  <Ionicons name="person" size={12} color="#0f172a" />
                </View>
                <TextInput
                  value={commentDraft}
                  onChangeText={setCommentDraft}
                  placeholder="Add comment for PureFarm..."
                  placeholderTextColor="#6b7280"
                  style={styles.commentInput}
                />
                <Pressable style={styles.commentSendBtn} onPress={submitComment}>
                  <Ionicons name="send" size={14} color="#111827" />
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f2f3f5" },
  storyRow: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 10
  },
  storyRowWrap: {
    backgroundColor: "#ffffff"
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
  storyName: { fontSize: 8, color: "#7f868a", marginTop: 5, fontWeight: "500", textAlign: "center", width: "100%" },
  homeTopTabsRow: {
    flexDirection: "row",
    backgroundColor: "#f2f3f5",
    paddingHorizontal: 8,
    paddingVertical: 8,
    justifyContent: "space-between"
  },
  homeTopTabPressable: { flex: 1, alignItems: "center" },
  homeTopTabPill: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 7
  },
  homeTopTabPillActive: { backgroundColor: "#303132" },
  homeTopTabText: { fontSize: 14, color: "#374151", fontWeight: "500" },
  homeTopTabTextActive: { color: "#C9FF35", fontWeight: "700" },
  feedBottom: { paddingBottom: 100 },
  postCard: {
    backgroundColor: "#fff",
    marginTop: 10,
    paddingBottom: 10
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
    width: "100%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative"
  },
  video: {
    width: "100%",
    height: "100%"
  },
  videoTapArea: {
    width: "100%",
    height: "100%"
  },
  postActionsRow: {
    marginTop: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  postActionsLeft: { flexDirection: "row", alignItems: "center" },
  postActionIconBtn: { marginRight: 14 },
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
  likes: { marginTop: 6, paddingHorizontal: 10, fontWeight: "700", color: "#1f2c29", fontSize: 13 },
  caption: { marginTop: 4, paddingHorizontal: 10, color: "#1f2c29", lineHeight: 20, fontSize: 13 },
  captionUser: { fontWeight: "700" },
  comments: { marginTop: 4, paddingHorizontal: 10, color: "#637571", fontSize: 13 }
  ,
  commentsBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end"
  },
  commentsKeyboardWrap: {
    width: "100%"
  },
  commentsSheet: {
    backgroundColor: "#1a1b1c",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: 360,
    maxHeight: "72%",
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 14
  },
  commentsHandle: {
    width: 42,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#b7ff37",
    alignSelf: "center",
    marginBottom: 12
  },
  commentsTitle: {
    color: "#b7ff37",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 10
  },
  commentsList: { flex: 1 },
  commentsListInner: { paddingBottom: 10, gap: 10 },
  noCommentsText: { color: "#b7ff37", textAlign: "center", marginTop: 40, fontWeight: "700" },
  commentRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  commentAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center"
  },
  commentAvatarText: { color: "#111827", fontSize: 11, fontWeight: "700" },
  commentBody: { flex: 1 },
  commentUser: { color: "#f9fafb", fontSize: 11, fontWeight: "700" },
  commentText: { color: "#d1d5db", fontSize: 11, marginTop: 1 },
  commentLikeWrap: { alignItems: "center", minWidth: 24 },
  commentLikeCount: { color: "#9ca3af", fontSize: 9, marginTop: 1 },
  emojiRow: {
    borderTopWidth: 1,
    borderTopColor: "#303236",
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  emojiText: { fontSize: 16 },
  commentInputRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  commentInputAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center"
  },
  commentInput: {
    flex: 1,
    height: 28,
    borderRadius: 10,
    paddingHorizontal: 10,
    backgroundColor: "#f9fafb",
    color: "#111827",
    fontSize: 11
  },
  commentSendBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#b7ff37",
    alignItems: "center",
    justifyContent: "center"
  }
});
