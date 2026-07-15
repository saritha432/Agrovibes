import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import { formatDisplayName } from "../localization/feedDisplay";
import { useLanguage } from "../localization/LanguageContext";
import { POST_REPORT_REASONS, type PostReportReasonKey } from "../social/postReportReasons";
import { reportHomePost, type HomePost } from "../services/api";
import { postSheetStyles as styles } from "./postSheetStyles";

type ReportStep = "reasons" | "details" | "done";

type PostReportSheetProps = {
  visible: boolean;
  post: HomePost | null;
  onClose: () => void;
  /** Optional — shown on success step (Instagram-style). */
  onBlockAuthor?: (post: HomePost) => void;
};

export function PostReportSheet({ visible, post, onClose, onBlockAuthor }: PostReportSheetProps) {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { t, language } = useLanguage();
  const [step, setStep] = React.useState<ReportStep>("reasons");
  const [busy, setBusy] = React.useState(false);
  const [description, setDescription] = React.useState("");
  const [selectedReason, setSelectedReason] = React.useState<PostReportReasonKey | null>(null);

  React.useEffect(() => {
    if (!visible) {
      setStep("reasons");
      setBusy(false);
      setDescription("");
      setSelectedReason(null);
    }
  }, [visible, post?.id]);

  if (!post) return null;

  const authorName = formatDisplayName(post.userName, language, t);
  const reasons = POST_REPORT_REASONS.map((r) => ({ key: r.key, label: t(r.labelKey) }));

  const submitReport = async () => {
    if (!token) {
      Alert.alert(t("loginRequired"), t("loginRequiredReport"));
      return;
    }
    if (!selectedReason) {
      Alert.alert(t("reportPostTitle"), t("reportPickReason") || "Please select a reason");
      return;
    }
    setBusy(true);
    try {
      await reportHomePost(token, post.id, selectedReason, description.trim() || undefined);
      setStep("done");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t("reportFailed");
      Alert.alert(t("reportFailed"), msg);
    } finally {
      setBusy(false);
    }
  };

  const onBack = () => {
    if (busy) return;
    if (step === "details") {
      setStep("reasons");
      return;
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onBack}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalRoot}>
        <Pressable style={styles.dimTap} onPress={onBack} accessibilityLabel={t("cancel")} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 12, 20), maxHeight: "78%" }]}>
          <View style={styles.handle} />

          {step === "done" ? (
            <View>
              <View style={styles.doneIconWrap}>
                <Ionicons name="checkmark-circle" size={44} color="#C9FF35" />
              </View>
              <Text style={styles.doneTitle}>{t("reportDoneTitle")}</Text>
              <Text style={styles.doneMsg}>{t("reportDoneMsg")}</Text>
              {onBlockAuthor ? (
                <Pressable
                  style={styles.secondaryBtn}
                  onPress={() => {
                    onBlockAuthor(post);
                    onClose();
                  }}
                >
                  <Text style={styles.secondaryBtnText}>{t("reportBlockAuthor", { name: authorName })}</Text>
                </Pressable>
              ) : null}
              <Pressable style={styles.primaryBtn} onPress={onClose}>
                <Text style={styles.primaryBtnText}>{t("done")}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.headerRow}>
                <Pressable style={styles.headerBtn} onPress={onBack} hitSlop={8} accessibilityLabel={t("back")}>
                  <Ionicons name={step === "details" ? "chevron-back" : "close"} size={22} color="#eef4f8" />
                </Pressable>
                <Text style={[styles.title, { flex: 1, textAlign: "center" }]}>{t("reportPostTitle")}</Text>
                <View style={styles.headerBtn} />
              </View>

              {step === "reasons" ? (
                <>
                  <Text style={styles.subtitle}>{t("reportPostPrompt")}</Text>
                  <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    {reasons.map((r) => {
                      const selected = selectedReason === r.key;
                      return (
                        <Pressable
                          key={r.key}
                          style={[styles.reasonRow, selected ? { backgroundColor: "rgba(201,255,53,0.08)" } : null]}
                          onPress={() => setSelectedReason(r.key)}
                        >
                          <Text style={styles.reasonLabel}>{r.label}</Text>
                          <Ionicons
                            name={selected ? "radio-button-on" : "radio-button-off"}
                            size={20}
                            color={selected ? "#C9FF35" : "#6b7280"}
                          />
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                  <Pressable
                    style={[styles.primaryBtn, !selectedReason ? { opacity: 0.45 } : null]}
                    disabled={!selectedReason}
                    onPress={() => setStep("details")}
                  >
                    <Text style={styles.primaryBtnText}>{t("reportNext") || "Next"}</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.subtitle}>{t("reportOtherDetails")}</Text>
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder={t("reportOtherPlaceholder")}
                    placeholderTextColor="#6b7280"
                    style={styles.quoteInput}
                    multiline
                    maxLength={500}
                    autoFocus
                  />
                  <Pressable
                    style={[styles.primaryBtn, busy ? { opacity: 0.6 } : null]}
                    disabled={busy}
                    onPress={() => void submitReport()}
                  >
                    {busy ? (
                      <ActivityIndicator color="#111" />
                    ) : (
                      <Text style={styles.primaryBtnText}>{t("reportSubmit")}</Text>
                    )}
                  </Pressable>
                </>
              )}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
