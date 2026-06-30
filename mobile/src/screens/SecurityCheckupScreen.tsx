import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AccountCenterCard,
  AccountCenterSectionTitle,
  AccountCenterSubLayout
} from "../components/accountCenter/AccountCenterSubLayout";
import type { RootStackParamList } from "../navigation/rootStackTypes";
import { APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../theme/appColors";

type CheckupRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress?: () => void;
  showDivider?: boolean;
};

function CheckupRow({ icon, title, subtitle, onPress, showDivider }: CheckupRowProps) {
  const content = (
    <>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={22} color={APP_LIME} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
    </>
  );

  return (
    <>
      {onPress ? (
        <Pressable style={styles.row} onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>
          {content}
        </Pressable>
      ) : (
        <View style={styles.row}>{content}</View>
      )}
      {showDivider ? <View style={styles.divider} /> : null}
    </>
  );
}

export function SecurityCheckupScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <AccountCenterSubLayout
      title="Security Checkup"
      description={
        <Text style={{ color: "#97a0a8", fontSize: 14, lineHeight: 21 }}>
          You Have 1 Recommended Action
        </Text>
      }
    >
      <AccountCenterCard>
        <CheckupRow
          icon="alert-circle-outline"
          title="Review Your Contact Info"
          subtitle="Take a look at your contact info so that we can help if you lose access."
          onPress={() => navigation.navigate("ProfilesPersonalDetails")}
          showDivider
        />
        <CheckupRow
          icon="checkmark-circle-outline"
          title="Password"
          subtitle="Updated 15 Apr 2024"
          onPress={() => navigation.navigate("ChangePassword")}
          showDivider
        />
        <CheckupRow
          icon="checkmark-circle-outline"
          title="Where You're Logged In"
          subtitle="Reviewed Just Now"
          onPress={() => navigation.navigate("WhereLoggedIn")}
        />
      </AccountCenterCard>

      <AccountCenterSectionTitle title="Additional Security Steps" />
      <AccountCenterCard>
        <CheckupRow
          icon="phone-portrait-outline"
          title="Two Factor Authentication"
          subtitle="Reviewed Just Now"
          onPress={() => navigation.navigate("TwoFactorAuth")}
        />
      </AccountCenterCard>
    </AccountCenterSubLayout>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12
  },
  iconWrap: {
    width: 28,
    paddingTop: 2,
    alignItems: "center"
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
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#3a3a3a",
    marginLeft: 14
  }
});
