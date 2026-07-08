import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/rootStackTypes";
import { APP_BLACK, APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../theme/appColors";

const CARD = "#303132";
const DIVIDER = "rgba(255,255,255,0.1)";

type RowItem = {
  key: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
};

type SectionItem = {
  title: string;
  rows: RowItem[];
};

function ActivityRow({ title, icon, onPress, showDivider }: RowItem & { showDivider?: boolean }) {
  return (
    <>
      <Pressable style={styles.row} onPress={onPress} disabled={!onPress} accessibilityRole="button" accessibilityLabel={title}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={20} color={APP_LIME} />
        </View>
        <Text style={styles.rowTitle}>{title}</Text>
        <View style={styles.chevronWrap}>
          <Ionicons name="chevron-forward" size={18} color={APP_TEXT_MUTED} />
        </View>
      </Pressable>
      {showDivider ? <View style={styles.divider} /> : null}
    </>
  );
}

function ActivitySection({ title, rows }: SectionItem) {
  return (
    <View style={styles.sectionWrap}>
      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        {rows.map((row, index) => (
          <ActivityRow key={row.key} {...row} showDivider={index < rows.length - 1} />
        ))}
      </View>
    </View>
  );
}

export function YourActivityScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const sections: SectionItem[] = [
    {
      title: "Interactions",
      rows: [
        { key: "likes", title: "Likes", icon: "heart-outline", onPress: () => navigation.navigate("YourActivityLikes") },
        { key: "comments", title: "Comments", icon: "chatbubble-outline", onPress: () => navigation.navigate("YourActivityComments") },
        { key: "mentions", title: "Mentions & Tags", icon: "at-outline", onPress: () => navigation.navigate("YourActivityMentionsTags") }
      ]
    },
    {
      title: "Content Management",
      rows: [
        { key: "recently-deleted", title: "Recently Deleted", icon: "trash-outline", onPress: () => navigation.navigate("YourActivityRecentlyDeleted") }
      ]
    },
    {
      title: "Content You’ve Shared",
      rows: [
        { key: "posts", title: "Posts", icon: "images-outline", onPress: () => navigation.navigate("YourActivityPosts") },
        { key: "drops", title: "Drops", icon: "albums-outline", onPress: () => navigation.navigate("YourActivityDrops") }
      ]
    },
    {
      title: "Suggested Content",
      rows: [
        { key: "not-interested", title: "Not Interested", icon: "eye-off-outline", onPress: () => navigation.navigate("YourActivityNotInterested") },
        { key: "interested", title: "Interested", icon: "checkmark-outline", onPress: () => navigation.navigate("YourActivityInterested") }
      ]
    },
    {
      title: "How To Use Cropvibe",
      rows: [
        { key: "watch-history", title: "Watch History", icon: "play-back-outline", onPress: () => navigation.navigate("YourActivityWatchHistory") },
        { key: "account-history", title: "Account History", icon: "document-text-outline", onPress: () => navigation.navigate("YourActivityAccountHistory") },
        { key: "recent-searches", title: "Recent Search’s", icon: "search-outline", onPress: () => navigation.navigate("YourActivityRecentSearches") }
      ]
    }
  ];

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={APP_LIME} />
        </Pressable>
        <Text style={styles.topTitle}>Your Activity</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.description}>View and manage your interactions, content, and account activity in one place.</Text>
        {sections.map((section) => (
          <ActivitySection key={section.title} {...section} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: APP_BLACK
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: DIVIDER
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  topTitle: {
    flex: 1,
    textAlign: "center",
    color: APP_TEXT,
    fontSize: 16,
    fontWeight: "600"
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 32
  },
  description: {
    color: APP_TEXT,
    opacity: 0.72,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14
  },
  sectionWrap: {
    marginBottom: 14
  },
  card: {
    borderRadius: 14,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: DIVIDER,
    overflow: "hidden"
  },
  sectionHeader: {
    minHeight: 48,
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: DIVIDER,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  sectionTitle: {
    color: "#9c9c9c",
    fontSize: 16,
    fontWeight: "500"
  },
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  iconWrap: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center"
  },
  rowTitle: {
    flex: 1,
    color: APP_TEXT,
    fontSize: 16,
    fontWeight: "500"
  },
  chevronWrap: {
    width: 24,
    alignItems: "center",
    justifyContent: "center"
  },
  divider: {
    height: 1,
    backgroundColor: DIVIDER
  }
});
