import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../auth/AuthContext";
import type { Course } from "../services/api";
import { createCourse } from "../services/api";
import { updateCourse } from "../services/api";
import { uploadCourseVideo } from "../services/api";

const GREEN = "#0a9f46";
const BORDER = "#dce3e1";

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function formatDurationLabel(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0));
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function isProbablyMp4(url: string) {
  const u = String(url || "").trim().toLowerCase();
  return (u.startsWith("http://") || u.startsWith("https://")) && (u.includes(".mp4") || u.includes("/uploads/learn-videos/"));
}

export function InstructorStudioScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { user, token } = useAuth();

  const [title, setTitle] = React.useState("");
  const [courseId, setCourseId] = React.useState("");
  const [category, setCategory] = React.useState("General");
  const [isFree, setIsFree] = React.useState(true);
  const [video1, setVideo1] = React.useState("");
  const [video2, setVideo2] = React.useState("");
  const [video1DurationLabel, setVideo1DurationLabel] = React.useState("05:00");
  const [video2DurationLabel, setVideo2DurationLabel] = React.useState("10:00");
  const [uploadingVideo1, setUploadingVideo1] = React.useState(false);
  const [uploadingVideo2, setUploadingVideo2] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!courseId && title) setCourseId(slugify(title));
  }, [title]);

  const pickAndUploadVideo = async (lessonIndex: 1 | 2) => {
    setError(null);
    if (!token) {
      setError("Please login first.");
      return;
    }
    const setUploading = lessonIndex === 1 ? setUploadingVideo1 : setUploadingVideo2;
    const setUrl = lessonIndex === 1 ? setVideo1 : setVideo2;
    setUploading(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError("Media library permission is required to upload videos.");
        return;
      }
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsMultipleSelection: false,
        quality: 1
      });
      if (picked.canceled || !picked.assets?.[0]) return;
      const asset = picked.assets[0];
      let webFile: Blob | undefined = undefined;
      if (Platform.OS === "web") {
        const directFile = (asset as any).file as Blob | undefined;
        if (directFile) {
          webFile = directFile;
        } else if (asset.uri) {
          // Expo web may not expose `asset.file`; fetch the blob from the local object URL.
          const blobRes = await fetch(asset.uri);
          webFile = await blobRes.blob();
        }
      }
      const durationSeconds = Number((asset as any).duration || 0) / 1000;
      const resolvedDurationLabel = durationSeconds > 0 ? formatDurationLabel(durationSeconds) : lessonIndex === 1 ? "05:00" : "10:00";
      const uploaded = await uploadCourseVideo(token, {
        uri: asset.uri,
        name: asset.fileName || `lesson-${lessonIndex}-${Date.now()}.mp4`,
        type: asset.mimeType || "video/mp4",
        file: webFile
      });
      setUrl(uploaded.videoUrl);
      if (lessonIndex === 1) setVideo1DurationLabel(resolvedDurationLabel);
      if (lessonIndex === 2) setVideo2DurationLabel(resolvedDurationLabel);
      setSuccess(`Lesson ${lessonIndex} video uploaded.`);
    } catch (e: any) {
      setError(e?.message || `Failed to upload lesson ${lessonIndex} video`);
    } finally {
      setUploading(false);
    }
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
    if (!isProbablyMp4(video1) || !isProbablyMp4(video2)) {
      setError("Upload both lesson videos before publishing.");
      return;
    }
    setLoading(true);
    try {
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
        syllabus: [
          { id: "1", title: "Introduction", durationLabel: video1DurationLabel, locked: false },
          { id: "2", title: "Lesson 2", durationLabel: video2DurationLabel, locked: !isFree }
        ],
        lessons: [
          { id: "1", title: "Introduction", durationLabel: video1DurationLabel, locked: false, videoUrl: video1 },
          { id: "2", title: "Lesson 2", durationLabel: video2DurationLabel, locked: !isFree, videoUrl: video2 }
        ],
        reviewsPreview: []
      };

      // Create first to avoid expected 404 noise from "update-then-create" flow.
      try {
        const res = await createCourse(token, payload);
        setSuccess(`Created course: ${res.courseId}`);
      } catch (createErr: any) {
        const msg = String(createErr?.message || "");
        if (msg.toLowerCase().includes("already exists") || msg.includes("409")) {
          await updateCourse(token, courseId, payload);
          setSuccess(`Updated course: ${courseId}`);
        } else {
          throw createErr;
        }
      }
      setTitle("");
      setCourseId("");
      setVideo1("");
      setVideo2("");
      setVideo1DurationLabel("05:00");
      setVideo2DurationLabel("10:00");
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

        <Text style={styles.label}>Lesson 1 video</Text>
        <Pressable
          onPress={() => pickAndUploadVideo(1)}
          disabled={uploadingVideo1 || loading}
          style={[styles.uploadBtn, uploadingVideo1 ? styles.btnDisabled : null]}
        >
          <Ionicons name="cloud-upload-outline" size={16} color="#22312d" />
          <Text style={styles.uploadBtnText}>{uploadingVideo1 ? "Uploading..." : "Pick and upload from device"}</Text>
        </Pressable>
        <Text style={styles.uploadMeta}>{video1 ? "Uploaded" : "Not uploaded"}</Text>

        <Text style={styles.label}>Lesson 2 video</Text>
        <Pressable
          onPress={() => pickAndUploadVideo(2)}
          disabled={uploadingVideo2 || loading}
          style={[styles.uploadBtn, uploadingVideo2 ? styles.btnDisabled : null]}
        >
          <Ionicons name="cloud-upload-outline" size={16} color="#22312d" />
          <Text style={styles.uploadBtnText}>{uploadingVideo2 ? "Uploading..." : "Pick and upload from device"}</Text>
        </Pressable>
        <Text style={styles.uploadMeta}>{video2 ? "Uploaded" : "Not uploaded"}</Text>

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
  uploadBtn: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  uploadBtnText: { fontWeight: "800", color: "#22312d" },
  uploadMeta: { marginTop: 6, color: "#4b5a56", fontWeight: "700" },
  row: { flexDirection: "row", gap: 8, marginTop: 10 },
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

