import React, { useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/rootStackTypes";
import { APP_BLACK, APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../theme/appColors";
import { useAuth } from "../auth/AuthContext";
import { fetchHomePosts, fetchLikedHomePosts, type HomePost } from "../services/api";
import { PostsReelViewerModal } from "../components/PostsReelViewerModal";
import { ReelGridTile } from "../components/ReelGridTile";
import { getLocalLikeStateForPosts } from "../social/localEngagementStore";

const CARD = "#303132";
const CARD_ALT = "#383b3f";
const DIVIDER = "rgba(255,255,255,0.08)";
const SHEET_BG = "#202224";
const CHIP_BG = "#2e3237";
const DISABLED_APPLY_BG = "rgba(201,255,53,0.25)";

type SortBy = "newest" | "oldest";
type DateFilter = "all" | "week" | "month" | "year" | "range";
type FilterSheet = "sort" | "type" | "date" | "author" | null;
type ContentType = "post" | "drop";

const CONTENT_TYPE_OPTIONS: Array<{ key: ContentType; label: string }> = [
  { key: "post", label: "Posts" },
  { key: "drop", label: "Drops" }
];

const DATE_OPTIONS: Array<{ key: DateFilter; label: string }> = [
  { key: "all", label: "All dates" },
  { key: "week", label: "Past week" },
  { key: "month", label: "Past month" },
  { key: "year", label: "Past year" },
  { key: "range", label: "Date range" }
];

function localLikeViewerIdentity(user: {
  id?: number;
  fullName?: string;
  username?: string;
  email?: string;
}) {
  return {
    name: user.fullName || user.username || "You",
    key: user.username || user.email || "",
    userId: user.id
  };
}

function getAuthorMeta(post: HomePost, index: number) {
  const postAny = post as HomePost & {
    username?: string;
    ownerName?: string;
    ownerUsername?: string;
    avatarUrl?: string;
    userAvatarUrl?: string;
  };
  const idPart = Number(post.userId);
  const userName = String(post.userName || postAny.ownerName || "").trim();
  const username = String(postAny.username || postAny.ownerUsername || "").trim();
  const normalizedUsername = username.replace(/^@+/, "").toLowerCase();
  const normalizedName = userName.toLowerCase();

  const key = Number.isFinite(idPart) && idPart > 0 ? `id:${idPart}` : normalizedUsername ? `u:${normalizedUsername}` : normalizedName ? `n:${normalizedName}` : `p:${post.id || index}`;
  const label = userName || username || "Unknown";
  const subtitle = username ? `@${username.replace(/^@+/, "")}` : "Media Account";
  const avatarCandidate = post.authorAvatarUrl || postAny.userAvatarUrl || postAny.avatarUrl;
  const avatarUrl = typeof avatarCandidate === "string" && avatarCandidate.trim() ? avatarCandidate.trim() : null;
  return { key, label, subtitle, avatarUrl };
}

function getAuthorInitial(label: string) {
  const trimmed = String(label || "").trim();
  if (!trimmed) return "U";
  return trimmed.charAt(0).toUpperCase();
}

export function YourActivityLikesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { token, user } = useAuth();
  const { width } = useWindowDimensions();
  const [likedPosts, setLikedPosts] = useState<HomePost[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewer, setViewer] = useState<{ posts: HomePost[]; initialIndex: number } | null>(null);
  const [openSheet, setOpenSheet] = useState<FilterSheet>(null);

  const [sortBy, setSortBy] = useState<SortBy>("newest");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [selectedTypes, setSelectedTypes] = useState<Set<ContentType>>(new Set());
  const [selectedAuthors, setSelectedAuthors] = useState<Set<string>>(new Set());

  const [draftSortBy, setDraftSortBy] = useState<SortBy>("newest");
  const [draftDateFilter, setDraftDateFilter] = useState<DateFilter>("all");
  const [draftSelectedTypes, setDraftSelectedTypes] = useState<Set<ContentType>>(new Set());
  const [draftSelectedAuthors, setDraftSelectedAuthors] = useState<Set<string>>(new Set());

  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;
      const loadLiked = async () => {
        if (!token) {
          setLikedPosts([]);
          return;
        }
        const loadFallbackFromFeed = async () => {
          const feed = await fetchHomePosts(token);
          if (!mounted) return;
          const feedPosts = feed.posts || [];
          if (!feedPosts.length) {
            setLikedPosts([]);
            return;
          }
          const localLikes = await getLocalLikeStateForPosts(
            localLikeViewerIdentity({
              id: user?.id,
              fullName: user?.fullName,
              username: user?.username,
              email: user?.email
            }),
            feedPosts.map((p) => p.id)
          );
          if (!mounted) return;
          const merged = feedPosts.filter((p) => p.viewerHasLiked || localLikes.likedPostIds.has(p.id));
          setLikedPosts(merged);
        };

        setLoading(true);
        try {
          const data = await fetchLikedHomePosts(token);
          if (!mounted) return;
          const likedFromApi = data.posts || [];
          if (likedFromApi.length > 0) {
            setLikedPosts(likedFromApi);
            return;
          }
          await loadFallbackFromFeed();
        } catch (error) {
          if (!mounted) return;
          console.warn("[Likes] /liked failed, falling back to feed", error);
          try {
            await loadFallbackFromFeed();
          } catch {
            if (!mounted) return;
            setLikedPosts([]);
          }
        } finally {
          if (mounted) setLoading(false);
        }
      };
      void loadLiked();
      return () => {
        mounted = false;
      };
    }, [token, user?.email, user?.fullName, user?.id, user?.username])
  );

  const tileSize = useMemo(() => Math.floor((width - 2) / 3), [width]);

  const authorOptions = useMemo(() => {
    const byKey = new Map<string, { key: string; label: string; subtitle: string; avatarUrl: string | null }>();
    likedPosts.forEach((post, index) => {
      const { key, label, subtitle, avatarUrl } = getAuthorMeta(post, index);
      if (!key) return;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, { key, label, subtitle, avatarUrl });
        return;
      }
      if (!existing.avatarUrl && avatarUrl) {
        byKey.set(key, { ...existing, avatarUrl });
      }
    });
    return Array.from(byKey.values());
  }, [likedPosts]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const typeFiltered = likedPosts.filter((post) => {
      if (selectedTypes.size === 0) return true;
      const currentType: ContentType = post.videoUrl ? "drop" : "post";
      return selectedTypes.has(currentType);
    });

    const authorFiltered = typeFiltered.filter((post) => {
      if (selectedAuthors.size === 0) return true;
      const { key } = getAuthorMeta(post, 0);
      return selectedAuthors.has(key);
    });

    const dateFiltered = authorFiltered.filter((post) => {
      if (dateFilter === "all" || dateFilter === "range") return true;
      const ms = Date.parse(String(post.createdAt || ""));
      if (!Number.isFinite(ms)) return false;
      const age = now - ms;
      if (dateFilter === "week") return age <= 7 * 24 * 60 * 60 * 1000;
      if (dateFilter === "month") return age <= 30 * 24 * 60 * 60 * 1000;
      return age <= 365 * 24 * 60 * 60 * 1000;
    });

    return [...dateFiltered].sort((a, b) => {
      const aTime = Date.parse(String(a.createdAt || "")) || 0;
      const bTime = Date.parse(String(b.createdAt || "")) || 0;
      return sortBy === "newest" ? bTime - aTime : aTime - bTime;
    });
  }, [dateFilter, likedPosts, selectedAuthors, selectedTypes, sortBy]);

  const openSortSheet = () => {
    setDraftSortBy(sortBy);
    setOpenSheet("sort");
  };

  const openTypeSheet = () => {
    setDraftSelectedTypes(new Set(selectedTypes));
    setOpenSheet("type");
  };

  const openDateSheet = () => {
    setDraftDateFilter(dateFilter);
    setOpenSheet("date");
  };

  const openAuthorSheet = () => {
    setDraftSelectedAuthors(new Set(selectedAuthors));
    setOpenSheet("author");
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityRole="button">
          <Ionicons name="arrow-back" size={22} color={APP_LIME} />
        </Pressable>
        <Text style={styles.topTitle}>Likes</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersBarContent}
        style={styles.filtersBar}
      >
        <FilterChip label={sortBy === "newest" ? "Newest to oldest" : "Oldest to newest"} onPress={openSortSheet} />
        <FilterChip
          label={selectedTypes.size === 0 ? "All content types" : `${selectedTypes.size} content type${selectedTypes.size > 1 ? "s" : ""}`}
          onPress={openTypeSheet}
        />
        <FilterChip label={DATE_OPTIONS.find((d) => d.key === dateFilter)?.label ?? "All dates"} onPress={openDateSheet} />
        <FilterChip label={selectedAuthors.size === 0 ? "Author" : `${selectedAuthors.size} author`} onPress={openAuthorSheet} />
      </ScrollView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={APP_LIME} />
          </View>
        ) : null}
        {!loading && filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No liked posts yet.</Text>
          </View>
        ) : null}
        <View style={styles.grid}>
          {filtered.map((item, index) => (
            <ReelGridTile
              key={item.id}
              post={item}
              width={tileSize}
              height={tileSize}
              backgroundColor={index % 2 === 0 ? CARD : CARD_ALT}
              onPress={() => setViewer({ posts: filtered, initialIndex: index })}
            />
          ))}
        </View>
      </ScrollView>
      <PostsReelViewerModal
        visible={!!viewer}
        posts={viewer?.posts ?? []}
        initialIndex={viewer?.initialIndex ?? 0}
        onClose={() => setViewer(null)}
        onPostsChange={(nextPosts) =>
          setLikedPosts((prev) => {
            const updates = new Map(nextPosts.map((p) => [p.id, p]));
            return prev.map((p) => updates.get(p.id) ?? p);
          })
        }
      />

      <Modal visible={openSheet === "sort"} transparent animationType="slide" onRequestClose={() => setOpenSheet(null)}>
        <FilterSheet
          title="Sort By"
          canApply
          onClose={() => setOpenSheet(null)}
          onApply={() => {
            setSortBy(draftSortBy);
            setOpenSheet(null);
          }}
        >
          <SingleSelectOption label="Newest To Oldest" active={draftSortBy === "newest"} onPress={() => setDraftSortBy("newest")} />
          <SingleSelectOption label="Oldest To Newest" active={draftSortBy === "oldest"} onPress={() => setDraftSortBy("oldest")} />
        </FilterSheet>
      </Modal>

      <Modal visible={openSheet === "type"} transparent animationType="slide" onRequestClose={() => setOpenSheet(null)}>
        <FilterSheet
          title="Filter By Content Type"
          canApply={draftSelectedTypes.size > 0}
          onClose={() => setOpenSheet(null)}
          onApply={() => {
            setSelectedTypes(new Set(draftSelectedTypes));
            setOpenSheet(null);
          }}
        >
          {CONTENT_TYPE_OPTIONS.map((opt) => {
            const active = draftSelectedTypes.has(opt.key);
            return (
              <MultiSelectOption
                key={opt.key}
                label={opt.label}
                active={active}
                onPress={() =>
                  setDraftSelectedTypes((prev) => {
                    const next = new Set(prev);
                    if (next.has(opt.key)) next.delete(opt.key);
                    else next.add(opt.key);
                    return next;
                  })
                }
              />
            );
          })}
        </FilterSheet>
      </Modal>

      <Modal visible={openSheet === "date"} transparent animationType="slide" onRequestClose={() => setOpenSheet(null)}>
        <FilterSheet
          title="Filter By Date"
          canApply
          onClose={() => setOpenSheet(null)}
          onApply={() => {
            setDateFilter(draftDateFilter);
            setOpenSheet(null);
          }}
        >
          {DATE_OPTIONS.map((opt) => (
            <SingleSelectOption
              key={opt.key}
              label={opt.label}
              active={draftDateFilter === opt.key}
              onPress={() => setDraftDateFilter(opt.key)}
            />
          ))}
        </FilterSheet>
      </Modal>

      <Modal visible={openSheet === "author"} transparent animationType="slide" onRequestClose={() => setOpenSheet(null)}>
        <FilterSheet
          title="Filter By Author"
          canApply
          onClose={() => setOpenSheet(null)}
          onApply={() => {
            setSelectedAuthors(new Set(draftSelectedAuthors));
            setOpenSheet(null);
          }}
        >
          <ScrollView style={styles.sheetAuthorList} showsVerticalScrollIndicator={false}>
            {authorOptions.map((author) => {
              const active = draftSelectedAuthors.has(author.key);
              return (
                <Pressable
                  key={author.key}
                  style={styles.sheetRow}
                  onPress={() =>
                    setDraftSelectedAuthors((prev) => {
                      const next = new Set(prev);
                      if (next.has(author.key)) next.delete(author.key);
                      else next.add(author.key);
                      return next;
                    })
                  }
                >
                  {author.avatarUrl ? (
                    <Image source={{ uri: author.avatarUrl }} style={styles.authorAvatarImage} />
                  ) : (
                    <View style={styles.authorAvatar}>
                      <Text style={styles.authorAvatarInitial}>{getAuthorInitial(author.label)}</Text>
                    </View>
                  )}
                  <View style={styles.authorBody}>
                    <Text style={styles.sheetLabel}>{author.label}</Text>
                    <Text style={styles.sheetSubLabel}>{author.subtitle}</Text>
                  </View>
                  <Radio active={active} />
                </Pressable>
              );
            })}
          </ScrollView>
        </FilterSheet>
      </Modal>
    </SafeAreaView>
  );
}

function FilterChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.filterChip} onPress={onPress} accessibilityRole="button">
      <Text style={styles.filterChipText} numberOfLines={1}>
        {label}
      </Text>
      <Ionicons name="chevron-down" size={14} color={APP_TEXT_MUTED} />
    </Pressable>
  );
}

function FilterSheet({
  title,
  canApply,
  onClose,
  onApply,
  children
}: {
  title: string;
  canApply: boolean;
  onClose: () => void;
  onApply: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sheetOverlay}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetTop}>
          <Pressable style={styles.backBtn} onPress={onClose}>
            <Ionicons name="arrow-back" size={18} color={APP_LIME} />
          </Pressable>
          <Text style={styles.sheetTitle}>{title}</Text>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.sheetCard}>{children}</View>
        <Pressable
          style={[styles.applyBtn, !canApply && styles.applyBtnDisabled]}
          onPress={onApply}
          disabled={!canApply}
          accessibilityRole="button"
        >
          <Text style={[styles.applyText, !canApply && styles.applyTextDisabled]}>Apply</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SingleSelectOption({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.sheetRow} onPress={onPress}>
      <Text style={styles.sheetLabel}>{label}</Text>
      <Radio active={active} />
    </Pressable>
  );
}

function MultiSelectOption({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.sheetRow} onPress={onPress}>
      <Text style={styles.sheetLabel}>{label}</Text>
      {active ? <Ionicons name="checkmark-circle" size={16} color={APP_LIME} /> : <Radio active={false} />}
    </Pressable>
  );
}

