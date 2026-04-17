import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import type { LearnStackParamList } from "../navigation/LearnStackNavigator";
import { ActivityIndicator } from "react-native";
import type { Course } from "../services/api";
import { fetchLearnCourseById } from "../services/api";
import { useAuth } from "../auth/AuthContext";
import { enrollInCourse } from "../services/api";

type Nav = NativeStackNavigationProp<LearnStackParamList, "CourseDetail">;
type Rt = RouteProp<LearnStackParamList, "CourseDetail">;

const GREEN = "#0a9f46";
const BORDER = "#dce3e1";

function formatCompact(n: number) {
  if (n >= 1000000) return `${Math.round(n / 100000) / 10}M`;
  if (n >= 1000) return `${Math.round(n / 100) / 10}K`;
  return String(n);
}

function Stars({ value }: { value: number }) {
  const full = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <View style={{ flexDirection: "row", gap: 2, alignItems: "center" }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Ionicons key={i} name={i < full ? "star" : "star-outline"} size={12} color="#f59e0b" />
      ))}
    </View>
  );
}

export function CourseDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { user, token } = useAuth();
  const [course, setCourse] = React.useState<Course | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const data = await fetchLearnCourseById(route.params.courseId);
        if (!mounted) return;
        setCourse(data.course);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load course");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [route.params.courseId]);

  const heroGradient = (course?.heroGradient?.length ? course.heroGradient : ["#f7d7c9", "#cfe7d9", "#f6d8b7"]) as any;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollBottom} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityRole="button">
          <Ionicons name="arrow-back" size={18} color="#22312d" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {course?.title || "Course"}
        </Text>
        <View style={{ width: 34 }} />
      </View>

      <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroChips}>
          <View style={styles.heroPill}><Text style={styles.heroPillText}>{course?.tags?.[0] ?? "Hindi"}</Text></View>
          <View style={styles.heroPill}><Text style={styles.heroPillText}>{course?.level ?? "Beginner"}</Text></View>
          <View style={styles.heroPill}><Text style={styles.heroPillText}>{course?.tags?.[2] ?? "Marathi"}</Text></View>
        </View>
        <View style={styles.heroIconWrap}>
          <View style={styles.heroIcon}>
            <Ionicons name="leaf" size={26} color={GREEN} />
          </View>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={GREEN} />
            <Text style={styles.stateText}>Loading course…</Text>
          </View>
        ) : error ? (
          <View style={styles.stateCard}>
            <Ionicons name="alert-circle-outline" size={18} color="#b42318" />
            <Text style={styles.stateText}>{error}</Text>
          </View>
        ) : null}

        {course ? (
          <>
            <Text style={styles.courseTitle}>{course.title}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="star" size={14} color="#f59e0b" />
          <Text style={styles.metaText}>{Number(course.rating).toFixed(1)} rating</Text>
          <Text style={styles.dot}>•</Text>
          <Ionicons name="people-outline" size={14} color="#5b6966" />
          <Text style={styles.metaText}>{formatCompact(course.learnersCount)} students</Text>
          <Text style={styles.dot}>•</Text>
          <Ionicons name="time-outline" size={14} color="#5b6966" />
          <Text style={styles.metaText}>{course.durationLabel}</Text>
        </View>

        <View style={styles.priceCard}>
          <View style={styles.priceTopRow}>
            <Text style={styles.priceLabel}>{course.isFree ? "Free" : "Paid"}</Text>
            <Ionicons name="bookmark-outline" size={18} color="#7b8b86" />
          </View>
          <Text style={styles.priceSub}>Full lifetime access • Certificate included</Text>
          <Pressable
            style={styles.cta}
            accessibilityRole="button"
            onPress={async () => {
              if (!user || !token) {
                navigation.navigate("Auth" as any);
                return;
              }
              try {
                await enrollInCourse(route.params.courseId, token, !course.isFree);
              } catch {
                // ignore for now; player will still show locked lessons
              }
              navigation.navigate("CoursePlayer", { courseId: route.params.courseId });
            }}
          >
            <Ionicons name="play-circle" size={18} color="#fff" />
            <Text style={styles.ctaText}>{course.isFree ? "Start Learning for Free" : "Buy & Start Learning"}</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your instructor</Text>
          <View style={styles.instructorCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {course.instructor.name
                  .split(" ")
                  .slice(0, 2)
                  .map((p) => p[0])
                  .join("")}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.instructorName}>{course.instructor.name}</Text>
              <Text style={styles.instructorTitle}>{course.instructor.title}</Text>
              <Text style={styles.instructorBio}>{course.instructor.bio}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Course syllabus</Text>
          {course.syllabus.map((s, idx) => (
            <View key={s.id} style={styles.syllabusRow}>
              <View style={styles.syllabusLeft}>
                <View style={styles.stepCircle}>
                  <Text style={styles.stepText}>{idx + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.syllabusTitle} numberOfLines={2}>
                    {s.title}
                  </Text>
                  {s.durationLabel ? <Text style={styles.syllabusSub}>{s.durationLabel}</Text> : null}
                </View>
              </View>
              <Ionicons name={s.locked ? "lock-closed-outline" : "play-circle-outline"} size={18} color={s.locked ? "#9aa8a4" : GREEN} />
            </View>
          ))}
        </View>

        {course.reviewsPreview?.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Student reviews</Text>
            {course.reviewsPreview.slice(0, 3).map((r) => (
              <View key={r.name} style={styles.reviewRow}>
                <View style={styles.reviewAvatar}>
                  <Text style={styles.reviewAvatarText}>{r.name.split(" ").slice(0, 2).map((p) => p[0]).join("")}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={styles.reviewName}>{r.name}</Text>
                    <Stars value={r.rating} />
                  </View>
                  <Text style={styles.reviewText}>{r.text}</Text>
                </View>
              </View>
            ))}
            <Pressable
              style={styles.bottomCta}
              accessibilityRole="button"
              onPress={async () => {
                if (!user || !token) {
                  navigation.navigate("Auth" as any);
                  return;
                }
                try {
                  await enrollInCourse(route.params.courseId, token, !course.isFree);
                } catch {
                  // ignore
                }
                navigation.navigate("CoursePlayer", { courseId: route.params.courseId });
              }}
            >
              <Ionicons name="play-circle" size={18} color="#fff" />
              <Text style={styles.bottomCtaText}>Start Learning Now — It’s Free!</Text>
            </Pressable>
          </View>
        ) : null}
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f2f5f4" },
  scrollBottom: { paddingBottom: 120 },

  headerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8, backgroundColor: "#f2f5f4" },
  backBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#fff", borderWidth: 1, borderColor: BORDER, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, marginHorizontal: 10, fontWeight: "900", color: "#22312d", fontSize: 14 },

  hero: { marginHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: "#e7dfdc", overflow: "hidden", padding: 12 },
  heroChips: { flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 4, flexWrap: "wrap" },
  heroPill: { backgroundColor: "rgba(255,255,255,0.85)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  heroPillText: { color: "#22312d", fontWeight: "900", fontSize: 11 },
  heroIconWrap: { alignItems: "center", paddingVertical: 26 },
  heroIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(10,159,70,0.25)" },

  body: { paddingHorizontal: 12, paddingTop: 12 },
  courseTitle: { fontSize: 20, fontWeight: "900", color: "#111616" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" },
  metaText: { color: "#5b6966", fontWeight: "800", fontSize: 12 },
  dot: { color: "#7b8b86", fontWeight: "900" },

  priceCard: { marginTop: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: BORDER, borderRadius: 16, padding: 12 },
  priceTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  priceLabel: { fontWeight: "900", color: GREEN, fontSize: 18 },
  priceSub: { marginTop: 4, color: "#5b6966", fontWeight: "700" },
  cta: { marginTop: 10, backgroundColor: GREEN, borderRadius: 14, paddingVertical: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  ctaText: { color: "#fff", fontWeight: "900", fontSize: 14 },

  section: { marginTop: 14 },
  sectionTitle: { fontSize: 16, fontWeight: "900", color: "#22312d", marginBottom: 8 },

  instructorCard: { backgroundColor: "#fff", borderWidth: 1, borderColor: BORDER, borderRadius: 16, padding: 12, flexDirection: "row", gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#eef8f1", borderWidth: 1, borderColor: "#cde9d9", alignItems: "center", justifyContent: "center" },
  avatarText: { color: GREEN, fontWeight: "900" },
  instructorName: { color: "#111616", fontWeight: "900" },
  instructorTitle: { marginTop: 2, color: "#5b6966", fontWeight: "800" },
  instructorBio: { marginTop: 8, color: "#33443f", fontWeight: "600", lineHeight: 18 },

  syllabusRow: { backgroundColor: "#fff", borderWidth: 1, borderColor: BORDER, borderRadius: 16, padding: 12, marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  syllabusLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  stepCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#f2f5f4", borderWidth: 1, borderColor: "#d7dfdc", alignItems: "center", justifyContent: "center" },
  stepText: { fontWeight: "900", color: "#22312d", fontSize: 12 },
  syllabusTitle: { color: "#111616", fontWeight: "900" },
  syllabusSub: { marginTop: 2, color: "#7b8b86", fontWeight: "800", fontSize: 12 },

  reviewRow: { backgroundColor: "#fff", borderWidth: 1, borderColor: BORDER, borderRadius: 16, padding: 12, marginTop: 8, flexDirection: "row", gap: 10 },
  reviewAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#f2f5f4", borderWidth: 1, borderColor: "#d7dfdc", alignItems: "center", justifyContent: "center" },
  reviewAvatarText: { color: "#33443f", fontWeight: "900", fontSize: 12 },
  reviewName: { fontWeight: "900", color: "#22312d" },
  reviewText: { marginTop: 6, color: "#33443f", fontWeight: "600", lineHeight: 18 },
  bottomCta: { marginTop: 12, backgroundColor: GREEN, borderRadius: 14, paddingVertical: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  bottomCtaText: { color: "#fff", fontWeight: "900", fontSize: 14 }
  ,
  stateCard: { marginBottom: 10, backgroundColor: "#fff", borderWidth: 1, borderColor: BORDER, borderRadius: 16, padding: 12, flexDirection: "row", gap: 10, alignItems: "center" },
  stateText: { color: "#4b5a56", fontWeight: "700", flex: 1 }
});

