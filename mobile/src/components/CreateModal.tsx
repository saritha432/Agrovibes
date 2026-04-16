import React, { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { createHomePost, createHomeStory } from "../services/api";

interface CreateModalProps {
  visible: boolean;
  onClose: () => void;
  onVideoPosted?: () => void;
}

type CreateType = "reel" | "story" | "upload" | "camera";

const createItems: { type: CreateType; title: string; subtitle: string; icon: string }[] = [
  { type: "reel", title: "Post Reel", subtitle: "Create a short reel", icon: "🎬" },
  { type: "story", title: "Story", subtitle: "Share a quick update", icon: "🟣" },
  { type: "upload", title: "Upload Video", subtitle: "Upload from gallery", icon: "📤" },
  { type: "camera", title: "Camera", subtitle: "Record now", icon: "📷" }
];

export function CreateModal({ visible, onClose, onVideoPosted }: CreateModalProps) {
  const [createType, setCreateType] = useState<CreateType | null>(null);
  const [userName, setUserName] = useState("Ramesh Patel");
  const [location, setLocation] = useState("Nashik");
  const [caption, setCaption] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [errorText, setErrorText] = useState("");
  const [isSubmitting, setSubmitting] = useState(false);

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
        if (!userName.trim() || !location.trim()) {
          setErrorText("Name and district are required for story.");
          setSubmitting(false);
          return;
        }
        await createHomeStory({
          userName: userName.trim(),
          district: location.trim()
        });
      } else {
        if (!caption.trim() || !videoUrl.trim()) {
          setErrorText("Caption and video URL are required.");
          setSubmitting(false);
          return;
        }
        await createHomePost({
          userName: userName.trim() || "Farmer",
          location: location.trim() || "Unknown",
          caption: createType ? `[${createType.toUpperCase()}] ${caption.trim()}` : caption.trim(),
          videoUrl: videoUrl.trim(),
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
      setErrorText("Failed to publish video. Please check backend/API URL.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.modalBackdrop} onPress={handleClose}>
        <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
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
                {createType === "camera"
                  ? "Paste video URL captured from your camera workflow."
                  : createType === "upload"
                    ? "Paste uploaded gallery video URL."
                    : "Add details and publish to Home feed."}
              </Text>
              <TextInput value={userName} onChangeText={setUserName} style={styles.input} placeholder="Your name" />
              <TextInput value={location} onChangeText={setLocation} style={styles.input} placeholder="Location" />
              {createType !== "story" ? (
                <>
                  <TextInput value={caption} onChangeText={setCaption} style={styles.input} placeholder="Caption" />
                  <TextInput value={videoUrl} onChangeText={setVideoUrl} style={styles.input} placeholder="Video URL (.mp4)" autoCapitalize="none" />
                  <TextInput value={thumbnailUrl} onChangeText={setThumbnailUrl} style={styles.input} placeholder="Thumbnail URL (optional)" autoCapitalize="none" />
                </>
              ) : null}
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
        </View>
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