function Radio({ active }: { active: boolean }) {
  return <View style={[styles.radio, active ? styles.radioActive : null]}>{active ? <View style={styles.radioDot} /> : null}</View>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: APP_BLACK
  },
  topBar: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  topTitle: {
    color: APP_TEXT,
    fontSize: 18,
    fontWeight: "700"
  },
  filtersBar: {
    backgroundColor: "#2b2d31",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: DIVIDER,
    height: 48,
    maxHeight: 48,
    flexGrow: 0,
    flexShrink: 0
  },
  filtersBarContent: {
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 7,
    alignItems: "center"
  },
  filterChip: {
    minWidth: 116,
    minHeight: 30,
    borderRadius: 4,
    backgroundColor: CHIP_BG,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4
  },
  filterChipText: {
    flexShrink: 1,
    color: APP_TEXT,
    fontSize: 11
  },
  content: {
    paddingBottom: 24
  },
  loadingWrap: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24
  },
  emptyText: {
    color: APP_TEXT,
    opacity: 0.7,
    fontSize: 13
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: "100%"
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)"
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject
  },
  sheet: {
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 20,
    maxHeight: "72%"
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.25)",
    marginBottom: 10
  },
  sheetTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10
  },
  sheetTitle: {
    flex: 1,
    color: APP_TEXT,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "left"
  },
  sheetCard: {
    backgroundColor: CARD,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: DIVIDER,
    overflow: "hidden"
  },
  sheetRow: {
    minHeight: 50,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: DIVIDER,
    flexDirection: "row",
    alignItems: "center"
  },
  sheetLabel: {
    color: APP_TEXT,
    fontSize: 14,
    flex: 1
  },
  sheetSubLabel: {
    color: APP_TEXT_MUTED,
    fontSize: 10,
    marginTop: 2
  },
  authorAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#3a3d42",
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  authorAvatarImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 10,
    backgroundColor: "#3a3d42"
  },
  authorAvatarInitial: {
    color: APP_TEXT,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    includeFontPadding: false
  },
  authorBody: {
    flex: 1,
    paddingRight: 8
  },
  radio: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.2,
    borderColor: "#9aa3ac",
    alignItems: "center",
    justifyContent: "center"
  },
  radioActive: {
    borderColor: APP_LIME
  },
  radioDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: APP_LIME
  },
  applyBtn: {
    marginTop: 14,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: APP_LIME,
    alignItems: "center",
    justifyContent: "center"
  },
  applyBtnDisabled: {
    backgroundColor: DISABLED_APPLY_BG
  },
  applyText: {
    color: APP_BLACK,
    fontSize: 14,
    fontWeight: "700"
  },
  applyTextDisabled: {
    opacity: 0.5
  },
  sheetAuthorList: {
    maxHeight: 360
  }
});
