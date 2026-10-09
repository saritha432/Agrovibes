import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { StoryCreativeMeta } from "../services/api";
import { APP_LIME } from "../theme/appColors";
import { DraggableOverlay } from "./DraggableOverlay";

export const STICKER_SCALE_MIN = 0.4;
export const STICKER_SCALE_MAX = 1.8;
const STICKER_SCALE_STEP = 0.15;
const STICKER_FONT = 56;

export function stickerScale(scale?: number) {
  const n = Number(scale);
  if (!Number.isFinite(n)) return 1;
  return Math.min(STICKER_SCALE_MAX, Math.max(STICKER_SCALE_MIN, n));
}

export function stepStickerScale(scale: number | undefined, direction: -1 | 1) {
  const next = stickerScale(scale) + direction * STICKER_SCALE_STEP;
  return stickerScale(Math.round(next * 100) / 100);
}

type Props = {
  meta?: StoryCreativeMeta | null;
};

export function storyTextPoint(meta?: StoryCreativeMeta | null) {
  if (meta && typeof meta.textX === "number" && typeof meta.textY === "number") {
    return { x: meta.textX, y: meta.textY };
  }
  const position = meta?.textPosition || "center";
  return { x: 0.5, y: position === "top" ? 0.22 : position === "bottom" ? 0.78 : 0.5 };
}

export function StoryTextLabel({ meta, text }: { meta?: StoryCreativeMeta | null; text: string }) {
  const color = meta?.textColor || "#ffffff";
  return (
    <Text
      style={[
        styles.text,
        { color },
        meta?.textBackground ? [styles.textBg, { color: color === "#ffffff" ? "#111111" : color }] : styles.textShadow
      ]}
    >
      {text}
    </Text>
  );
}

export function StorySticker({ emoji, scale }: { emoji: string; scale?: number }) {
  const fontSize = Math.round(STICKER_FONT * stickerScale(scale));
  return <Text style={[styles.sticker, { fontSize, lineHeight: Math.round(fontSize * 1.15) }]}>{emoji}</Text>;
}

/** Shown while an emoji sticker is selected so it can be made smaller or larger. */
export function StickerSizeBar({
  emoji,
  scale,
  onChange,
  onDone
}: {
  emoji: string;
  scale?: number;
  onChange: (scale: number) => void;
  onDone: () => void;
}) {
  const current = stickerScale(scale);
  const atMin = current <= STICKER_SCALE_MIN + 0.01;
  const atMax = current >= STICKER_SCALE_MAX - 0.01;
  return (
    <View style={sizeStyles.bar}>
      <Pressable
        style={[sizeStyles.btn, atMin ? sizeStyles.btnOff : null]}
        onPress={() => onChange(stepStickerScale(current, -1))}
        disabled={atMin}
        accessibilityLabel="Smaller emoji"
      >
        <Ionicons name="remove" size={22} color="#fff" />
      </Pressable>
      <Text style={sizeStyles.emoji}>{emoji}</Text>
      <Text style={sizeStyles.label}>Emoji size</Text>
      <Pressable
        style={[sizeStyles.btn, atMax ? sizeStyles.btnOff : null]}
        onPress={() => onChange(stepStickerScale(current, 1))}
        disabled={atMax}
        accessibilityLabel="Larger emoji"
      >
        <Ionicons name="add" size={22} color="#fff" />
      </Pressable>
      <Pressable style={sizeStyles.done} onPress={onDone} accessibilityLabel="Done resizing emoji">
        <Ionicons name="checkmark" size={18} color="#111" />
      </Pressable>
    </View>
  );
}

/** Read-only text + stickers for story viewers, placed where the author dragged them. */
export function StoryTextOverlay({ meta }: Props) {
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const text = String(meta?.text || "").trim();
  const stickers = meta?.stickers || [];
  if (!text && !stickers.length) return null;
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setFrame({ width, height });
      }}
    >
      {frame.width > 0 ? (
        <>
          {text ? (
            <DraggableOverlay position={storyTextPoint(meta)} containerWidth={frame.width} containerHeight={frame.height}>
              <StoryTextLabel meta={meta} text={text} />
            </DraggableOverlay>
          ) : null}
          {stickers.map((s) => (
            <DraggableOverlay
              key={s.id}
              position={{ x: s.x, y: s.y }}
              containerWidth={frame.width}
              containerHeight={frame.height}
            >
              <StorySticker emoji={s.emoji} scale={s.scale} />
            </DraggableOverlay>
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 32
  },
  textShadow: {
    textShadowColor: "rgba(0,0,0,0.65)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4
  },
  textBg: {
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    overflow: "hidden"
  },
  sticker: { textAlign: "center" }
});

const sizeStyles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center"
  },
  btnOff: { opacity: 0.35 },
  emoji: { fontSize: 22, lineHeight: 26 },
  label: { color: "#fff", fontSize: 13, fontWeight: "700" },
  done: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: APP_LIME,
    alignItems: "center",
    justifyContent: "center"
  }
});
