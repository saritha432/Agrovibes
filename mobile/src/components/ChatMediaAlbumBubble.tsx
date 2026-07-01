import { Ionicons } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import {
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import type { DmMediaItem } from "../screens/messaging/dmMessageFormats";
import { APP_LIME } from "../theme/appColors";

const CARD_W = 200;
const CARD_H = 260;
const STACK_STEP = 8;

type ChatMediaAlbumBubbleProps = {
  items: DmMediaItem[];
  onPress?: (index: number) => void;
  onLongPress?: () => void;
};

function stackIndexForLayer(page: number, layer: number, total: number) {
  if (total <= 1) return -1;
  const next = page + layer + 1;
  return next < total ? next : -1;
}

export function ChatMediaAlbumBubble({ items, onPress, onLongPress }: ChatMediaAlbumBubbleProps) {
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const peekCount = Math.min(Math.max(items.length - 1, 0), 2);
  const stackPad = peekCount * STACK_STEP;

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const w = e.nativeEvent.layoutMeasurement.width || CARD_W;
    if (w <= 0) return;
    const next = Math.max(0, Math.min(items.length - 1, Math.round(e.nativeEvent.contentOffset.x / w)));
    setPage(next);
  };

  const backLayer2 = stackIndexForLayer(page, 1, items.length);
  const backLayer1 = stackIndexForLayer(page, 0, items.length);

  return (
    <Pressable onLongPress={onLongPress} delayLongPress={280}>
      <View style={[styles.wrap, { width: CARD_W + stackPad, height: CARD_H + 6 }]}>
        {backLayer2 >= 0 ? (
          <View style={[styles.stackCard, { left: 0, top: 6, zIndex: 1, opacity: 0.72 }]}>
            <Image source={{ uri: items[backLayer2].url }} style={styles.stackImage} resizeMode="cover" />
          </View>
        ) : null}
        {backLayer1 >= 0 ? (
          <View style={[styles.stackCard, { left: STACK_STEP, top: 3, zIndex: 2, opacity: 0.86 }]}>
            <Image source={{ uri: items[backLayer1].url }} style={styles.stackImage} resizeMode="cover" />
          </View>
        ) : null}
        <View style={[styles.frontCard, { marginLeft: stackPad, zIndex: 3 }]}>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScrollEnd}
            scrollEventThrottle={16}
            style={styles.carousel}
            contentContainerStyle={{ width: CARD_W * items.length }}
          >
            {items.map((item, index) => (
              <Pressable key={`${item.url}-${index}`} onPress={() => onPress?.(index)} style={styles.slide}>
                <Image source={{ uri: item.url }} style={styles.slideImage} resizeMode="cover" />
              </Pressable>
            ))}
          </ScrollView>
          {items.length > 1 ? (
            <View style={styles.countBadge} pointerEvents="none">
              <Ionicons name="images-outline" size={12} color="#111" />
              <Text style={styles.countText}>{page + 1}/{items.length}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    justifyContent: "flex-end",
    alignItems: "flex-start"
  },
  stackCard: {
    position: "absolute",
    width: CARD_W,
    height: CARD_H,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)"
  },
  stackImage: { width: "100%", height: "100%" },
  frontCard: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)"
  },
  carousel: { width: CARD_W, height: CARD_H },
  slide: { width: CARD_W, height: CARD_H },
  slideImage: { width: "100%", height: "100%" },
  countBadge: {
    position: "absolute",
    right: 8,
    bottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: APP_LIME
  },
  countText: { color: "#111", fontSize: 11, fontWeight: "800" }
});
