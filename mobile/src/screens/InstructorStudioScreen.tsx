import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../auth/AuthContext";
import type { Course } from "../services/api";
import { createCourse } from "../services/api";
import { updateCourse } from "../services/api";
import { uploadVideoFile } from "../services/api";

const GREEN = "#0a9f46";
const BORDER = "#dce3e1";
type DraftLesson = {
  id: string;
  title: string;
  durationLabel: string;
  locked: boolean;
  videoUri: string;
};

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function formatSelectedLabel(uri: string) {
  if (!uri) return "";
  const clean = uri.split("?")[0];
  const last = clean.split("/").pop() || clean;
  if (last.length > 40) return `${last.slice(0, 18)}…${last.slice(-12)}`;
  return last;
}

export function InstructorStudioScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { user, token } = useAuth();

  const [title, setTitle] = React.useState("");
  const [courseId, setCourseId] = React.useState("");
  const [category, setCategory] = React.useState("General");
  const [isFree, setIsFree] = React.useState(true);
  const [lessons, setLessons] = React.useState<DraftLesson[]>([
    { id: "1", title: "Introduction", durationLabel: "05:00", locked: false, videoUri: "" },
    { id: "2", title: "Lesson 2", durationLabel: "10:00", locked: true, videoUri: "" }
  ]);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!courseId && title) setCourseId(slugify(title));
  }, [title]);

  async function validateVideoSize(uri: string, maxMb: number) {
    if (Platform.OS === "web") return;
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    const bytes = (info as { size?: number }).size ?? 0;
    if (!bytes) return;
    const mb = bytes / (1024 * 1024);
    if (mb > maxMb) {
      throw new Error(`Video is ${mb.toFixed(1)}MB. Please select a video under ${maxMb}MB.`);
    }
  }

  async function pickLessonVideo(lessonId: string, source: "camera" | "gallery") {
    setError(null);
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(source === "camera" ? "Camera permission is required." : "Media library permission is required.");
      return;
    }
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            quality: 0.9
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            quality: 1
          });
    if (!result.canceled) {
      const uri = result.assets[0]?.uri ?? "";
      setLessons((prev) => prev.map((l) => (l.id === lessonId ? { ...l, videoUri: uri } : l)));
    }
  }

  const updateLesson = (lessonId: string, patch: Partial<DraftLesson>) => {
    setLessons((prev) => prev.map((l) => (l.id === lessonId ? { ...l, ...patch } : l)));
  };

  const addLesson = () => {
    setLessons((prev) => {
      const nextNum = prev.length + 1;
      return [
        ...prev,
        {
          id: String(nextNum),
          title: `Lesson ${nextNum}`,
          durationLabel: "10:00",
          locked: !isFree && nextNum > 1,
          videoUri: ""
        }
      ];
    });
  };

  const removeLesson = (lessonId: string) => {
    setLessons((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((l) => l.id !== lessonId).map((l, idx) => ({ ...l, id: String(idx + 1) }));
    });
  };

  const submit = async () => {
    setError(null);
    setSuccess(null);
    if (!token) {
      setError("Please login first.");
      return;
    }
    if (!courseId || !title) {
      setError("Course id and title are required.");
      return;
    }
    if (lessons.length === 0) {
      setError("Please add at least one lesson.");
      return;
    }
    const invalidLesson = lessons.find((l) => !l.title.trim() || !l.durationLabel.trim() || !l.videoUri);
    if (invalidLesson) {
      setError("Each lesson needs title, duration and video upload.");
      return;
    }
    setLoading(true);
    try {
      let publishedCourseId = courseId;
      for (const lesson of lessons) {
        await validateVideoSize(lesson.videoUri, 120);
      }
      const uploadedUrls = await Promise.all(lessons.map((lesson) => uploadVideoFile(lesson.videoUri)));
      const lessonPayload = lessons.map((lesson, idx) => ({
        id: String(idx + 1),
        title: lesson.title.trim(),
        durationLabel: lesson.durationLabel.trim(),
        locked: idx === 0 ? false : isFree ? false : Boolean(lesson.locked),
        videoUrl: uploadedUrls[idx].url
      }));

      const payload: Course = {
        id: courseId,
        title,
        category,
        tags: ["English", "Beginner"],
        level: "Beginner",
        rating: 4.6,
        learnersCount: 0,
        durationLabel: "1h 00m",
        isFree,
        heroGradient: ["#f7d7c9", "#cfe7d9", "#f6d8b7"],
        instructor: {
          name: user?.fullName || "Instructor",
          title: "Instructor",
          bio: "Created in Instructor Studio"
        },
        syllabus: lessonPayload.map((l) => ({
          id: l.id,
          title: l.title,
          durationLabel: l.durationLabel,
          locked: l.locked
        })),
        lessons: lessonPayload,
        reviewsPreview: []
      };

      // Update first; create only when course does not exist (404).
      try {
        await updateCourse(token, courseId, payload);
        setSuccess(`Updated course: ${courseId}`);
      } catch (e: any) {
        if (Number(e?.status) === 404) {
          const res = await createCourse(token, payload);
          publishedCourseId = res.courseId;
          setSuccess(`Created course: ${res.courseId}`);
        } else {
          throw e;
        }
      }
      setTitle("");
      setCourseId("");
      setLessons([
        { id: "1", title: "Introduction", durationLabel: "05:00", locked: false, videoUri: "" },
        { id: "2", title: "Lesson 2", durationLabel: "10:00", locked: true, videoUri: "" }
      ]);
      navigation.replace(
        "Main" as never,
        {
          screen: "Learn",
          params: {
            screen: "CoursePlayer",
            params: { courseId: publishedCourseId }
          }
        } as never
      );
    } catch (e: any) {
      setError(e?.message || "Failed to create course");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.bottom} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={18} color="#22312d" />
        </Pressable>
        <Text style={styles.title}>Instructor Studio</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.hint}>Create a new course and publish lessons/videos (Udemy-style).</Text>

        <Text style={styles.label}>Course title</Text>
        <TextInput value={title} onChangeText={setTitle} style={styles.input} placeholder="e.g. Water Management Basics" />

        <Text style={styles.label}>Course id (slug)</Text>
        <TextInput value={courseId} onChangeText={setCourseId} style={styles.input} placeholder="water-management-basics" />

        <Text style={styles.label}>Category</Text>
        <TextInput value={category} onChangeText={setCategory} style={styles.input} placeholder="General" />

        <View style={styles.row}>
          <Pressable onPress={() => setIsFree(true)} style={[styles.pill, isFree ? styles.pillActive : null]}>
            <Text style={[styles.pillText, isFree ? styles.pillTextActive : null]}>Free</Text>
          </Pressable>
          <Pressable onPress={() => setIsFree(false)} style={[styles.pill, !isFree ? styles.pillActive : null]}>
            <Text style={[styles.pillText, !isFree ? styles.pillTextActive : null]}>Paid</Text>
          </Pressable>
        </View>

        <View style={styles.lessonHeaderRow}>
          <Text style={styles.label}>Lessons</Text>
          <Pressable onPress={addLesson} style={styles.addLessonBtn} disabled={loading}>
            <Ionicons name="add" size={15} color="#fff" />
            <Text style={styles.addLessonText}>Add lesson</Text>
          </Pressable>
        </View>
        {lessons.map((lesson, idx) => (
          <View key={lesson.id} style={styles.lessonCard}>
            <View style={styles.lessonTitleRow}>
              <Text style={styles.lessonTitle}>Lesson {idx + 1}</Text>
              {lessons.length > 1 ? (
                <Pressable onPress={() => removeLesson(lesson.id)} disabled={loading}>
                  <Ionicons name="trash-outline" size={16} color="#b42318" />
                </Pressable>
              ) : null}
            </View>
            <TextInput
              value={lesson.title}
              onChangeText={(v) => updateLesson(lesson.id, { title: v })}
              style={styles.input}
              placeholder={`Lesson ${idx + 1} title`}
            />
            <TextInput
              value={lesson.durationLabel}
              onChangeText={(v) => updateLesson(lesson.id, { durationLabel: v })}
              style={styles.input}
              placeholder="Duration (e.g. 10:00)"
            />
            {idx > 0 ? (
              <Pressable
                onPress={() => updateLesson(lesson.id, { locked: !lesson.locked })}
                style={[styles.lockPill, lesson.locked ? styles.lockPillActive : null]}
                disabled={loading || isFree}
              >
                <Text style={[styles.lockPillText, lesson.locked ? styles.lockPillTextActive : null]}>
                  {isFree ? "Unlocked (free course)" : lesson.locked ? "Locked lesson" : "Unlocked lesson"}
                </Text>
              </Pressable>
            ) : (
              <Text style={styles.firstLessonHint}>First lesson stays unlocked for preview.</Text>
            )}
            <View style={styles.videoActionRow}>
              <Pressable style={styles.videoActionBtn} onPress={() => pickLessonVideo(lesson.id, "camera")} disabled={loading}>
                <Text style={styles.videoActionText}>Record</Text>
              </Pressable>
              <Pressable style={styles.videoActionBtn} onPress={() => pickLessonVideo(lesson.id, "gallery")} disabled={loading}>
                <Text style={styles.videoActionText}>Upload</Text>
              </Pressable>
            </View>
            {lesson.videoUri ? (
              <Text style={styles.selectedText} numberOfLines={1} ellipsizeMode="middle">
                Selected: {formatSelectedLabel(lesson.videoUri)}
              </Text>
            ) : null}
          </View>
        ))}

        {error ? (
          <View style={styles.msgRow}>
            <Ionicons name="alert-circle-outline" size={18} color="#b42318" />
            <Text style={styles.msgError}>{error}</Text>
          </View>
        ) : null}
        {success ? (
          <View style={styles.msgRow}>
            <Ionicons name="checkmark-circle-outline" size={18} color={GREEN} />
            <Text style={styles.msgOk}>{success}</Text>
          </View>
        ) : null}

        <Pressable style={[styles.btn, loading ? styles.btnDisabled : null]} disabled={loading} onPress={submit}>
          <Text style={styles.btnText}>{loading ? "Publishing…" : "Publish course"}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f2f5f4" },
  bottom: { paddingBottom: 80 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 },
  backBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#fff", borderWidth: 1, borderColor: BORDER, alignItems: "center", justifyContent: "center" },
  title: { fontWeight: "900", color: "#111616", fontSize: 18 },
  card: { margin: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: BORDER, borderRadius: 16, padding: 12 },
  hint: { color: "#4b5a56", fontWeight: "700", lineHeight: 18 },
  label: { marginTop: 10, fontWeight: "900", color: "#22312d" },
  input: { marginTop: 6, borderWidth: 1, borderColor: BORDER, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontWeight: "700", color: "#111616" },
  row: { flexDirection: "row", gap: 8, marginTop: 10 },
  lessonHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  addLessonBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: GREEN, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  addLessonText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  lessonCard: { marginTop: 8, borderWidth: 1, borderColor: "#e4ebe8", borderRadius: 12, padding: 10, backgroundColor: "#f9fbfa" },
  lessonTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 },
  lessonTitle: { fontWeight: "900", color: "#1d2b27" },
  lockPill: { marginTop: 8, borderRadius: 999, borderWidth: 1, borderColor: BORDER, paddingVertical: 7, alignItems: "center", backgroundColor: "#fff" },
  lockPillActive: { backgroundColor: "#111827", borderColor: "#111827" },
  lockPillText: { color: "#425652", fontWeight: "700", fontSize: 12 },
  lockPillTextActive: { color: "#fff" },
  firstLessonHint: { marginTop: 8, color: "#5b6966", fontWeight: "600", fontSize: 12 },
  videoActionRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  videoActionBtn: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: "#dbe6e1", backgroundColor: "#f8faf9", paddingVertical: 10, alignItems: "center" },
  videoActionText: { color: "#1b2422", fontWeight: "700" },
  selectedText: { marginTop: 6, color: "#4d5f5a", fontSize: 12 },
  pill: { flex: 1, borderRadius: 999, borderWidth: 1, borderColor: BORDER, paddingVertical: 10, alignItems: "center" },
  pillActive: { backgroundColor: "#111827", borderColor: "#111827" },
  pillText: { fontWeight: "900", color: "#5b6966" },
  pillTextActive: { color: "#fff" },
  msgRow: { marginTop: 12, flexDirection: "row", gap: 8, alignItems: "center" },
  msgError: { color: "#b42318", fontWeight: "800", flex: 1 },
  msgOk: { color: GREEN, fontWeight: "900", flex: 1 },
  btn: { marginTop: 16, backgroundColor: GREEN, borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: "#fff", fontWeight: "900", fontSize: 14 }
});

