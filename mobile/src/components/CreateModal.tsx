import { Ionicons } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  InteractionManager,
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
import { CameraView } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { Audio, ResizeMode, Video } from "expo-av";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import * as VideoThumbnails from "expo-video-thumbnails";
import { captureRef } from "react-native-view-shot";
import {
  createHomePost,
  createHomeStory,
  fetchSocialNetwork,
  shouldUseImageUpload,
  uploadImageFile,
  uploadPickedMedia
} from "../services/api";
import { launchWebCameraAsyncWithFacing } from "../utils/webCameraPicker";
import { useAuth } from "../auth/AuthContext";
import { InAppCameraCapture, isInAppCameraSupported, type InAppCameraCaptureMode } from "./InAppCameraCapture";
import { WebCameraCapture } from "./WebCameraCapture";
import { StoryCameraPreview } from "./StoryCameraPreview";
import {
  fetchGalleryAlbums,
  fetchGalleryAssets,
  recentsAlbumId,
  type GalleryAlbum,
  type GalleryGridAsset
} from "../utils/galleryAlbums";

type TaggedPerson = { id: number; name: string };

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
type CreativeAudioTrack = { id: string; title: string; artist: string; previewUrl: string };

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
const AUDIO_TRACKS: CreativeAudioTrack[] = [
  {
    id: "sunrise",
    title: "Sunrise Fields",
    artist: "Cropvibe",
    previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
  },
  {
    id: "tractor-beat",
    title: "Tractor Beat",
    artist: "Cropvibe",
    previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3"
  },
  {
    id: "rainfall",
    title: "Rainfall Mood",
    artist: "Cropvibe",
    previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3"
  }
];

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
  musicLabel?: string;
  shouldPlay?: boolean;
};

const CAMERA_GRID_ID = "__camera__";

const MediaWithCreative = React.forwardRef<View, MediaCreativeProps>(function MediaWithCreative(
  { uri, isVideo, filter, overlayText, font, textColor, textBackground, musicLabel, shouldPlay = true },
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
      {musicLabel ? (
        <View
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: 14,
            borderRadius: 14,
            paddingHorizontal: 10,
            paddingVertical: 6,
            backgroundColor: "rgba(0,0,0,0.5)",
            alignSelf: "center"
          }}
        >
          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700", textAlign: "center" }}>♪ {musicLabel}</Text>
        </View>
      ) : null}
    </View>
  );
});

