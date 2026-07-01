import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { APP_LIME, APP_SURFACE, APP_TEXT, APP_TEXT_MUTED } from "../../theme/appColors";

export type InformationRowProps = {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  showDivider?: boolean;
  trailing?: "chevron" | "external" | "diagonal" | "none";
};

export function InformationPermissionRow({
  title,
  icon,
  onPress,
  showDivider,
  trailing = "chevron"
}: InformationRowProps) {
  const trailingIcon =
    trailing === "external"
      ? "open-outline"
      : trailing === "diagonal"
        ? "arrow-up-outline"
        : trailing === "chevron"
          ? "chevron-forward"
          : null;

  return (
    <>
      <Pressable
        style={styles.row}
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        {icon ? (
          <View style={styles.iconWrap}>
            <Ionicons name={icon} size={22} color={APP_LIME} />
          </View>
        ) : (
          <View style={styles.iconSpacer} />
        )}
        <Text style={styles.rowTitle}>{title}</Text>
        {trailingIcon ? (
          <Ionicons
            name={trailingIcon}
            size={trailing === "diagonal" ? 18 : 18}
            color={APP_TEXT_MUTED}
            style={trailing === "diagonal" ? styles.diagonalIcon : undefined}
          />
        ) : null}
      </Pressable>
      {showDivider ? <View style={styles.divider} /> : null}
    </>
  );
}

export function InformationPermissionCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: APP_SURFACE,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 14
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 54,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 14
  },
  iconWrap: {
    width: 28,
    alignItems: "center"
  },
  iconSpacer: {
    width: 28
  },
  rowTitle: {
    flex: 1,
    color: APP_TEXT,
    fontSize: 15,
    fontWeight: "600"
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#3a3a3a",
    marginLeft: 14
  },
  diagonalIcon: {
    transform: [{ rotate: "45deg" }]
  }
});
