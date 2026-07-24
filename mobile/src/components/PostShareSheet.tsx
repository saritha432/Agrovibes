import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import React from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import { formatDisplayName } from "../localization/feedDisplay";
import { useLanguage } from "../localization/LanguageContext";
import {
  fetchMessageThreads,
  fetchSocialNetwork,
  sendDirectMessage,
  type HomePost
} from "../services/api";
import { APP_LIME } from "../theme/appColors";
import {
  buildPostShareLink,
  buildPostShareMessage,
  buildPostChatMessage,
  buildExternalShareLink,
  buildInstagramStyleShareText,
  postShareKind,
  sharePostToMessenger,
  sharePostToSnapchat,
  sharePostToSystem,
  sharePostToTelegram,
  sharePostToWhatsApp,
  sharePostToX
} from "../utils/postShare";
import { UserAvatar } from "./UserAvatar";

export type SharePeer = { id: number; name: string; avatarUrl?: string | null };

type PostShareSheetProps = {
  visible: boolean;
  post: HomePost | null;
  onClose: () => void;
  onAddToStory?: (post: HomePost) => void | Promise<void>;
  followingPeers?: SharePeer[];
};

const GRID_COLUMNS = 4;
const SHEET_HORIZONTAL_PAD = 20;
const AVATAR_SIZE = 68;

function normalizeIdentity(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

type FooterAction = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  variant: "story" | "default";
  onPress: () => void;
};

