import React, { useMemo, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { createHomePost, createHomeStory, uploadVideoFile } from "../services/api";

interface CreateModalProps {
  visible: boolean;
  onClose: () => void;
  onVideoPosted?: () => void;
  initialType?: CreateType | null;
}

export type CreateType = "reel" | "story" | "upload" | "camera";

const createItems: { type: CreateType; title: string; subtitle: string; icon: string }[] = [
  { type: "reel", title: "Post Reel", subtitle: "Create a short reel", icon: "🎬" },
  { type: "story", title: "Story", subtitle: "Share a quick update", icon: "🟣" },
  { type: "upload", title: "Upload Video", subtitle: "Upload from gallery", icon: "📤" },
  { type: "camera", title: "Camera", subtitle: "Record now", icon: "📷" }
];

function formatSelectedLabel(uri: string) {
  if (!uri) return "";
  const clean = uri.split("?")[0];
  const last = clean.split("/").pop() || clean;
  // If it looks like a massive data/blob string, shorten it.
  if (last.length > 40) return `${last.slice(0, 18)}…${last.slice(-12)}`;
  return last;
}

export function CreateModal({ visible, onClose, onVideoPosted, initialType = null }: CreateModalProps) {
  const [createType, setCreateType] = useState<CreateType | null>(null);
  const [userName, setUserName] = useState("Ramesh Patel");
  const [location, setLocation] = useState("Nashik");
  const [caption, setCaption] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [pickedStoryVideoUri, setPickedStoryVideoUri] = useState<string>("");
  const [pickedPostVideoUri, setPickedPostVideoUri] = useState<string>("");
  const [errorText, setErrorText] = useState("");
  const [isSubmitting, setSubmitting] = useState(false);

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

  const isStory = createType === "story";
  const storyHint = useMemo(() => {
    if (!isStory) return "";
    return pickedStoryVideoUri ? "Video selected." : "Choose how you want to add a story video.";
  }, [isStory, pickedStoryVideoUri]);

  React.useEffect(() => {
    if (!visible) return;
    setCreateType(initialType);
    setErrorText("");
    setPickedStoryVideoUri("");
    setPickedPostVideoUri("");
  }, [visible, initialType]);

  const handleClose = () => {
    if (isSubmitting) return;
    setCreateType(null);
    setErrorText("");
    onClose();
  };

  const submitPostVideo = async () => {
    setSubmitting(true);
    setErrorText("");
    try {
      if (createType === "story") {
        if (!pickedStoryVideoUri) {
          setErrorText("Please record or upload a story video.");
          setSubmitting(false);
          return;
        }
        await validateVideoSize(pickedStoryVideoUri, 30);
        const uploaded = await uploadVideoFile(pickedStoryVideoUri);
        await createHomeStory({
          userName: userName.trim() || "Farmer",
          district: location.trim() || "Unknown",
          videoUrl: uploaded.url
        });
      } else {
        if (!caption.trim()) {
          setErrorText("Caption is required.");
          setSubmitting(false);
          return;
        }
        if (!pickedPostVideoUri) {
          setErrorText("Please record or upload a reel video.");
          setSubmitting(false);
          return;
        }
        await validateVideoSize(pickedPostVideoUri, 80);
        const finalVideoUrl = (await uploadVideoFile(pickedPostVideoUri)).url;
        await createHomePost({
          userName: "Farmer",
          location: "Unknown",
          caption: createType ? `[${createType.toUpperCase()}] ${caption.trim()}` : caption.trim(),
          videoUrl: finalVideoUrl,
          thumbnailUrl: thumbnailUrl.trim() || undefined
        });
      }
      setCreateType(null);
      setCaption("");
      setVideoUrl("");
      setThumbnailUrl("");
      onVideoPosted?.();
      onClose();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Failed to publish video.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.modalBackdrop} onPress={handleClose}>
        <Pressable
          style={styles.modalCard}
          onStartShouldSetResponder={() => true}
          // Prevent backdrop-close when user taps inside the sheet (especially TextInput on web).
          onPress={(e) => {
            e.stopPropagation?.();
          }}
        >
          {!createType ? (
            <>
              <View style={styles.sheetHandle} />
              <Text style={styles.modalTitle}>Create new</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.createRow}>
                {createItems.map((item) => (
                  <Pressable
                    key={item.title}
                    style={styles.createPill}
                    onPress={() => setCreateType(item.type)}
                  >
                    <View style={styles.modalIcon}>
                      <Text style={styles.modalIconText}>{item.icon}</Text>
                    </View>
                    <Text style={styles.modalItemTitle}>{item.title}</Text>
                    <Text style={styles.modalItemSub}>{item.subtitle}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : (
            <>
              <Text style={styles.modalTitle}>
                {createType === "reel" ? "Post Reel" : createType === "story" ? "Create Story" : createType === "upload" ? "Upload Video" : "Record from Camera"}
              </Text>
              <Text style={styles.helperText}>
                {createType === "story"
                  ? storyHint
                  : createType === "camera"
                    ? "Paste video URL captured from your camera workflow."
                    : createType === "upload"
                      ? "Paste uploaded gallery video URL."
                      : "Add details and publish to Home feed."}
              </Text>
              {createType === "story" ? (
                <>
                  <View style={styles.storyActionRow}>
                    <Pressable
                      style={styles.storyActionBtn}
                      onPress={async () => {
                        setErrorText("");
                        const perm = await ImagePicker.requestCameraPermissionsAsync();
                        if (!perm.granted) {
                          setErrorText("Camera permission is required.");
                          return;
                        }
                        const result = await ImagePicker.launchCameraAsync({
                          mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                          quality: 0.9
                        });
                        if (!result.canceled) {
                          setPickedStoryVideoUri(result.assets[0]?.uri ?? "");
                        }
                      }}
                      disabled={isSubmitting}
                    >
                      <Text style={styles.storyActionText}>Tap to record</Text>
                    </Pressable>
                    <Pressable
                      style={styles.storyActionBtn}
                      onPress={async () => {
                        setErrorText("");
                        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                        if (!perm.granted) {
                          setErrorText("Media library permission is required.");
                          return;
                        }
                        const result = await ImagePicker.launchImageLibraryAsync({
                          mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                          quality: 1
                        });
                        if (!result.canceled) {
                          setPickedStoryVideoUri(result.assets[0]?.uri ?? "");
                        }
                      }}
                      disabled={isSubmitting}
                    >
                      <Text style={styles.storyActionText}>Upload video</Text>
                    </Pressable>
                  </View>
                  {pickedStoryVideoUri ? (
                    <Text style={styles.selectedText} numberOfLines={1} ellipsizeMode="middle">
                      Selected: {formatSelectedLabel(pickedStoryVideoUri)}
                    </Text>
                  ) : null}
                </>
              ) : (
                <>
                  <TextInput value={caption} onChangeText={setCaption} style={styles.input} placeholder="Caption" />
                  <View style={styles.storyActionRow}>
                    <Pressable
                      style={styles.storyActionBtn}
                      onPress={async () => {
                        setErrorText("");
                        const perm = await ImagePicker.requestCameraPermissionsAsync();
                        if (!perm.granted) {
                          setErrorText("Camera permission is required.");
                          return;
                        }
                        const result = await ImagePicker.launchCameraAsync({
                          mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                          quality: 0.9
                        });
                        if (!result.canceled) {
                          setPickedPostVideoUri(result.assets[0]?.uri ?? "");
                        }
                      }}
                      disabled={isSubmitting}
                    >
                      <Text style={styles.storyActionText}>Tap to record</Text>
                    </Pressable>
                    <Pressable
                      style={styles.storyActionBtn}
                      onPress={async () => {
                        setErrorText("");
                        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                        if (!perm.granted) {
                          setErrorText("Media library permission is required.");
                          return;
                        }
                        const result = await ImagePicker.launchImageLibraryAsync({
                          mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                          quality: 1
                        });
                        if (!result.canceled) {
                          setPickedPostVideoUri(result.assets[0]?.uri ?? "");
                        }
                      }}
                      disabled={isSubmitting}
                    >
                      <Text style={styles.storyActionText}>Upload video</Text>
                    </Pressable>
                  </View>
                  {pickedPostVideoUri ? (
                    <Text style={styles.selectedText} numberOfLines={1} ellipsizeMode="middle">
                      Selected: {formatSelectedLabel(pickedPostVideoUri)}
                    </Text>
                  ) : null}
                </>
              )}
              {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
              <View style={styles.actionsRow}>
                <Pressable style={styles.secondaryBtn} onPress={() => setCreateType(null)} disabled={isSubmitting}>
                  <Text style={styles.secondaryBtnText}>Back</Text>
                </Pressable>
                <Pressable style={styles.primaryBtn} onPress={submitPostVideo} disabled={isSubmitting}>
                  {isSubmitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryBtnText}>Publish</Text>}
                </Pressable>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0, 0, 0, 0.30)", padding: 16 },
  modalCard: { backgroundColor: "#fff", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: "#e5ece8", marginBottom: 72 },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: "#d8dfdc", alignSelf: "center", marginBottom: 10 },
  modalTitle: { textAlign: "center", color: "#1b2422", fontWeight: "700", fontSize: 18, marginBottom: 10 },
  createRow: { gap: 10, paddingHorizontal: 2, paddingBottom: 4 },
  createPill: { width: 132, backgroundColor: "#f7faf8", borderWidth: 1, borderColor: "#e1e9e5", borderRadius: 14, padding: 10 },
  modalIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#111827", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  modalIconText: { color: "#fff" },
  modalItemTitle: { color: "#1b2422", fontWeight: "700", fontSize: 14 },
  modalItemSub: { color: "#697774", marginTop: 2, fontSize: 12 },
  helperText: { color: "#6b7976", textAlign: "center", marginBottom: 2 },
  storyActionRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  storyActionBtn: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: "#dbe6e1", backgroundColor: "#f8faf9", paddingVertical: 12, alignItems: "center" },
  storyActionText: { color: "#1b2422", fontWeight: "700" },
  selectedText: { marginTop: 8, color: "#4d5f5a", fontSize: 12 },
  input: {
    marginTop: 8,
    backgroundColor: "#f8faf9",
    borderWidth: 1,
    borderColor: "#dbe6e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  errorText: { color: "#b91c1c", marginTop: 8, fontWeight: "600" },
  actionsRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  secondaryBtn: { flex: 1, borderWidth: 1, borderColor: "#c6d5cf", borderRadius: 10, alignItems: "center", paddingVertical: 10 },
  secondaryBtnText: { color: "#4d5f5a", fontWeight: "700" },
  primaryBtn: { flex: 1, backgroundColor: "#0a9f46", borderRadius: 10, alignItems: "center", justifyContent: "center", paddingVertical: 10 },
  primaryBtnText: { color: "#fff", fontWeight: "700" }
});
