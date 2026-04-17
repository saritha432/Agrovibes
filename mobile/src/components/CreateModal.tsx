import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ResizeMode, Video } from "expo-av";
import * as FileSystem from "expo-file-system";
import { createHomePost, createHomeStory, shouldUseImageUpload, uploadPickedMedia } from "../services/api";

interface CreateModalProps {
  visible: boolean;
  onClose: () => void;
  onVideoPosted?: () => void;
  initialType?: CreateType | null;
}

export type CreateType = "reel" | "post" | "story" | "live";
const createModes: { key: CreateType; label: string }[] = [
  { key: "post", label: "POST" },
  { key: "story", label: "STORY" },
  { key: "reel", label: "REEL" },
  { key: "live", label: "LIVE" }
];

export function CreateModal({ visible, onClose, onVideoPosted, initialType = null }: CreateModalProps) {
  const [createType, setCreateType] = useState<CreateType | null>(null);
  const [createStep, setCreateStep] = useState<"preview" | "compose">("preview");
  const [entryType, setEntryType] = useState<CreateType>("story");
  const [userName, setUserName] = useState("Ramesh Patel");
  const [location, setLocation] = useState("Nashik");
  const [caption, setCaption] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [liveMode, setLiveMode] = useState<"now" | "schedule" | null>(null);
  const [pickedStoryVideoUri, setPickedStoryVideoUri] = useState<string>("");
  const [pickedStoryAsset, setPickedStoryAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [pickedStoryMediaType, setPickedStoryMediaType] = useState<"image" | "video" | null>(null);
  /** Post / reel picks (reel always length 1). */
  const [pickedPostAssets, setPickedPostAssets] = useState<ImagePicker.ImagePickerAsset[]>([]);
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
  const isLive = createType === "live";
  const isReel = createType === "reel";
  const storyHint = useMemo(() => {
    if (!isStory) return "";
    return pickedStoryVideoUri ? "Video selected." : "Choose how you want to add a story video.";
  }, [isStory, pickedStoryVideoUri]);

  React.useEffect(() => {
    if (!visible) return;
    setCreateType(initialType);
    setCreateStep("preview");
    setEntryType(initialType ?? "story");
    setErrorText("");
    setPickedStoryVideoUri("");
    setPickedStoryAsset(null);
    setPickedStoryMediaType(null);
    setPickedPostAssets([]);
    setLiveMode(null);
  }, [visible, initialType]);

  const handleClose = () => {
    if (isSubmitting) return;
    setCreateType(null);
    setErrorText("");
    onClose();
  };

  const mediaTypeForEntry = () => {
    if (entryType === "live") return ImagePicker.MediaTypeOptions.All;
    return ImagePicker.MediaTypeOptions.All;
  };

  const applyPickedMediaToFlow = (assets: ImagePicker.ImagePickerAsset[]) => {
    if (!assets.length) return;
    const first = assets[0];
    const uri = first.uri ?? "";
    if (!uri) return;
    if (entryType === "story") {
      setPickedStoryVideoUri(uri);
      setPickedStoryAsset(first);
      setPickedStoryMediaType(shouldUseImageUpload(uri, first) ? "image" : "video");
      setCreateType("story");
      setCreateStep("preview");
      return;
    }
    if (entryType === "reel") {
      setPickedPostAssets([first]);
      setCreateType("reel");
      setCreateStep("preview");
      return;
    }
    if (entryType === "post") {
      if (assets.length > 1) {
        const allImg = assets.every((a) => shouldUseImageUpload(a.uri, a));
        if (!allImg) {
          setErrorText("Photo carousels can only include pictures. Pick one video for a video post.");
          return;
        }
      }
      setPickedPostAssets(assets);
      setCreateType("post");
      setCreateStep("preview");
    }
  };

  const openEntryCamera = async () => {
    setErrorText("");
    if (entryType === "live") {
      setCreateType("live");
      return;
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setErrorText("Camera permission is required.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: mediaTypeForEntry(),
      quality: 0.9
    });
    if (!result.canceled && result.assets[0]) {
      applyPickedMediaToFlow([result.assets[0]]);
    }
  };

  const openEntryGallery = async () => {
    setErrorText("");
    if (entryType === "live") {
      setCreateType("live");
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setErrorText("Media library permission is required.");
      return;
    }
    const allowMulti = entryType === "post";
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: mediaTypeForEntry(),
      allowsMultipleSelection: allowMulti,
      selectionLimit: allowMulti ? 10 : 1,
      quality: 1
    });
    if (!result.canceled && result.assets.length) {
      setErrorText("");
      applyPickedMediaToFlow(result.assets);
    }
  };

  const submitPostVideo = async () => {
    setSubmitting(true);
    setErrorText("");
    try {
      if (createType === "live") {
        if (!liveMode) {
          setErrorText("Choose an option to continue.");
          setSubmitting(false);
          return;
        }
        Alert.alert(
          "Live selected",
          liveMode === "now"
            ? "Start live selected. Connect livestream backend to continue."
            : "Schedule live selected. Add scheduling flow next."
        );
      } else if (createType === "story") {
        if (!pickedStoryVideoUri) {
          setErrorText("Please record or upload story media.");
          setSubmitting(false);
          return;
        }
        const storyIsImage = shouldUseImageUpload(pickedStoryVideoUri, pickedStoryAsset);
        if (!storyIsImage) await validateVideoSize(pickedStoryVideoUri, 30);
        const { url: storyUrl } = await uploadPickedMedia(pickedStoryVideoUri, pickedStoryAsset ?? undefined);
        await createHomeStory({
          userName: userName.trim() || "Farmer",
          district: location.trim() || "Unknown",
          ...(storyIsImage ? { imageUrl: storyUrl } : { videoUrl: storyUrl })
        });
      } else {
        if (!caption.trim()) {
          setErrorText("Caption is required.");
          setSubmitting(false);
          return;
        }
        const assets = pickedPostAssets;
        if (!assets.length) {
          setErrorText(createType === "reel" ? "Please record or upload a reel video." : "Please add media for your post.");
          setSubmitting(false);
          return;
        }
        if (createType === "reel" && assets.length > 1) {
          setErrorText("A reel is a single video or photo.");
          setSubmitting(false);
          return;
        }
        const images = assets.filter((a) => shouldUseImageUpload(a.uri, a));
        const videos = assets.filter((a) => !shouldUseImageUpload(a.uri, a));
        if (images.length && videos.length) {
          setErrorText("Use either one video or multiple photos — not both.");
          setSubmitting(false);
          return;
        }
        if (videos.length > 1) {
          setErrorText("Only one video per post.");
          setSubmitting(false);
          return;
        }
        if (videos.length === 1) {
          const v = videos[0];
          await validateVideoSize(v.uri, 80);
          const { url: mediaUrl } = await uploadPickedMedia(v.uri, v);
          await createHomePost({
            userName: "Farmer",
            location: "Unknown",
            caption: createType ? `[${createType.toUpperCase()}] ${caption.trim()}` : caption.trim(),
            videoUrl: mediaUrl,
            thumbnailUrl: thumbnailUrl.trim() || undefined
          });
        } else {
          const urls: string[] = [];
          for (const im of images) {
            const { url } = await uploadPickedMedia(im.uri, im);
            urls.push(url);
          }
          if (!urls.length) {
            setErrorText("Could not upload images.");
            setSubmitting(false);
            return;
          }
          await createHomePost({
            userName: "Farmer",
            location: "Unknown",
            caption: createType ? `[${createType.toUpperCase()}] ${caption.trim()}` : caption.trim(),
            imageUrl: urls[0],
            ...(urls.length > 1 ? { imageUrls: urls } : {})
          });
        }
      }
      setCreateType(null);
      setCreateStep("preview");
      setCaption("");
      setVideoUrl("");
      setThumbnailUrl("");
      setPickedStoryMediaType(null);
      setPickedStoryAsset(null);
      setPickedPostAssets([]);
      onVideoPosted?.();
      onClose();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Failed to publish video.");
    } finally {
      setSubmitting(false);
    }
  };

  const previewWidth = Dimensions.get("window").width - 32;
  const selectedUri = createType === "story" ? pickedStoryVideoUri : pickedPostAssets[0]?.uri ?? "";
  const postFirst = pickedPostAssets[0];
  const isSelectedVideo =
    createType === "story"
      ? !shouldUseImageUpload(pickedStoryVideoUri, pickedStoryAsset ?? undefined)
      : pickedPostAssets.length === 1 && !!postFirst && !shouldUseImageUpload(postFirst.uri, postFirst);
  const canProceedFromPreview =
    (createType === "story" ? !!selectedUri : pickedPostAssets.length > 0) || createType === "live";
  const previewTitle = createType === "reel" ? "Reel" : createType === "post" ? "New Post" : createType === "story" ? "Story" : "Create";

  return (
    <Modal visible={visible} transparent={!createType} animationType={createType ? "fade" : "slide"} onRequestClose={handleClose}>
      {!createType ? (
        <View style={styles.igFullScreen}>
          <View style={styles.igTopControls}>
            <Pressable onPress={handleClose} hitSlop={10}>
              <Ionicons name="close" size={28} color="#fff" />
            </Pressable>
            <View style={styles.igTopRightControls}>
              <Ionicons name="flash-off-outline" size={24} color="#fff" />
              <Ionicons name="settings-outline" size={24} color="#fff" />
            </View>
          </View>

          <View style={styles.igLeftTools}>
            <Text style={styles.igLeftToolText}>Aa</Text>
            <Ionicons name="infinite-outline" size={26} color="#fff" />
            <Ionicons name="sparkles-outline" size={24} color="#fff" />
          </View>

          <View style={styles.igBottomControls}>
            <Pressable style={styles.igThumbPlaceholder} onPress={openEntryGallery}>
              <Ionicons name="image-outline" size={20} color="#fff" />
            </Pressable>
            <Pressable style={styles.igCaptureBtn} onPress={openEntryCamera}>
              <View style={styles.igCaptureInner} />
            </Pressable>
            <Pressable>
              <Ionicons name="camera-reverse-outline" size={28} color="#fff" />
            </Pressable>
          </View>

          <View style={styles.igModeRow}>
            {createModes.map((m) => (
              <Pressable key={m.key} onPress={() => setEntryType(m.key)}>
                <Text style={[styles.igModeText, entryType === m.key ? styles.igModeTextActive : null]}>{m.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
      createType !== "live" ? (
      <View style={styles.igFullScreen}>
        {createStep === "preview" ? (
          <>
            <View style={styles.igPreviewTopBar}>
              <Pressable onPress={() => setCreateType(null)} hitSlop={10}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </Pressable>
              <Text style={styles.igPreviewTitle}>{previewTitle}</Text>
              <Pressable
                onPress={() => {
                  if (createType === "story") {
                    submitPostVideo();
                    return;
                  }
                  setCreateStep("compose");
                }}
                disabled={!canProceedFromPreview || isSubmitting}
              >
                <Text style={[styles.igPreviewAction, !canProceedFromPreview ? styles.igPreviewActionDisabled : null]}>
                  {createType === "story" ? "Share" : "Next"}
                </Text>
              </Pressable>
            </View>
            <View style={styles.igMediaPreviewWrap}>
              {createType === "story" ? (
                selectedUri ? (
                  isSelectedVideo ? (
                    <Video style={styles.igMediaPreview} source={{ uri: selectedUri }} shouldPlay isLooping resizeMode={ResizeMode.CONTAIN} />
                  ) : (
                    <Image style={styles.igMediaPreview} source={{ uri: selectedUri }} resizeMode="contain" />
                  )
                ) : (
                  <View style={styles.igEmptyPreview}>
                    <Ionicons name="image-outline" size={42} color="rgba(255,255,255,0.7)" />
                    <Text style={styles.igEmptyPreviewText}>Select media from camera or gallery</Text>
                  </View>
                )
              ) : pickedPostAssets.length > 1 ? (
                <FlatList
                  data={pickedPostAssets}
                  keyExtractor={(a, i) => `${i}-${a.uri}`}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  style={[styles.igPreviewCarousel, { width: previewWidth }]}
                  snapToInterval={previewWidth}
                  decelerationRate="fast"
                  renderItem={({ item }) => (
                    <View style={[styles.igPreviewCarouselPage, { width: previewWidth }]}>
                      <Image style={styles.igMediaPreview} source={{ uri: item.uri }} resizeMode="contain" />
                    </View>
                  )}
                />
              ) : pickedPostAssets.length === 1 ? (
                isSelectedVideo ? (
                  <Video style={styles.igMediaPreview} source={{ uri: selectedUri }} shouldPlay isLooping resizeMode={ResizeMode.CONTAIN} />
                ) : (
                  <Image style={styles.igMediaPreview} source={{ uri: selectedUri }} resizeMode="contain" />
                )
              ) : (
                <View style={styles.igEmptyPreview}>
                  <Ionicons name="image-outline" size={42} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.igEmptyPreviewText}>Select media from camera or gallery</Text>
                </View>
              )}
            </View>
            {errorText ? <Text style={styles.igErrorText}>{errorText}</Text> : null}
          </>
        ) : (
          <>
            <View style={styles.igComposeTopBar}>
              <Pressable onPress={() => setCreateStep("preview")} hitSlop={10}>
                <Ionicons name="arrow-back" size={24} color="#1b2422" />
              </Pressable>
              <Text style={styles.igComposeTitle}>New {createType === "reel" ? "Reel" : "Post"}</Text>
              <Pressable onPress={submitPostVideo} disabled={isSubmitting}>
                {isSubmitting ? <ActivityIndicator size="small" color="#0a9f46" /> : <Text style={styles.igComposeShare}>Share</Text>}
              </Pressable>
            </View>
            <View style={styles.igComposeMediaRow}>
              {pickedPostAssets.length > 1 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.igComposeThumbStripInner}>
                  {pickedPostAssets.map((a, i) => (
                    <Image key={`${i}-${a.uri}`} style={styles.igComposeThumbSmall} source={{ uri: a.uri }} resizeMode="cover" />
                  ))}
                </ScrollView>
              ) : selectedUri ? (
                isSelectedVideo ? (
                  <Video style={styles.igComposeThumb} source={{ uri: selectedUri }} shouldPlay={false} resizeMode={ResizeMode.COVER} />
                ) : (
                  <Image style={styles.igComposeThumb} source={{ uri: selectedUri }} resizeMode="cover" />
                )
              ) : null}
              <TextInput
                value={caption}
                onChangeText={setCaption}
                style={styles.igComposeCaptionInput}
                placeholder={createType === "reel" ? "Write a reel caption..." : "Write a caption..."}
                multiline
                placeholderTextColor="#7f8b88"
              />
            </View>
            {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
          </>
        )}
      </View>
      ) : (
      <Pressable style={styles.modalBackdrop} onPress={handleClose}>
        <Pressable
          style={styles.modalCard}
          onStartShouldSetResponder={() => true}
          // Prevent backdrop-close when user taps inside the sheet (especially TextInput on web).
          onPress={(e) => {
            e.stopPropagation?.();
          }}
        >
          <>
              <Text style={styles.modalTitle}>Create Live</Text>
              <Text style={styles.helperText}>Choose how you want to go live.</Text>
              <View style={styles.storyActionRow}>
                <Pressable
                  style={[styles.storyActionBtn, liveMode === "now" ? styles.storyActionBtnActive : null]}
                  onPress={() => {
                    setErrorText("");
                    setLiveMode("now");
                  }}
                  disabled={isSubmitting}
                >
                  <Text style={styles.storyActionText}>Start live now</Text>
                </Pressable>
                <Pressable
                  style={[styles.storyActionBtn, liveMode === "schedule" ? styles.storyActionBtnActive : null]}
                  onPress={() => {
                    setErrorText("");
                    setLiveMode("schedule");
                  }}
                  disabled={isSubmitting}
                >
                  <Text style={styles.storyActionText}>Schedule live</Text>
                </Pressable>
              </View>
              {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
              <View style={styles.actionsRow}>
                <Pressable style={styles.secondaryBtn} onPress={() => setCreateType(null)} disabled={isSubmitting}>
                  <Text style={styles.secondaryBtnText}>Back</Text>
                </Pressable>
                <Pressable style={styles.primaryBtn} onPress={submitPostVideo} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Continue</Text>
                  )}
                </Pressable>
              </View>
          </>
        </Pressable>
      </Pressable>
      )
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  igFullScreen: { flex: 1, backgroundColor: "#111", justifyContent: "space-between", paddingTop: 48, paddingBottom: 24, paddingHorizontal: 16 },
  igTopControls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  igTopRightControls: { flexDirection: "row", alignItems: "center", gap: 16 },
  igLeftTools: { position: "absolute", left: 16, top: 140, gap: 24, alignItems: "center" },
  igLeftToolText: { color: "#fff", fontSize: 34, fontWeight: "500" },
  igBottomControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14
  },
  igThumbPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    alignItems: "center",
    justifyContent: "center"
  },
  igCaptureBtn: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center"
  },
  igCaptureInner: { width: 66, height: 66, borderRadius: 33, backgroundColor: "#fff" },
  igModeRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 18, marginBottom: 4 },
  igModeText: { color: "rgba(255,255,255,0.62)", fontWeight: "700", letterSpacing: 0.8 },
  igModeTextActive: { color: "#fff" },
  igPreviewTopBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12
  },
  igPreviewTitle: { color: "#fff", fontWeight: "700", fontSize: 16 },
  igPreviewAction: { color: "#4da6ff", fontWeight: "700", fontSize: 16 },
  igPreviewActionDisabled: { color: "rgba(77,166,255,0.5)" },
  igMediaPreviewWrap: { flex: 1, borderRadius: 14, overflow: "hidden", backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  igPreviewCarousel: { flex: 1, alignSelf: "center" },
  igPreviewCarouselPage: { justifyContent: "center", alignItems: "center" },
  igMediaPreview: { width: "100%", height: "100%" },
  igEmptyPreview: { alignItems: "center", gap: 8 },
  igEmptyPreviewText: { color: "rgba(255,255,255,0.7)" },
  igErrorText: { color: "#fecaca", textAlign: "center", marginTop: 10, fontWeight: "600" },
  igComposeTopBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: 8, backgroundColor: "#fff" },
  igComposeTitle: { color: "#1b2422", fontWeight: "700", fontSize: 16 },
  igComposeShare: { color: "#0a9f46", fontWeight: "700", fontSize: 16 },
  igComposeMediaRow: { backgroundColor: "#fff", flexDirection: "row", padding: 12, gap: 10, borderTopWidth: 1, borderTopColor: "#edf1ef" },
  igComposeThumb: { width: 76, height: 76, borderRadius: 8, backgroundColor: "#e7ece9" },
  igComposeThumbStripInner: { flexDirection: "row", gap: 6, paddingRight: 6, alignItems: "center" },
  igComposeThumbSmall: { width: 56, height: 56, borderRadius: 8, backgroundColor: "#e7ece9" },
  igComposeCaptionInput: { flex: 1, minHeight: 76, textAlignVertical: "top", color: "#1b2422" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0, 0, 0, 0.30)", padding: 16 },
  modalCard: { backgroundColor: "#fff", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: "#e5ece8", marginBottom: 72 },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: "#d8dfdc", alignSelf: "center", marginBottom: 10 },
  modalTitle: { textAlign: "center", color: "#1b2422", fontWeight: "700", fontSize: 18, marginBottom: 10 },
  modalItemTitle: { color: "#1b2422", fontWeight: "700", fontSize: 14 },
  modalItemSub: { color: "#697774", marginTop: 2, fontSize: 12 },
  helperText: { color: "#6b7976", textAlign: "center", marginBottom: 2 },
  storyActionRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  storyActionBtn: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: "#dbe6e1", backgroundColor: "#f8faf9", paddingVertical: 12, alignItems: "center" },
  storyActionBtnActive: { borderColor: "#0a9f46", backgroundColor: "#e8f7ef" },
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
  primaryBtn: { marginTop: 10, backgroundColor: "#0a9f46", borderRadius: 10, alignItems: "center", justifyContent: "center", paddingVertical: 10 },
  primaryBtnText: { color: "#fff", fontWeight: "700" }
});
