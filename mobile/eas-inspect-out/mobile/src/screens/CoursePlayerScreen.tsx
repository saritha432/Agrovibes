import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import type { LearnStackParamList } from "../navigation/LearnStackNavigator";
import { fetchLearnCourseById } from "../services/api";
import type { Course, CourseLesson } from "../services/api";
import { useAuth } from "../auth/AuthContext";
import { fetchCourseProgress } from "../services/api";

type Nav = NativeStackNavigationProp<LearnStackParamList, "CoursePlayer">;
type Rt = RouteProp<LearnStackParamList, "CoursePlayer">;

const GREEN = "#0a9f46";
const BORDER = "#dce3e1";

function lessonIsPlayable(lesson: CourseLesson) {
  const u = String(lesson.videoUrl || "").trim().toLowerCase();
  const hasRemoteUrl = u.startsWith("http://") || u.startsWith("https://");
  return !lesson.locked && hasRemoteUrl;
}

export function CoursePlayerScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { token } = useAuth();
  const [course, setCourse] = React.useState<Course | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [progressMap, setProgressMap] = React.useState<Record<string, { completed: boolean; lastWatchedSeconds: number; updatedAt: string }>>({});
  const [resumeLessonId, setResumeLessonId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchLearnCourseById(route.params.courseId);
        if (!mounted) return;
        setCourse(data.course);
        if (token) {
          try {
            const p = await fetchCourseProgress(route.params.courseId, token);
            const map: any = {};
            for (const row of p.progress || []) {
              map[String(row.lessonId)] = row;
            }
            setProgressMap(map);
            const last = (p.progress || [])[0];
            setResumeLessonId(last ? String(last.lessonId) : null);
          } catch {
            // ignore
          }
        }
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
  const lessons = course?.lessons?.length ? course.lessons : course?.syllabus?.map((s) => ({ ...s, videoUrl: "", locked: s.locked })) ?? [];

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
        <View style={styles.heroInner}>
          <View style={styles.heroIcon}>
            <Ionicons name="play" size={22} color="#fff" />
          </View>
          <Text style={styles.heroTitle} numberOfLines={2}>
            {course?.title || "Learning"}
          </Text>
          <Text style={styles.heroSub}>Your lessons will appear below</Text>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        {loading ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateText}>Loading lessons…</Text>
          </View>
        ) : error ? (
          <View style={styles.stateCard}>
            <Ionicons name="alert-circle-outline" size={18} color="#b42318" />
            <Text style={styles.stateText}>{error}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Course content</Text>
        {resumeLessonId ? (
          <Pressable
            style={styles.resumeBtn}
            onPress={() =>
              navigation.navigate("LessonVideo", { courseId: route.params.courseId, lessonId: resumeLessonId, autoPlay: true })
            }
          >
            <Ionicons name="play" size={16} color="#fff" />
            <Text style={styles.resumeText}>Resume lesson {resumeLessonId}</Text>
          </Pressable>
        ) : null}
        {lessons.map((l: any, idx: number) => {
          const locked = Boolean(l.locked);
          const playable = l.videoUrl && lessonIsPlayable(l);
          const p = progressMap[String(l.id)];
          return (
            <Pressable
              key={l.id ?? String(idx)}
              style={styles.lessonRow}
              disabled={!playable}
              onPress={() => {
                navigation.navigate("LessonVideo", { courseId: route.params.courseId, lessonId: String(l.id), autoPlay: true });
              }}
            >
              <View style={styles.lessonLeft}>
                <View style={[styles.lessonIndex, locked ? styles.lessonIndexLocked : null]}>
                  <Text style={[styles.lessonIndexText, locked ? styles.lessonIndexTextLocked : null]}>{idx + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lessonTitle} numberOfLines={2}>
                    {l.title}
                  </Text>
                  {l.durationLabel ? <Text style={styles.lessonSub}>{l.durationLabel}</Text> : null}
                  {p ? (
                    <Text style={styles.progressSub}>
                      {p.completed ? "Completed" : `Watched ${Math.max(0, Math.floor(p.lastWatchedSeconds || 0))}s`}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {p?.completed ? <Ionicons name="checkmark-circle" size={18} color={GREEN} /> : null}
                <Ionicons name={locked ? "lock-closed-outline" : playable ? "play-circle" : "play-circle-outline"} size={20} color={locked ? "#9aa8a4" : GREEN} />
              </View>
            </Pressable>
          );
        })}

        <View style={styles.tipCard}>
          <Ionicons name="information-circle-outline" size={18} color="#2a5f46" />
          <Text style={styles.tipText}>
            Locked lessons represent paid content. Later we can add purchase/enrollment to unlock them (Udemy style).
          </Text>
        </View>
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

  hero: { marginHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: "#e7dfdc", overflow: "hidden" },
  heroInner: { padding: 14, alignItems: "center" },
  heroIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: GREEN, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.6)" },
  heroTitle: { marginTop: 10, textAlign: "center", fontWeight: "900", color: "#111616" },
  heroSub: { marginTop: 4, color: "#4b5a56", fontWeight: "700" },

  body: { paddingHorizontal: 12, paddingTop: 12 },
  stateCard: { marginBottom: 10, backgroundColor: "#fff", borderWidth: 1, borderColor: BORDER, borderRadius: 16, padding: 12, flexDirection: "row", gap: 10, alignItems: "center" },
  stateText: { color: "#4b5a56", fontWeight: "700", flex: 1 },
  sectionTitle: { marginTop: 8, color: "#22312d", fontWeight: "900", fontSize: 16, marginBottom: 8 },
  resumeBtn: { marginBottom: 4, backgroundColor: GREEN, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  resumeText: { color: "#fff", fontWeight: "900" },

  lessonRow: { backgroundColor: "#fff", borderWidth: 1, borderColor: BORDER, borderRadius: 16, padding: 12, marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  lessonLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  lessonIndex: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#eef8f1", borderWidth: 1, borderColor: "#cde9d9", alignItems: "center", justifyContent: "center" },
  lessonIndexLocked: { backgroundColor: "#f2f5f4", borderColor: "#d7dfdc" },
  lessonIndexText: { fontWeight: "900", color: GREEN, fontSize: 12 },
  lessonIndexTextLocked: { color: "#7b8b86" },
  lessonTitle: { color: "#111616", fontWeight: "900" },
  lessonSub: { marginTop: 2, color: "#7b8b86", fontWeight: "800", fontSize: 12 },
  progressSub: { marginTop: 4, color: "#0f7d3d", fontWeight: "800", fontSize: 12 },

  tipCard: { marginTop: 14, backgroundColor: "#eef8f1", borderWidth: 1, borderColor: "#cde9d9", borderRadius: 16, padding: 12, flexDirection: "row", gap: 10, alignItems: "center" },
  tipText: { color: "#2a5f46", fontWeight: "700", flex: 1, lineHeight: 18 }
});

