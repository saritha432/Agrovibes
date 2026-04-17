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
          <Text style={styles.sectionTitle}>COURSE SYLLABUS</Text>
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
                </View>
              </View>
              {idx === 0 && !s.locked ? (
                <View style={styles.previewPill}>
                  <Text style={styles.previewPillText}>Preview</Text>
                </View>
              ) : (
                <Ionicons name={s.locked ? "lock-closed-outline" : "play-circle-outline"} size={16} color={s.locked ? "#9aa8a4" : GREEN} />
              )}
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WHAT YOU'LL LEARN</Text>
          {[
            "Practical field-tested techniques",
            "Reduce input costs significantly",
            "Improve crop yield and quality",
            "Access government schemes & subsidies",
            "Connect with expert community",
            "Downloadable study material"
          ].map((item) => (
            <View key={item} style={styles.learnRow}>
              <Ionicons name="checkmark-circle" size={14} color={GREEN} />
              <Text style={styles.learnText}>{item}</Text>
            </View>
          ))}
        </View>

        {course.reviewsPreview?.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>STUDENT REVIEWS</Text>
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
          </View>
        ) : null}
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f5f2ee" },
  scrollBottom: { paddingBottom: 120 },

  headerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8, backgroundColor: "#f5f2ee" },
  backBtn: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, marginHorizontal: 6, fontWeight: "700", color: "#22312d", fontSize: 11 },

  hero: { marginHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: "#e7dfdc", overflow: "hidden", padding: 12, minHeight: 130 },
  heroChips: { flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 4, flexWrap: "wrap" },
  heroPill: { backgroundColor: "rgba(255,255,255,0.9)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  heroPillText: { color: "#22312d", fontWeight: "700", fontSize: 9 },
  heroIconWrap: { alignItems: "center", paddingVertical: 12 },
  heroIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(10,159,70,0.25)" },

  body: { paddingHorizontal: 12, paddingTop: 12 },
  courseTitle: { fontSize: 28, fontWeight: "900", color: "#111616", lineHeight: 34 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" },
  metaText: { color: "#5b6966", fontWeight: "600", fontSize: 11 },
  dot: { color: "#7b8b86", fontWeight: "900" },

  priceCard: { marginTop: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 12 },
  priceTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  priceLabel: { fontWeight: "900", color: GREEN, fontSize: 34, lineHeight: 38 },
  priceSub: { marginTop: 0, color: "#5b6966", fontWeight: "500", fontSize: 11 },
  cta: { marginTop: 10, backgroundColor: GREEN, borderRadius: 8, paddingVertical: 11, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  ctaText: { color: "#fff", fontWeight: "800", fontSize: 12 },

  section: { marginTop: 12 },
  sectionTitle: { fontSize: 10, fontWeight: "700", color: "#7f8a87", marginBottom: 8, letterSpacing: 0.8 },

  instructorCard: { borderBottomWidth: 1, borderBottomColor: "#e8e1da", paddingBottom: 10, flexDirection: "row", gap: 10 },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#f5d3c4", borderWidth: 1, borderColor: "#efbfa6", alignItems: "center", justifyContent: "center" },
  avatarText: { color: GREEN, fontWeight: "900" },
  instructorName: { color: "#111616", fontWeight: "800", fontSize: 11 },
  instructorTitle: { marginTop: 1, color: "#7a857f", fontWeight: "600", fontSize: 10 },
  instructorBio: { marginTop: 4, color: "#495955", fontWeight: "500", lineHeight: 16, fontSize: 10 },

  syllabusRow: { backgroundColor: "#f8f6f2", borderWidth: 1, borderColor: "#ece4dc", borderRadius: 8, padding: 10, marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  syllabusLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  stepCircle: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#f1e6de", alignItems: "center", justifyContent: "center" },
  stepText: { fontWeight: "800", color: "#9f5f4d", fontSize: 10 },
  syllabusTitle: { color: "#111616", fontWeight: "600", fontSize: 10, lineHeight: 14 },
  previewPill: { backgroundColor: "#d6f8d9", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  previewPillText: { color: "#118247", fontWeight: "700", fontSize: 9 },

  learnRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 7 },
  learnText: { color: "#33443f", fontWeight: "500", fontSize: 11 },

  reviewRow: { backgroundColor: "#fff", borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 10, marginTop: 8, flexDirection: "row", gap: 8 },
  reviewAvatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#f8dfd2", alignItems: "center", justifyContent: "center" },
  reviewAvatarText: { color: "#7c4937", fontWeight: "800", fontSize: 9 },
  reviewName: { fontWeight: "700", color: "#22312d", fontSize: 10 },
  reviewText: { marginTop: 4, color: "#33443f", fontWeight: "500", lineHeight: 15, fontSize: 10 },
  stateCard: { marginBottom: 10, backgroundColor: "#fff", borderWidth: 1, borderColor: BORDER, borderRadius: 16, padding: 12, flexDirection: "row", gap: 10, alignItems: "center" },
  stateText: { color: "#4b5a56", fontWeight: "700", flex: 1 }
});

