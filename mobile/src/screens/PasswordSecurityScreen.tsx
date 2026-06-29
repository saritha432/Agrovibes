import React from "react";
import { Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AccountCenterCard,
  AccountCenterChevronRow,
  AccountCenterSectionTitle,
  AccountCenterSubLayout
} from "../components/accountCenter/AccountCenterSubLayout";
import type { RootStackParamList } from "../navigation/rootStackTypes";

export function PasswordSecurityScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const noop = () => {};

  const loginItems = [
    { key: "change-password", title: "Change Password", onPress: () => navigation.navigate("ChangePassword") },
    { key: "two-factor", title: "Two-Factor Authentication", onPress: noop },
    { key: "verification-selfie", title: "Verification Selfie", onPress: noop },
    { key: "saved-login", title: "Saved Login", onPress: noop }
  ];

  const securityItems = [
    { key: "where-logged-in", title: "Where You're Logged In", onPress: noop },
    { key: "recent-emails", title: "Recent Emails", onPress: noop },
    { key: "security-checkup", title: "Security Checkup", onPress: noop }
  ];

  return (
    <AccountCenterSubLayout
      title="Password & Security"
      description={
        <Text style={{ color: "#97a0a8", fontSize: 14, lineHeight: 21 }}>
          Manage Your Passwords, Login Preferences And Recovery Methods.
        </Text>
      }
    >
      <AccountCenterSectionTitle title="Login Management" />
      <AccountCenterCard>
        {loginItems.map((item, index) => (
          <AccountCenterChevronRow
            key={item.key}
            title={item.title}
            onPress={item.onPress}
            showDivider={index < loginItems.length - 1}
          />
        ))}
      </AccountCenterCard>

      <AccountCenterSectionTitle title="Security Checks" />
      <AccountCenterCard>
        {securityItems.map((item, index) => (
          <AccountCenterChevronRow
            key={item.key}
            title={item.title}
            onPress={item.onPress}
            showDivider={index < securityItems.length - 1}
          />
        ))}
      </AccountCenterCard>
    </AccountCenterSubLayout>
  );
}
