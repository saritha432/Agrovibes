import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewToken
} from "react-native";
import type { MutualConnectionInfo, UserSearchRecord } from "../services/api";
import { formatMutualConnectionLabel } from "../social/formatMutualConnection";
import { APP_LIME, APP_LIME_MUTED, APP_TEXT_ON_LIME } from "../theme/appColors";
import { buildSuggestionSlides } from "../utils/reelViewerFeed";
import { UserAvatar } from "./UserAvatar";

type ReelSuggestionsPageProps = {
  allUsers: UserSearchRecord[];
  mutualByUserId: Record<number, MutualConnectionInfo>;
  hasFriendNetwork: boolean;
  slideOffset?: number;
  followBusy: Record<number, boolean>;
  followDone: Set<number>;
  topInset: number;
  bottomInset: number;
  t: (key: string, params?: Record<string, string | number>) => string;
  onFollow: (userId: number) => void;
  onDismiss: (userId: number) => void;
  onOpenProfile: (user: UserSearchRecord) => void;
};

function displayName(user: UserSearchRecord) {
  return String(user.fullName || user.username || "User").trim() || "User";
}

function SuggestionUserCard({
  user,
  mutual,
  mutualLabel,
  followed,
  busy,
  cardWidth,
  onDismiss,
  onOpenProfile,
  onFollow
}: {
  user: UserSearchRecord;
  mutual?: MutualConnectionInfo;
  mutualLabel: string;
  followed: boolean;
  busy: boolean;
  cardWidth: number;
  onDismiss: () => void;
  onOpenProfile: () => void;
  onFollow: () => void;
}) {
  return (
    <View style={[styles.card, { width: cardWidth }]}>
      <Pressable
        hitSlop={8}
        style={styles.dismissBtn}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss suggestion"
      >
        <Ionicons name="close" size={16} color="rgba(255,255,255,0.72)" />
      </Pressable>

      <Pressable style={styles.cardBody} onPress={onOpenProfile}>
        <UserAvatar
          uri={user.avatarUrl}
          name={displayName(user)}
          size={72}
          borderRadius={36}
          fallbackBackgroundColor="#3a3f46"
          initialsColor="#fff"
        />
        <Text style={styles.userName} numberOfLines={1}>
          {displayName(user)}
        </Text>
        {mutualLabel ? (
          <View style={styles.mutualRow}>
            {mutual?.mutual?.slice(0, 3).map((person) => (
              <UserAvatar
                key={person.userId}
                uri={person.avatarUrl}
                name={person.fullName}
                size={16}
                borderRadius={8}
                fallbackBackgroundColor="#4b5563"
                initialsColor="#fff"
              />
            ))}
            <Text style={styles.mutualText} numberOfLines={2}>
              {mutualLabel}
            </Text>
          </View>
        ) : (
          <Text style={styles.mutualText} numberOfLines={2}>
            {user.username ? `@${String(user.username).replace(/^@+/, "")}` : " "}
          </Text>
        )}
      </Pressable>

      <Pressable
        style={[styles.followBtn, followed ? styles.followBtnDone : null]}
        onPress={onFollow}
        disabled={busy || followed}
      >
        {busy ? (
          <ActivityIndicator size="small" color={followed ? "#fff" : APP_TEXT_ON_LIME} />
        ) : (
          <Text style={[styles.followBtnText, followed ? styles.followBtnTextDone : null]}>
            {followed ? (user.viewerStatus === "pending" ? "Requested" : "Following") : "Follow"}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

export function ReelSuggestionsPage({
  allUsers,
  mutualByUserId,
  hasFriendNetwork,
  slideOffset = 0,
  followBusy,
  followDone,
  topInset,
  bottomInset,
  t,
  onFollow,
  onDismiss,
  onOpenProfile
}: ReelSuggestionsPageProps) {
  const { width } = useWindowDimensions();
  const horizontalPad = 14;
  const gap = 10;
  const cardWidth = (width - horizontalPad * 2 - gap) / 2;
  const cardRowHeight = 230;
  const carouselHeight = cardRowHeight * 2;
  const [activeSlide, setActiveSlide] = useState(0);
  const listRef = useRef<FlatList<UserSearchRecord[]>>(null);

  const slides = useMemo(
    () =>
      buildSuggestionSlides(allUsers, mutualByUserId, {
        hasFriendNetwork,
        slideOffset
      }),
    [allUsers, hasFriendNetwork, mutualByUserId, slideOffset]
  );

  useEffect(() => {
    setActiveSlide((prev) => Math.min(prev, Math.max(0, slides.length - 1)));
  }, [slides.length]);

  const updateActiveSlide = useCallback(
    (offsetX: number, pageWidth: number) => {
      if (pageWidth <= 0 || slides.length === 0) return;
      const next = Math.max(0, Math.min(slides.length - 1, Math.round(offsetX / pageWidth)));
      setActiveSlide((prev) => (prev === next ? prev : next));
    },
    [slides.length]
  );

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      updateActiveSlide(e.nativeEvent.contentOffset.x, e.nativeEvent.layoutMeasurement.width || width);
    },
    [updateActiveSlide, width]
  );

  const onSlideEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      updateActiveSlide(e.nativeEvent.contentOffset.x, e.nativeEvent.layoutMeasurement.width || width);
    },
    [updateActiveSlide, width]
  );

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 55 }).current;

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const focused = viewableItems.find((item) => item.isViewable);
    const index = focused?.index;
    if (index != null && index >= 0) {
      setActiveSlide((prev) => (prev === index ? prev : index));
    }
  }).current;

  const renderSlide = ({ item: users }: { item: UserSearchRecord[] }) => (
    <View style={[styles.slide, { width, height: carouselHeight }]}>
      <View style={[styles.grid, { paddingHorizontal: horizontalPad, gap }]}>
        {users.map((user) => {
          const mutual = mutualByUserId[user.id];
          const mutualLabel = formatMutualConnectionLabel(mutual, t);
          const followed =
            followDone.has(user.id) || user.viewerStatus === "accepted" || user.viewerStatus === "pending";
          const busy = !!followBusy[user.id];
          return (
            <SuggestionUserCard
              key={user.id}
              user={user}
              mutual={mutual}
              mutualLabel={mutualLabel}
              followed={followed}
              busy={busy}
              cardWidth={cardWidth}
              onDismiss={() => onDismiss(user.id)}
              onOpenProfile={() => onOpenProfile(user)}
              onFollow={() => onFollow(user.id)}
            />
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={[styles.screen, { paddingTop: topInset + 52, paddingBottom: bottomInset + 20 }]}>
      <View style={styles.contentWrap}>
        <FlatList
          ref={listRef}
          data={slides}
          horizontal
          pagingEnabled
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_item, index) => `suggest-slide-${index}`}
          renderItem={renderSlide}
          onScroll={onScroll}
          onMomentumScrollEnd={onSlideEnd}
          onScrollEndDrag={onSlideEnd}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          scrollEventThrottle={16}
          style={[styles.carousel, { height: carouselHeight }]}
          snapToInterval={width}
          decelerationRate="fast"
          disableIntervalMomentum
          getItemLayout={(_data, index) => ({ length: width, offset: width * index, index })}
        />
      </View>

      <View style={styles.bottomSection}>
        {slides.length > 1 ? (
          <View style={styles.dotsRow}>
            {slides.map((_, index) => (
              <View key={`dot-${index}`} style={[styles.dot, activeSlide === index ? styles.dotActive : null]} />
            ))}
          </View>
        ) : null}

        <View style={[styles.footer, { paddingHorizontal: horizontalPad }]}>
          <View style={styles.footerTextWrap}>
            <Text style={styles.footerTitle}>Suggested for you</Text>
            <Text style={styles.footerSubtitle}>
              {hasFriendNetwork && slides.length > 0
                ? "People you may know from your friends"
                : "Cropvibe is better with friends"}
            </Text>
          </View>
          <Ionicons name="ellipsis-horizontal" size={22} color="rgba(255,255,255,0.55)" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0f0f0f",
    justifyContent: "space-between"
  },
  contentWrap: {
    width: "100%"
  },
  bottomSection: {
    width: "100%"
  },
  carousel: {
    width: "100%"
  },
  slide: {
    overflow: "hidden",
    justifyContent: "flex-start"
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignContent: "flex-start"
  },
  card: {
    backgroundColor: "#1b1b1b",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingTop: 12,
    paddingHorizontal: 10,
    paddingBottom: 10,
    minHeight: 220,
    marginBottom: 10
  },
  dismissBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 2,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center"
  },
  cardBody: {
    alignItems: "center",
    paddingTop: 8,
    paddingHorizontal: 4,
    flex: 1
  },
  userName: {
    marginTop: 10,
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
    width: "100%"
  },
  mutualRow: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    width: "100%"
  },
  mutualText: {
    marginTop: 8,
    color: "rgba(255,255,255,0.58)",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
    textAlign: "center",
    width: "100%"
  },
  followBtn: {
    marginTop: 10,
    height: 34,
    borderRadius: 8,
    backgroundColor: APP_LIME,
    alignItems: "center",
    justifyContent: "center"
  },
  followBtnDone: {
    backgroundColor: "rgba(255,255,255,0.12)"
  },
  followBtnText: {
    color: APP_TEXT_ON_LIME,
    fontSize: 13,
    fontWeight: "800"
  },
  followBtnTextDone: {
    color: "#fff"
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 8,
    paddingBottom: 10
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: APP_LIME_MUTED
  },
  dotActive: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: APP_LIME
  },
  footer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingTop: 0
  },
  footerTextWrap: { flex: 1, minWidth: 0, paddingRight: 12 },
  footerTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },
  footerSubtitle: { marginTop: 4, color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "600" }
});
