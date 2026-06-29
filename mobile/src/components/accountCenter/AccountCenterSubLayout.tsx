import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { APP_BLACK, APP_LIME, APP_SURFACE, APP_TEXT, APP_TEXT_MUTED } from "../../theme/appColors";

type AccountCenterSubLayoutProps = {
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
  contentStyle?: ViewStyle;
};

export function AccountCenterSubLayout({ title, description, children, contentStyle }: AccountCenterSubLayoutProps) {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.grabber} />
      <Pressable
        style={styles.backBtn}
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Ionicons name="arrow-back" size={24} color={APP_LIME} />
      </Pressable>

      <ScrollView
        contentContainerStyle={[styles.content, contentStyle]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{title}</Text>
      <View style={styles.descriptionWrap}>{description}</View>
        {children}
      </ScrollView>
    </SafeAreaView>
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
  screen: {
    flex: 1,
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
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32
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
  description: {
    color: APP_TEXT_MUTED,
    fontSize: 14,
    lineHeight: 21
  },
  sectionTitle: {
    color: APP_TEXT_MUTED,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 10,
    marginTop: 6
  },
  card: {
    backgroundColor: APP_SURFACE,
    borderRadius: 14,
    overflow: "hidden"
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 54,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12
  },
  rowBody: {
    flex: 1,
    gap: 4
  },
  rowTitle: {
    color: APP_TEXT,
    fontSize: 15,
    fontWeight: "600"
  },
  rowSubtitle: {
    color: APP_TEXT_MUTED,
    fontSize: 13,
    lineHeight: 18
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#3a3a3a",
    marginLeft: 14
  }
});
