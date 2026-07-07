import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "react-native";
import {
  AccountCenterCard,
  AccountCenterChevronRow,
  AccountCenterSectionTitle,
  AccountCenterSubLayout
} from "./AccountCenterSubLayout";
import { useAccountCenterSheetNav } from "./accountCenterSheetNav";
import type { RootStackParamList } from "../../navigation/rootStackTypes";
import { APP_LIME } from "../../theme/appColors";

type SecurityRow = {
  key: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  screen?: keyof RootStackParamList;
  onPress?: () => void;
};

export function PasswordSecurityContent() {
  const { push, pop, close, navigateStack } = useAccountCenterSheetNav();
  const noop = () => {};

  const openScreen = (screen: keyof RootStackParamList) => {
    close();
    requestAnimationFrame(() => navigateStack(screen));
  };

  const loginItems: SecurityRow[] = [
    {
      key: "change-password",
      title: "Change Password",
      icon: "lock-closed-outline",
      onPress: () => push("ChangePassword")
    },
    { key: "two-factor", title: "Two-Factor Authentication", icon: "shield-checkmark-outline", screen: "TwoFactorAuth" },
    { key: "verification-selfie", title: "Verification Selfie", icon: "scan-outline", screen: "VerificationSelfie" },
    { key: "saved-login", title: "Saved Login", icon: "bookmark-outline", screen: "SaveLogin" }
  ];

  const securityItems: SecurityRow[] = [
    { key: "where-logged-in", title: "Where You're Logged In", icon: "phone-portrait-outline", screen: "WhereLoggedIn" },
    { key: "recent-emails", title: "Recent Emails", icon: "mail-outline" },
    { key: "security-checkup", title: "Security Checkup", icon: "checkmark-done-outline", screen: "SecurityCheckup" }
  ];

  return (
    <AccountCenterSubLayout
      variant="sheet"
      onBack={pop}
      title="Password & Security"
      description={
        <Text style={{ color: "#97a0a8", fontSize: 14, lineHeight: 21 }}>
          Manage your passwords, login preferences and recovery methods.
        </Text>
      }
    >
      <AccountCenterSectionTitle title="Login Management" />
      <AccountCenterCard>
        {loginItems.map((item, index) => (
          <AccountCenterChevronRow
            key={item.key}
            title={item.title}
            onPress={item.onPress ?? (item.screen ? () => openScreen(item.screen!) : noop)}
            showDivider={index < loginItems.length - 1}
            left={
              <Ionicons name={item.icon} size={22} color={APP_LIME} style={{ width: 28, textAlign: "center" }} />
            }
          />
        ))}
      </AccountCenterCard>

      <AccountCenterSectionTitle title="Security Checks" />
      <AccountCenterCard>
        {securityItems.map((item, index) => (
          <AccountCenterChevronRow
            key={item.key}
            title={item.title}
            onPress={item.onPress ?? (item.screen ? () => openScreen(item.screen!) : noop)}
            showDivider={index < securityItems.length - 1}
            left={
              <Ionicons name={item.icon} size={22} color={APP_LIME} style={{ width: 28, textAlign: "center" }} />
            }
          />
        ))}
      </AccountCenterCard>
    </AccountCenterSubLayout>
  );
}