export function PostShareSheet({ visible, post, onClose, onAddToStory, followingPeers }: PostShareSheetProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { token, user } = useAuth();
  const langCtx = useLanguage();
  const appLanguage = langCtx.language;
  const t = React.useCallback(
    (key: string, params?: Record<string, string | number>) =>
      typeof langCtx?.t === "function" ? langCtx.t(key, params) : key,
    [langCtx]
  );
  const [search, setSearch] = React.useState("");
  const [busyUserId, setBusyUserId] = React.useState<number | null>(null);
  const [sendingSelected, setSendingSelected] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(() => new Set());
  const [recipients, setRecipients] = React.useState<SharePeer[]>([]);

  const gridItemWidth = React.useMemo(() => {
    const inner = windowWidth - SHEET_HORIZONTAL_PAD * 2;
    return Math.floor(inner / GRID_COLUMNS);
  }, [windowWidth]);

  React.useEffect(() => {
    if (!visible || !token || !user?.id) {
      if (!visible) {
        setSearch("");
        setSelectedIds(new Set());
      }
      return;
    }
    let cancelled = false;
    void (async () => {
      const seen = new Set<number>();
      const rows: SharePeer[] = [];
      const add = (peer: SharePeer) => {
        if (!peer.id || peer.id === Number(user.id)) return;
        if (seen.has(peer.id)) {
          const existing = rows.find((row) => row.id === peer.id);
          if (existing && !existing.avatarUrl && peer.avatarUrl) {
            existing.avatarUrl = peer.avatarUrl;
          }
          return;
        }
        seen.add(peer.id);
        rows.push({
          id: peer.id,
          name: peer.name,
          avatarUrl: peer.avatarUrl || null
        });
      };

      // Prefer network/thread rows (with avatars). Seed followingPeers only as fallback names.
      try {
        const network = await fetchSocialNetwork(token, Number(user.id));
        if (cancelled) return;
        for (const person of network.following || []) {
          const raw = String(person.key || "").trim();
          const uid = /^\d+$/.test(raw) ? Number(raw) : NaN;
          const name = String(person.name || "").trim();
          if (!Number.isFinite(uid) || !name) continue;
          add({
            id: uid,
            name,
            avatarUrl: typeof person.avatarUrl === "string" ? person.avatarUrl : null
          });
        }
      } catch {
        // no-op
      }

      try {
        const threads = await fetchMessageThreads(token);
        if (cancelled) return;
        for (const thread of threads.threads || []) {
          const uid = Number(thread.peerUserId);
          const name = String(thread.peerName || "").trim();
          if (!Number.isFinite(uid) || !name) continue;
          add({
            id: uid,
            name,
            avatarUrl: thread.peerAvatarUrl || null
          });
        }
      } catch {
        // no-op
      }

      for (const peer of followingPeers || []) {
        add(peer);
      }

      if (!cancelled) {
        setRecipients(rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [followingPeers, token, user?.id, visible]);

  const shareText = React.useMemo(() => {
    if (!post) return "";
    return buildInstagramStyleShareText(post, formatDisplayName(post.userName, appLanguage, t));
  }, [appLanguage, post, t]);

  const shareLink = React.useMemo(() => (post ? buildExternalShareLink(post) : ""), [post]);

  const filteredRecipients = React.useMemo(() => {
    const q = normalizeIdentity(search);
    return recipients
      .filter((item) => !q || normalizeIdentity(item.name).includes(q))
      .slice(0, 48);
  }, [recipients, search]);

  const toggleRecipient = (recipientId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(recipientId)) next.delete(recipientId);
      else next.add(recipientId);
      return next;
    });
  };

  const sendToChat = async (recipient: SharePeer) => {
    if (!token || !post) return;
    setBusyUserId(recipient.id);
    try {
      await sendDirectMessage(token, recipient.id, buildPostChatMessage(post));
      onClose();
      setSearch("");
      setSelectedIds(new Set());
      const kind = postShareKind(post);
      Alert.alert(
        t("sentTitle"),
        kind === "reel"
          ? t("reelSentTo", { name: formatDisplayName(recipient.name, appLanguage, t) })
          : t("postSentTo", { name: formatDisplayName(recipient.name, appLanguage, t) })
      );
    } catch {
      Alert.alert(t("sendFailed"), t("sendFailedReel"));
    } finally {
      setBusyUserId(null);
    }
  };

  const sendSelected = async () => {
    if (!token || !post || selectedIds.size === 0 || sendingSelected) return;
    const targets = recipients.filter((r) => selectedIds.has(r.id));
    if (!targets.length) return;
    setSendingSelected(true);
    try {
      await Promise.all(targets.map((recipient) => sendDirectMessage(token, recipient.id, buildPostChatMessage(post))));
      onClose();
      setSearch("");
      setSelectedIds(new Set());
      Alert.alert(
        t("sentTitle"),
        targets.length === 1
          ? postShareKind(post) === "reel"
            ? t("reelSentTo", { name: formatDisplayName(targets[0].name, appLanguage, t) })
            : t("postSentTo", { name: formatDisplayName(targets[0].name, appLanguage, t) })
          : t("shareSentToMany", { count: targets.length })
      );
    } catch {
      Alert.alert(t("sendFailed"), t("sendFailedReel"));
    } finally {
      setSendingSelected(false);
    }
  };

  const copyLink = React.useCallback(async () => {
    if (!post) return;
    try {
      await Clipboard.setStringAsync(shareLink);
      onClose();
      Alert.alert(t("copied"), t("copiedPostLink"));
    } catch {
      Alert.alert(t("copyFailedTitle"), t("copyFailed"));
    }
  }, [onClose, post, shareLink, t]);

  const footerActions = React.useMemo((): FooterAction[] => {
    if (!post) return [];
    const actions: FooterAction[] = [];
    if (onAddToStory) {
      actions.push({
        key: "story",
        label: t("addToStory"),
        icon: "add",
        variant: "story",
        onPress: () => {
          void Promise.resolve(onAddToStory(post)).then(() => onClose());
        }
      });
    }
    actions.push(
      {
        key: "copy",
        label: t("copyLink"),
        icon: "link-outline",
        variant: "default",
        onPress: () => void copyLink()
      },
      {
        key: "share",
        label: t("shareTo"),
        icon: "open-outline",
        variant: "default",
        onPress: () => {
          void sharePostToSystem(shareText).catch(() => Alert.alert(t("shareFailed"), t("shareFailedSystem")));
        }
      },
      {
        key: "whatsapp",
        label: t("whatsapp"),
        icon: "logo-whatsapp",
        variant: "default",
        onPress: () => {
          void sharePostToWhatsApp(shareText).catch(() => Alert.alert(t("shareFailed"), t("shareFailedSystem")));
        }
      },
      {
        key: "messenger",
        label: t("messenger"),
        icon: "chatbubble-ellipses-outline",
        variant: "default",
        onPress: () => {
          void sharePostToMessenger(shareLink).catch(() => Alert.alert(t("shareFailed"), t("shareFailedSystem")));
        }
      },
      {
        key: "snapchat",
        label: t("snapchat"),
        icon: "logo-snapchat",
        variant: "default",
        onPress: () => {
          void sharePostToSnapchat(shareLink).catch(() => Alert.alert(t("shareFailed"), t("shareFailedSystem")));
        }
      },
      {
        key: "telegram",
        label: t("telegram"),
        icon: "paper-plane-outline",
        variant: "default",
        onPress: () => {
          void sharePostToTelegram(shareText, shareLink).catch(() => Alert.alert(t("shareFailed"), t("shareFailedSystem")));
        }
      },
      {
        key: "x",
        label: t("x"),
        icon: "logo-twitter",
        variant: "default",
        onPress: () => {
          void sharePostToX(shareText).catch(() => Alert.alert(t("shareFailed"), t("shareFailedSystem")));
        }
      }
    );
    return actions;
  }, [copyLink, onAddToStory, onClose, post, shareLink, shareText, t]);

  if (!post) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 14, 22) }]}
          onPress={(e) => e.stopPropagation?.()}
        >
          <View style={styles.handle} />

          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{t("share")}</Text>
            <Pressable
              style={[styles.sendBtn, selectedIds.size > 0 && !sendingSelected ? styles.sendBtnActive : styles.sendBtnDisabled]}
              onPress={() => void sendSelected()}
              disabled={selectedIds.size === 0 || sendingSelected}
            >
              <Text style={[styles.sendBtnText, selectedIds.size > 0 ? styles.sendBtnTextActive : null]}>
                {sendingSelected ? "..." : t("send")}
              </Text>
            </Pressable>
          </View>

          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color={APP_LIME} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t("search")}
              placeholderTextColor="#8e9499"
              style={styles.searchInput}
            />
            <Pressable style={styles.searchAction} hitSlop={8}>
              <Ionicons name="person-add-outline" size={18} color={APP_LIME} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.peopleScroll}
            contentContainerStyle={styles.peopleScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {filteredRecipients.length ? (
              <View style={styles.peopleGrid}>
                {filteredRecipients.map((recipient) => {
                  const selected = selectedIds.has(recipient.id);
                  return (
                  <Pressable
                    key={recipient.id}
                    style={[styles.personItem, { width: gridItemWidth }]}
                    onPress={() => toggleRecipient(recipient.id)}
                    onLongPress={() => void sendToChat(recipient)}
                    disabled={busyUserId === recipient.id || sendingSelected}
                  >
                    <View style={[styles.personAvatarWrap, selected ? styles.personAvatarSelected : null]}>
                      {busyUserId === recipient.id ? (
                        <View style={styles.personAvatarBusy}>
                          <Ionicons name="checkmark" size={22} color={APP_LIME} />
                        </View>
                      ) : (
                        <>
                          <UserAvatar
                            uri={recipient.avatarUrl}
                            name={recipient.name}
                            size={AVATAR_SIZE}
                            borderRadius={AVATAR_SIZE / 2}
                            fallbackBackgroundColor="#3a3a3c"
                            initialsColor="#f5f5f5"
                          />
                          {selected ? (
                            <View style={styles.personSelectedBadge}>
                              <Ionicons name="checkmark" size={14} color="#111" />
                            </View>
                          ) : null}
                        </>
                      )}
                    </View>
                    <Text style={styles.personName} numberOfLines={2}>
                      {recipient.name}
                    </Text>
                  </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.emptyText}>{t("noChatsFound")}</Text>
            )}
          </ScrollView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.footerRow}
            style={styles.footerScroll}
          >
            {footerActions.map((action) => (
              <Pressable key={action.key} style={styles.footerAction} onPress={action.onPress}>
                <View style={[styles.footerIcon, action.variant === "story" ? styles.footerIconStory : null]}>
                  <Ionicons
                    name={action.icon}
                    size={action.variant === "story" ? 26 : 22}
                    color={action.variant === "story" ? "#111111" : APP_LIME}
                  />
                </View>
                <Text style={styles.footerText} numberOfLines={2}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.62)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#121212",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 8,
    paddingHorizontal: SHEET_HORIZONTAL_PAD,
    maxHeight: "78%"
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: APP_LIME,
    marginBottom: 12
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12
  },
  sheetTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "800"
  },
  sendBtn: {
    minWidth: 64,
    height: 34,
    borderRadius: 17,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  sendBtnActive: {
    backgroundColor: APP_LIME
  },
  sendBtnDisabled: {
    backgroundColor: "#2c2c2e"
  },
  sendBtnText: {
    color: "#8e9499",
    fontSize: 14,
    fontWeight: "800"
  },
  sendBtnTextActive: {
    color: "#111111"
  },
  searchRow: {
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1c1c1e",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
    marginBottom: 6
  },
  searchInput: {
    flex: 1,
    color: "#f2f2f2",
    fontSize: 15,
    fontWeight: "500",
    paddingVertical: 0
  },
  searchAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  peopleScroll: { flexGrow: 0, flexShrink: 1 },
  peopleScrollContent: { paddingTop: 10, paddingBottom: 8 },
  peopleGrid: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  personItem: {
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 2
  },
  personAvatarWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: "hidden"
  },
  personAvatarSelected: {
    borderWidth: 2,
    borderColor: APP_LIME
  },
  personSelectedBadge: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: APP_LIME,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#121212"
  },
  personAvatarBusy: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: "#2c2c2e",
    alignItems: "center",
    justifyContent: "center"
  },
  personName: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 14,
    maxWidth: AVATAR_SIZE + 12
  },
  emptyText: {
    color: "#8e9499",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 28
  },
  footerScroll: { flexGrow: 0, marginTop: 4 },
  footerRow: {
    paddingTop: 14,
    paddingBottom: 2,
    paddingRight: 8,
    gap: 18
  },
  footerAction: { alignItems: "center", width: 76 },
  footerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2c2c2e",
    alignItems: "center",
    justifyContent: "center"
  },
  footerIconStory: {
    backgroundColor: APP_LIME
  },
  footerText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 14
  }
});
