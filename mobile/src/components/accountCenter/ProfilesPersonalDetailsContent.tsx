import React, { useMemo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Linking, StyleSheet, Text, View } from "react-native";
import {
  AccountCenterCard,
  AccountCenterChevronRow,
  AccountCenterSectionTitle,
  AccountCenterSubLayout
} from "./AccountCenterSubLayout";
import { useAccountCenterSheetNav } from "./accountCenterSheetNav";
import { useAuth } from "../../auth/AuthContext";
import { UserAvatar } from "../UserAvatar";
import { APP_LIME } from "../../theme/appColors";

function formatPhone(phone?: string) {
  if (!phone) return "";
  return phone.startsWith("+") ? phone : `+${phone}`;
}

function formatDateOfBirth(value?: string) {
  if (!value) return "Not added";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function ProfileAvatar({ label, avatarUrl }: { label: string; avatarUrl?: string }) {
  return <UserAvatar uri={avatarUrl} name={label || "?"} size={48} borderRadius={24} />;
}

export function ProfilesPersonalDetailsContent() {
  const { pop, close, navigateStack } = useAccountCenterSheetNav();
  const { user } = useAuth();

  const displayName = useMemo(
    () => user?.username || user?.fullName || "Your profile",
    [user?.fullName, user?.username]
  );
  const contactLine = useMemo(() => {
    const parts = [user?.email, formatPhone(user?.phone)].filter(Boolean);
    return parts.join(", ") || "Add your contact details";
  }, [user?.email, user?.phone]);

  const openEditProfile = () => {
    close();
    requestAnimationFrame(() => navigateStack("EditProfile"));
  };

  return (
    <AccountCenterSubLayout
      variant="sheet"
      onBack={pop}
      title="Profiles And Personal Details"
      description={
        <Text style={styles.description}>
          Review the profiles and personal details that you've added to this accounts centre. Add more profiles by
          adding your accounts.{" "}
          <Text
            style={styles.learnMore}
            onPress={() => void Linking.openURL("https://www.cropvibe.com/privacy-policy")}
          >
            learn more
          </Text>
        </Text>
      }
    >
      <AccountCenterSectionTitle title="Profiles" />
      <AccountCenterCard>
        <AccountCenterChevronRow
          title={displayName}
          onPress={openEditProfile}
          showDivider
          left={<ProfileAvatar label={displayName} avatarUrl={user?.avatarUrl} />}
        />
        <AccountCenterChevronRow
          title="Add Accounts"
          onPress={() => {}}
          left={
            <View style={styles.addIconWrap}>
              <Ionicons name="person-add-outline" size={22} color={APP_LIME} />
            </View>
          }
          titleColor={APP_LIME}
        />
      </AccountCenterCard>

      <AccountCenterSectionTitle title="Personal Details" />
      <AccountCenterCard>
        <AccountCenterChevronRow
          title={displayName}
          subtitle={contactLine}
          onPress={openEditProfile}
          showDivider
        />
        <AccountCenterChevronRow
          title="Date Of Birth"
          subtitle={formatDateOfBirth(user?.dateOfBirth)}
          onPress={openEditProfile}
        />
      </AccountCenterCard>
    </AccountCenterSubLayout>
  );
}

const styles = StyleSheet.create({
  description: {
    color: "#97a0a8",
    fontSize: 14,
    lineHeight: 21
  },
  learnMore: {
    color: APP_LIME,
    fontWeight: "600",
    textDecorationLine: "underline"
  },
  addIconWrap: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center"
  }
});
