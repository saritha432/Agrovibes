import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { StoryCreativeMeta } from "../services/api";
import { DraggableOverlay } from "./DraggableOverlay";

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

export function StorySticker({ emoji }: { emoji: string }) {
  return <Text style={styles.sticker}>{emoji}</Text>;
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
              <StorySticker emoji={s.emoji} />
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
  sticker: { fontSize: 56, lineHeight: 66, textAlign: "center" }
});
