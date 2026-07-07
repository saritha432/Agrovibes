import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { APP_BLACK, APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../../theme/appColors";

const CARD = "#303132";
const DIVIDER = "rgba(255,255,255,0.1)";
const SECTION_HEADING = "rgba(255, 255, 255, 0.55)";

type AccountCenterSubLayoutProps = {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  contentStyle?: ViewStyle;
  variant?: "screen" | "sheet";
  onBack?: () => void;
};

export function AccountCenterSubLayout({
  title,
  description,
  children,
  contentStyle,
  variant = "screen",
  onBack
}: AccountCenterSubLayoutProps) {
  const navigation = useNavigation();
  const handleBack = onBack ?? (() => navigation.goBack());
  const Root = variant === "sheet" ? View : SafeAreaView;
  const rootProps = variant === "sheet" ? {} : { edges: ["top", "bottom"] as const };

  return (
    <Root style={variant === "sheet" ? styles.sheetRoot : styles.screenRoot} {...rootProps}>
      {variant === "sheet" ? null : <View style={styles.grabber} />}
      <Pressable
        style={styles.backBtn}
        onPress={handleBack}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Ionicons name="arrow-back" size={24} color={APP_LIME} />
      </Pressable>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, contentStyle]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Text style={styles.title}>{title}</Text>
        {description ? <View style={styles.descriptionWrap}>{description}</View> : null}
        {children}
      </ScrollView>
    </Root>
  );
}

export function AccountCenterCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function AccountCenterSectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

export function AccountCenterChevronRow({
  title,
  subtitle,
  onPress,
  showDivider,
  left,
  titleColor
}: {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  showDivider?: boolean;
  left?: React.ReactNode;
  titleColor?: string;
}) {
  return (
    <>
      <Pressable
        style={styles.row}
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        {left}
        <View style={styles.rowBody}>
          <Text style={[styles.rowTitle, titleColor ? { color: titleColor } : null]}>{title}</Text>
          {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={APP_TEXT_MUTED} />
      </Pressable>
      {showDivider ? <View style={styles.rowDivider} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: APP_BLACK
  },
  sheetRoot: {
    backgroundColor: APP_BLACK
  },
  grabber: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#5a5a5a",
    marginTop: 6,
    marginBottom: 8
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8
  },
  scroll: {
    flexGrow: 0
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24
  },
  title: {
    color: APP_TEXT,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 10
  },
  descriptionWrap: {
    marginBottom: 22
  },
  sectionTitle: {
    color: SECTION_HEADING,
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 10,
    marginTop: 6,
    textTransform: "capitalize"
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: DIVIDER
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 63,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12
  },
  rowBody: {
    flex: 1,
    gap: 4,
    minWidth: 0
  },
  rowTitle: {
    color: APP_TEXT,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 19
  },
  rowSubtitle: {
    color: APP_TEXT_MUTED,
    fontSize: 12,
    lineHeight: 17
  },
  rowDivider: {
    height: 1,
    backgroundColor: DIVIDER
  }
});
