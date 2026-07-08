import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useAuth } from "../auth/AuthContext";
import { formatDisplayName, formatFeedText, stripInternalCaptionPrefix } from "../localization/feedDisplay";
import { useLanguage } from "../localization/LanguageContext";
import { reshareHomePost, unreshareHomePost, type HomePost } from "../services/api";
import { APP_LIME } from "../theme/appColors";
import { reelGridStillUri } from "../utils/reelGrid";

type PostRepostSheetProps = {
  visible: boolean;
  post: HomePost | null;
  onClose: () => void;
  onRepostChange: (postId: number, reshared: boolean, quoteCaption?: string) => void;
};

export function PostRepostSheet({ visible, post, onClose, onRepostChange }: PostRepostSheetProps) {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { t, language } = useLanguage();
  const [quoteMode, setQuoteMode] = React.useState(false);
  const [quoteDraft, setQuoteDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!visible) {
      setQuoteMode(false);
      setQuoteDraft("");
      setBusy(false);
    }
  }, [visible, post?.id]);

  if (!post) return null;

  const thumbUri = reelGridStillUri(post) || post.videoUrl || "";
  const authorName = formatDisplayName(post.userName, language, t);
  const caption = formatFeedText(stripInternalCaptionPrefix(post.caption || ""), language, t);
  const alreadyReposted = !!post.viewerHasReshared;

  const runRepost = async (withQuote: boolean) => {
    if (!token) {
      Alert.alert(t("loginRequired"), t("loginRequiredReshare"));
      return;
    }
    const quote = withQuote ? quoteDraft.trim() : "";
    if (withQuote && !quote) {
      Alert.alert(t("repostQuoteRequired"), t("repostQuoteRequiredMsg"));
      return;
    }
    setBusy(true);
    try {
      const res = await reshareHomePost(token, post.id, quote || undefined);
      onRepostChange(post.id, res.reshared, res.quoteCaption || quote || undefined);
      onClose();
      Alert.alert(t("reposted"), alreadyReposted ? t("repostUpdated") : t("repostSuccess"));
    } catch {
      Alert.alert(t("reshareFailed"), t("resharePostFailed"));
    } finally {
      setBusy(false);
    }
  };

  const runRemove = async () => {
    if (!token) return;
    setBusy(true);
    try {
      await unreshareHomePost(token, post.id);
      onRepostChange(post.id, false);
      onClose();
      Alert.alert(t("repostRemoved"), t("repostRemovedMsg"));
    } catch {
      Alert.alert(t("reshareFailed"), t("resharePostFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboardWrap}>
          <Pressable
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 12, 20) }]}
            onPress={(e) => e.stopPropagation?.()}
          >
            <View style={styles.handle} />
            <Text style={styles.title}>{t("repost")}</Text>

            <View style={styles.previewCard}>
              {thumbUri ? (
                <Image source={{ uri: thumbUri }} style={styles.previewThumb} resizeMode="cover" />
              ) : (
                <View style={[styles.previewThumb, styles.previewThumbPlaceholder]}>
                  <Ionicons name="film-outline" size={22} color="#8e9499" />
                </View>
              )}
              <View style={styles.previewMeta}>
                <Text style={styles.previewAuthor} numberOfLines={1}>
                  {authorName}
                </Text>
                {caption ? (
                  <Text style={styles.previewCaption} numberOfLines={2}>
                    {caption}
                  </Text>
                ) : null}
              </View>
            </View>

            {quoteMode ? (
              <TextInput
                value={quoteDraft}
                onChangeText={setQuoteDraft}
                placeholder={t("repostQuotePlaceholder")}
                placeholderTextColor="#8e9499"
                style={styles.quoteInput}
                multiline
                maxLength={2200}
                autoFocus
              />
            ) : null}

            <Pressable
              style={[styles.primaryBtn, busy ? styles.btnDisabled : null]}
              onPress={() => void runRepost(quoteMode)}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#111" />
              ) : (
                <>
                  <Ionicons name="repeat" size={20} color="#111" />
                  <Text style={styles.primaryBtnText}>
                    {quoteMode ? t("repostWithThoughts") : t("repost")}
                  </Text>
                </>
              )}
            </Pressable>

            {!quoteMode ? (
              <Pressable style={styles.secondaryBtn} onPress={() => setQuoteMode(true)} disabled={busy}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color="#fff" />
                <Text style={styles.secondaryBtnText}>{t("repostWithThoughts")}</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.secondaryBtn} onPress={() => setQuoteMode(false)} disabled={busy}>
                <Text style={styles.secondaryBtnText}>{t("cancel")}</Text>
              </Pressable>
            )}

            {alreadyReposted ? (
              <Pressable style={styles.removeBtn} onPress={() => void runRemove()} disabled={busy}>
                <Text style={styles.removeBtnText}>{t("removeRepost")}</Text>
              </Pressable>
            ) : null}
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end"
  },
  keyboardWrap: { width: "100%" },
  sheet: {
    backgroundColor: "#1c1c1e",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 20,
    paddingTop: 10
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#4b5563",
    marginBottom: 14
  },
  title: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 16
  },
  previewCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#2c2c2e",
    borderRadius: 12,
    padding: 10,
    marginBottom: 14
  },
  previewThumb: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: "#111"
  },
  previewThumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center"
  },
  previewMeta: { flex: 1, minWidth: 0 },
  previewAuthor: { color: "#fff", fontSize: 14, fontWeight: "700" },
  previewCaption: { color: "#b0b6bc", fontSize: 12, marginTop: 4, lineHeight: 16 },
  quoteInput: {
    minHeight: 88,
    maxHeight: 140,
    borderRadius: 12,
    backgroundColor: "#2c2c2e",
    color: "#fff",
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    textAlignVertical: "top"
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: APP_LIME,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 10
  },
  primaryBtnText: { color: "#111", fontSize: 16, fontWeight: "800" },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#2c2c2e",
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 8
  },
  secondaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  removeBtn: {
    alignItems: "center",
    paddingVertical: 14,
    marginTop: 4
  },
  removeBtnText: { color: "#ff6b6b", fontSize: 15, fontWeight: "700" },
  btnDisabled: { opacity: 0.65 }
});
