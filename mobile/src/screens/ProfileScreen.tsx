import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppTopBar } from "../components/AppTopBar";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../auth/AuthContext";

function safeHandle(name: string) {
  const base = String(name || "user")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `@${base || "user_farmer"}`;
}

export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { user, signOut } = useAuth();

  const profileModel = useMemo(() => {
    if (!user) return null;
    // Simple deterministic placeholders (until we connect real profile stats API).
    const seed = Number(user.id || 1);
    const posts = 6 + (seed % 10);
    const followers = 80 + (seed % 200);
    const following = 20 + (seed % 90);
    const handle = safeHandle(user.fullName || user.email);
    const initials = String(user.fullName || user.email || "U")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("");
    return { posts, followers, following, handle, initials: initials || "U" };
  }, [user]);

  const isInstructor = Boolean(user && (user.role === "instructor" || user.role === "admin"));
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollBottom}>
      <AppTopBar />
      {!user ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome to AgroGram</Text>
          <Text style={styles.cardSub}>Login to enroll, enroll in courses, and track progress.</Text>
          <Pressable style={styles.primaryBtn} onPress={() => navigation.navigate("Auth")}>
            <Ionicons name="log-in-outline" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>Login / Register</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.profileHeader}>
            <View style={styles.headerTopRow}>
              <Text style={styles.handleText}>{profileModel?.handle}</Text>
              <Pressable style={styles.iconChip} accessibilityRole="button" onPress={() => {}}>
                <Ionicons name="ellipsis-horizontal" size={18} color="#22312d" />
              </Pressable>
            </View>

            <View style={styles.headerMidRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{profileModel?.initials}</Text>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{profileModel?.posts}</Text>
                  <Text style={styles.statLabel}>Posts</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{profileModel?.followers}</Text>
                  <Text style={styles.statLabel}>Followers</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{profileModel?.following}</Text>
                  <Text style={styles.statLabel}>Following</Text>
                </View>
              </View>
            </View>

            <Text style={styles.fullName}>{user.fullName}</Text>
            <Text style={styles.roleLine}>
              {isInstructor ? "Instructor" : "Farmer"} • {user.email}
            </Text>

            <View style={styles.actionsRow}>
              <Pressable style={styles.followBtn} accessibilityRole="button" onPress={() => {}}>
                <Ionicons name="heart-outline" size={18} color="#fff" />
                <Text style={styles.followBtnText}>Follow</Text>
              </Pressable>
              <Pressable style={styles.msgBtn} accessibilityRole="button" onPress={() => {}}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color="#0f7d3d" />
                <Text style={styles.msgBtnText}>Message</Text>
              </Pressable>
              <Pressable style={styles.editBtn} accessibilityRole="button" onPress={() => {}}>
                <Ionicons name="create-outline" size={18} color="#0a9f46" />
                <Text style={styles.editBtnText}>Edit</Text>
              </Pressable>
            </View>

            {isInstructor ? (
              <Pressable style={styles.studioBtn} accessibilityRole="button" onPress={() => navigation.navigate("InstructorStudio")}>
                <Ionicons name="school-outline" size={18} color="#0a9f46" />
                <Text style={styles.studioText}>Instructor Studio</Text>
                <Text style={styles.studioMeta}>Upload courses & lessons</Text>
                <Ionicons name="chevron-forward" size={18} color="#6b7b77" />
              </Pressable>
            ) : (
              <Pressable style={[styles.actionBtn, styles.actionBtnSecondary]} accessibilityRole="button" onPress={() => signOut()}>
                <Ionicons name="log-out-outline" size={18} color="#fff" />
                <Text style={styles.actionBtnText}>Logout</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Gallery</Text>
              <Pressable style={styles.smallLink} onPress={() => {}}>
                <Text style={styles.smallLinkText}>View all</Text>
              </Pressable>
            </View>

            <View style={styles.galleryTabs}>
              {[
                { icon: "grid-outline", label: "Posts" },
                { icon: "ticket-outline", label: "Tips" },
                { icon: "sparkles-outline", label: "Top" },
                { icon: "play-outline", label: "Videos" }
              ].map((t) => (
                <View key={t.label} style={styles.galleryTab}>
                  <Ionicons name={t.icon as any} size={18} color="#0f7d3d" />
                  <Text style={styles.galleryTabText}>{t.label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.grid}>
              {Array.from({ length: 12 }).map((_, i) => (
                <View key={i} style={styles.gridTile}>
                  <Ionicons name="leaf-outline" size={20} color="#0a9f46" />
                </View>
              ))}
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f2f5f4" },
  scrollBottom: { paddingBottom: 90 },

  card: { margin: 12, borderRadius: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dce4e1", padding: 16 },
  cardTitle: { fontSize: 20, fontWeight: "900", color: "#111616" },
  cardSub: { marginTop: 6, color: "#5b6965", fontWeight: "600", lineHeight: 18 },

  primaryBtn: { marginTop: 16, borderRadius: 14, backgroundColor: "#0a9f46", paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryBtnText: { color: "#fff", fontWeight: "900" },

  profileHeader: { margin: 12, borderRadius: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dce4e1", padding: 14 },

  headerTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  handleText: { fontWeight: "900", color: "#22312d" },
  iconChip: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: "#e3e7e6", alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },

  headerMidRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10 },
  avatar: { width: 66, height: 66, borderRadius: 33, backgroundColor: "#e8f7ee", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#cde9d9" },
  avatarText: { color: "#0a9f46", fontSize: 22, fontWeight: "900" },

  statsRow: { flex: 1, flexDirection: "row", justifyContent: "space-around" },
  statItem: { alignItems: "center" },
  statValue: { fontWeight: "900", color: "#22312d" },
  statLabel: { marginTop: 1, color: "#5b6965", fontWeight: "700", fontSize: 12 },

  fullName: { marginTop: 10, fontSize: 16, fontWeight: "900", color: "#22312d" },
  roleLine: { marginTop: 2, color: "#5b6965", fontWeight: "700" },

  actionsRow: { marginTop: 10, flexDirection: "row", gap: 8 },
  followBtn: { flex: 1, backgroundColor: "#0a9f46", borderRadius: 14, paddingVertical: 10, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  followBtnText: { color: "#fff", fontWeight: "900" },
  msgBtn: { flex: 1, backgroundColor: "#eef8f1", borderRadius: 14, paddingVertical: 10, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#cde9d9" },
  msgBtnText: { color: "#0f7d3d", fontWeight: "900" },
  editBtn: { width: 84, backgroundColor: "#fff", borderRadius: 14, paddingVertical: 10, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#dce4e1" },
  editBtnText: { marginTop: 2, color: "#0a9f46", fontWeight: "900", fontSize: 12 },

  studioBtn: {
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: "#eef8f1",
    borderWidth: 1,
    borderColor: "#cde9d9",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  studioText: { fontWeight: "900", color: "#0a9f46" },
  studioMeta: { flex: 1, color: "#5b6965", fontWeight: "700", fontSize: 12 },

  actionBtn: { marginTop: 12, borderRadius: 14, backgroundColor: "#0a9f46", paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  actionBtnSecondary: { backgroundColor: "#111827" },
  actionBtnText: { color: "#fff", fontWeight: "900" },

  sectionCard: { margin: 12, borderRadius: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dce4e1", padding: 14 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontWeight: "900", color: "#22312d", fontSize: 16 },
  smallLink: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: "#f2f5f4", borderWidth: 1, borderColor: "#dce4e1" },
  smallLinkText: { color: "#0f7d3d", fontWeight: "800" },

  galleryTabs: { flexDirection: "row", gap: 10, marginTop: 12 },
  galleryTab: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: 14, backgroundColor: "#f2f5f4", borderWidth: 1, borderColor: "#dce4e1" },
  galleryTabText: { marginTop: 6, color: "#0f7d3d", fontWeight: "900", fontSize: 12 },

  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 14, gap: 10 },
  gridTile: { width: "30%", aspectRatio: 1, borderRadius: 14, backgroundColor: "#eef8f1", borderWidth: 1, borderColor: "#cde9d9", alignItems: "center", justifyContent: "center" }
});
