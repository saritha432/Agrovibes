import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ActivityIndicator, RefreshControl } from "react-native";
import { AppTopBar } from "../components/AppTopBar";
import type { LearnStackParamList } from "../navigation/LearnStackNavigator";
import type { Course } from "../services/api";
import { fetchLearnCourses } from "../services/api";

type Nav = NativeStackNavigationProp<LearnStackParamList, "LearnHome">;

const GREEN = "#0a9f46";
const BORDER = "#dce3e1";

const segments = [
  { id: "courses", label: "Courses", count: 120 },
  { id: "community", label: "Community", count: 18000 },
  { id: "experts", label: "Experts", count: 8 }
] as const;

type SegmentId = (typeof segments)[number]["id"];

function formatCompact(n: number) {
  if (n >= 1000000) return `${Math.round(n / 100000) / 10}M`;
  if (n >= 1000) return `${Math.round(n / 100) / 10}K`;
  return String(n);
}

export function LearnScreen() {
  const navigation = useNavigation<Nav>();
  const [segment, setSegment] = useState<SegmentId>("courses");
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const featured = useMemo(() => courses[0], [courses]);

  const load = async () => {
    setError(null);
    const data = await fetchLearnCourses();
    setCourses(data.courses || []);
  };

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await load();
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load courses");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.scrollBottom}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            try {
              await load();
            } catch (e: any) {
              setError(e?.message || "Failed to load courses");
            } finally {
              setRefreshing(false);
            }
          }}
        />
      }
    >
      <AppTopBar />

      <View style={styles.header}>
        <Text style={styles.title}>Learn & Community</Text>
        <Text style={styles.sub}>Courses, expert guidance, Q&A and farmer groups</Text>
      </View>

      <View style={styles.segmentRow}>
        {segments.map((s) => {
          const active = segment === s.id;
          return (
            <Pressable
              key={s.id}
              onPress={() => setSegment(s.id)}
              style={[styles.segmentItem, active ? styles.segmentActive : null]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.segmentCount, active ? styles.segmentCountActive : null]}>{formatCompact(s.count)}+</Text>
              <Text style={[styles.segmentLabel, active ? styles.segmentLabelActive : null]}>{s.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {segment !== "courses" ? (
        <View style={styles.placeholderCard}>
          <Ionicons name="construct-outline" size={18} color="#4b5a56" />
          <Text style={styles.placeholderText}>This section is coming next. Courses are ready now.</Text>
        </View>
      ) : (
        <>
          <View style={styles.chipRow}>
            {["All", "Crop Management", "Soil Health", "Plant Care"].map((c) => (
              <View key={c} style={[styles.chip, c === "All" ? styles.chipActive : null]}>
                <Text style={[styles.chipText, c === "All" ? styles.chipTextActive : null]}>{c}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Featured Course</Text>
          {loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color={GREEN} />
              <Text style={styles.loadingText}>Loading courses…</Text>
            </View>
          ) : error ? (
            <View style={styles.loadingCard}>
              <Ionicons name="alert-circle-outline" size={18} color="#b42318" />
              <Text style={styles.loadingText}>{error}</Text>
            </View>
          ) : !featured ? (
            <View style={styles.loadingCard}>
              <Text style={styles.loadingText}>No courses yet.</Text>
            </View>
          ) : (
            <Pressable
              style={styles.featuredWrap}
              onPress={() => navigation.navigate("CourseDetail", { courseId: featured.id })}
              accessibilityRole="button"
            >
              <LinearGradient colors={featured.heroGradient as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.featuredCard}>
                <View style={styles.badgeRow}>
                  <View style={styles.hotBadge}>
                    <Ionicons name="flame" size={12} color="#fff" />
                    <Text style={styles.hotBadgeText}>Top Rated</Text>
                  </View>
                  <View style={styles.levelPill}>
                    <Text style={styles.levelPillText}>{featured.level}</Text>
                  </View>
                </View>

                <View style={styles.heroIconWrap}>
                  <View style={styles.heroIcon}>
                    <Ionicons name="leaf" size={22} color={GREEN} />
                  </View>
                </View>

                <Text style={styles.featuredTitle} numberOfLines={2}>
                  {featured.title}
                </Text>
                <View style={styles.featuredMetaRow}>
                  <Ionicons name="star" size={14} color="#f59e0b" />
                  <Text style={styles.metaText}>{Number(featured.rating).toFixed(1)}</Text>
                  <Text style={styles.metaDot}>•</Text>
                  <Ionicons name="people-outline" size={14} color="#5b6966" />
                  <Text style={styles.metaText}>{formatCompact(featured.learnersCount)} students</Text>
                  <Text style={styles.metaDot}>•</Text>
                  <Ionicons name="time-outline" size={14} color="#5b6966" />
                  <Text style={styles.metaText}>{featured.durationLabel}</Text>
                </View>
              </LinearGradient>
            </Pressable>
          )}

          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>All Courses</Text>
            <Text style={styles.sectionCount}>{courses.length}</Text>
          </View>

          {courses.map((c) => (
            <Pressable key={c.id} style={styles.bigCourseWrap} onPress={() => navigation.navigate("CourseDetail", { courseId: c.id })}>
              <LinearGradient colors={c.heroGradient as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bigCourseHero}>
                <View style={styles.bigBadgeRow}>
                  <View style={styles.hotBadge}>
                    <Ionicons name="flame" size={12} color="#fff" />
                    <Text style={styles.hotBadgeText}>Top Rated</Text>
                  </View>
                  <View style={styles.levelPill}>
                    <Text style={styles.levelPillText}>{c.level}</Text>
                  </View>
                </View>
                <View style={styles.bigHeroCenter}>
                  <View style={styles.heroIcon}>
                    <Ionicons name="leaf" size={22} color={GREEN} />
                  </View>
                  <View style={styles.freePill}>
                    <Text style={styles.freePillText}>{c.isFree ? "FREE" : "PAID"}</Text>
                  </View>
                </View>
              </LinearGradient>

              <View style={styles.bigCourseBody}>
                <Text style={styles.bigCourseTitle} numberOfLines={2}>
                  {c.title}
                </Text>
                <View style={styles.bigMetaRow}>
                  <Ionicons name="star" size={14} color="#f59e0b" />
                  <Text style={styles.metaText}>{Number(c.rating).toFixed(1)}</Text>
                  <Text style={styles.metaDot}>•</Text>
                  <Ionicons name="people-outline" size={14} color="#5b6966" />
                  <Text style={styles.metaText}>{formatCompact(c.learnersCount)} students</Text>
                  <Text style={styles.metaDot}>•</Text>
                  <Ionicons name="time-outline" size={14} color="#5b6966" />
                  <Text style={styles.metaText}>{c.durationLabel}</Text>
                </View>
                <Pressable
                  style={styles.bigStartBtn}
                  onPress={() => navigation.navigate("CoursePlayer", { courseId: c.id })}
                  accessibilityRole="button"
                >
                  <Ionicons name="play-circle" size={18} color="#fff" />
                  <Text style={styles.bigStartBtnText}>Start Learning</Text>
                </Pressable>
              </View>
            </Pressable>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f2f5f4" },
  scrollBottom: { paddingBottom: 110 },
  header: { paddingHorizontal: 12, paddingVertical: 10 },
  title: { fontSize: 26, fontWeight: "800", color: "#121716" },
  sub: { color: "#4b5a56", marginTop: 3, fontWeight: "600" },

  segmentRow: { flexDirection: "row", gap: 8, paddingHorizontal: 12, marginBottom: 10 },
  segmentItem: { flex: 1, backgroundColor: "#ffffff", borderWidth: 1, borderColor: BORDER, borderRadius: 14, paddingVertical: 10, alignItems: "center" },
  segmentActive: { borderColor: "#bfe3cf", backgroundColor: "#eef8f1" },
  segmentCount: { fontSize: 16, fontWeight: "900", color: "#1f2b28" },
  segmentCountActive: { color: GREEN },
  segmentLabel: { marginTop: 2, fontSize: 12, fontWeight: "700", color: "#5b6966" },
  segmentLabelActive: { color: GREEN },

  placeholderCard: { marginHorizontal: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: BORDER, borderRadius: 14, padding: 12, flexDirection: "row", gap: 10, alignItems: "center" },
  placeholderText: { color: "#4b5a56", fontWeight: "600", flex: 1 },

  chipRow: { flexDirection: "row", gap: 8, paddingHorizontal: 12, marginTop: 6, marginBottom: 10, flexWrap: "wrap" },
  chip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 18, borderWidth: 1, borderColor: "#c7d5cf", backgroundColor: "#fff" },
  chipActive: { backgroundColor: "#121716", borderColor: "#121716" },
  chipText: { color: "#425652", fontWeight: "700", fontSize: 12 },
  chipTextActive: { color: "#fff" },

  sectionTitle: { marginTop: 8, marginHorizontal: 12, color: "#22312d", fontWeight: "800", fontSize: 17 },

  featuredWrap: { marginHorizontal: 12, marginTop: 8 },
  featuredCard: { borderRadius: 18, padding: 12, borderWidth: 1, borderColor: "#e7dfdc", overflow: "hidden" },
  badgeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  hotBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#111827", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  hotBadgeText: { color: "#fff", fontWeight: "800", fontSize: 11 },
  levelPill: { backgroundColor: "rgba(255,255,255,0.85)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  levelPillText: { color: "#22312d", fontWeight: "800", fontSize: 11 },
  heroIconWrap: { alignItems: "center", marginTop: 16, marginBottom: 10 },
  heroIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(10,159,70,0.25)" },
  featuredTitle: { marginTop: 4, color: "#111616", fontSize: 16, fontWeight: "900" },
  featuredMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" },
  metaText: { color: "#33443f", fontWeight: "700", fontSize: 12 },
  metaDot: { color: "#7b8b86", fontWeight: "900" },

  sectionRow: { marginTop: 8, marginHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionCount: { color: "#5b6966", fontWeight: "800" },

  bigCourseWrap: { marginHorizontal: 12, marginTop: 10, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: BORDER, overflow: "hidden" },
  bigCourseHero: { height: 130, padding: 10, borderBottomWidth: 1, borderBottomColor: "#e7dfdc" },
  bigBadgeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bigHeroCenter: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  freePill: { backgroundColor: GREEN, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  freePillText: { color: "#fff", fontWeight: "900", fontSize: 11 },
  bigCourseBody: { padding: 12 },
  bigCourseTitle: { color: "#111616", fontWeight: "900", fontSize: 16 },
  bigMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" },
  bigStartBtn: { marginTop: 12, backgroundColor: GREEN, borderRadius: 14, paddingVertical: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  bigStartBtnText: { color: "#fff", fontWeight: "900", fontSize: 14 }
  ,
  loadingCard: {
    marginHorizontal: 12,
    marginTop: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "center"
  },
  loadingText: { color: "#4b5a56", fontWeight: "700", flex: 1 }
});

