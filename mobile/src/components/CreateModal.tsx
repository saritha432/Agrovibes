import { Ionicons } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
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
  TextStyle,
  View
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ResizeMode, Video } from "expo-av";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import { captureRef } from "react-native-view-shot";
import { createHomePost, createHomeStory, shouldUseImageUpload, uploadPickedMedia } from "../services/api";
import { useAuth } from "../auth/AuthContext";

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

type CreativeFilterId = "none" | "warm" | "cool" | "mono" | "vivid" | "sunset" | "noir";
type CreativeFontId = "classic" | "modern" | "strong" | "neon";
type CreativeTextColor = "white" | "black" | "yellow" | "pink" | "blue" | "green";

const FILTER_OPTIONS: { id: CreativeFilterId; label: string }[] = [
  { id: "none", label: "Normal" },
  { id: "warm", label: "Warm" },
  { id: "cool", label: "Cool" },
  { id: "mono", label: "B&W" },
  { id: "vivid", label: "Vivid" },
  { id: "sunset", label: "Sunset" },
  { id: "noir", label: "Noir" }
];

const STICKER_EMOJIS = ["🌾", "🚜", "🌿", "🍅", "☀️", "💧", "🐄", "🌻", "🌽", "🥕"];

const TEXT_COLOR_OPTIONS: { id: CreativeTextColor; hex: string }[] = [
  { id: "white", hex: "#FFFFFF" },
  { id: "black", hex: "#111111" },
  { id: "yellow", hex: "#FFE066" },
  { id: "pink", hex: "#FF66C4" },
  { id: "blue", hex: "#66D2FF" },
  { id: "green", hex: "#86EFAC" }
];

function creativeTextColorHex(id: CreativeTextColor) {
  return TEXT_COLOR_OPTIONS.find((c) => c.id === id)?.hex ?? "#FFFFFF";
}

function filterTint(id: CreativeFilterId): string | null {
  switch (id) {
    case "warm":
      return "rgba(255, 190, 100, 0.25)";
    case "cool":
      return "rgba(100, 180, 255, 0.22)";
    case "mono":
      return "rgba(80, 80, 80, 0.35)";
    case "vivid":
      return "rgba(255, 60, 160, 0.15)";
    case "sunset":
      return "rgba(255, 120, 60, 0.28)";
    case "noir":
      return "rgba(0, 0, 0, 0.38)";
    default:
      return null;
  }
}

function creativeFontStyle(font: CreativeFontId, textColor: CreativeTextColor, withBackground: boolean): TextStyle {
  const color = creativeTextColorHex(textColor);
  const bg = withBackground
    ? textColor === "black"
      ? "rgba(255,255,255,0.9)"
      : "rgba(0,0,0,0.7)"
    : "transparent";

  switch (font) {
    case "modern":
      return {
        fontSize: 22,
        fontWeight: "700",
        color,
        backgroundColor: bg,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        overflow: "hidden",
        alignSelf: "center",
        letterSpacing: 0.4
      };
    case "strong":
      return {
        fontSize: 32,
        fontWeight: "900",
        color,
        textShadowColor: "#000",
        textShadowOffset: { width: 1, height: 2 },
        textShadowRadius: 4,
        backgroundColor: bg,
        paddingVertical: withBackground ? 6 : 0,
        paddingHorizontal: withBackground ? 12 : 0,
        borderRadius: 8,
        overflow: "hidden"
      };
    case "neon":
      return {
        fontSize: 26,
        fontWeight: "800",
        color,
        textShadowColor: textColor === "black" ? "#ffffff" : "#0a5c45",
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 8,
        backgroundColor: bg,
        paddingVertical: withBackground ? 6 : 0,
        paddingHorizontal: withBackground ? 12 : 0,
        borderRadius: 8,
        overflow: "hidden"
      };
    default:
      return {
        fontSize: 28,
        fontWeight: "700",
        color,
        textShadowColor: withBackground ? "transparent" : "rgba(0,0,0,0.85)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 6,
        backgroundColor: bg,
        paddingVertical: withBackground ? 6 : 0,
        paddingHorizontal: withBackground ? 12 : 0,
        borderRadius: 8,
        overflow: "hidden"
      };
  }
}

type MediaCreativeProps = {
  uri: string;
  isVideo: boolean;
  filter: CreativeFilterId;
  overlayText: string;
  font: CreativeFontId;
  textColor: CreativeTextColor;
  textBackground: boolean;
  shouldPlay?: boolean;
};

type RecentGridAsset = {
  id: string;
  uri: string;
  mediaType: "image" | "video";
  filename?: string;
  duration?: number;
};

const MediaWithCreative = React.forwardRef<View, MediaCreativeProps>(function MediaWithCreative(
  { uri, isVideo, filter, overlayText, font, textColor, textBackground, shouldPlay = true },
  ref
) {
  const tint = filterTint(filter);
  return (
    <View ref={ref} collapsable={false} style={{ flex: 1, width: "100%" }}>
      <View style={StyleSheet.absoluteFillObject}>
        {isVideo ? (
          <Video
            style={{ width: "100%", height: "100%" }}
            source={{ uri }}
            shouldPlay={shouldPlay}
            isLooping
            resizeMode={ResizeMode.CONTAIN}
          />
        ) : (
          <Image style={{ width: "100%", height: "100%" }} source={{ uri }} resizeMode="contain" />
        )}
      </View>
      {tint ? <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: tint }]} /> : null}
      {overlayText.trim().length > 0 ? (
        <Text
          style={[
            {
              position: "absolute",
              left: 12,
              right: 12,
              bottom: "16%",
              textAlign: "center"
            },
            creativeFontStyle(font, textColor, textBackground)
          ]}
        >
          {overlayText}
        </Text>
      ) : null}
    </View>
  );
});

