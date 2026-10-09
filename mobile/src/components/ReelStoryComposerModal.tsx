import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ContainedAppVideo } from "./ContainedAppVideo";
import { StickerSizeBar, StorySticker, StoryTextLabel } from "./StoryTextOverlay";
import { DraggableOverlay, OverlayTrashZone, type OverlayPoint } from "./DraggableOverlay";
import { AppEmojiPicker } from "./AppEmojiPicker";
import type { HomePost, StoryCreativeMeta, StorySticker as StoryStickerItem } from "../services/api";
import { APP_LIME } from "../theme/appColors";
import { useLanguage } from "../localization/LanguageContext";

const TEXT_COLORS = ["#ffffff", "#111111", APP_LIME, "#ff3b30", "#ffcc00", "#34c759", "#0a84ff", "#ff2d55"];
const DEFAULT_TEXT_POINT: OverlayPoint = { x: 0.5, y: 0.5 };

type Props = {
  post: HomePost | null;
  onClose: () => void;
  onShare: (post: HomePost, meta: StoryCreativeMeta) => Promise<void>;
};

/** Preview + light edits (text, fit/crop) before a reel or post is added to the story. */
export function ReelStoryComposerModal({ post, onClose, onShare }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [text, setText] = useState("");
  const [editingText, setEditingText] = useState(false);
  const [textColor, setTextColor] = useState("#ffffff");
  const [textBackground, setTextBackground] = useState(false);
  const [textPoint, setTextPoint] = useState<OverlayPoint>(DEFAULT_TEXT_POINT);
  const [stickers, setStickers] = useState<StoryStickerItem[]>([]);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const [dragState, setDragState] = useState({ active: false, overTrash: false });
  const [fit, setFit] = useState<"contain" | "cover">("contain");
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!post) return;
    setText("");
    setEditingText(false);
    setTextColor("#ffffff");
    setTextBackground(false);
    setTextPoint(DEFAULT_TEXT_POINT);
    setStickers([]);
    setSelectedStickerId(null);
    setDragState({ active: false, overTrash: false });
    setFit("contain");
    setSharing(false);
  }, [post?.id]);

  if (!post) return null;

  const videoUrl = String(post.videoUrl || "").trim();
  const imageUrl = String(post.imageUrl || post.imageUrls?.[0] || "").trim();
  const meta: StoryCreativeMeta = {
    text: text.trim(),
    textColor,
    textBackground,
    textX: textPoint.x,
    textY: textPoint.y,
    stickers,
    fit,
    sourcePostId: post.id
  };
  const onDragActiveChange = (active: boolean, overTrash: boolean) =>
    setDragState((prev) => (prev.active === active && prev.overTrash === overTrash ? prev : { active, overTrash }));
  const selectedSticker = stickers.find((s) => s.id === selectedStickerId) ?? null;

  const share = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      await onShare(post, meta);
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={styles.previewArea}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setFrame({ width: Math.round(width), height: Math.round(height) });
          }}
        >
          {frame.width > 0 && videoUrl ? (
            <ContainedAppVideo
              uri={videoUrl}
              hlsUrl={post.hlsUrl}
              playbackUrl={post.playbackUrl}
              shouldPlay={!sharing}
              containerWidth={frame.width}
              containerHeight={frame.height}
              fit={fit}
              isLooping
              isMuted
            />
          ) : frame.width > 0 && imageUrl ? (
            <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} resizeMode={fit} />
          ) : null}

          {editingText ? (
            <View style={[StyleSheet.absoluteFill, styles.textEditor]}>
              <TextInput
                value={text}
                onChangeText={setText}
                autoFocus
                multiline
                maxLength={220}
                placeholder="Type something…"
                placeholderTextColor="rgba(255,255,255,0.6)"
                style={[
                  styles.textInput,
                  { color: textBackground && textColor === "#ffffff" ? "#111111" : textColor },
                  textBackground ? styles.textInputBg : null
                ]}
              />
            </View>
          ) : frame.width > 0 ? (
            <>
              {meta.text ? (
                <DraggableOverlay
                  position={textPoint}
                  containerWidth={frame.width}
                  containerHeight={frame.height}
                  onMove={setTextPoint}
                  onPress={() => setEditingText(true)}
                  onRemove={() => {
                    setText("");
                    setTextPoint(DEFAULT_TEXT_POINT);
                  }}
                  onDragActiveChange={onDragActiveChange}
                >
                  <StoryTextLabel meta={meta} text={meta.text} />
                </DraggableOverlay>
              ) : null}
              {stickers.map((s) => (
                <DraggableOverlay
                  key={s.id}
                  position={{ x: s.x, y: s.y }}
                  containerWidth={frame.width}
                  containerHeight={frame.height}
                  onMove={(p) => setStickers((prev) => prev.map((row) => (row.id === s.id ? { ...row, ...p } : row)))}
                  onPress={() => setSelectedStickerId(s.id)}
                  onRemove={() => {
                    setStickers((prev) => prev.filter((row) => row.id !== s.id));
                    setSelectedStickerId((cur) => (cur === s.id ? null : cur));
                  }}
                  onDragActiveChange={onDragActiveChange}
                >
                  <StorySticker emoji={s.emoji} scale={s.scale} />
                </DraggableOverlay>
              ))}
              <OverlayTrashZone visible={dragState.active} active={dragState.overTrash} />
            </>
          ) : null}
        </View>

        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) + 4 }]}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
            <Ionicons name="close" size={30} color="#fff" />
          </Pressable>
          <View style={styles.topTools}>
            {editingText ? (
              <Pressable style={styles.doneBtn} onPress={() => setEditingText(false)}>
                <Text style={styles.doneText}>Done</Text>
              </Pressable>
            ) : (
              <>
                <Pressable style={styles.toolBtn} onPress={() => setEditingText(true)} accessibilityLabel="Add text">
                  <Text style={styles.toolAa}>Aa</Text>
                </Pressable>
                <Pressable style={styles.toolBtn} onPress={() => setStickerPickerOpen(true)} accessibilityLabel="Add sticker">
                  <Ionicons name="happy-outline" size={22} color="#fff" />
                </Pressable>
                <Pressable
                  style={[styles.toolBtn, fit === "cover" ? styles.toolBtnActive : null]}
                  onPress={() => setFit((f) => (f === "cover" ? "contain" : "cover"))}
                  accessibilityLabel={fit === "cover" ? "Show full reel" : "Crop to fill"}
                >
                  <Ionicons name={fit === "cover" ? "contract-outline" : "crop-outline"} size={22} color={fit === "cover" ? "#111" : "#fff"} />
                </Pressable>
              </>
            )}
          </View>
        </View>

        {editingText ? (
          <View style={styles.textTools}>
            <View style={styles.textToolRow}>
              <Pressable
                style={[styles.chip, textBackground ? styles.chipActive : null]}
                onPress={() => setTextBackground((v) => !v)}
              >
                <Text style={[styles.chipText, textBackground ? styles.chipTextActive : null]}>A</Text>
              </Pressable>
              <Text style={styles.dragHint}>Tap Done, then drag the text anywhere</Text>
            </View>
            <View style={styles.textToolRow}>
              {TEXT_COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setTextColor(c)}
                  style={[styles.swatch, { backgroundColor: c }, textColor === c ? styles.swatchActive : null]}
                  accessibilityLabel={`Text colour ${c}`}
                />
              ))}
            </View>
          </View>
        ) : (
          <View style={{ backgroundColor: "#000" }}>
            {selectedSticker ? (
              <StickerSizeBar
                emoji={selectedSticker.emoji}
                scale={selectedSticker.scale}
                onChange={(scale) =>
                  setStickers((prev) => prev.map((row) => (row.id === selectedSticker.id ? { ...row, scale } : row)))
                }
                onDone={() => setSelectedStickerId(null)}
              />
            ) : null}
            <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            <Text style={styles.fitHint}>{fit === "cover" ? "Cropped to fill" : "Full reel"}</Text>
            <Pressable style={styles.shareBtn} onPress={() => void share()} disabled={sharing}>
              {sharing ? (
                <ActivityIndicator color="#111" size="small" />
              ) : (
                <>
                  <Ionicons name="add-circle" size={20} color="#111" />
                  <Text style={styles.shareText}>{t("addToStory")}</Text>
                </>
              )}
            </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
      <AppEmojiPicker
        open={stickerPickerOpen}
        allowMultiple
        onClose={() => setStickerPickerOpen(false)}
        onSelect={(emoji) => {
          if (stickers.length >= 20) return;
          const id = `${Date.now()}-${stickers.length}`;
          setStickers((prev) => [
            ...prev,
            { id, emoji, x: 0.5, y: 0.35 + (prev.length % 5) * 0.06, scale: 1 }
          ]);
          setSelectedStickerId(id);
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  previewArea: { flex: 1, backgroundColor: "#000", overflow: "hidden" },
  topBar: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  topTools: { flexDirection: "row", alignItems: "center", gap: 12 },
  toolBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center"
  },
  toolBtnActive: { backgroundColor: APP_LIME },
  toolAa: { color: "#fff", fontSize: 18, fontWeight: "800" },
  doneBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: APP_LIME },
  doneText: { color: "#111", fontWeight: "800", fontSize: 15 },
  textEditor: {
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20
  },
  textInput: {
    minWidth: 120,
    maxWidth: "100%",
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    paddingVertical: 6
  },
  textInputBg: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 10,
    paddingHorizontal: 12
  },
  textTools: { paddingHorizontal: 14, paddingVertical: 12, gap: 12, backgroundColor: "#000" },
  textToolRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  chip: {
    minWidth: 38,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  chipActive: { backgroundColor: "#fff", borderColor: "#fff" },
  chipText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  dragHint: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "600", flexShrink: 1 },
  chipTextActive: { color: "#111" },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: "rgba(255,255,255,0.35)" },
  swatchActive: { borderColor: "#fff", transform: [{ scale: 1.15 }] },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#000"
  },
  fitHint: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "600" },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    minWidth: 140,
    justifyContent: "center",
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: APP_LIME
  },
  shareText: { color: "#111", fontSize: 15, fontWeight: "800" }
});
