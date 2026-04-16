import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
          <Pressable key={story.id} style={styles.storyItem} onPress={() => onOpenCreate?.()}>
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
              <Ionicons name="play-circle-outline" size={48} color="#fff" />
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