export function CreateModal({ visible, onClose, onVideoPosted, initialType = null }: CreateModalProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [createType, setCreateType] = useState<CreateType | null>(null);
  const [entryCameraFacing, setEntryCameraFacing] = useState(ImagePicker.CameraType.back);
  const [entryFlashOn, setEntryFlashOn] = useState(false);
  const [entryZoomLabel, setEntryZoomLabel] = useState<"1x" | "2x">("1x");
  const [entryTimerOn, setEntryTimerOn] = useState(false);
  const [createStep, setCreateStep] = useState<"preview" | "compose">("preview");
  const [entryType, setEntryType] = useState<CreateType>("story");
  const [caption, setCaption] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [liveMode, setLiveMode] = useState<"now" | "schedule" | null>(null);
  const [pickedStoryVideoUri, setPickedStoryVideoUri] = useState<string>("");
  const [pickedStoryAsset, setPickedStoryAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [pickedStoryMediaType, setPickedStoryMediaType] = useState<"image" | "video" | null>(null);
  /** Post / reel picks (reel always length 1). */
  const [pickedPostAssets, setPickedPostAssets] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [creativeFilter, setCreativeFilter] = useState<CreativeFilterId>("none");
  const [creativeText, setCreativeText] = useState("");
  const [creativeFont, setCreativeFont] = useState<CreativeFontId>("classic");
  const [creativeTextColor, setCreativeTextColor] = useState<CreativeTextColor>("white");
  const [creativeTextBackground, setCreativeTextBackground] = useState(false);
  const [showCreativeTextPanel, setShowCreativeTextPanel] = useState(false);
  const [showCreativeFilterPanel, setShowCreativeFilterPanel] = useState(false);
  const [showStickerPanel, setShowStickerPanel] = useState(false);
  const [recentGridAssets, setRecentGridAssets] = useState<RecentGridAsset[]>([]);
  const [entrySelectedIds, setEntrySelectedIds] = useState<string[]>([]);
  const [entryMultiSelect, setEntryMultiSelect] = useState(false);
  /** Snapshot of preview with text+filter for single-image post/reel (captured when leaving preview). */
  const [composedImageUri, setComposedImageUri] = useState<string | null>(null);
  const previewCaptureRef = useRef<View>(null);
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

  React.useEffect(() => {
    if (!visible) {
      setShowCreativeTextPanel(false);
      setShowCreativeFilterPanel(false);
      setShowStickerPanel(false);
      return;
    }
    setCreateType(initialType);
    setCreateStep("preview");
    setEntryType(initialType ?? "story");
    setErrorText("");
    setPickedStoryVideoUri("");
    setPickedStoryAsset(null);
    setPickedStoryMediaType(null);
    setPickedPostAssets([]);
    setLiveMode(null);
    setCreativeFilter("none");
    setCreativeText("");
    setCreativeFont("classic");
    setCreativeTextColor("white");
    setCreativeTextBackground(false);
    setShowCreativeTextPanel(false);
    setShowCreativeFilterPanel(false);
    setShowStickerPanel(false);
    setComposedImageUri(null);
    setEntrySelectedIds([]);
    setEntryMultiSelect(false);
  }, [visible, initialType]);

  React.useEffect(() => {
    if (!visible || createType) return;
    void loadRecentGridAssets();
  }, [createType, visible]);

  React.useEffect(() => {
    if (!visible || createType || entryType !== "post") return;
    if (!recentGridAssets.length) return;
    setEntrySelectedIds((prev) => (prev.length ? prev : [recentGridAssets[0].id]));
  }, [recentGridAssets, visible, createType, entryType]);

  const handleClose = () => {
    if (isSubmitting) return;
    setCreateType(null);
    setErrorText("");
    setShowCreativeTextPanel(false);
    setShowCreativeFilterPanel(false);
    setShowStickerPanel(false);
    onClose();
  };

  const startPostFromEntry = () => {
    const selected = recentGridAssets.filter((a) => entrySelectedIds.includes(a.id));
    if (!selected.length) {
      setErrorText("Please select at least one photo.");
      return;
    }
    const assets: ImagePicker.ImagePickerAsset[] = selected.map((a) => ({
      uri: a.uri,
      fileName: a.filename,
      duration: a.duration ?? undefined,
      type: a.mediaType
    })) as ImagePicker.ImagePickerAsset[];
    applyPickedMediaToFlow(assets);
  };

  const onEntryPressAsset = (asset: RecentGridAsset) => {
    setErrorText("");
    if (asset.mediaType === "video") {
      setErrorText("Post grid supports photos only. Choose Reel for video.");
      return;
    }
    setEntrySelectedIds((prev) => {
      if (!entryMultiSelect) return [asset.id];
      if (prev.includes(asset.id)) return prev.filter((id) => id !== asset.id);
      if (prev.length >= 10) return prev;
      return [...prev, asset.id];
    });
  };

  async function loadRecentGridAssets() {
    if (Platform.OS === "web") {
      setRecentGridAssets([]);
      return;
    }
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        setRecentGridAssets([]);
        return;
      }
      const result = await MediaLibrary.getAssetsAsync({
        first: 24,
        mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
        sortBy: [MediaLibrary.SortBy.creationTime]
      });
      setRecentGridAssets(
        result.assets.map((a) => ({
          id: a.id,
          uri: a.uri,
          mediaType: a.mediaType === MediaLibrary.MediaType.video ? "video" : "image",
          filename: a.filename,
          duration: a.duration
        }))
      );
    } catch {
      setRecentGridAssets([]);
    }
  }

  async function snapshotComposedImage(): Promise<string | null> {
    if (!previewCaptureRef.current) return null;
    try {
      await new Promise((r) => setTimeout(r, Platform.OS === "web" ? 120 : 80));
      const uri = await captureRef(previewCaptureRef, {
        format: "jpg",
        quality: 0.9,
        result: "tmpfile"
      });
      return uri || null;
    } catch {
      return null;
    }
  }

  const proceedToCompose = async () => {
    let composed: string | null = null;
    if (pickedPostAssets.length === 1) {
      const a = pickedPostAssets[0];
      if (shouldUseImageUpload(a.uri, a) && (creativeText.trim() || creativeFilter !== "none")) {
        composed = await snapshotComposedImage();
      }
    }
    setComposedImageUri(composed);
    setCreateStep("compose");
  };

  const renderCreativeToolbar = () => (
    <View style={[styles.igLeftTools, styles.igLeftToolsElevated]} pointerEvents="box-none">
      <Pressable
        onPress={() => {
          setShowCreativeFilterPanel(false);
          setShowStickerPanel(false);
          setShowCreativeTextPanel(true);
        }}
        hitSlop={8}
      >
        <Text style={[styles.igLeftToolText, creativeText.trim().length > 0 ? styles.igLeftToolActive : null]}>Aa</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          setShowCreativeTextPanel(false);
          setShowStickerPanel(false);
          setShowCreativeFilterPanel(true);
        }}
        hitSlop={8}
      >
        <Ionicons name="infinite-outline" size={26} color={creativeFilter !== "none" ? "#7dd3fc" : "#fff"} />
      </Pressable>
      <Pressable
        onPress={() => {
          setShowCreativeTextPanel(false);
          setShowCreativeFilterPanel(false);
          setShowStickerPanel(true);
        }}
        hitSlop={8}
      >
        <Ionicons name="sparkles-outline" size={24} color="#fff" />
      </Pressable>
    </View>
  );

  const mediaTypeForEntry = () => {
    if (entryType === "live") return ImagePicker.MediaTypeOptions.All;
    if (entryType === "reel") return ImagePicker.MediaTypeOptions.Videos;
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
      if (shouldUseImageUpload(uri, first)) {
        setErrorText("Reels support video only. Please select or record a video.");
        return;
      }
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
      quality: 0.9,
      cameraType: entryCameraFacing
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
        let storyUri = pickedStoryVideoUri;
        let storyAssetForUpload: ImagePicker.ImagePickerAsset | undefined = pickedStoryAsset ?? undefined;
        if (storyIsImage && (creativeText.trim() || creativeFilter !== "none")) {
          const snap = await snapshotComposedImage();
          if (snap) {
            storyUri = snap;
            storyAssetForUpload = pickedStoryAsset ? { ...pickedStoryAsset, uri: snap } : ({ uri: snap } as ImagePicker.ImagePickerAsset);
          }
        }
        if (!storyIsImage) await validateVideoSize(storyUri, 30);
        const { url: storyUrl } = await uploadPickedMedia(storyUri, storyAssetForUpload);
        await createHomeStory({
          userName: user?.fullName?.trim() || "Farmer",
          district: user?.locationLabel?.trim() || "Unknown",
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
          setErrorText("A reel must be a single video.");
          setSubmitting(false);
          return;
        }
        const images = assets.filter((a) => shouldUseImageUpload(a.uri, a));
        const videos = assets.filter((a) => !shouldUseImageUpload(a.uri, a));
        if (createType === "reel" && (videos.length !== 1 || images.length > 0)) {
          setErrorText("Please upload one video reel.");
          setSubmitting(false);
          return;
        }
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
            userName: user?.fullName?.trim() || "Farmer",
            location: user?.locationLabel?.trim() || "Unknown",
            caption: createType ? `[${createType.toUpperCase()}] ${caption.trim()}` : caption.trim(),
            videoUrl: mediaUrl,
            thumbnailUrl: thumbnailUrl.trim() || undefined
          });
        } else {
          const urls: string[] = [];
          for (let i = 0; i < images.length; i++) {
            const im = images[i];
            const uri = i === 0 && composedImageUri ? composedImageUri : im.uri;
            const meta = i === 0 && composedImageUri ? { ...im, uri: composedImageUri } : im;
            const { url } = await uploadPickedMedia(uri, meta);
            urls.push(url);
          }
          if (!urls.length) {
            setErrorText("Could not upload images.");
            setSubmitting(false);
            return;
          }
          await createHomePost({
            userName: user?.fullName?.trim() || "Farmer",
            location: user?.locationLabel?.trim() || "Unknown",
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
      setComposedImageUri(null);
      onVideoPosted?.();
      onClose();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Failed to publish video.");
    } finally {
      setSubmitting(false);
    }
  };

  const previewWidth = Dimensions.get("window").width - 32;
  const selectedEntryAsset = recentGridAssets.find((a) => a.id === entrySelectedIds[0]) ?? null;
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
    <>
    <Modal
      visible={visible}
      transparent={!createType || createType === "live"}
      animationType={createType && createType !== "live" ? "fade" : "slide"}
      onRequestClose={handleClose}
    >
      {!createType ? (
        entryType === "post" ? (
          <View style={[styles.igPostEntryRoot, { paddingTop: insets.top + 4, paddingBottom: Math.max(insets.bottom, 10) }]}>
            <View style={styles.igPostEntryTop}>
              <Pressable style={styles.igPostEntryTopBtn} onPress={handleClose}>
                <Ionicons name="close" size={24} color="#fff" />
              </Pressable>
              <Text style={styles.igPostEntryTitle}>New post</Text>
              <Pressable onPress={startPostFromEntry} disabled={!entrySelectedIds.length}>
                <Text style={[styles.igPostEntryNext, !entrySelectedIds.length ? styles.igPostEntryNextDisabled : null]}>Next</Text>
              </Pressable>
            </View>

            <View style={styles.igPostEntryPreview}>
              {selectedEntryAsset ? (
                <Image
                  source={{ uri: selectedEntryAsset.uri }}
                  style={styles.igPostEntryPreviewImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.igPostEntryPreviewFallback}>
                  <Ionicons name="images-outline" size={34} color="#fff" />
                </View>
              )}
              <View style={styles.igPostGridOverlay} pointerEvents="none">
                <View style={styles.igPostGridLineH} />
                <View style={[styles.igPostGridLineH, { top: "66.666%" }]} />
                <View style={styles.igPostGridLineV} />
                <View style={[styles.igPostGridLineV, { left: "66.666%" }]} />
              </View>
            </View>

            <View style={styles.igPostEntryRecentsRow}>
              <Text style={styles.igPostEntryRecentsText}>Recents</Text>
              <Pressable
                style={[styles.igPostEntrySelectBtn, entryMultiSelect ? styles.igPostEntrySelectBtnOn : null]}
                onPress={() => setEntryMultiSelect((v) => !v)}
              >
                <Ionicons name="copy-outline" size={14} color="#fff" />
                <Text style={styles.igPostEntrySelectText}>Select</Text>
              </Pressable>
            </View>

            <FlatList
              data={recentGridAssets}
              keyExtractor={(item) => item.id}
              numColumns={4}
              contentContainerStyle={styles.igPostEntryGrid}
              renderItem={({ item, index }) => (
                <Pressable
                  style={styles.igPostEntryCell}
                  onPress={() => {
                    if (index === 0) {
                      openEntryCamera();
                      return;
                    }
                    onEntryPressAsset(item);
                  }}
                >
                  <Image source={{ uri: item.uri }} style={styles.igPostEntryCellImage} resizeMode="cover" />
                  {index === 0 ? (
                    <View style={styles.igPostEntryCameraBadge}>
                      <Ionicons name="camera" size={16} color="#fff" />
                    </View>
                  ) : null}
                  {entrySelectedIds.includes(item.id) ? (
                    <View style={styles.igPostEntrySelectedBadge}>
                      <Text style={styles.igPostEntrySelectedText}>{entrySelectedIds.indexOf(item.id) + 1}</Text>
                    </View>
                  ) : null}
                </Pressable>
              )}
            />

            <View style={styles.igPostEntryModes}>
              {createModes.map((m) => (
                <Pressable key={m.key} onPress={() => setEntryType(m.key)} style={styles.igPostEntryModeItem}>
                  <Text style={[styles.igPostEntryModeText, entryType === m.key ? styles.igPostEntryModeTextOn : null]}>
                    {m.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
        <View style={[styles.igCameraEntryRoot, { paddingTop: insets.top + 4, paddingBottom: Math.max(insets.bottom, 10) }]}>
          <View style={styles.igCamTopRow}>
            <Pressable style={styles.igCamIconSq} onPress={handleClose} hitSlop={10}>
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
            <View style={styles.igCamTopCenter}>
              <Pressable style={styles.igCamRoundControl} onPress={() => setEntryFlashOn((v) => !v)}>
                <Ionicons name={entryFlashOn ? "flash" : "flash-outline"} size={18} color="#b7ff37" />
              </Pressable>
              <Pressable
                style={styles.igCamRoundControl}
                onPress={() => setEntryZoomLabel((z) => (z === "1x" ? "2x" : "1x"))}
              >
                <Text style={styles.igCamZoomText}>{entryZoomLabel}</Text>
              </Pressable>
              <Pressable style={styles.igCamRoundControl} onPress={() => setEntryTimerOn((v) => !v)}>
                <Ionicons name="timer-outline" size={18} color={entryTimerOn ? "#b7ff37" : "#e8e8e8"} />
              </Pressable>
            </View>
            <Pressable
              style={styles.igCamIconSq}
              onPress={() =>
                Alert.alert("Settings", "Live and advanced camera options are available from the mode bar.", [
                  { text: "Go Live", onPress: () => setEntryType("live") },
                  { text: "OK", style: "cancel" }
                ])
              }
            >
              <Ionicons name="settings-sharp" size={19} color="#b7ff37" />
            </Pressable>
          </View>

          <Pressable style={styles.igAddAudioPill} onPress={() => Alert.alert("Audio", "Add music or audio after you capture — coming soon.")}>
            <Ionicons name="musical-notes" size={16} color="#b7ff37" />
            <Text style={styles.igAddAudioText}>Add Audio</Text>
          </Pressable>

          <View style={styles.igCamBody}>
            <View style={styles.igCamLeftRail} pointerEvents="box-none">
              <Pressable style={styles.igCamRailRow} onPress={() => Alert.alert("Audio", "Browse audio tracks — coming soon.")}>
                <View style={styles.igCamRailIcon}>
                  <Ionicons name="musical-note" size={16} color="#b7ff37" />
                </View>
                <Text style={styles.igCamRailLabel}>Audio</Text>
              </Pressable>
              <Pressable style={styles.igCamRailRow} onPress={() => setShowCreativeFilterPanel(true)}>
                <View style={styles.igCamRailIcon}>
                  <Ionicons name="sparkles" size={16} color="#b7ff37" />
                </View>
                <Text style={styles.igCamRailLabel}>Effects</Text>
              </Pressable>
            </View>

            <View style={styles.igCamViewfinder}>
              <View style={styles.igCrosshair} pointerEvents="none">
                <View style={styles.igCrosshairLineH} />
                <View style={styles.igCrosshairLineV} />
                <View style={styles.igCrosshairBurst}>
                  <Ionicons name="sparkles" size={12} color="#38bdf8" />
                </View>
              </View>
            </View>
          </View>

          {errorText ? <Text style={styles.igCamErrorBanner}>{errorText}</Text> : null}

          <View style={styles.igCamCaptureRow}>
            <Pressable style={styles.igCamGalleryThumb} onPress={openEntryGallery}>
              {recentGridAssets[0] ? (
                <Image source={{ uri: recentGridAssets[0].uri }} style={styles.igCamGalleryThumbImg} resizeMode="cover" />
              ) : (
                <Ionicons name="images-outline" size={22} color="#b7ff37" />
              )}
            </Pressable>
            <View style={styles.igCamCaptureRowSpacer} />
            <View style={styles.igCamCaptureCluster}>
              <Pressable style={styles.igCamCaptureOuter} onPress={openEntryCamera}>
                <View style={styles.igCamCaptureInner} />
              </Pressable>
              <View style={styles.igCamAuxDots}>
                <View style={styles.igCamAuxDot} />
                <View style={[styles.igCamAuxDot, styles.igCamAuxDotSm]} />
              </View>
            </View>
            <View style={styles.igCamCaptureRowSpacer} />
            <Pressable
              style={styles.igCamFlipBtn}
              onPress={() =>
                setEntryCameraFacing((f) =>
                  f === ImagePicker.CameraType.back ? ImagePicker.CameraType.front : ImagePicker.CameraType.back
                )
              }
              hitSlop={8}
            >
              <Ionicons name="camera-reverse-outline" size={28} color="#b7ff37" />
            </Pressable>
          </View>

          <View style={styles.igCamBottomModes}>
            {createModes.map((m) => {
              const label = m.label;
              const emphasize = m.key === "story";
              return (
                <Pressable
                  key={m.key}
                  style={[styles.igCamModeItem, entryType === m.key ? styles.igCamModeItemOn : null]}
                  onPress={() => setEntryType(m.key)}
                >
                  <Text
                    style={[
                      styles.igCamModeItemText,
                      entryType === m.key ? styles.igCamModeItemTextOn : null,
                      emphasize && entryType === m.key ? styles.igCamModeItemTextHero : null
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        )
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
                  void proceedToCompose();
                }}
                disabled={!canProceedFromPreview || isSubmitting}
              >
                <Text style={[styles.igPreviewAction, !canProceedFromPreview ? styles.igPreviewActionDisabled : null]}>
                  {createType === "story" ? "Share" : "Next"}
                </Text>
              </Pressable>
            </View>
            {createType === "story" ? renderCreativeToolbar() : null}
            <View style={styles.igMediaPreviewWrap}>
              {createType === "story" ? (
                selectedUri ? (
                  isSelectedVideo ? (
                    <MediaWithCreative
                      uri={selectedUri}
                      isVideo
                      filter={creativeFilter}
                      overlayText={creativeText}
                      font={creativeFont}
                      textColor={creativeTextColor}
                      textBackground={creativeTextBackground}
                    />
                  ) : (
                    <MediaWithCreative
                      ref={previewCaptureRef}
                      uri={selectedUri}
                      isVideo={false}
                      filter={creativeFilter}
                      overlayText={creativeText}
                      font={creativeFont}
                      textColor={creativeTextColor}
                      textBackground={creativeTextBackground}
                    />
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
                      <MediaWithCreative
                        uri={item.uri}
                        isVideo={false}
                        filter={creativeFilter}
                        overlayText={creativeText}
                        font={creativeFont}
                        textColor={creativeTextColor}
                        textBackground={creativeTextBackground}
                      />
                    </View>
                  )}
                />
              ) : pickedPostAssets.length === 1 ? (
                isSelectedVideo ? (
                  <MediaWithCreative
                    uri={selectedUri}
                    isVideo
                    filter={creativeFilter}
                    overlayText={creativeText}
                    font={creativeFont}
                    textColor={creativeTextColor}
                    textBackground={creativeTextBackground}
                  />
                ) : (
                  <MediaWithCreative
                    ref={previewCaptureRef}
                    uri={selectedUri}
                    isVideo={false}
                    filter={creativeFilter}
                    overlayText={creativeText}
                    font={creativeFont}
                    textColor={creativeTextColor}
                    textBackground={creativeTextBackground}
                  />
                )
              ) : (
                <View style={styles.igEmptyPreview}>
                  <Ionicons name="image-outline" size={42} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.igEmptyPreviewText}>Select media from camera or gallery</Text>
                </View>
              )}
            </View>
            {createType === "post" || createType === "reel" ? (
              <>
                <View style={styles.igPostToolsRow}>
                  {[
                    { id: "audio", label: "Audio", icon: "musical-note-outline" as const, onPress: () => Alert.alert("Audio", "Audio picker coming soon.") },
                    {
                      id: "text",
                      label: "Text",
                      icon: "text-outline" as const,
                      onPress: () => {
                        setShowCreativeFilterPanel(false);
                        setShowStickerPanel(false);
                        setShowCreativeTextPanel(true);
                      }
                    },
                    {
                      id: "overlay",
                      label: "Overlay",
                      icon: "images-outline" as const,
                      onPress: () => Alert.alert("Overlay", "Overlay editor coming soon.")
                    },
                    {
                      id: "filter",
                      label: "Filter",
                      icon: "color-filter-outline" as const,
                      onPress: () => {
                        setShowCreativeTextPanel(false);
                        setShowStickerPanel(false);
                        setShowCreativeFilterPanel(true);
                      }
                    },
                    {
                      id: "edit",
                      label: "Edit",
                      icon: "options-outline" as const,
                      onPress: () => Alert.alert("Edit", "Advanced editing tools coming soon.")
                    }
                  ].map((tool) => (
                    <Pressable key={tool.id} style={styles.igPostToolPill} onPress={tool.onPress}>
                      <Ionicons name={tool.icon} size={16} color="#f5f7fa" />
                      <Text style={styles.igPostToolText}>{tool.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.igPostNextRow}>
                  <Pressable
                    onPress={() => {
                      void proceedToCompose();
                    }}
                    disabled={!canProceedFromPreview || isSubmitting}
                    style={[styles.igPostNextBtn, !canProceedFromPreview ? styles.igPostNextBtnDisabled : null]}
                  >
                    <Text style={styles.igPostNextText}>Next</Text>
                    <Ionicons name="arrow-forward" size={16} color="#fff" />
                  </Pressable>
                </View>
              </>
            ) : null}
            {errorText ? <Text style={styles.igErrorText}>{errorText}</Text> : null}
          </>
        ) : (
          <>
            <View style={styles.igComposeTopBar}>
              <Pressable
                onPress={() => {
                  setComposedImageUri(null);
                  setCreateStep("preview");
                }}
                hitSlop={10}
              >
                <Ionicons name="arrow-back" size={24} color="#1b2422" />
              </Pressable>
              <Text style={styles.igComposeTitle}>New {createType === "reel" ? "Reel" : "Post"}</Text>
              <Pressable onPress={submitPostVideo} disabled={isSubmitting}>
                {isSubmitting ? <ActivityIndicator size="small" color="#0a9f46" /> : <Text style={styles.igComposeShare}>Share</Text>}
              </Pressable>
            </View>
            {pickedPostAssets.length > 1 ? (
              <View style={styles.igComposeBody}>
                <Text style={styles.igComposeSectionLabel}>Photos</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.igComposeThumbStripInner}>
                  {pickedPostAssets.map((a, i) => (
                    <Image key={`${i}-${a.uri}`} style={styles.igComposeThumbSmall} source={{ uri: a.uri }} resizeMode="cover" />
                  ))}
                </ScrollView>
                <Text style={styles.igComposeSectionLabel}>Caption</Text>
                <TextInput
                  value={caption}
                  onChangeText={setCaption}
                  style={styles.igComposeCaptionInputFull}
                  placeholder={createType === "reel" ? "Write a reel caption..." : "Write a caption..."}
                  multiline
                  placeholderTextColor="#7f8b88"
                />
              </View>
            ) : (
              <View style={styles.igComposeMediaRow}>
                {selectedUri ? (
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
            )}
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

    <Modal visible={showCreativeTextPanel} transparent animationType="fade" onRequestClose={() => setShowCreativeTextPanel(false)}>
      <Pressable style={styles.creativePanelBackdrop} onPress={() => setShowCreativeTextPanel(false)}>
        <Pressable style={styles.creativePanelCard} onPress={(e) => e.stopPropagation?.()}>
          <View style={styles.creativePanelTopRow}>
            <Text style={styles.creativePanelTitle}>Edit text</Text>
            <Pressable style={styles.creativePanelDoneGhost} onPress={() => setShowCreativeTextPanel(false)}>
              <Text style={styles.creativePanelDoneGhostText}>Done</Text>
            </Pressable>
          </View>
          <View style={styles.creativeLivePreviewBox}>
            <Text style={[styles.creativeLivePreviewText, creativeFontStyle(creativeFont, creativeTextColor, creativeTextBackground)]}>
              {creativeText.trim() || "Type text"}
            </Text>
          </View>
          <TextInput
            value={creativeText}
            onChangeText={setCreativeText}
            placeholder="Type something…"
            placeholderTextColor="#9aa8a4"
            style={styles.creativePanelInput}
            multiline
            maxLength={220}
          />
          <Text style={styles.creativePanelSub}>Font</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fontChipsRow}>
            {(
              [
                ["classic", "Classic"],
                ["modern", "Modern"],
                ["strong", "Strong"],
                ["neon", "Neon"]
              ] as const
            ).map(([id, label]) => (
              <Pressable
                key={id}
                style={[styles.fontChip, creativeFont === id ? styles.fontChipOn : null]}
                onPress={() => setCreativeFont(id)}
              >
                <Text style={creativeFont === id ? styles.fontChipTextOn : styles.fontChipText}>{label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={styles.creativePanelSub}>Color</Text>
          <View style={styles.textColorRow}>
            {TEXT_COLOR_OPTIONS.map((c) => (
              <Pressable
                key={c.id}
                style={[styles.textColorDot, { backgroundColor: c.hex }, creativeTextColor === c.id ? styles.textColorDotActive : null]}
                onPress={() => setCreativeTextColor(c.id)}
              />
            ))}
            <Pressable
              style={[styles.textBackgroundToggle, creativeTextBackground ? styles.textBackgroundToggleActive : null]}
              onPress={() => setCreativeTextBackground((v) => !v)}
            >
              <Text style={[styles.textBackgroundToggleText, creativeTextBackground ? styles.textBackgroundToggleActiveText : null]}>A</Text>
            </Pressable>
          </View>
          <Pressable style={styles.creativePanelDone} onPress={() => setShowCreativeTextPanel(false)}>
            <Text style={styles.creativePanelDoneText}>Apply</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>

    <Modal visible={showCreativeFilterPanel} transparent animationType="fade" onRequestClose={() => setShowCreativeFilterPanel(false)}>
      <Pressable style={styles.creativePanelBackdrop} onPress={() => setShowCreativeFilterPanel(false)}>
        <Pressable style={styles.creativePanelCard} onPress={(e) => e.stopPropagation?.()}>
          <Text style={styles.creativePanelTitle}>Filters</Text>
          <View style={styles.filterGrid}>
            {FILTER_OPTIONS.map((f) => (
              <Pressable
                key={f.id}
                style={[styles.filterChip, creativeFilter === f.id ? styles.filterChipOn : null]}
                onPress={() => setCreativeFilter(f.id)}
              >
                <View
                  style={[
                    styles.filterSwatch,
                    f.id === "none" ? styles.filterSwatchNone : { backgroundColor: filterTint(f.id) ?? "transparent" }
                  ]}
                />
                <Text style={styles.filterChipLabel}>{f.label}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.creativePanelDone} onPress={() => setShowCreativeFilterPanel(false)}>
            <Text style={styles.creativePanelDoneText}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>

    <Modal visible={showStickerPanel} transparent animationType="fade" onRequestClose={() => setShowStickerPanel(false)}>
      <Pressable style={styles.creativePanelBackdrop} onPress={() => setShowStickerPanel(false)}>
        <Pressable style={styles.creativePanelCard} onPress={(e) => e.stopPropagation?.()}>
          <Text style={styles.creativePanelTitle}>Stickers</Text>
          <Text style={styles.creativePanelHint}>Tap to add to your text</Text>
          <View style={styles.stickerGrid}>
            {STICKER_EMOJIS.map((emoji) => (
              <Pressable
                key={emoji}
                style={styles.stickerBtn}
                onPress={() => setCreativeText((t) => (t ? `${t} ${emoji}` : emoji))}
              >
                <Text style={styles.stickerEmoji}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.creativePanelDone} onPress={() => setShowStickerPanel(false)}>
            <Text style={styles.creativePanelDoneText}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  igPostEntryRoot: {
    flex: 1,
    backgroundColor: "#03070d"
  },
  igPostEntryTop: {
    height: 48,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  igPostEntryTopBtn: { width: 32, alignItems: "flex-start", justifyContent: "center" },
  igPostEntryTitle: { color: "#fff", fontWeight: "800", fontSize: 32 },
  igPostEntryNext: { color: "#6f81ff", fontWeight: "800", fontSize: 28 },
  igPostEntryNextDisabled: { opacity: 0.45 },
  igPostEntryPreview: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#0b111a",
    position: "relative"
  },
  igPostEntryPreviewImage: { width: "100%", height: "100%" },
  igPostEntryPreviewFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  igPostGridOverlay: { ...StyleSheet.absoluteFillObject },
  igPostGridLineH: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "33.333%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.25)"
  },
  igPostGridLineV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "33.333%",
    width: 1,
    backgroundColor: "rgba(255,255,255,0.25)"
  },
  igPostEntryRecentsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  igPostEntryRecentsText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  igPostEntrySelectBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#232a36"
  },
  igPostEntrySelectBtnOn: { backgroundColor: "#3a4660" },
  igPostEntrySelectText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  igPostEntryGrid: { paddingBottom: 8 },
  igPostEntryCell: {
    width: "25%",
    aspectRatio: 1,
    borderWidth: 0.5,
    borderColor: "#0d121b",
    position: "relative"
  },
  igPostEntryCellImage: { width: "100%", height: "100%" },
  igPostEntryCameraBadge: {
    position: "absolute",
    left: 8,
    bottom: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)"
  },
  igPostEntrySelectedBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#4f62ff",
    alignItems: "center",
    justifyContent: "center"
  },
  igPostEntrySelectedText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  igPostEntryModes: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: "#121925"
  },
  igPostEntryModeItem: { paddingHorizontal: 2, paddingVertical: 6 },
  igPostEntryModeText: { color: "rgba(255,255,255,0.55)", fontWeight: "700", fontSize: 18, letterSpacing: 0.8 },
  igPostEntryModeTextOn: { color: "#fff" },
  igCameraEntryRoot: {
    flex: 1,
    backgroundColor: "#8e8e93",
    paddingHorizontal: 8
  },
  igCamTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    marginBottom: 10
  },
  igCamIconSq: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center"
  },
  igCamTopCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  igCamRoundControl: {
    minWidth: 40,
    height: 40,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center"
  },
  igCamZoomText: {
    color: "#b7ff37",
    fontWeight: "800",
    fontSize: 13
  },
  igAddAudioPill: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.45)",
    marginBottom: 8
  },
  igAddAudioText: {
    color: "#b7ff37",
    fontWeight: "700",
    fontSize: 14
  },
  igCamBody: {
    flex: 1,
    flexDirection: "row",
    marginTop: 4,
    minHeight: 280
  },
  igCamLeftRail: {
    width: 112,
    justifyContent: "center",
    gap: 14,
    paddingRight: 4,
    zIndex: 2
  },
  igCamRailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  igCamRailIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center"
  },
  igCamRailLabel: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    flex: 1
  },
  igCamViewfinder: {
    flex: 1,
    marginLeft: -6,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "#9a9a9e"
  },
  igCrosshair: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center"
  },
  igCrosshairLineH: {
    position: "absolute",
    width: "72%",
    height: 2,
    backgroundColor: "rgba(56,189,248,0.9)",
    borderRadius: 1
  },
  igCrosshairLineV: {
    position: "absolute",
    width: 2,
    height: "58%",
    backgroundColor: "rgba(56,189,248,0.9)",
    borderRadius: 1
  },
  igCrosshairBurst: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center"
  },
  igCamErrorBanner: {
    color: "#7f1d1d",
    backgroundColor: "rgba(255,255,255,0.92)",
    textAlign: "center",
    fontWeight: "700",
    paddingVertical: 6,
    marginHorizontal: 12,
    marginTop: 6,
    borderRadius: 8,
    overflow: "hidden"
  },
  igCamCaptureRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    marginBottom: 10,
    paddingHorizontal: 4
  },
  igCamGalleryThumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#b7ff37",
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  igCamGalleryThumbImg: { width: "100%", height: "100%" },
  igCamCaptureRowSpacer: { flex: 1 },
  igCamCaptureCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  igCamCaptureOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 5,
    borderColor: "#b7ff37",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center"
  },
  igCamCaptureInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#3a3a3c"
  },
  igCamAuxDots: {
    justifyContent: "center",
    gap: 10
  },
  igCamAuxDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#3a3a3c"
  },
  igCamAuxDotSm: {
    width: 11,
    height: 11,
    borderRadius: 6
  },
  igCamFlipBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  igCamBottomModes: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    flexWrap: "wrap",
    paddingBottom: 4
  },
  igCamModeItem: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  igCamModeItemOn: {
    backgroundColor: "rgba(0,0,0,0.35)"
  },
  igCamModeItemText: {
    color: "rgba(255,255,255,0.72)",
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 0.6
  },
  igCamModeItemTextOn: {
    color: "#b7ff37"
  },
  igCamModeItemTextHero: {
    fontSize: 13,
    letterSpacing: 0.8
  },
  igFullScreen: { flex: 1, backgroundColor: "#05080d", justifyContent: "space-between", paddingTop: 48, paddingBottom: 24, paddingHorizontal: 16 },
  igTopControls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  igTopRightControls: { flexDirection: "row", alignItems: "center", gap: 16 },
  igLeftTools: { position: "absolute", left: 16, top: 140, gap: 24, alignItems: "center" },
  igLeftToolsElevated: { zIndex: 30 },
  igLeftToolText: { color: "#fff", fontSize: 34, fontWeight: "500" },
  igLeftToolActive: { color: "#7dd3fc" },
  creativePanelBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
    padding: 16
  },
  creativePanelCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5ece8"
  },
  creativePanelTitle: { fontSize: 18, fontWeight: "800", color: "#1b2422" },
  creativePanelTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  creativePanelDoneGhost: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 16, backgroundColor: "#e8f7ef" },
  creativePanelDoneGhostText: { color: "#0a9f46", fontWeight: "800", fontSize: 12 },
  creativeLivePreviewBox: {
    minHeight: 70,
    borderRadius: 10,
    backgroundColor: "#111",
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  creativeLivePreviewText: { textAlign: "center", lineHeight: 34 },
  creativePanelSub: { fontSize: 12, fontWeight: "700", color: "#697774", marginTop: 12, marginBottom: 8 },
  creativePanelHint: { fontSize: 12, color: "#697774", marginBottom: 10 },
  creativePanelInput: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: "#dbe6e1",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: "#1b2422",
    textAlignVertical: "top"
  },
  fontChipsRow: { flexDirection: "row", gap: 8, paddingRight: 6 },
  fontChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#dbe6e1",
    backgroundColor: "#f8faf9"
  },
  fontChipOn: { borderColor: "#0a9f46", backgroundColor: "#e8f7ef" },
  fontChipText: { color: "#4d5f5a", fontWeight: "700", fontSize: 13 },
  fontChipTextOn: { color: "#0a9f46", fontWeight: "800", fontSize: 13 },
  creativePanelDone: {
    marginTop: 16,
    backgroundColor: "#0a9f46",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center"
  },
  creativePanelDoneText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  textColorRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2 },
  textColorDot: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: "#fff" },
  textColorDotActive: { borderColor: "#0a9f46", transform: [{ scale: 1.08 }] },
  textBackgroundToggle: {
    marginLeft: "auto",
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#dbe6e1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8faf9"
  },
  textBackgroundToggleActive: { backgroundColor: "#111", borderColor: "#111" },
  textBackgroundToggleText: { color: "#1b2422", fontWeight: "800" },
  textBackgroundToggleActiveText: { color: "#fff" },
  filterGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between" },
  filterChip: { width: "30%", alignItems: "center", marginBottom: 6 },
  filterChipOn: { opacity: 1 },
  filterSwatch: { width: 44, height: 44, borderRadius: 10, marginBottom: 4 },
  filterSwatchNone: { backgroundColor: "#f3f4f6", borderWidth: 2, borderColor: "#d1d5db" },
  filterChipLabel: { fontSize: 11, fontWeight: "600", color: "#4d5f5a", textAlign: "center" },
  stickerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
  stickerBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#f8faf9",
    borderWidth: 1,
    borderColor: "#e5ece8",
    alignItems: "center",
    justifyContent: "center"
  },
  stickerEmoji: { fontSize: 26 },
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
  igPreviewTitle: { color: "#fff", fontWeight: "800", fontSize: 33 },
  igPreviewAction: { color: "#6f81ff", fontWeight: "800", fontSize: 22 },
  igPreviewActionDisabled: { color: "rgba(77,166,255,0.5)" },
  igMediaPreviewWrap: { flex: 1, borderRadius: 14, overflow: "hidden", backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  igPreviewCarousel: { flex: 1, alignSelf: "center" },
  igPreviewCarouselPage: { justifyContent: "center", alignItems: "center" },
  igMediaPreview: { width: "100%", height: "100%" },
  igEmptyPreview: { alignItems: "center", gap: 8 },
  igEmptyPreviewText: { color: "rgba(255,255,255,0.7)" },
  igErrorText: { color: "#fecaca", textAlign: "center", marginTop: 10, fontWeight: "600" },
  igPostToolsRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  igPostToolPill: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "#1b2430",
    borderWidth: 1,
    borderColor: "#2b3748",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10
  },
  igPostToolText: { marginTop: 4, color: "#f5f7fa", fontSize: 11, fontWeight: "600" },
  igPostNextRow: {
    marginTop: 16,
    alignItems: "flex-end"
  },
  igPostNextBtn: {
    minWidth: 108,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#4f62ff",
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  igPostNextBtnDisabled: { opacity: 0.5 },
  igPostNextText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  igComposeTopBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: 8, backgroundColor: "#fff" },
  igComposeTitle: { color: "#1b2422", fontWeight: "700", fontSize: 16 },
  igComposeShare: { color: "#0a9f46", fontWeight: "700", fontSize: 16 },
  igComposeMediaRow: { backgroundColor: "#fff", flexDirection: "row", padding: 12, gap: 10, borderTopWidth: 1, borderTopColor: "#edf1ef" },
  igComposeThumb: { width: 76, height: 76, borderRadius: 8, backgroundColor: "#e7ece9" },
  igComposeThumbStripInner: { flexDirection: "row", gap: 6, paddingRight: 6, alignItems: "center" },
  igComposeThumbSmall: { width: 56, height: 56, borderRadius: 8, backgroundColor: "#e7ece9" },
  igComposeCaptionInput: { flex: 1, minHeight: 76, textAlignVertical: "top", color: "#1b2422" },
  igComposeBody: {
    flex: 1,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#edf1ef",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 16,
    minHeight: 200
  },
  igComposeSectionLabel: { color: "#697774", fontSize: 12, fontWeight: "700", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.6 },
  igComposeCaptionInputFull: {
    width: "100%",
    minHeight: 120,
    maxHeight: 220,
    textAlignVertical: "top",
    color: "#1b2422",
    fontSize: 16,
    lineHeight: 22,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#f8faf9",
    borderWidth: 1,
    borderColor: "#dbe6e1",
    borderRadius: 10,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as const) : null)
  },
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
