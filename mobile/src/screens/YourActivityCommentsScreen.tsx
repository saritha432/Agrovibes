import React, { useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/rootStackTypes";
import { APP_BLACK, APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../theme/appColors";
import { useAuth } from "../auth/AuthContext";
import { fetchHomePostComments, fetchHomePosts, type HomePost } from "../services/api";
import { PostsReelViewerModal } from "../components/PostsReelViewerModal";

const CARD = "#303132";
const DIVIDER = "rgba(255,255,255,0.08)";
const SHEET_BG = "#202224";
const CHIP_BG = "#2e3237";

type SortBy = "newest" | "oldest";
type DateFilter = "all" | "week" | "month" | "year" | "range";
type FilterSheet = "sort" | "type" | "date" | "author" | null;
type ContentType = "post" | "drop";

type ActivityComment = {
  id: string;
  postId: number;
  text: string;
  createdAt?: string;
  userLabel: string;
  userAvatarUrl?: string | null;
  postAuthorKey: string;
  postAuthorLabel: string;
  postAuthorSubtitle: string;
  postAuthorAvatarUrl?: string | null;
  contentType: ContentType;
  postPreviewUrl?: string | null;
  post: HomePost;
};

const DATE_OPTIONS: Array<{ key: DateFilter; label: string }> = [
  { key: "all", label: "All dates" },
  { key: "week", label: "Past week" },
  { key: "month", label: "Past month" },
  { key: "year", label: "Past year" },
  { key: "range", label: "Date range" }
];

function getInitial(label: string) {
  const normalized = String(label || "").trim();
  return normalized ? normalized.charAt(0).toUpperCase() : "U";
}

function getRelativeTime(createdAt?: string) {
  const ms = Date.parse(String(createdAt || ""));
  if (!Number.isFinite(ms)) return "";
  const diffMs = Date.now() - ms;
  const mins = Math.max(1, Math.floor(diffMs / 60000));
  if (mins < 60) return `${mins} m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} w`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mo`;
  const years = Math.floor(days / 365);
  return `${years} y`;
}

function getPostAuthorMeta(post: HomePost) {
  const postAny = post as HomePost & { username?: string };
  const idPart = Number(post.userId);
  const label = String(post.userName || "").trim() || "Unknown";
  const username = String(postAny.username || "").trim().replace(/^@+/, "");
  const key = Number.isFinite(idPart) && idPart > 0 ? `id:${idPart}` : username ? `u:${username.toLowerCase()}` : `n:${label.toLowerCase()}`;
  return {
    key,
    label,
    subtitle: username ? `@${username}` : "Media Account",
    avatarUrl: post.authorAvatarUrl || null
  };
}

export function YourActivityCommentsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { token, user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ActivityComment[]>([]);
  const [openSheet, setOpenSheet] = useState<FilterSheet>(null);
  const [viewer, setViewer] = useState<{ posts: HomePost[]; initialIndex: number; initialCommentsPostId: number } | null>(null);

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
      const load = async () => {
        if (!token) {
          setItems([]);
          return;
        }
        setLoading(true);
        try {
          const feed = await fetchHomePosts(token);
          if (!mounted) return;
          const posts = (feed.posts || []).slice(0, 30);

          const commentGroups = await Promise.all(
            posts.map(async (post) => {
              try {
                const res = await fetchHomePostComments(post.id, token);
                return { post, comments: res.comments || [] };
              } catch {
                return { post, comments: [] };
              }
            })
          );
          if (!mounted) return;

          const viewerId = Number(user?.id);
          const fullName = String(user?.fullName || "").trim().toLowerCase();
          const username = String(user?.username || "").trim().toLowerCase();
          const mine: ActivityComment[] = [];

          commentGroups.forEach(({ post, comments }) => {
            const authorMeta = getPostAuthorMeta(post);
            comments.forEach((comment) => {
              const commentUser = String(comment.user || "").trim().toLowerCase();
              const isMineById = Number.isFinite(viewerId) && viewerId > 0 && Number(comment.userId) === viewerId;
              const isMineByLabel = !!commentUser && (commentUser === fullName || commentUser === username);
              if (!isMineById && !isMineByLabel) return;
              mine.push({
                id: `${post.id}:${comment.id}`,
                postId: post.id,
                text: comment.text || "",
                createdAt: comment.createdAt,
                userLabel: String(comment.user || "").trim() || "You",
                userAvatarUrl: comment.avatarUrl || null,
                postAuthorKey: authorMeta.key,
                postAuthorLabel: authorMeta.label,
                postAuthorSubtitle: authorMeta.subtitle,
                postAuthorAvatarUrl: authorMeta.avatarUrl,
                contentType: post.videoUrl ? "drop" : "post",
                postPreviewUrl: post.thumbnailUrl || post.imageUrl || post.videoUrl || null,
                post
              });
            });
          });

          setItems(mine);
        } catch {
          if (mounted) setItems([]);
        } finally {
          if (mounted) setLoading(false);
        }
      };
      void load();
      return () => {
        mounted = false;
      };
    }, [token, user?.fullName, user?.id, user?.username])
  );

  const authorOptions = useMemo(() => {
    const byKey = new Map<string, { key: string; label: string; subtitle: string; avatarUrl: string | null }>();
    items.forEach((item) => {
      const existing = byKey.get(item.postAuthorKey);
      if (!existing) {
        byKey.set(item.postAuthorKey, {
          key: item.postAuthorKey,
          label: item.postAuthorLabel,
          subtitle: item.postAuthorSubtitle,
          avatarUrl: item.postAuthorAvatarUrl || null
        });
        return;
      }
      if (!existing.avatarUrl && item.postAuthorAvatarUrl) {
        byKey.set(item.postAuthorKey, { ...existing, avatarUrl: item.postAuthorAvatarUrl });
      }
    });
    return Array.from(byKey.values());
  }, [items]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const typeFiltered = items.filter((item) => (selectedTypes.size === 0 ? true : selectedTypes.has(item.contentType)));
    const authorFiltered = typeFiltered.filter((item) => (selectedAuthors.size === 0 ? true : selectedAuthors.has(item.postAuthorKey)));
    const dateFiltered = authorFiltered.filter((item) => {
      if (dateFilter === "all" || dateFilter === "range") return true;
      const ms = Date.parse(String(item.createdAt || ""));
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
  }, [dateFilter, items, selectedAuthors, selectedTypes, sortBy]);

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityRole="button">
          <Ionicons name="arrow-back" size={22} color={APP_LIME} />
        </Pressable>
        <Text style={styles.topTitle}>Comments</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersBarContent} style={styles.filtersBar}>
        <FilterChip label={sortBy === "newest" ? "Newest to oldest" : "Oldest to newest"} onPress={() => {
          setDraftSortBy(sortBy);
          setOpenSheet("sort");
        }} />
        <FilterChip
          label={selectedTypes.size === 0 ? "All content types" : `${selectedTypes.size} content type${selectedTypes.size > 1 ? "s" : ""}`}
          onPress={() => {
            setDraftSelectedTypes(new Set(selectedTypes));
            setOpenSheet("type");
          }}
        />
        <FilterChip label={DATE_OPTIONS.find((d) => d.key === dateFilter)?.label ?? "All dates"} onPress={() => {
          setDraftDateFilter(dateFilter);
          setOpenSheet("date");
        }} />
        <FilterChip label={selectedAuthors.size === 0 ? "Author" : `${selectedAuthors.size} author`} onPress={() => {
          setDraftSelectedAuthors(new Set(selectedAuthors));
          setOpenSheet("author");
        }} />
      </ScrollView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={APP_LIME} />
          </View>
        ) : null}
        {!loading && filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No comments yet.</Text>
          </View>
        ) : null}
        {filtered.map((item) => (
          <Pressable
            key={item.id}
            style={styles.row}
            onPress={() =>
              setViewer({
                posts: [item.post],
                initialIndex: 0,
                initialCommentsPostId: item.post.id
              })
            }
          >
            {item.userAvatarUrl ? (
              <Image source={{ uri: item.userAvatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>{getInitial(item.userLabel)}</Text>
              </View>
            )}
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{item.userLabel}</Text>
              <Text style={styles.rowText} numberOfLines={2}>
                {item.text || "Comment"}
              </Text>
              <Text style={styles.rowMeta}>{getRelativeTime(item.createdAt)}</Text>
            </View>
            {item.postPreviewUrl ? <Image source={{ uri: item.postPreviewUrl }} style={styles.previewImage} /> : <View style={styles.previewPlaceholder} />}
          </Pressable>
        ))}
      </ScrollView>

      <PostsReelViewerModal
        visible={!!viewer}
        posts={viewer?.posts ?? []}
        initialIndex={viewer?.initialIndex ?? 0}
        initialCommentsPostId={viewer?.initialCommentsPostId ?? null}
        onClose={() => setViewer(null)}
        onPostsChange={(nextPosts) => {
          setViewer((prev) => (prev ? { ...prev, posts: nextPosts } : prev));
          const byId = new Map(nextPosts.map((p) => [p.id, p]));
          setItems((prev) => prev.map((row) => ({ ...row, post: byId.get(row.post.id) ?? row.post })));
        }}
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
          {[
            { key: "post" as const, label: "Posts" },
            { key: "drop" as const, label: "Drops" }
          ].map((opt) => {
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
            <SingleSelectOption key={opt.key} label={opt.label} active={draftDateFilter === opt.key} onPress={() => setDraftDateFilter(opt.key)} />
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
                      <Text style={styles.authorAvatarInitial}>{getInitial(author.label)}</Text>
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
        <Pressable style={[styles.applyBtn, !canApply && styles.applyBtnDisabled]} onPress={onApply} disabled={!canApply} accessibilityRole="button">
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
  screen: { flex: 1, backgroundColor: APP_BLACK },
  topBar: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 6 },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  topTitle: { color: APP_TEXT, fontSize: 18, fontWeight: "700" },
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
  filtersBarContent: { gap: 6, paddingHorizontal: 8, paddingVertical: 7, alignItems: "center" },
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
  filterChipText: { flexShrink: 1, color: APP_TEXT, fontSize: 11 },
  content: { paddingBottom: 24 },
  loadingWrap: { width: "100%", alignItems: "center", justifyContent: "center", paddingVertical: 10 },
  emptyWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 24 },
  emptyText: { color: APP_TEXT, opacity: 0.7, fontSize: 13 },
  row: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: DIVIDER,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  avatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#3a3d42",
    alignItems: "center",
    justifyContent: "center"
  },
  avatarImage: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#3a3d42" },
  avatarInitial: { color: APP_TEXT, fontSize: 12, fontWeight: "700", textAlign: "center", includeFontPadding: false },
  rowBody: { flex: 1, paddingLeft: 10, paddingRight: 10 },
  rowTitle: { color: APP_TEXT, fontSize: 13, fontWeight: "700" },
  rowText: { color: APP_TEXT, opacity: 0.75, fontSize: 11, marginTop: 1 },
  rowMeta: { color: APP_TEXT_MUTED, fontSize: 10, marginTop: 3 },
  previewImage: { width: 36, height: 36, borderRadius: 5, backgroundColor: "#3a3d42" },
  previewPlaceholder: { width: 36, height: 36, borderRadius: 5, backgroundColor: "#3a3d42" },
  sheetOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject },
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
  sheetTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sheetTitle: { flex: 1, color: APP_TEXT, fontSize: 12, fontWeight: "600", textAlign: "left" },
  sheetCard: { backgroundColor: CARD, borderRadius: 10, borderWidth: 1, borderColor: DIVIDER, overflow: "hidden" },
  sheetRow: {
    minHeight: 50,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: DIVIDER,
    flexDirection: "row",
    alignItems: "center"
  },
  sheetLabel: { color: APP_TEXT, fontSize: 14, flex: 1 },
  sheetSubLabel: { color: APP_TEXT_MUTED, fontSize: 10, marginTop: 2 },
  authorAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#3a3d42",
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  authorAvatarImage: { width: 28, height: 28, borderRadius: 14, marginRight: 10, backgroundColor: "#3a3d42" },
  authorAvatarInitial: { color: APP_TEXT, fontSize: 12, fontWeight: "700", textAlign: "center", includeFontPadding: false },
  authorBody: { flex: 1, paddingRight: 8 },
  radio: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.2,
    borderColor: "#9aa3ac",
    alignItems: "center",
    justifyContent: "center"
  },
  radioActive: { borderColor: APP_LIME },
  radioDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: APP_LIME },
  applyBtn: {
    marginTop: 14,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: APP_LIME,
    alignItems: "center",
    justifyContent: "center"
  },
  applyBtnDisabled: { backgroundColor: "rgba(201,255,53,0.25)" },
  applyText: { color: APP_BLACK, fontSize: 14, fontWeight: "700" },
  applyTextDisabled: { opacity: 0.5 },
  sheetAuthorList: { maxHeight: 360 }
});
