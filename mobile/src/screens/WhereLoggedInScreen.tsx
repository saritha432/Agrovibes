import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AccountCenterCard,
  AccountCenterChevronRow,
  AccountCenterSectionTitle,
  AccountCenterSubLayout
} from "../components/accountCenter/AccountCenterSubLayout";
import { AccountCenterAvatar } from "../components/accountCenter/AccountCenterAvatar";
import { useAuth } from "../auth/AuthContext";
import type { RootStackParamList } from "../navigation/rootStackTypes";
import { APP_LIME } from "../theme/appColors";

const LOGGED_IN_ACCOUNTS = [
  { key: "android", deviceSummary: "OnePlus Nord | +30 More" },
  { key: "ios", deviceSummary: "iPhone 17 Pro | +20 More" }
] as const;

export function WhereLoggedInScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();

  const displayName = useMemo(
    () => user?.fullName || user?.username || "Your profile",
    [user?.fullName, user?.username]
  );

  const openLoginActivity = () => navigation.navigate("LoginActivity", { accountName: displayName });

  return (
    <AccountCenterSubLayout
      title="Where You're Logged In"
      description={
        <Text style={{ color: "#97a0a8", fontSize: 14, lineHeight: 21 }}>
          See What Devices Are Used To Log In To Your Accounts.
        </Text>
      }
    >
      <Pressable style={styles.alertBanner} onPress={openLoginActivity} accessibilityRole="button">
        <Ionicons name="alert-circle" size={20} color={APP_LIME} />
        <Text style={styles.alertText}>
          We Detected Unrecognized Logins.{" "}
          <Text style={styles.alertLink}>Review Devices</Text>
        </Text>
      </Pressable>

      <AccountCenterSectionTitle title="Accounts" />
      <AccountCenterCard>
        {LOGGED_IN_ACCOUNTS.map((account, index) => (
          <AccountCenterChevronRow
            key={account.key}
            title={displayName}
            subtitle={account.deviceSummary}
            onPress={openLoginActivity}
            showDivider={index < LOGGED_IN_ACCOUNTS.length - 1}
            left={<AccountCenterAvatar label={displayName} avatarUrl={user?.avatarUrl} />}
          />
        ))}
      </AccountCenterCard>
    </AccountCenterSubLayout>
  );
}

const styles = StyleSheet.create({
  alertBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 18
  },
  alertText: {
    flex: 1,
    color: "#97a0a8",
    fontSize: 14,
    lineHeight: 20
  },
  alertLink: {
    color: APP_LIME,
    fontWeight: "700",
    textDecorationLine: "underline"
  }
});
