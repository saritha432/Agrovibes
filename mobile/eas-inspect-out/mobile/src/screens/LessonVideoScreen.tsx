import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { Video, ResizeMode } from "expo-av";
import type { LearnStackParamList } from "../navigation/LearnStackNavigator";
import { fetchLearnCourseById } from "../services/api";
import type { Course, CourseLesson } from "../services/api";
import { useAuth } from "../auth/AuthContext";
import { saveCourseProgress } from "../services/api";

type Nav = NativeStackNavigationProp<LearnStackParamList, "LessonVideo">;
type Rt = RouteProp<LearnStackParamList, "LessonVideo">;

const GREEN = "#0a9f46";
const BORDER = "#dce3e1";

function isProbablyMp4Url(url: string) {
  const u = String(url || "").trim().toLowerCase();
  return u.startsWith("http://") || u.startsWith("https://");
}

export function LessonVideoScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { token } = useAuth();
  const [course, setCourse] = React.useState<Course | null>(null);
  const [lesson, setLesson] = React.useState<CourseLesson | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [playRequested, setPlayRequested] = React.useState<boolean>(Boolean(route.params.autoPlay));
  const [isPlaying, setIsPlaying] = React.useState(false);
  const lastSavedRef = React.useRef<number>(0);
  const completedRef = React.useRef<boolean>(false);

  React.useEffect(() => {
    setPlayRequested(Boolean(route.params.autoPlay));
    setIsPlaying(false);
    completedRef.current = false;
    lastSavedRef.current = 0;
  }, [route.params.lessonId, route.params.autoPlay]);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchLearnCourseById(route.params.courseId);
        if (!mounted) return;
        setCourse(data.course);
        const lessons = data.course.lessons || [];
        const selected = lessons.find((l) => String(l.id) === String(route.params.lessonId)) || null;
        if (!selected) {
          setError("Lesson not found");
          setLesson(null);
        } else if (selected.locked) {
          setError("This lesson is locked. Enroll/purchase to unlock.");
          setLesson(selected);
        } else {
          setLesson(selected);
        }
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load lesson");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [route.params.courseId, route.params.lessonId]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollBottom} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityRole="button">
          <Ionicons name="arrow-back" size={18} color="#22312d" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {lesson?.title || "Lesson"}
        </Text>
        <View style={{ width: 34 }} />
      </View>

      <View style={styles.body}>
        {loading ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateText}>Loading video…</Text>
          </View>
        ) : error ? (
          <View style={styles.stateCard}>
            <Ionicons name="alert-circle-outline" size={18} color="#b42318" />
            <Text style={styles.stateText}>{error}</Text>
          </View>
        ) : null}

        {lesson?.videoUrl && !lesson.locked ? (
          isProbablyMp4Url(lesson.videoUrl) ? (
          <View style={styles.videoCard}>
            <Video
              source={{ uri: lesson.videoUrl }}
              style={styles.video}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay={playRequested}
              onPlaybackStatusUpdate={(status: any) => {
                if (!token) return;
                if (!status?.isLoaded) return;
                const seconds = Math.floor((status.positionMillis || 0) / 1000);
                const now = Date.now();
                const shouldSave = now - lastSavedRef.current > 10000; // every 10s
                if (shouldSave && seconds >= 1) {
                  lastSavedRef.current = now;
                  saveCourseProgress(route.params.courseId, token, {
                    lessonId: route.params.lessonId,
                    completed: false,
                    lastWatchedSeconds: seconds
                  }).catch(() => {});
                }
                setIsPlaying(Boolean(status?.isPlaying));
                if (status.didJustFinish && !completedRef.current) {
                  completedRef.current = true;
                  saveCourseProgress(route.params.courseId, token, {
                    lessonId: route.params.lessonId,
                    completed: true,
                    lastWatchedSeconds: seconds
                  }).catch(() => {});
                }
              }}
            />
            {!isPlaying && (
              <Pressable
                style={styles.playOverlay}
                onPress={() => {
                  // On web, initial playback can be blocked. Toggle state to force re-play on user gesture.
                  setPlayRequested(false);
                  setTimeout(() => setPlayRequested(true), 50);
                }}
                accessibilityRole="button"
              >
                <View style={styles.playButton}>
                  <Ionicons name="play" size={18} color="#fff" />
                  <Text style={styles.playText}>Play</Text>
                </View>
              </Pressable>
            )}
          </View>
          ) : (
            <View style={styles.videoCard}>
              <Text style={styles.invalidVideoText}>Video URL is not playable.</Text>
              <Text style={styles.invalidVideoTextSub}>Provide a direct reachable video file URL.</Text>
            </View>
          )
        ) : null}

        {course ? (
          <View style={styles.metaCard}>
            <Text style={styles.courseName} numberOfLines={2}>
              {course.title}
            </Text>
            {lesson?.durationLabel ? <Text style={styles.metaText}>Duration {lesson.durationLabel}</Text> : null}
            <View style={styles.row}>
              <Ionicons name="shield-checkmark-outline" size={16} color={GREEN} />
              <Text style={styles.metaText}>HD playback • Resume later (next)</Text>
            </View>
          </View>
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

  body: { paddingHorizontal: 12, paddingTop: 12 },
  stateCard: { marginBottom: 10, backgroundColor: "#fff", borderWidth: 1, borderColor: BORDER, borderRadius: 16, padding: 12, flexDirection: "row", gap: 10, alignItems: "center" },
  stateText: { color: "#4b5a56", fontWeight: "700", flex: 1 },

  videoCard: { backgroundColor: "#fff", borderWidth: 1, borderColor: BORDER, borderRadius: 16, overflow: "hidden" },
  video: { width: "100%", height: 220, backgroundColor: "#0b0f0e" },
  playOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)"
  },
  playButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#0a9f46",
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  playText: { color: "#fff", fontWeight: "900" },

  metaCard: { marginTop: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: BORDER, borderRadius: 16, padding: 12 },
  courseName: { fontWeight: "900", color: "#111616", fontSize: 16 },
  metaText: { marginTop: 6, color: "#5b6966", fontWeight: "800" },
  row: { marginTop: 8, flexDirection: "row", gap: 8, alignItems: "center" }
  ,
  invalidVideoText: { color: "#b42318", fontWeight: "900", marginBottom: 6 },
  invalidVideoTextSub: { color: "#5b6966", fontWeight: "700", lineHeight: 18 }
});

