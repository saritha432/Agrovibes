import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import { useLanguage } from "../localization/LanguageContext";
import { buildLiveShareChatMessage } from "../screens/messaging/liveShareMessage";
import { fetchSocialNetwork, sendDirectMessage, type HomePost } from "../services/api";
import { APP_LIME } from "../theme/appColors";
import { UserAvatar } from "./UserAvatar";

type LiveShareSheetProps = {
  visible: boolean;
  post: HomePost | null;
  title?: string;
  onClose: () => void;
};

function normalizeIdentity(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function LiveShareSheet({ visible, post, title, onClose }: LiveShareSheetProps) {
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const { t } = useLanguage();
  const [search, setSearch] = React.useState("");
  const [busyUserId, setBusyUserId] = React.useState<number | null>(null);
  const [recipients, setRecipients] = React.useState<Array<{ id: number; name: string; avatarUrl?: string | null }>>([]);

  React.useEffect(() => {
    if (!visible || !token || !user?.id) {
      setRecipients([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const network = await fetchSocialNetwork(token, Number(user.id));
        if (cancelled) return;
        const rows: Array<{ id: number; name: string; avatarUrl?: string | null }> = [];
        for (const person of network.following || []) {
          const raw = String(person.key || "").trim();
          const uid = /^\d+$/.test(raw) ? Number(raw) : NaN;
          const name = String(person.name || "").trim();
          if (!Number.isFinite(uid) || uid <= 0 || !name || uid === Number(user.id)) continue;
          rows.push({
            id: uid,
            name,
            avatarUrl: typeof person.avatarUrl === "string" ? person.avatarUrl : null
          });
        }
        setRecipients(rows);
      } catch {
        if (!cancelled) setRecipients([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, user?.id, visible]);

  const filtered = React.useMemo(() => {
    const q = normalizeIdentity(search);
    return recipients
      .filter((r) => !q || normalizeIdentity(r.name).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
      .slice(0, 48);
  }, [recipients, search]);

  const sendTo = async (recipient: { id: number; name: string }) => {
    if (!token || !post) return;
    setBusyUserId(recipient.id);
    try {
      await sendDirectMessage(token, recipient.id, buildLiveShareChatMessage({ post, title }));
      onClose();
      setSearch("");
      Alert.alert(t("sentTitle"), t("liveSentTo", { name: recipient.name }));
    } catch {
      Alert.alert(t("sendFailed"), t("sendFailedLive"));
    } finally {
      setBusyUserId(null);
    }
  };

  if (!post) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 10, 20) }]} onPress={(e) => e.stopPropagation?.()}>
          <View style={styles.handle} />
          <Text style={styles.title}>{t("shareLive")}</Text>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color={APP_LIME} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t("search")}
              placeholderTextColor="#97a0a8"
              style={styles.searchInput}
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.peopleRow}>
            {filtered.length ? (
              filtered.map((recipient) => (
                <Pressable
                  key={recipient.id}
                  style={styles.personItem}
                  onPress={() => void sendTo(recipient)}
                  disabled={busyUserId === recipient.id}
                >
                  <View style={styles.personAvatar}>
                    {busyUserId === recipient.id ? (
                      <Ionicons name="checkmark" size={18} color={APP_LIME} />
                    ) : (
                      <UserAvatar
                        uri={recipient.avatarUrl}
                        name={recipient.name}
                        size={52}
                        borderRadius={26}
                        fallbackBackgroundColor="#343b43"
                        initialsColor={APP_LIME}
                      />
                    )}
                  </View>
                  <Text style={styles.personName} numberOfLines={1}>
                    {recipient.name}
                  </Text>
                </Pressable>
              ))
            ) : (
              <Text style={styles.emptyText}>{t("noChatsFound")}</Text>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#1a1f24",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 10,
    paddingHorizontal: 16
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#4b5563",
    marginBottom: 12
  },
  title: { color: "#fff", fontSize: 16, fontWeight: "800", marginBottom: 12 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#303842",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14
  },
  searchInput: { flex: 1, color: "#fff", fontSize: 15 },
  peopleRow: { gap: 14, paddingBottom: 8 },
  personItem: { width: 72, alignItems: "center" },
  personAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#262626"
  },
  personName: { marginTop: 6, color: "#e5e7eb", fontSize: 11, fontWeight: "700", textAlign: "center" },
  emptyText: { color: "#97a0a8", fontSize: 14, paddingVertical: 12 }
});