export function CreateModal({ visible, onClose, onVideoPosted, initialType = null }: CreateModalProps) {
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const [createType, setCreateType] = useState<CreateType | null>(null);
  const [entryCameraFacing, setEntryCameraFacing] = useState(ImagePicker.CameraType.front);
  const [fullScreenCameraOpen, setFullScreenCameraOpen] = useState(false);
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
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [showAudioPanel, setShowAudioPanel] = useState(false);
  const [selectedAudioTrackId, setSelectedAudioTrackId] = useState<string | null>(null);
  const [audioPreviewTrackId, setAudioPreviewTrackId] = useState<string | null>(null);
  const [audioQuery, setAudioQuery] = useState("");
  const [audioSearchResults, setAudioSearchResults] = useState<CreativeAudioTrack[]>([]);
  const [audioSearchLoading, setAudioSearchLoading] = useState(false);
  const [audioSearchError, setAudioSearchError] = useState("");
  const [recentGridAssets, setRecentGridAssets] = useState<GalleryGridAsset[]>([]);
  const [galleryAlbums, setGalleryAlbums] = useState<GalleryAlbum[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [showAlbumPicker, setShowAlbumPicker] = useState(false);
  const [captureEntryView, setCaptureEntryView] = useState<"camera" | "gallery">("camera");
  const entryCameraRef = useRef<CameraView>(null);
  const [entrySelectedIds, setEntrySelectedIds] = useState<string[]>([]);
  /** Instagram-style: post flow allows multiple photos by default (up to 10). */
  const [entryMultiSelect, setEntryMultiSelect] = useState(true);
  const [postLocation, setPostLocation] = useState("");
  const [showLocationPanel, setShowLocationPanel] = useState(false);
  const [locationDraft, setLocationDraft] = useState("");
  const [taggedPeople, setTaggedPeople] = useState<TaggedPerson[]>([]);
  const [showTagPeoplePanel, setShowTagPeoplePanel] = useState(false);
  const [followableUsers, setFollowableUsers] = useState<TaggedPerson[]>([]);
  const [followableLoading, setFollowableLoading] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState("");
  /** Snapshot of preview with text+filter for single-image post/reel (captured when leaving preview). */
  const [composedImageUri, setComposedImageUri] = useState<string | null>(null);
  const previewCaptureRef = useRef<View>(null);
  const audioPreviewRef = useRef<Audio.Sound | null>(null);
  const [errorText, setErrorText] = useState("");
  const [isSubmitting, setSubmitting] = useState(false);

  const openCreativePanel = React.useCallback((panel: "text" | "filter" | "overlay") => {
    setShowEditPanel(false);
    setShowCreativeTextPanel(false);
    setShowCreativeFilterPanel(false);
    setShowStickerPanel(false);
    setTimeout(() => {
      if (panel === "text") setShowCreativeTextPanel(true);
      if (panel === "filter") setShowCreativeFilterPanel(true);
      if (panel === "overlay") setShowStickerPanel(true);
    }, 0);
  }, []);

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

  const stopAudioPreview = React.useCallback(async () => {
    const sound = audioPreviewRef.current;
    if (!sound) return;
    try {
      await sound.stopAsync();
      await sound.unloadAsync();
    } catch {
      // ignore preview cleanup errors
    }
    audioPreviewRef.current = null;
    setAudioPreviewTrackId(null);
  }, []);

  const previewAudioTrack = React.useCallback(
    async (track: CreativeAudioTrack) => {
      if (audioPreviewTrackId === track.id) {
        await stopAudioPreview();
        return;
      }
      await stopAudioPreview();
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false
        });
        const sound = new Audio.Sound();
        await sound.loadAsync({ uri: track.previewUrl }, { shouldPlay: true, isLooping: true });
        audioPreviewRef.current = sound;
        setAudioPreviewTrackId(track.id);
      } catch {
        setErrorText("Could not preview this audio track.");
      }
    },
    [audioPreviewTrackId, stopAudioPreview]
  );

  React.useEffect(() => {
    if (!visible) {
      setFullScreenCameraOpen(false);
      setShowCreativeTextPanel(false);
      setShowCreativeFilterPanel(false);
      setShowStickerPanel(false);
      setShowEditPanel(false);
      setShowAudioPanel(false);
      void stopAudioPreview();
      return;
    }
    setCreateType(initialType === "story" ? null : initialType);
    setCreateStep("preview");
    const entry = initialType ?? "story";
    setEntryType(entry);
    setEntryMultiSelect(entry === "post");
    setEntryCameraFacing(ImagePicker.CameraType.front);
    setFullScreenCameraOpen(false);
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
    setShowEditPanel(false);
    setShowAudioPanel(false);
    setSelectedAudioTrackId(null);
    setAudioPreviewTrackId(null);
    setAudioQuery("");
    setAudioSearchResults([]);
    setAudioSearchLoading(false);
    setAudioSearchError("");
    setComposedImageUri(null);
    setEntrySelectedIds([]);
    setEntryMultiSelect(false);
    setCaptureEntryView("camera");
    setPostLocation("");
    setLocationDraft("");
    setShowLocationPanel(false);
    setTaggedPeople([]);
    setShowTagPeoplePanel(false);
    setTagSearchQuery("");
  }, [visible, initialType, stopAudioPreview]);

  React.useEffect(() => {
    return () => {
      void stopAudioPreview();
    };
  }, [stopAudioPreview]);

  React.useEffect(() => {
    if (!showAudioPanel) return;
    const q = audioQuery.trim();
    if (q.length < 2) {
      setAudioSearchLoading(false);
      setAudioSearchError("");
      setAudioSearchResults([]);
      return;
    }
    let cancelled = false;
    const timeout = setTimeout(async () => {
      try {
        setAudioSearchLoading(true);
        setAudioSearchError("");
        const response = await fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=20`
        );
        const data = (await response.json()) as {
          results?: Array<{ trackId?: number; trackName?: string; artistName?: string; previewUrl?: string }>;
        };
        const tracks: CreativeAudioTrack[] = (data.results ?? [])
          .filter((item) => !!item.previewUrl && !!item.trackName)
          .map((item, idx) => ({
            id: `itunes-${item.trackId ?? `${item.trackName ?? "track"}-${idx}`}`,
            title: item.trackName ?? "Unknown",
            artist: item.artistName ?? "Unknown artist",
            previewUrl: item.previewUrl ?? ""
          }));
        if (!cancelled) setAudioSearchResults(tracks);
      } catch {
        if (!cancelled) {
          setAudioSearchResults([]);
          setAudioSearchError("Could not fetch songs. Check internet and try again.");
        }
      } finally {
        if (!cancelled) setAudioSearchLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [audioQuery, showAudioPanel]);

  const selectedAlbumTitle =
    galleryAlbums.find((a) => a.id === (selectedAlbumId ?? recentsAlbumId()))?.title ?? "Recents";

  const refreshGallery = React.useCallback(async () => {
    if (Platform.OS === "web") {
      setGalleryAlbums([{ id: recentsAlbumId(), title: "Recents", assetCount: 0 }]);
      setRecentGridAssets([]);
      return;
    }
    try {
      const albums = await fetchGalleryAlbums();
      setGalleryAlbums(albums);
      const assets = await fetchGalleryAssets(selectedAlbumId, entryType);
      setRecentGridAssets(assets);
    } catch {
      setGalleryAlbums([{ id: recentsAlbumId(), title: "Recents", assetCount: 0 }]);
      setRecentGridAssets([]);
    }
  }, [entryType, selectedAlbumId]);

  React.useEffect(() => {
    if (!visible || createType) return;
    void refreshGallery();
  }, [createType, refreshGallery, visible]);

  React.useEffect(() => {
    if (entryType === "post" || entryType === "live") return;
    setCaptureEntryView("camera");
  }, [entryType]);

  React.useEffect(() => {
    if (!showTagPeoplePanel) return;
    if (!token || !user?.id) {
      setFollowableUsers([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setFollowableLoading(true);
        const network = await fetchSocialNetwork(token, Number(user.id));
        const merged: TaggedPerson[] = [];
        const seen = new Set<number>();
        for (const list of [network.following || [], network.followers || []]) {
          for (const person of list) {
            const raw = String(person.key || "").trim();
            if (!/^\d+$/.test(raw)) continue;
            const id = Number(raw);
            if (seen.has(id)) continue;
            seen.add(id);
            merged.push({ id, name: person.name });
          }
        }
        if (!cancelled) setFollowableUsers(merged);
      } catch {
        if (!cancelled) setFollowableUsers([]);
      } finally {
        if (!cancelled) setFollowableLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showTagPeoplePanel, token, user?.id]);

  const handleClose = () => {
    if (isSubmitting) return;
    setFullScreenCameraOpen(false);
    setCreateType(null);
    setErrorText("");
    setShowCreativeTextPanel(false);
    setShowCreativeFilterPanel(false);
    setShowStickerPanel(false);
    setShowEditPanel(false);
    setShowAudioPanel(false);
    void stopAudioPreview();
    onClose();
  };

  const startPostFromEntry = () => {
    if (pickedPostAssets.length) {
      setCreateType("post");
      setCreateStep("preview");
      return;
    }
    const selected = entrySelectedIds
      .map((id) => recentGridAssets.find((a) => a.id === id))
      .filter((a): a is GalleryGridAsset => !!a);
    if (!selected.length) {
      setErrorText("Please select at least one photo.");
      return;
    }
    if (selected.length > 1 && selected.some((a) => a.mediaType === "video")) {
      setErrorText("Photo carousels can only include pictures. Pick one video for a video post.");
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

  const onEntryPressAsset = (asset: GalleryGridAsset) => {
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

  const pickStoryFromGallery = (asset: GalleryGridAsset) => {
    setErrorText("");
    const pickerAsset = {
      uri: asset.uri,
      type: asset.mediaType,
      fileName: asset.filename,
      duration: asset.duration
    } as ImagePicker.ImagePickerAsset;
    applyPickedMediaToFlow([pickerAsset]);
  };

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
          openCreativePanel("text");
        }}
        hitSlop={8}
      >
        <Text style={[styles.igLeftToolText, creativeText.trim().length > 0 ? styles.igLeftToolActive : null]}>Aa</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          openCreativePanel("filter");
        }}
        hitSlop={8}
      >
        <Ionicons name="infinite-outline" size={26} color={creativeFilter !== "none" ? "#7dd3fc" : "#fff"} />
      </Pressable>
      <Pressable
        onPress={() => {
          openCreativePanel("overlay");
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

  const cameraCaptureMode = (): InAppCameraCaptureMode => {
    if (entryType === "reel") return "video";
    if (entryType === "post") return "photo";
    return "any";
  };

  const openNativeCameraPicker = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setErrorText("Camera permission is required.");
      return;
    }
    await new Promise<void>((resolve) => {
      InteractionManager.runAfterInteractions(() => resolve());
    });
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: mediaTypeForEntry(),
      quality: 0.9,
      cameraType: entryCameraFacing,
      ...(Platform.OS === "ios"
        ? { presentationStyle: ImagePicker.UIImagePickerPresentationStyle.OVER_FULL_SCREEN }
        : {})
    });
    if (!result.canceled && result.assets[0]) {
      applyPickedMediaToFlow([result.assets[0]]);
    }
  };

  const openEntryCameraWeb = async () => {
    try {
      const result = await launchWebCameraAsyncWithFacing({
        mediaTypes: mediaTypeForEntry(),
        cameraType: entryCameraFacing
      });
      if (!result.canceled && result.assets?.[0]) {
        applyPickedMediaToFlow([result.assets[0]]);
      }
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Camera failed.");
    }
  };

  const openFullScreenCamera = () => {
    setErrorText("");
    if (entryType === "live") {
      setCreateType("live");
      return;
    }
    if (Platform.OS === "web") {
      setFullScreenCameraOpen(true);
      return;
    }
    if (!isInAppCameraSupported()) {
      void openNativeCameraPicker();
      return;
    }
    setFullScreenCameraOpen(true);
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
      const gridIds = assets
        .map((a) => recentGridAssets.find((g) => g.uri === a.uri)?.id)
        .filter((id): id is string => !!id);
      if (gridIds.length === assets.length) setEntrySelectedIds(gridIds);
      else setEntrySelectedIds([]);
      if (!createType) return;
      setCreateType("post");
      setCreateStep("preview");
    }
  };

  const openEntryCamera = () => {
    void captureEntryShutter();
  };

  const captureEntryShutter = async () => {
    setErrorText("");
    if (entryType === "live") {
      setCreateType("live");
      return;
    }
    if (entryType === "reel") {
      openFullScreenCamera();
      return;
    }
    if (Platform.OS === "web") {
      openFullScreenCamera();
      return;
    }
    try {
      const photo = await entryCameraRef.current?.takePictureAsync({ quality: 0.9 });
      if (!photo?.uri) {
        setErrorText("Could not capture photo.");
        return;
      }
      applyPickedMediaToFlow([
        {
          uri: photo.uri,
          type: "image",
          width: photo.width ?? 0,
          height: photo.height ?? 0
        } as ImagePicker.ImagePickerAsset
      ]);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Photo capture failed.");
    }
  };

  const onCaptureGalleryAsset = (asset: GalleryGridAsset) => {
    if (entryType === "reel" && asset.mediaType !== "video") {
      setErrorText("Reels support video only.");
      return;
    }
    pickStoryFromGallery(asset);
  };

  const launchWebOrNativeImageLibrary = async () => {
    const allowMulti = entryType === "post";
    if (Platform.OS !== "web") {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setErrorText("Media library permission is required.");
        return;
      }
    }
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

  const openEntryGallery = async () => {
    setErrorText("");
    if (entryType === "live") {
      setCreateType("live");
      return;
    }
    // expo-media-library is native-only; web uses the browser file picker.
    if (Platform.OS === "web") {
      await launchWebOrNativeImageLibrary();
      return;
    }
    if (entryType === "story" || entryType === "reel") {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        setErrorText("Media library permission is required.");
        return;
      }
      setCaptureEntryView("gallery");
      void refreshGallery();
      return;
    }
    await launchWebOrNativeImageLibrary();
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
          ...(selectedAudioLabel ? { musicLabel: selectedAudioLabel } : {}),
          ...(storyIsImage ? { imageUrl: storyUrl } : { videoUrl: storyUrl })
        }, token ?? null);
      } else {
        if (!caption.trim()) {
          setErrorText("Caption is required.");
          setSubmitting(false);
          return;
        }
        const assets = [...pickedPostAssets];
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
        const resolvedLocation =
          postLocation.trim() || user?.locationLabel?.trim() || "Unknown";
        const taggedIds = taggedPeople.map((p) => p.id);
        if (videos.length === 1) {
          const v = videos[0];
          await validateVideoSize(v.uri, 80);
          let derivedThumb: string | undefined;
          if (!thumbnailUrl.trim()) {
            try {
              const thumb = await VideoThumbnails.getThumbnailAsync(v.uri, {
                time: 400,
                quality: 0.72
              });
              const { url } = await uploadImageFile(thumb.uri);
              derivedThumb = url;
            } catch {
              /* grid can fall back to muted video preview on device */
            }
          }
          const { url: mediaUrl } = await uploadPickedMedia(v.uri, v);
          const reelAudio =
            createType === "reel" && selectedAudioTrack
              ? {
                  musicLabel: `${selectedAudioTrack.title} · ${selectedAudioTrack.artist}`.slice(0, 240),
                  musicAudioUrl: selectedAudioTrack.previewUrl
                }
              : {};
          const reelCreative =
            createType === "reel" &&
            (creativeFilter !== "none" || creativeText.trim() || creativeTextBackground || creativeTextColor !== "white" || creativeFont !== "classic")
              ? {
                  creativeMeta: {
                    filter: creativeFilter,
                    overlayText: creativeText.trim(),
                    textColor: creativeTextColor,
                    textBackground: creativeTextBackground,
                    font: creativeFont
                  }
                }
              : {};
          await createHomePost({
            userId: user?.id,
            userName: user?.fullName?.trim() || "Farmer",
            location: resolvedLocation,
            caption: createType ? `[${createType.toUpperCase()}] ${caption.trim()}` : caption.trim(),
            videoUrl: mediaUrl,
            thumbnailUrl: thumbnailUrl.trim() || derivedThumb || undefined,
            ...(taggedIds.length ? { taggedUserIds: taggedIds } : {}),
            ...reelAudio,
            ...reelCreative
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
            userId: user?.id,
            userName: user?.fullName?.trim() || "Farmer",
            location: resolvedLocation,
            caption: createType ? `[${createType.toUpperCase()}] ${caption.trim()}` : caption.trim(),
            imageUrl: urls[0],
            imageUrls: urls,
            ...(taggedIds.length ? { taggedUserIds: taggedIds } : {})
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
      setPostLocation("");
      setTaggedPeople([]);
      onVideoPosted?.();
      onClose();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Failed to publish video.");
    } finally {
      setSubmitting(false);
    }
  };

  const previewWidth = Dimensions.get("window").width - 32;
  const selectedEntryAsset =
    recentGridAssets.find((a) => a.id === entrySelectedIds[0]) ??
    (pickedPostAssets[0]?.uri
      ? {
          id: "picked-preview",
          uri: pickedPostAssets[0].uri,
          mediaType: "image" as const,
          filename: pickedPostAssets[0].fileName
        }
      : null);
  const canProceedFromPostEntry = entrySelectedIds.length > 0 || pickedPostAssets.length > 0;

  const postGridData = React.useMemo(
    () => [{ id: CAMERA_GRID_ID, isCamera: true as const }, ...recentGridAssets],
    [recentGridAssets]
  );
  const selectedUri = createType === "story" ? pickedStoryVideoUri : pickedPostAssets[0]?.uri ?? "";
  const postFirst = pickedPostAssets[0];
  const isSelectedVideo =
    createType === "story"
      ? !shouldUseImageUpload(pickedStoryVideoUri, pickedStoryAsset ?? undefined)
      : pickedPostAssets.length === 1 && !!postFirst && !shouldUseImageUpload(postFirst.uri, postFirst);
  const canProceedFromPreview =
    (createType === "story" ? !!selectedUri : pickedPostAssets.length > 0) || createType === "live";
  const previewTitle = createType === "reel" ? "Reel" : createType === "post" ? "New Post" : createType === "story" ? "Story" : "Create";
  const audioTracksToShow = audioQuery.trim().length >= 2 ? audioSearchResults : AUDIO_TRACKS;
  const selectedAudioTrack =
    [...audioSearchResults, ...AUDIO_TRACKS].find((t) => t.id === selectedAudioTrackId) ?? null;
  const selectedAudioLabel = selectedAudioTrack ? `${selectedAudioTrack.title} - ${selectedAudioTrack.artist}` : "";

  const taggedSummary =
    taggedPeople.length === 0
      ? "Tag people"
      : taggedPeople.length === 1
      ? `Tagged: ${taggedPeople[0].name}`
      : `Tagged: ${taggedPeople[0].name} + ${taggedPeople.length - 1} more`;
  const locationSummary = postLocation.trim() ? `Location: ${postLocation.trim()}` : "Add location";
  const entryFacing = entryCameraFacing === ImagePicker.CameraType.front ? "front" : "back";
  const entryCameraActive =
    visible && captureEntryView === "camera" && (entryType === "story" || entryType === "reel");

  const composeOptions: Array<{
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    displayText: string;
    onPress: () => void;
  }> = [
    {
      icon: "musical-notes-outline",
      label: "Add audio",
      displayText: selectedAudioTrack ? `Audio: ${selectedAudioTrack.title}` : "Add audio",
      onPress: () => setShowAudioPanel(true)
    },
    {
      icon: "person-add-outline",
      label: "Tag people",
      displayText: taggedSummary,
      onPress: () => {
        setTagSearchQuery("");
        setShowTagPeoplePanel(true);
      }
    },
    {
      icon: "location-outline",
      label: "Add location",
      displayText: locationSummary,
      onPress: () => {
        setLocationDraft(postLocation);
        setShowLocationPanel(true);
      }
    },
    {
      icon: "people-outline",
      label: "Audience",
      displayText: "Audience",
      onPress: () => Alert.alert("Audience", "Audience controls coming soon.")
    }
  ];

  const filteredFollowable = followableUsers.filter((p) =>
    tagSearchQuery.trim()
      ? p.name.toLowerCase().includes(tagSearchQuery.trim().toLowerCase())
      : true
  );
  const isTagged = (id: number) => taggedPeople.some((p) => p.id === id);
  const toggleTagPerson = (p: TaggedPerson) =>
    setTaggedPeople((prev) => (prev.some((x) => x.id === p.id) ? prev.filter((x) => x.id !== p.id) : [...prev, p]));

  return (
    <>
    <Modal
      visible={visible}
      transparent={Platform.OS === "web" ? false : !createType || createType === "live"}
      animationType={createType && createType !== "live" ? "fade" : "slide"}
      onRequestClose={handleClose}
    >
      {visible && !createType ? (
        entryType === "post" ? (
          <View style={[styles.igPostEntryRoot, { paddingTop: insets.top + 4, paddingBottom: Math.max(insets.bottom, 10) }]}>
            <View style={styles.igPostEntryTop}>
              <Pressable style={styles.igPostEntryTopBtn} onPress={handleClose}>
                <Ionicons name="close" size={24} color="#fff" />
              </Pressable>
              <Text style={styles.igPostEntryTitle}>New Post</Text>
              <Pressable onPress={startPostFromEntry} disabled={!canProceedFromPostEntry}>
                <Text style={[styles.igPostEntryNext, !canProceedFromPostEntry ? styles.igPostEntryNextDisabled : null]}>Next</Text>
              </Pressable>
            </View>

            <Pressable
              style={styles.igPostEntryPreview}
              onPress={() => void openEntryGallery()}
              accessibilityRole="button"
              accessibilityLabel="Open photo gallery"
            >
              {selectedEntryAsset ? (
                <Image
                  source={{ uri: selectedEntryAsset.uri }}
                  style={styles.igPostEntryPreviewImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.igPostEntryPreviewFallback}>
                  <Ionicons name="images-outline" size={34} color="#fff" />
                  <Text style={styles.igPostEntryPreviewHint}>Tap to open gallery</Text>
                </View>
              )}
              <View style={styles.igPostGridOverlay} pointerEvents="none">
                <View style={styles.igPostGridLineH} />
                <View style={[styles.igPostGridLineH, { top: "66.666%" }]} />
                <View style={styles.igPostGridLineV} />
                <View style={[styles.igPostGridLineV, { left: "66.666%" }]} />
              </View>
            </Pressable>

            <View style={styles.igPostEntryRecentsRow}>
              <Pressable style={styles.igPostAlbumPicker} onPress={() => setShowAlbumPicker(true)}>
                <Text style={styles.igPostEntryRecentsText}>{selectedAlbumTitle}</Text>
                <Ionicons name="chevron-down" size={16} color="#f8fafc" />
              </Pressable>
              <Pressable
                style={[styles.igPostEntrySelectBtn, entryMultiSelect ? styles.igPostEntrySelectBtnOn : null]}
                onPress={() => setEntryMultiSelect((v) => !v)}
              >
                <Ionicons name="copy-outline" size={14} color="#fff" />
                <Text style={styles.igPostEntrySelectText}>Select</Text>
              </Pressable>
            </View>

            <FlatList
              data={postGridData}
              keyExtractor={(item) => ("isCamera" in item ? item.id : item.id)}
              numColumns={4}
              contentContainerStyle={styles.igPostEntryGrid}
              renderItem={({ item }) => {
                if ("isCamera" in item && item.isCamera) {
                  return (
                    <Pressable style={styles.igPostEntryCell} onPress={openEntryCamera}>
                      <View style={styles.igPostEntryCameraCell}>
                        <Ionicons name="camera" size={28} color="#fff" />
                      </View>
                    </Pressable>
                  );
                }
                const asset = item as GalleryGridAsset;
                return (
                  <Pressable style={styles.igPostEntryCell} onPress={() => onEntryPressAsset(asset)}>
                    <Image source={{ uri: asset.uri }} style={styles.igPostEntryCellImage} resizeMode="cover" />
                    {entrySelectedIds.includes(asset.id) ? (
                      <View style={styles.igPostEntrySelectedBadge}>
                        <Text style={styles.igPostEntrySelectedText}>{entrySelectedIds.indexOf(asset.id) + 1}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              }}
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
        ) : captureEntryView === "gallery" ? (
          <View
            style={[
              styles.igCaptureGalleryRoot,
              { paddingTop: insets.top + 4, paddingBottom: Math.max(insets.bottom, 10) }
            ]}
          >
            <View style={styles.igCaptureGalleryHeader}>
              <Pressable style={styles.igCamTopGhostBtn} onPress={() => setCaptureEntryView("camera")} hitSlop={10}>
                <Ionicons name="chevron-back" size={24} color="#fff" />
              </Pressable>
              <Pressable style={styles.igPostAlbumPicker} onPress={() => setShowAlbumPicker(true)}>
                <Text style={styles.igPostEntryRecentsText}>{selectedAlbumTitle}</Text>
                <Ionicons name="chevron-down" size={16} color="#f8fafc" />
              </Pressable>
              <View style={styles.igCaptureHeaderSpacer} />
            </View>

            <FlatList
              data={postGridData}
              keyExtractor={(item) => ("isCamera" in item ? item.id : item.id)}
              numColumns={4}
              contentContainerStyle={styles.igPostEntryGrid}
              renderItem={({ item }) => {
                if ("isCamera" in item && item.isCamera) {
                  return (
                    <Pressable style={styles.igPostEntryCell} onPress={() => setCaptureEntryView("camera")}>
                      <View style={styles.igPostEntryCameraCell}>
                        <Ionicons name="camera" size={28} color="#fff" />
                      </View>
                    </Pressable>
                  );
                }
                const asset = item as GalleryGridAsset;
                return (
                  <Pressable style={styles.igPostEntryCell} onPress={() => onCaptureGalleryAsset(asset)}>
                    <Image source={{ uri: asset.uri }} style={styles.igPostEntryCellImage} resizeMode="cover" />
                    {asset.mediaType === "video" ? (
                      <View style={styles.storyGalleryVideoBadge}>
                        <Ionicons name="play" size={10} color="#fff" />
                      </View>
                    ) : null}
                  </Pressable>
                );
              }}
            />

            {errorText ? <Text style={styles.igCamErrorBanner}>{errorText}</Text> : null}

            <View style={styles.igCamBottomModes}>
              {createModes.map((m) => (
                <Pressable
                  key={m.key}
                  style={[styles.igCamModeItem, entryType === m.key ? styles.igCamModeItemOn : null]}
                  onPress={() => setEntryType(m.key)}
                >
                  <Text style={[styles.igCamModeItemText, entryType === m.key ? styles.igCamModeItemTextOn : null]}>
                    {m.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <View style={[styles.igCaptureCameraRoot, Platform.OS === "web" ? styles.igCameraEntryRootWeb : null]}>
            {entryType === "live" ? (
              <View style={styles.igCaptureLiveFallback}>
                <Ionicons name="radio-outline" size={48} color="#d8ff37" />
                <Text style={styles.igCaptureLiveText}>Go live from here</Text>
              </View>
            ) : (
              <StoryCameraPreview
                ref={entryCameraRef}
                active={entryCameraActive}
                facing={entryFacing}
                mode={entryType === "reel" ? "video" : "picture"}
                onPress={openFullScreenCamera}
              />
            )}

            <View
              style={[
                styles.igCaptureOverlay,
                { paddingTop: insets.top + 6, paddingBottom: Math.max(insets.bottom, 12) }
              ]}
              pointerEvents="box-none"
            >
              <View style={styles.igCaptureTopRow} pointerEvents="box-none">
                <Pressable style={styles.igCamTopGhostBtn} onPress={handleClose} hitSlop={10}>
                  <Ionicons name="close" size={26} color="#fff" />
                </Pressable>
                <View style={styles.igCaptureTopCenterTools} pointerEvents="box-none">
                  <Pressable style={styles.igCamRoundControl} onPress={() => setEntryFlashOn((v) => !v)}>
                    <Ionicons name={entryFlashOn ? "flash" : "flash-outline"} size={18} color="#b7ff37" />
                  </Pressable>
                  <Pressable
                    style={styles.igCamRoundControl}
                    onPress={() => setEntryZoomLabel((z) => (z === "1x" ? "2x" : "1x"))}
                  >
                    <Text style={styles.igCamZoomText}>{entryZoomLabel}</Text>
                  </Pressable>
                </View>
                <View style={styles.igCaptureHeaderSpacer} />
              </View>

              <View style={{ flex: 1 }} pointerEvents="none" />

              {errorText ? (
                <Text style={[styles.igCamErrorBanner, styles.igCaptureError]} pointerEvents="none">
                  {errorText}
                </Text>
              ) : null}

              <View style={styles.igCamCaptureRow} pointerEvents="box-none">
                <Pressable style={styles.igCamGalleryThumb} onPress={openEntryGallery}>
                  {recentGridAssets[0] ? (
                    <Image
                      source={{ uri: recentGridAssets[0].uri }}
                      style={styles.igCamGalleryThumbImg}
                      resizeMode="cover"
                    />
                  ) : (
                    <Ionicons name="images-outline" size={22} color="#b7ff37" />
                  )}
                </Pressable>
                <View style={styles.igCamCaptureRowSpacer} />
                <Pressable style={styles.igCamCaptureOuter} onPress={openEntryCamera}>
                  <View style={styles.igCamCaptureInner} />
                </Pressable>
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

              <View style={styles.igCamBottomModes} pointerEvents="box-none">
                {createModes.map((m) => (
                  <Pressable
                    key={m.key}
                    style={[styles.igCamModeItem, entryType === m.key ? styles.igCamModeItemOn : null]}
                    onPress={() => setEntryType(m.key)}
                  >
                    <Text
                      style={[
                        styles.igCamModeItemText,
                        entryType === m.key ? styles.igCamModeItemTextOn : null,
                        m.key === "story" && entryType === m.key ? styles.igCamModeItemTextHero : null
                      ]}
                    >
                      {m.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
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
                      musicLabel={selectedAudioLabel}
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
                      musicLabel={selectedAudioLabel}
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
                        musicLabel={selectedAudioLabel}
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
                    musicLabel={selectedAudioLabel}
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
                    musicLabel={selectedAudioLabel}
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
                    { id: "audio", label: "Audio", icon: "musical-note-outline" as const, onPress: () => setShowAudioPanel(true) },
                    {
                      id: "text",
                      label: "Text",
                      icon: "text-outline" as const,
                      onPress: () => openCreativePanel("text")
                    },
                    {
                      id: "overlay",
                      label: "Overlay",
                      icon: "images-outline" as const,
                      onPress: () => openCreativePanel("overlay")
                    },
                    {
                      id: "filter",
                      label: "Filter",
                      icon: "color-filter-outline" as const,
                      onPress: () => openCreativePanel("filter")
                    },
                    {
                      id: "edit",
                      label: "Edit",
                      icon: "options-outline" as const,
                      onPress: () => setShowEditPanel(true)
                    }
                  ].map((tool) => (
                    <Pressable key={tool.id} style={styles.igPostToolPill} onPress={tool.onPress}>
                      <Ionicons name={tool.icon} size={16} color="#f5f7fa" />
                      <Text style={styles.igPostToolText}>{tool.label}</Text>
                    </Pressable>
                  ))}
                </View>
                {createType === "post" ? (
                  <View style={styles.igPostNextRow}>
                    <Pressable
                      onPress={() => {
                        void proceedToCompose();
                      }}
                      disabled={!canProceedFromPreview || isSubmitting}
                      style={[styles.igPostNextBtn, !canProceedFromPreview ? styles.igPostNextBtnDisabled : null]}
                    >
                      <Text style={styles.igPostNextText}>Continue</Text>
                      <Ionicons name="arrow-forward" size={16} color="#111" />
                    </Pressable>
                  </View>
                ) : null}
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
                <Ionicons name="arrow-back" size={24} color="#d8ff37" />
              </Pressable>
              <Text style={styles.igComposeTitle}>New {createType === "reel" ? "Reel" : "Post"}</Text>
              <Pressable onPress={submitPostVideo} disabled={isSubmitting}>
                {isSubmitting ? <ActivityIndicator size="small" color="#d8ff37" /> : <Text style={styles.igComposeShare}>Share</Text>}
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
                {createType === "post" || createType === "reel" ? (
                  <View style={styles.igComposeOptions}>
                    {composeOptions.map(({ icon, label, onPress, displayText }) => (
                      <Pressable key={label} style={styles.igComposeOptionRow} onPress={onPress}>
                        <View style={styles.igComposeOptionLeft}>
                          <Ionicons name={icon as any} size={18} color="#d8ff37" />
                          <Text style={styles.igComposeOptionText} numberOfLines={1}>
                            {displayText}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={17} color="#97a0a8" />
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={styles.igComposeMediaRow}>
                <View style={styles.igComposeCaptionRow}>
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
                {createType === "post" || createType === "reel" ? (
                  <View style={styles.igComposeOptionsInline}>
                    {composeOptions.map(({ icon, label, onPress, displayText }) => (
                      <Pressable key={label} style={styles.igComposeOptionRow} onPress={onPress}>
                        <View style={styles.igComposeOptionLeft}>
                          <Ionicons name={icon as any} size={18} color="#d8ff37" />
                          <Text style={styles.igComposeOptionText} numberOfLines={1}>
                            {displayText}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={17} color="#97a0a8" />
                      </Pressable>
                    ))}
                  </View>
                ) : null}
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

    <Modal visible={showEditPanel} transparent animationType="fade" onRequestClose={() => setShowEditPanel(false)}>
      <Pressable style={styles.creativePanelBackdrop} onPress={() => setShowEditPanel(false)}>
        <Pressable style={styles.editPanelCard} onPress={(e) => e.stopPropagation?.()}>
          <View style={styles.editPanelHandle} />
          <Text style={styles.editPanelTitle}>Edit</Text>
          <Pressable
            style={styles.editPanelRow}
            onPress={() => {
              openCreativePanel("text");
            }}
          >
            <View style={styles.editPanelRowLeft}>
              <Ionicons name="text-outline" size={18} color="#111" />
              <Text style={styles.editPanelRowText}>Text</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#7f8b88" />
          </Pressable>
          <Pressable
            style={styles.editPanelRow}
            onPress={() => {
              openCreativePanel("filter");
            }}
          >
            <View style={styles.editPanelRowLeft}>
              <Ionicons name="color-filter-outline" size={18} color="#111" />
              <Text style={styles.editPanelRowText}>Filter</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#7f8b88" />
          </Pressable>
          <Pressable
            style={styles.editPanelRow}
            onPress={() => {
              openCreativePanel("overlay");
            }}
          >
            <View style={styles.editPanelRowLeft}>
              <Ionicons name="images-outline" size={18} color="#111" />
              <Text style={styles.editPanelRowText}>Overlay</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#7f8b88" />
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>

    <Modal
      visible={showAudioPanel}
      transparent
      animationType="fade"
      onRequestClose={() => {
        setShowAudioPanel(false);
        void stopAudioPreview();
      }}
    >
      <Pressable
        style={styles.creativePanelBackdrop}
        onPress={() => {
          setShowAudioPanel(false);
          void stopAudioPreview();
        }}
      >
        <Pressable style={styles.creativePanelCard} onPress={(e) => e.stopPropagation?.()}>
          <Text style={styles.creativePanelTitle}>Add audio</Text>
          <Text style={styles.creativePanelHint}>Select a music track for your story or reel.</Text>
          <TextInput
            value={audioQuery}
            onChangeText={setAudioQuery}
            style={styles.audioSearchInput}
            placeholder="Search any song..."
            placeholderTextColor="#8b9793"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {audioSearchLoading ? (
            <View style={styles.audioSearchStateRow}>
              <ActivityIndicator size="small" color="#0a9f46" />
              <Text style={styles.audioSearchStateText}>Searching songs...</Text>
            </View>
          ) : null}
          {audioSearchError ? <Text style={styles.audioSearchErrorText}>{audioSearchError}</Text> : null}
          <View style={styles.audioTrackList}>
            {audioTracksToShow.map((track) => {
              const selected = selectedAudioTrackId === track.id;
              const playing = audioPreviewTrackId === track.id;
              return (
                <Pressable
                  key={track.id}
                  style={[styles.audioTrackRow, selected ? styles.audioTrackRowSelected : null]}
                  onPress={() => setSelectedAudioTrackId(track.id)}
                >
                  <View style={styles.audioTrackMeta}>
                    <Text style={styles.audioTrackTitle}>{track.title}</Text>
                    <Text style={styles.audioTrackArtist}>{track.artist}</Text>
                  </View>
                  <Pressable
                    style={styles.audioTrackPlayBtn}
                    onPress={() => {
                      void previewAudioTrack(track);
                    }}
                  >
                    <Ionicons name={playing ? "pause" : "play"} size={16} color="#111" />
                  </Pressable>
                </Pressable>
              );
            })}
            {!audioSearchLoading && audioQuery.trim().length >= 2 && !audioTracksToShow.length ? (
              <Text style={styles.audioSearchStateText}>No playable preview found for this search.</Text>
            ) : null}
          </View>
          <View style={styles.audioActionsRow}>
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => {
                setSelectedAudioTrackId(null);
                void stopAudioPreview();
              }}
            >
              <Text style={styles.secondaryBtnText}>Remove</Text>
            </Pressable>
            <Pressable
              style={styles.audioDoneBtn}
              onPress={() => {
                setShowAudioPanel(false);
                void stopAudioPreview();
              }}
            >
              <Text style={styles.primaryBtnText}>Done</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>

    <Modal visible={showLocationPanel} transparent animationType="fade" onRequestClose={() => setShowLocationPanel(false)}>
      <Pressable style={styles.creativePanelBackdrop} onPress={() => setShowLocationPanel(false)}>
        <Pressable style={styles.creativePanelCard} onPress={(e) => e.stopPropagation?.()}>
          <Text style={styles.creativePanelTitle}>Add location</Text>
          <Text style={styles.creativePanelHint}>Where was this taken?</Text>
          <TextInput
            value={locationDraft}
            onChangeText={setLocationDraft}
            placeholder="e.g. Krishna, Andhra Pradesh"
            placeholderTextColor="#8b9793"
            style={styles.creativePanelInput}
            autoFocus
            maxLength={120}
          />
          <View style={styles.audioActionsRow}>
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => {
                setLocationDraft("");
                setPostLocation("");
                setShowLocationPanel(false);
              }}
            >
              <Text style={styles.secondaryBtnText}>Remove</Text>
            </Pressable>
            <Pressable
              style={styles.audioDoneBtn}
              onPress={() => {
                setPostLocation(locationDraft.trim());
                setShowLocationPanel(false);
              }}
            >
              <Text style={styles.primaryBtnText}>Save</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>

    <Modal visible={showTagPeoplePanel} transparent animationType="fade" onRequestClose={() => setShowTagPeoplePanel(false)}>
      <Pressable style={styles.creativePanelBackdrop} onPress={() => setShowTagPeoplePanel(false)}>
        <Pressable style={styles.creativePanelCard} onPress={(e) => e.stopPropagation?.()}>
          <Text style={styles.creativePanelTitle}>Tag people</Text>
          <Text style={styles.creativePanelHint}>Select friends to tag in this post.</Text>
          <TextInput
            value={tagSearchQuery}
            onChangeText={setTagSearchQuery}
            placeholder="Search by name…"
            placeholderTextColor="#8b9793"
            style={styles.audioSearchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {followableLoading ? (
            <View style={styles.audioSearchStateRow}>
              <ActivityIndicator size="small" color="#0a9f46" />
              <Text style={styles.audioSearchStateText}>Loading people…</Text>
            </View>
          ) : null}
          {!followableLoading && filteredFollowable.length === 0 ? (
            <Text style={styles.audioSearchStateText}>
              {followableUsers.length === 0
                ? "Follow some users first to tag them in posts."
                : "No people match your search."}
            </Text>
          ) : null}
          <ScrollView style={styles.tagPeopleList} contentContainerStyle={{ gap: 8 }}>
            {filteredFollowable.map((person) => {
              const selected = isTagged(person.id);
              return (
                <Pressable
                  key={person.id}
                  style={[styles.audioTrackRow, selected ? styles.audioTrackRowSelected : null]}
                  onPress={() => toggleTagPerson(person)}
                >
                  <View style={styles.audioTrackMeta}>
                    <Text style={styles.audioTrackTitle}>{person.name}</Text>
                    <Text style={styles.audioTrackArtist}>Tap to {selected ? "untag" : "tag"}</Text>
                  </View>
                  <View
                    style={[
                      styles.audioTrackPlayBtn,
                      { backgroundColor: selected ? "#0a9f46" : "#d8ff37" }
                    ]}
                  >
                    <Ionicons name={selected ? "checkmark" : "add"} size={16} color={selected ? "#fff" : "#111"} />
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.audioActionsRow}>
            <Pressable style={styles.secondaryBtn} onPress={() => setTaggedPeople([])}>
              <Text style={styles.secondaryBtnText}>Clear</Text>
            </Pressable>
            <Pressable style={styles.audioDoneBtn} onPress={() => setShowTagPeoplePanel(false)}>
              <Text style={styles.primaryBtnText}>Done</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>

    <Modal visible={showAlbumPicker} transparent animationType="fade" onRequestClose={() => setShowAlbumPicker(false)}>
      <Pressable style={styles.albumPickerBackdrop} onPress={() => setShowAlbumPicker(false)}>
        <Pressable style={styles.albumPickerSheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.albumPickerTitle}>Albums</Text>
          <ScrollView style={styles.albumPickerList}>
            {galleryAlbums.map((album) => {
              const selected = (selectedAlbumId ?? recentsAlbumId()) === album.id;
              return (
                <Pressable
                  key={album.id || "recents"}
                  style={[styles.albumPickerRow, selected ? styles.albumPickerRowOn : null]}
                  onPress={() => {
                    setSelectedAlbumId(album.id === recentsAlbumId() ? null : album.id);
                    setShowAlbumPicker(false);
                  }}
                >
                  <Text style={[styles.albumPickerRowText, selected ? styles.albumPickerRowTextOn : null]}>
                    {album.title}
                  </Text>
                  {album.assetCount > 0 ? (
                    <Text style={styles.albumPickerRowCount}>{album.assetCount}</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>

    {Platform.OS === "web" ? (
      <WebCameraCapture
        visible={fullScreenCameraOpen}
        onClose={() => setFullScreenCameraOpen(false)}
        onCapture={(asset) => {
          setFullScreenCameraOpen(false);
          applyPickedMediaToFlow([asset]);
        }}
        initialFacing={entryCameraFacing === ImagePicker.CameraType.front ? "front" : "back"}
        allowVideo={entryType !== "post"}
      />
    ) : fullScreenCameraOpen ? (
      <InAppCameraCapture
        visible
        onClose={() => setFullScreenCameraOpen(false)}
        onUnavailable={() => {
          setFullScreenCameraOpen(false);
          void openNativeCameraPicker();
        }}
        onCapture={(asset) => {
          setFullScreenCameraOpen(false);
          applyPickedMediaToFlow([asset]);
        }}
        initialFacing={entryCameraFacing === ImagePicker.CameraType.front ? "front" : "back"}
        mode={cameraCaptureMode()}
      />
    ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  igPostEntryRoot: {
    flex: 1,
    backgroundColor: "#1f1f1f"
  },
  igPostEntryTop: {
    height: 48,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  igPostEntryTopBtn: { width: 32, alignItems: "flex-start", justifyContent: "center" },
  igPostEntryTitle: { color: "#f8fafc", fontWeight: "900", fontSize: 15 },
  igPostEntryNext: { color: "#d8ff37", fontWeight: "900", fontSize: 14 },
  igPostEntryNextDisabled: { opacity: 0.45 },
  igPostEntryPreview: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#111418",
    position: "relative"
  },
  igPostEntryPreviewImage: { width: "100%", height: "100%" },
  igPostEntryPreviewFallback: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  igPostEntryPreviewHint: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: "600" },
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
  igPostAlbumPicker: { flexDirection: "row", alignItems: "center", gap: 4 },
  igPostEntryRecentsText: { color: "#f8fafc", fontSize: 14, fontWeight: "900" },
  igPostEntryCameraCell: {
    flex: 1,
    backgroundColor: "#111418",
    alignItems: "center",
    justifyContent: "center"
  },
  albumPickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    paddingHorizontal: 24
  },
  albumPickerSheet: {
    backgroundColor: "#1a1f24",
    borderRadius: 16,
    maxHeight: "70%",
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#303842"
  },
  albumPickerTitle: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "900",
    paddingHorizontal: 16,
    paddingBottom: 10
  },
  albumPickerList: { maxHeight: 360 },
  albumPickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#303842"
  },
  albumPickerRowOn: { backgroundColor: "rgba(216,255,55,0.12)" },
  albumPickerRowText: { color: "#e8edf2", fontSize: 15, fontWeight: "700", flex: 1 },
  albumPickerRowTextOn: { color: "#d8ff37" },
  albumPickerRowCount: { color: "#8b98a8", fontSize: 13, fontWeight: "600" },
  storyGalleryStrip: { marginTop: 8, maxHeight: 72 },
  storyGalleryStripContent: { paddingHorizontal: 10, gap: 8, alignItems: "center" },
  storyGalleryAllBtn: {
    width: 56,
    height: 56,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#d8ff37",
    backgroundColor: "#111418",
    alignItems: "center",
    justifyContent: "center"
  },
  storyGalleryThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#111418"
  },
  storyGalleryThumbImg: { width: "100%", height: "100%" },
  storyGalleryVideoBadge: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center"
  },
  igPostEntrySelectBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#111418",
    borderWidth: 1,
    borderColor: "#303842"
  },
  igPostEntrySelectBtnOn: { backgroundColor: "rgba(216,255,55,0.16)", borderColor: "#d8ff37" },
  igPostEntrySelectText: { color: "#f8fafc", fontWeight: "700", fontSize: 12 },
  igPostEntryGrid: { paddingBottom: 8 },
  igPostEntryCell: {
    width: "25%",
    aspectRatio: 1,
    borderWidth: 0.5,
    borderColor: "#252a31",
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
    backgroundColor: "#d8ff37",
    alignItems: "center",
    justifyContent: "center"
  },
  igPostEntrySelectedText: { color: "#111", fontSize: 12, fontWeight: "900" },
  igPostEntryModes: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: "#303842"
  },
  igPostEntryModeItem: { paddingHorizontal: 2, paddingVertical: 6 },
  igPostEntryModeText: { color: "rgba(255,255,255,0.55)", fontWeight: "800", fontSize: 11, letterSpacing: 0.8 },
  igPostEntryModeTextOn: { color: "#d8ff37" },
  igCaptureCameraRoot: {
    flex: 1,
    backgroundColor: "#000"
  },
  igCaptureOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between"
  },
  igCaptureTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12
  },
  igCaptureTopCenterTools: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  igCaptureHeaderSpacer: { width: 38 },
  igCaptureError: { marginHorizontal: 16, marginBottom: 8 },
  igCaptureLiveFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1a1a1a",
    gap: 12
  },
  igCaptureLiveText: { color: "#e8e8e8", fontSize: 16, fontWeight: "700" },
  igCaptureGalleryRoot: {
    flex: 1,
    backgroundColor: "#0d0f12"
  },
  igCaptureGalleryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 10
  },
  igCameraEntryRoot: {
    flex: 1,
    backgroundColor: "#1f1f1f",
    paddingHorizontal: 8
  },
  igCameraEntryRootWeb: {
    minHeight: "100vh",
    width: "100%"
  },
  igCamTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginBottom: 8
  },
  igCamTopGhostBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.28)",
    alignItems: "center",
    justifyContent: "center"
  },
  igCamTopTitle: { color: "#f8fafc", fontSize: 16, fontWeight: "800" },
  igCamTopShare: { color: "#d8ff37", fontSize: 14, fontWeight: "900" },
  igCamTopCenter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 10
  },
  igCamRoundControl: {
    minWidth: 40,
    height: 40,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: "#111418",
    borderWidth: 1,
    borderColor: "#303842",
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
    backgroundColor: "#111418",
    borderWidth: 1,
    borderColor: "#303842",
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
    marginTop: 2,
    minHeight: 280
  },
  igCamLeftRail: {
    width: 80,
    justifyContent: "flex-start",
    gap: 16,
    paddingRight: 4,
    paddingTop: 12,
    zIndex: 2
  },
  igCamRailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  igCamRailIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.38)",
    alignItems: "center",
    justifyContent: "center"
  },
  igCamRailLabel: {
    color: "#d8ff37",
    fontSize: 11,
    fontWeight: "800",
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    flex: 1
  },
  igCamRailAa: { color: "#d8ff37", fontSize: 14, fontWeight: "900" },
  igCamViewfinder: {
    flex: 1,
    marginLeft: -4,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#232323",
    borderWidth: 1,
    borderColor: "#2f2f2f"
  },
  igCamViewfinderMedia: {
    width: "100%",
    height: "100%"
  },
  igCamViewfinderFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2e2e2e",
    gap: 8
  },
  igCamViewfinderHint: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    fontWeight: "600"
  },
  igCamViewfinderShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.2)"
  },
  igCamGuideFrame: {
    ...StyleSheet.absoluteFillObject,
    margin: 22,
    borderRadius: 12
  },
  igCamGuideCornerTL: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 18,
    height: 18,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: "rgba(216,255,55,0.95)"
  },
  igCamGuideCornerTR: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 18,
    height: 18,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: "rgba(216,255,55,0.95)"
  },
  igCamGuideCornerBL: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: 18,
    height: 18,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderColor: "rgba(216,255,55,0.95)"
  },
  igCamGuideCornerBR: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: "rgba(216,255,55,0.95)"
  },
  igCamErrorBanner: {
    color: "#7f1d1d",
    backgroundColor: "#111418",
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
    backgroundColor: "#111418",
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
    backgroundColor: "#303030"
  },
  igCamAuxDots: {
    justifyContent: "center",
    gap: 10
  },
  igCamAuxDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#303030"
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
    backgroundColor: "rgba(216,255,55,0.16)"
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
  igFullScreen: { flex: 1, backgroundColor: "#1f1f1f", justifyContent: "space-between", paddingTop: 48, paddingBottom: 14, paddingHorizontal: 16 },
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
  editPanelCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: "#e5ece8"
  },
  editPanelHandle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#d6dedb",
    marginBottom: 10
  },
  editPanelTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1b2422",
    marginBottom: 10
  },
  editPanelRow: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5ece8",
    backgroundColor: "#f8faf9",
    paddingHorizontal: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  editPanelRowLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  editPanelRowText: { color: "#1b2422", fontSize: 14, fontWeight: "800" },
  audioSearchInput: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#dbe6e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#1b2422",
    fontSize: 14,
    backgroundColor: "#f8faf9",
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as const) : null)
  },
  audioSearchStateRow: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  audioSearchStateText: { marginTop: 10, color: "#62706c", fontSize: 12, fontWeight: "600" },
  audioSearchErrorText: { marginTop: 8, color: "#b91c1c", fontSize: 12, fontWeight: "700" },
  audioTrackList: { marginTop: 8, gap: 10 },
  tagPeopleList: { marginTop: 10, maxHeight: 260 },
  audioTrackRow: {
    minHeight: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbe6e1",
    backgroundColor: "#f8faf9",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  audioTrackRowSelected: { borderColor: "#0a9f46", backgroundColor: "#e8f7ef" },
  audioTrackMeta: { flex: 1, paddingRight: 10 },
  audioTrackTitle: { color: "#1b2422", fontSize: 14, fontWeight: "800" },
  audioTrackArtist: { color: "#62706c", fontSize: 12, marginTop: 2 },
  audioTrackPlayBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#d8ff37",
    alignItems: "center",
    justifyContent: "center"
  },
  audioActionsRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  audioDoneBtn: {
    flex: 1,
    backgroundColor: "#0a9f46",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10
  },
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
  igPreviewTitle: { color: "#f8fafc", fontWeight: "900", fontSize: 15 },
  igPreviewAction: { color: "#d8ff37", fontWeight: "900", fontSize: 14 },
  igPreviewActionDisabled: { color: "rgba(216,255,55,0.45)" },
  igMediaPreviewWrap: { flex: 1, borderRadius: 12, overflow: "hidden", backgroundColor: "#111418", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#303842" },
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
    backgroundColor: "#111418",
    borderWidth: 1,
    borderColor: "#303842",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10
  },
  igPostToolText: { marginTop: 4, color: "#f5f7fa", fontSize: 10, fontWeight: "700" },
  igPostNextRow: {
    marginTop: 16,
    alignItems: "flex-end"
  },
  igPostNextBtn: {
    minWidth: 132,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#d8ff37",
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  igPostNextBtnDisabled: { opacity: 0.5 },
  igPostNextText: { color: "#111", fontWeight: "900", fontSize: 15 },
  igComposeTopBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, paddingHorizontal: 8, backgroundColor: "#1f1f1f", borderBottomWidth: 1, borderBottomColor: "#303842" },
  igComposeTitle: { color: "#f8fafc", fontWeight: "900", fontSize: 15 },
  igComposeShare: { color: "#d8ff37", fontWeight: "900", fontSize: 14 },
  igComposeMediaRow: { backgroundColor: "#1f1f1f", padding: 12, gap: 12, borderTopWidth: 1, borderTopColor: "#303842" },
  igComposeCaptionRow: { flexDirection: "row", gap: 10 },
  igComposeThumb: { width: 88, height: 118, borderRadius: 8, backgroundColor: "#111418" },
  igComposeThumbStripInner: { flexDirection: "row", gap: 6, paddingRight: 6, alignItems: "center" },
  igComposeThumbSmall: { width: 62, height: 62, borderRadius: 8, backgroundColor: "#111418" },
  igComposeCaptionInput: { flex: 1, minHeight: 118, textAlignVertical: "top", color: "#f8fafc", fontWeight: "600" },
  igComposeOptions: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#303842"
  },
  igComposeOptionsInline: {
    borderTopWidth: 1,
    borderTopColor: "#303842"
  },
  igComposeOptionRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#303842"
  },
  igComposeOptionLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  igComposeOptionText: { color: "#f8fafc", fontSize: 13, fontWeight: "800" },
  igComposeBody: {
    flex: 1,
    backgroundColor: "#1f1f1f",
    borderTopWidth: 1,
    borderTopColor: "#303842",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 16,
    minHeight: 200
  },
  igComposeSectionLabel: { color: "#97a0a8", fontSize: 12, fontWeight: "800", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.6 },
  igComposeCaptionInputFull: {
    width: "100%",
    minHeight: 120,
    maxHeight: 220,
    textAlignVertical: "top",
    color: "#f8fafc",
    fontSize: 16,
    lineHeight: 22,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#111418",
    borderWidth: 1,
    borderColor: "#303842",
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
