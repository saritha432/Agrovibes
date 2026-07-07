import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTopChromeInset } from "../../theme/topChromeInset";
import { useAuth } from "../../auth/AuthContext";
import { UserAvatar } from "../../components/UserAvatar";
import { useLanguage } from "../../localization/LanguageContext";
import { navigateToDirectChat } from "../../navigation/navigationRef";
import { fetchSocialNetwork, fetchUsers, type MessageThread } from "../../services/api";
import { APP_LIME } from "../../theme/appColors";

type Person = {
  id: number;
  name: string;
  username?: string;
  avatarUrl?: string | null;
};

type Props = {
  visible: boolean;
  recentThreads?: MessageThread[];
  onClose: () => void;
};

const BG = "#121212";
const TEXT = "#ffffff";
const MUTED = "#9e9e9e";
const BORDER = "#2a2a2a";
const LIME = APP_LIME;

function personKey(person: Person) {
  return String(person.id);
}

export function NewMessageComposerModal({ visible, recentThreads = [], onClose }: Props) {
  const insets = useSafeAreaInsets();
  const topChromeInset = useTopChromeInset();
  const { t } = useLanguage();
  const { token, user } = useAuth();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [suggested, setSuggested] = useState<Person[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(() => new Set());
  const [searchHits, setSearchHits] = useState<Person[]>([]);
  const [selected, setSelected] = useState<Person[]>([]);
  const [groupStep, setGroupStep] = useState<"pick" | "name">("pick");
  const [groupName, setGroupName] = useState("");
  const [isGroupFlow, setIsGroupFlow] = useState(false);

  const reset = useCallback(() => {
    setQuery("");
    setSearchHits([]);
    setSelected([]);
    setGroupStep("pick");
    setGroupName("");
    setIsGroupFlow(false);
    setDismissedIds(new Set());
  }, []);

  useEffect(() => {
    if (!visible) {
      reset();
      return;
    }
    let cancelled = false;
    void (async () => {
      if (!token || !user?.id) {
        setSuggested([]);
        return;
      }
      setLoading(true);
      try {
        const network = await fetchSocialNetwork(token, user.id);
        if (cancelled) return;
        const seen = new Set<number>();
        const rows: Person[] = [];
        const add = (row: Person) => {
          if (!row.id || row.id === user.id || seen.has(row.id)) return;
          seen.add(row.id);
          rows.push(row);
        };
        for (const thread of recentThreads) {
          add({
            id: thread.peerUserId,
            name: thread.peerName,
            username: thread.peerUsername || undefined,
            avatarUrl: thread.peerAvatarUrl
          });
        }
        for (const row of network.following || []) {
          const raw = String(row.key || "").trim();
          const uid = /^\d+$/.test(raw) ? Number(raw) : NaN;
          const name = String(row.name || "").trim();
          if (!Number.isFinite(uid) || !name) continue;
          add({ id: uid, name, avatarUrl: row.avatarUrl });
        }
        setSuggested(rows);
      } catch {
        if (!cancelled) setSuggested([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recentThreads, reset, token, user?.id, visible]);

  useEffect(() => {
    if (!visible || !token) return;
    const q = query.trim();
    if (q.length < 2) {
      setSearchHits([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetchUsers(token, { search: q, limit: 24 });
          if (cancelled) return;
          const me = Number(user?.id);
          setSearchHits(
            (res.users || [])
              .filter((u) => u.id !== me)
              .map((u) => ({
                id: u.id,
                name: u.fullName || u.username || "User",
                username: u.username || undefined,
                avatarUrl: u.avatarUrl
              }))
          );
        } catch {
          if (!cancelled) setSearchHits([]);
        } finally {
          if (!cancelled) setSearching(false);
        }
      })();
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, token, user?.id, visible]);

  const selectedIds = useMemo(() => new Set(selected.map((p) => p.id)), [selected]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q.length >= 2 ? searchHits : suggested.filter((p) => !dismissedIds.has(p.id));
    if (!q) return base;
    return base.filter((person) => {
      const name = person.name.toLowerCase();
      const handle = String(person.username || "").toLowerCase();
      return name.includes(q) || handle.includes(q);
    });
  }, [dismissedIds, query, searchHits, suggested]);

  const openChat = (person: Person) => {
    onClose();
    navigateToDirectChat({
      peerUserId: person.id,
      peerName: person.name,
      peerUsername: person.username,
      peerAvatarUrl: person.avatarUrl
    });
  };

  const togglePerson = (person: Person) => {
    setSelected((prev) => {
      const exists = prev.some((p) => p.id === person.id);
      if (exists) return prev.filter((p) => p.id !== person.id);
      return [...prev, person];
    });
  };

  const onPressPerson = (person: Person) => {
    if (!isGroupFlow) {
      openChat(person);
      return;
    }
    togglePerson(person);
  };

  const dismissSuggestion = (personId: number) => {
    setDismissedIds((prev) => new Set(prev).add(personId));
  };

  const startGroupFlow = () => {
    setIsGroupFlow(true);
    setGroupStep("pick");
    setSelected([]);
    setQuery("");
  };

  const onBack = () => {
    if (isGroupFlow && groupStep === "name") {
      setGroupStep("pick");
      return;
    }
    if (isGroupFlow) {
      setIsGroupFlow(false);
      setSelected([]);
      setGroupStep("pick");
      setGroupName("");
      return;
    }
    onClose();
  };

  const onCreateGroup = () => {
    if (selected.length < 2) {
      Alert.alert(t("groupChat"), t("selectGroupMembers"));
      return;
    }
    Alert.alert(t("groupChat"), t("groupChatComingSoon"));
    onClose();
  };

  const title = isGroupFlow ? t("groupChat") : t("newMessage");
  const showGroupNameStep = isGroupFlow && groupStep === "name";
  const showSearchResults = query.trim().length >= 2;

  const listHeader = showGroupNameStep ? null : (
    <View>
      {!isGroupFlow ? (
        <Pressable style={styles.actionRow} onPress={startGroupFlow}>
          <View style={styles.actionIcon}>
            <Ionicons name="people-outline" size={22} color={TEXT} />
          </View>
          <Text style={styles.actionLabel}>{t("groupChat")}</Text>
        </Pressable>
      ) : null}

      {isGroupFlow && selected.length > 0 ? (
        <View style={styles.selectedRow}>
          {selected.map((person) => (
            <Pressable key={personKey(person)} style={styles.selectedChip} onPress={() => togglePerson(person)}>
              <UserAvatar uri={person.avatarUrl} name={person.name} size={28} borderRadius={14} />
              <Text style={styles.selectedChipText} numberOfLines={1}>
                {person.name}
              </Text>
              <Ionicons name="close-circle" size={16} color={MUTED} />
            </Pressable>
          ))}
        </View>
      ) : null}

      {!showSearchResults && list.length > 0 ? (
        <Text style={styles.sectionLabel}>{t("suggested")}</Text>
      ) : null}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onBack}>
      <View style={[styles.root, { paddingTop: topChromeInset, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.header}>
          <Pressable hitSlop={10} onPress={onBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={TEXT} />
          </Pressable>
          <Text style={styles.title}>{title}</Text>
          {isGroupFlow ? (
            <Pressable
              hitSlop={10}
              onPress={() => {
                if (groupStep === "name") {
                  onCreateGroup();
                  return;
                }
                if (selected.length < 2) {
                  Alert.alert(t("groupChat"), t("selectGroupMembers"));
                  return;
                }
                setGroupStep("name");
              }}
              style={styles.headerAction}
            >
              <Text style={[styles.nextText, selected.length < 2 && groupStep === "pick" ? styles.nextDisabled : null]}>
                {groupStep === "name" ? t("create") : t("next")}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.headerAction} />
          )}
        </View>

        {showGroupNameStep ? (
          <View style={styles.groupNameBlock}>
            <Text style={styles.toLabel}>{t("groupName")}</Text>
            <TextInput
              value={groupName}
              onChangeText={setGroupName}
              placeholder={t("groupNamePlaceholder")}
              placeholderTextColor={MUTED}
              style={styles.groupNameInput}
              autoFocus
            />
            <View style={styles.selectedRow}>
              {selected.map((person) => (
                <View key={personKey(person)} style={styles.selectedChip}>
                  <UserAvatar uri={person.avatarUrl} name={person.name} size={28} borderRadius={14} />
                  <Text style={styles.selectedChipText} numberOfLines={1}>
                    {person.name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <>
            <View style={styles.toRow}>
              <Text style={styles.toLabel}>{t("toLabel")}</Text>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t("search")}
                placeholderTextColor={MUTED}
                style={styles.toInput}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>

            {loading || searching ? (
              <View style={styles.center}>
                <ActivityIndicator color={LIME} />
              </View>
            ) : (
              <FlatList
                data={list}
                keyExtractor={(item) => personKey(item)}
                keyboardShouldPersistTaps="handled"
                ListHeaderComponent={listHeader}
                contentContainerStyle={list.length ? undefined : styles.center}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>
                    {showSearchResults ? t("noUsersFound") : t("followToMessage")}
                  </Text>
                }
                renderItem={({ item }) => {
                  const picked = selectedIds.has(item.id);
                  return (
                    <Pressable style={styles.row} onPress={() => onPressPerson(item)}>
                      <UserAvatar
                        uri={item.avatarUrl}
                        name={item.name}
                        size={48}
                        borderRadius={24}
                        fallbackBackgroundColor="#3a3f46"
                        initialsColor={MUTED}
                      />
                      <View style={styles.rowBody}>
                        <Text style={styles.rowName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        {item.username ? (
                          <Text style={styles.rowHandle} numberOfLines={1}>
                            {item.username}
                          </Text>
                        ) : null}
                      </View>
                      {isGroupFlow ? (
                        <View style={[styles.checkCircle, picked ? styles.checkCircleOn : null]}>
                          {picked ? <Ionicons name="checkmark" size={16} color="#111" /> : null}
                        </View>
                      ) : (
                        <Pressable hitSlop={10} onPress={() => dismissSuggestion(item.id)}>
                          <Ionicons name="close" size={18} color={MUTED} />
                        </Pressable>
                      )}
                    </Pressable>
                  );
                }}
              />
            )}
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 10
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "800", color: TEXT },
  headerAction: { width: 64, alignItems: "flex-end", paddingRight: 8 },
  nextText: { color: LIME, fontSize: 16, fontWeight: "800" },
  nextDisabled: { color: MUTED },
  toRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER
  },
  toLabel: { color: TEXT, fontSize: 16, fontWeight: "600" },
  toInput: { flex: 1, color: TEXT, fontSize: 16, paddingVertical: 0 },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#2a2a2a",
    alignItems: "center",
    justifyContent: "center"
  },
  actionLabel: { color: TEXT, fontSize: 15, fontWeight: "700" },
  sectionLabel: {
    color: TEXT,
    fontSize: 15,
    fontWeight: "800",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8
  },
  groupNameBlock: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  groupNameInput: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: TEXT,
    fontSize: 16
  },
  selectedRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  selectedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "48%",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#1f1f1f"
  },
  selectedChipText: { color: TEXT, fontSize: 12, fontWeight: "700", flexShrink: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: { color: TEXT, fontSize: 15, fontWeight: "700" },
  rowHandle: { color: MUTED, fontSize: 13, marginTop: 2 },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: MUTED,
    alignItems: "center",
    justifyContent: "center"
  },
  checkCircleOn: { backgroundColor: LIME, borderColor: LIME },
  center: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyText: { color: MUTED, fontSize: 14, textAlign: "center", lineHeight: 20 }
});
