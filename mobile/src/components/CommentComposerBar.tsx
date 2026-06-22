import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";import { SvgAssetIcon } from "./SvgAssetIcon";
import { UserAvatar } from "./UserAvatar";

const STICKER_ICON = require("../../assets/sticker-icon.svg");

export const COMMENT_QUICK_EMOJIS = ["❤️", "🙌", "🔥", "👏", "😢", "😍", "😮", "😂"] as const;

export function commentPlaceholderForPost(
  post: { userName?: string } | null | undefined,
  replyingToUser: string | null | undefined,
  t: (key: string) => string
) {
  if (replyingToUser) return t("writeReply");
  const handle = String(post?.userName || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (handle) return `Add a comment for ${handle}`;
  return t("addCommentPlaceholder");
}

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  placeholder: string;
  avatarUri?: string | null;
  avatarName?: string;
  submitting?: boolean;
  maxLength?: number;
};

export function CommentComposerBar({
  value,
  onChangeText,
  onSubmit,
  placeholder,
  avatarUri,
  avatarName = "You",
  submitting = false,
  maxLength = 2000
}: Props) {
  const hasText = value.trim().length > 0;
  const isMultiline = value.includes("\n") || value.length > 48;

  return (
    <View style={styles.root}>
      <View style={styles.emojiRow}>
        {COMMENT_QUICK_EMOJIS.map((emoji) => (
          <Pressable key={emoji} hitSlop={6} onPress={() => onChangeText(`${value}${emoji}`)}>
            <Text style={styles.emojiText}>{emoji}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.inputRow}>
        <UserAvatar
          uri={avatarUri}
          name={avatarName}
          size={28}
          borderRadius={14}
          fallbackBackgroundColor="#3f3f46"
          initialsColor="#fafafa"
        />
        <View style={styles.pill}>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="#6b7280"
            style={[styles.input, !isMultiline ? styles.inputSingleLine : null]}
            multiline={isMultiline}
            textAlignVertical={isMultiline ? "top" : "center"}
            maxLength={maxLength}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={() => {
              if (hasText && !submitting) onSubmit();
            }}
          />
          <Pressable
            hitSlop={8}
            style={styles.trailingBtn}
            onPress={() => {
              if (hasText && !submitting) onSubmit();
            }}
            disabled={submitting || !hasText}
          >
            {hasText ? (
              <Ionicons name="arrow-up-circle" size={24} color="#C9FF35" />
            ) : (
              <SvgAssetIcon module={STICKER_ICON} size={20} color="#e5e7eb" fallbackName="happy-outline" />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#303236"
  },
  emojiRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 6,
    paddingHorizontal: 2
  },
  emojiText: { fontSize: 18, lineHeight: 22 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#3f3f46",
    backgroundColor: "#262626",
    paddingLeft: 12,
    paddingRight: 4
  },
  input: {
    flex: 1,
    color: "#f8fafc",
    fontSize: 14,
    lineHeight: 18,
    maxHeight: 72,
    paddingRight: 4,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null)
  },
  inputSingleLine: {
    height: 36,
    paddingVertical: 0,
    lineHeight: Platform.OS === "ios" ? 18 : 36,
    ...(Platform.OS === "android" ? { textAlignVertical: "center" } : null)
  },
  trailingBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center"
  }
});
