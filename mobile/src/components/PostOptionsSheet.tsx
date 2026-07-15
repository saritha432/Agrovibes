import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "../localization/LanguageContext";
import { isReelPost } from "../utils/reelGrid";
import type { HomePost } from "../services/api";
import { postSheetStyles as styles } from "./postSheetStyles";

type PostOptionsSheetProps = {
  visible: boolean;
  post: HomePost | null;
  onClose: () => void;
  isOwnPost: boolean;
  isBlocked?: boolean;
  isSaved?: boolean;
  saveBusy?: boolean;
  onToggleSave?: () => void | Promise<void>;
  onCopyLink?: () => void;
  onNotInterested?: () => void;
  onReport: () => void;
  onBlock?: () => void;
  onUnblock?: () => void;
  onDelete?: () => void;
};

export function PostOptionsSheet({
  visible,
  post,
  onClose,
  isOwnPost,
  isBlocked = false,
  isSaved = false,
  saveBusy = false,
  onToggleSave,
  onCopyLink,
  onNotInterested,
  onReport,
  onBlock,
  onUnblock,
  onDelete
}: PostOptionsSheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  if (!post) return null;

  const title = post.videoUrl && isReelPost(post) ? t("reelOptions") : t("postOptions");
  const hasAnyAction =
    !!onToggleSave ||
    !!onCopyLink ||
    !!onNotInterested ||
    !!onReport ||
    (!isOwnPost && (!!onBlock || !!onUnblock)) ||
    (isOwnPost && !!onDelete);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.dimTap} onPress={onClose} accessibilityLabel={t("cancel")} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 12, 22) }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>

          {onToggleSave ? (
            <Pressable
              style={styles.optionRow}
              disabled={saveBusy}
              onPress={() => void onToggleSave()}
            >
              <View style={styles.optionIcon}>
                <Ionicons name={isSaved ? "bookmark" : "bookmark-outline"} size={22} color="#C9FF35" />
              </View>
              <View style={styles.optionTextCol}>
                <Text style={styles.optionTitle}>{isSaved ? t("removeFromSaved") : t("savePost")}</Text>
                <Text style={styles.optionSub}>{t("savedPostsHint")}</Text>
              </View>
            </Pressable>
          ) : null}

          {onCopyLink ? (
            <Pressable style={styles.optionRow} onPress={onCopyLink}>
              <View style={styles.optionIcon}>
                <Ionicons name="link-outline" size={22} color="#C9FF35" />
              </View>
              <View style={styles.optionTextCol}>
                <Text style={styles.optionTitle}>{t("copyLink")}</Text>
                <Text style={styles.optionSub}>{t("copyLinkSub")}</Text>
              </View>
            </Pressable>
          ) : null}

          {onNotInterested ? (
            <Pressable style={styles.optionRow} onPress={onNotInterested}>
              <View style={styles.optionIcon}>
                <Ionicons name="eye-off-outline" size={22} color="#C9FF35" />
              </View>
              <View style={styles.optionTextCol}>
                <Text style={styles.optionTitle}>{t("notInterested")}</Text>
                <Text style={styles.optionSub}>{t("notInterestedSub")}</Text>
              </View>
            </Pressable>
          ) : null}

          {!isOwnPost ? (
            <Pressable
              style={styles.optionRow}
              onPress={() => {
                onClose();
                onReport();
              }}
            >
              <View style={styles.optionIcon}>
                <Ionicons name="flag-outline" size={22} color="#C9FF35" />
              </View>
              <View style={styles.optionTextCol}>
                <Text style={styles.optionTitle}>{t("reportOption")}</Text>
                <Text style={styles.optionSub}>{t("reportOptionSub")}</Text>
              </View>
            </Pressable>
          ) : null}

          {!isOwnPost && isBlocked && onUnblock ? (
            <Pressable style={styles.optionRow} onPress={onUnblock}>
              <View style={styles.optionIcon}>
                <Ionicons name="checkmark-circle-outline" size={22} color="#C9FF35" />
              </View>
              <View style={styles.optionTextCol}>
                <Text style={styles.optionTitle}>{t("unblockAccount")}</Text>
                <Text style={styles.optionSub}>{t("unblockAccountSub")}</Text>
              </View>
            </Pressable>
          ) : null}

          {!isOwnPost && !isBlocked && onBlock ? (
            <Pressable style={styles.optionRow} onPress={onBlock}>
              <View style={styles.optionIcon}>
                <Ionicons name="ban-outline" size={22} color="#ff6b6b" />
              </View>
              <View style={styles.optionTextCol}>
                <Text style={[styles.optionTitle, styles.optionTitleDanger]}>{t("blockAccount")}</Text>
                <Text style={styles.optionSub}>{t("blockAccountSub")}</Text>
              </View>
            </Pressable>
          ) : null}

          {isOwnPost && onDelete ? (
            <Pressable style={styles.optionRow} onPress={onDelete}>
              <View style={styles.optionIcon}>
                <Ionicons name="trash-outline" size={22} color="#ff6b6b" />
              </View>
              <View style={styles.optionTextCol}>
                <Text style={[styles.optionTitle, styles.optionTitleDanger]}>{t("deleteConfirm")}</Text>
                <Text style={styles.optionSub}>{t("deletePostBody")}</Text>
              </View>
            </Pressable>
          ) : null}

          {!hasAnyAction ? <Text style={styles.optionSub}>{t("noPostActions")}</Text> : null}
        </View>
      </View>
    </Modal>
  );
}
