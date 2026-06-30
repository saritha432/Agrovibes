import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import type { RootStackParamList } from "../navigation/rootStackTypes";
import { APP_BLACK, APP_LIME, APP_SURFACE, APP_TEXT, APP_TEXT_MUTED } from "../theme/appColors";

const LEARN_LINKS = [
  "Privacy Policy",
  "Terms",
  "Help Centre",
  "Accounts Centre",
  "Cropvibe AI",
  "Threads",
  "Contact Uploading & Non-Users"
];

export function AboutAccountsCentreScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.progressTrack}>
        <View style={styles.progressFill} />
      </View>

      <View style={styles.browserBar}>
        <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Close">
          <Ionicons name="close" size={22} color={APP_TEXT} />
        </Pressable>
        <Text style={styles.urlText}>accountscenter.cropvibe.com</Text>
        <Ionicons name="ellipsis-horizontal" size={20} color={APP_TEXT_MUTED} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.pill}>
          <Text style={styles.pillText}>About Accounts Centre</Text>
        </View>

        <Text style={styles.body}>
          Password, security, personal details, connected experiences, preferences
        </Text>

        <Text style={styles.sectionHeading}>How you use cropvibe</Text>
        <Text style={styles.list}>
          Saved, Archive, Your activity, Notifications, Permissions, Ads, Cropvibe Pay, Subscriptions, Your media
          gallery, Personal details, Account ownership and control, Password and security, Login activity, Saved login,
          Where you're logged in, Security checkup, Connected experiences, Sharing across profiles, Memories from
          cropvibe, Showing links for your profiles, Syncing profile pictures, Managing avatars
        </Text>
      </ScrollView>

      <View style={styles.learnFooter}>
        <Text style={styles.learnLabel}>Learn</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.learnLinks}>
          {LEARN_LINKS.map((link) => (
            <Pressable key={link} style={styles.learnChip} accessibilityRole="button">
              <Text style={styles.learnChipText}>{link}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: APP_BLACK
  },
  progressTrack: {
    height: 3,
    backgroundColor: "#2a2a2a"
  },
  progressFill: {
    width: "38%",
    height: 3,
    backgroundColor: APP_LIME
  },
  browserBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#3a3a3a"
  },
  urlText: {
    color: APP_TEXT_MUTED,
    fontSize: 13,
    fontWeight: "600"
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24
  },
  pill: {
    alignSelf: "flex-start",
    backgroundColor: APP_LIME,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 16
  },
  pillText: {
    color: "#262626",
    fontSize: 13,
    fontWeight: "800"
  },
  body: {
    color: APP_TEXT,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 22
  },
  sectionHeading: {
    color: APP_TEXT,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10
  },
  list: {
    color: APP_TEXT_MUTED,
    fontSize: 14,
    lineHeight: 21
  },
  learnFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#3a3a3a",
    paddingTop: 10,
    paddingBottom: 8
  },
  learnLabel: {
    color: APP_TEXT_MUTED,
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 16,
    marginBottom: 8
  },
  learnLinks: {
    paddingHorizontal: 16,
    gap: 8
  },
  learnChip: {
    backgroundColor: APP_SURFACE,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8
  },
  learnChipText: {
    color: APP_TEXT,
    fontSize: 12,
    fontWeight: "600"
  }
});
