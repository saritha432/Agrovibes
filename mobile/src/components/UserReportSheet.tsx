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
import { reportUser } from "../services/api";
import { postSheetStyles as styles } from "./postSheetStyles";

type ReportStep = "reasons" | "other" | "done";

type UserReportSheetProps = {
  visible: boolean;
  userId: number | null;
  userName: string;
  onClose: () => void;
  onBlockUser?: () => void;
};

export function UserReportSheet({ visible, userId, userName, onClose, onBlockUser }: UserReportSheetProps) {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { t, language } = useLanguage();
  const [step, setStep] = React.useState<ReportStep>("reasons");
  const [busy, setBusy] = React.useState(false);
  const [otherDraft, setOtherDraft] = React.useState("");
  const [selectedReason, setSelectedReason] = React.useState<PostReportReasonKey | null>(null);

  React.useEffect(() => {
    if (!visible) {
      setStep("reasons");
      setBusy(false);
      setOtherDraft("");
      setSelectedReason(null);
    }
  }, [visible, userId]);

  if (!userId) return null;

  const displayName = formatDisplayName(userName, language, t);
  const reasons = POST_REPORT_REASONS.map((r) => ({ key: r.key, label: t(r.labelKey) }));

  const submitReport = async (reasonKey: PostReportReasonKey, detail?: string) => {
    if (!token) {
      Alert.alert(t("loginRequired"), t("loginRequiredReport"));
      return;
    }
    setBusy(true);
    try {
      const payload = detail?.trim() ? `${reasonKey}: ${detail.trim()}` : reasonKey;
      await reportUser(token, userId, payload);
      setStep("done");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t("reportFailed");
      Alert.alert(t("reportFailed"), msg);
    } finally {
      setBusy(false);
    }
  };

  const onPickReason = (key: PostReportReasonKey) => {
    if (busy) return;
    setSelectedReason(key);
    if (key === "other") {
      setStep("other");
      return;
    }
    void submitReport(key);
  };

  const onBack = () => {
    if (busy) return;
    if (step === "other") {
      setStep("reasons");
      setOtherDraft("");
      setSelectedReason(null);
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
              <Text style={styles.doneMsg}>{t("reportUserDoneMsg")}</Text>
              {onBlockUser ? (
                <Pressable
                  style={styles.secondaryBtn}
                  onPress={() => {
                    onBlockUser();
                    onClose();
                  }}
                >
                  <Text style={styles.secondaryBtnText}>{t("reportBlockAuthor", { name: displayName })}</Text>
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
                  <Ionicons name={step === "other" ? "chevron-back" : "close"} size={22} color="#eef4f8" />
                </Pressable>
                <Text style={[styles.title, { flex: 1, textAlign: "center" }]}>{t("reportUserTitle")}</Text>
                <View style={styles.headerBtn} />
              </View>

              {step === "reasons" ? (
                <>
                  <Text style={styles.subtitle}>{t("reportUserPrompt", { name: displayName })}</Text>
                  {busy ? (
                    <View style={{ paddingVertical: 28, alignItems: "center" }}>
                      <ActivityIndicator color="#C9FF35" />
                    </View>
                  ) : (
                    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                      {reasons.map((r) => (
                        <Pressable key={r.key} style={styles.reasonRow} onPress={() => onPickReason(r.key)}>
                          <Text style={styles.reasonLabel}>{r.label}</Text>
                          <Ionicons name="chevron-forward" size={18} color="#6b7280" />
                        </Pressable>
                      ))}
                    </ScrollView>
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.subtitle}>{t("reportOtherDetails")}</Text>
                  <TextInput
                    value={otherDraft}
                    onChangeText={setOtherDraft}
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
                    onPress={() => void submitReport(selectedReason || "other", otherDraft)}
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
