import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { AccountCenterAvatar } from "./AccountCenterAvatar";
import {
  AccountCenterCard,
  AccountCenterChevronRow,
  AccountCenterSectionTitle,
  AccountCenterSubLayout
} from "./AccountCenterSubLayout";
import { useAccountCenterSheetNav } from "./accountCenterSheetNav";
import { useAuth } from "../../auth/AuthContext";
import {
  autoClearPeriodLabel,
  readSearchHistorySettings
} from "../../utils/searchHistorySettings";
import { readSavedLogins } from "../../utils/savedLogins";
import { roleAccountLabel } from "../../utils/loginActivityFormatters";
import { APP_LIME } from "../../theme/appColors";

type ProfileRow = {
  key: string;
  displayName: string;
  subtitle: string;
  avatarUrl?: string | null;
};

export function SearchHistoryContent() {
  const { push, pop } = useAccountCenterSheetNav();
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [keepLabel, setKeepLabel] = useState("Default");

  const load = useCallback(async () => {
    const settings = await readSearchHistorySettings();
    setKeepLabel(autoClearPeriodLabel(settings.autoClearPeriod));

    if (!user) {
      setProfiles([]);
      return;
    }

    const saved = await readSavedLogins();
    if (saved.length > 0) {
      setProfiles(
        saved.map((item) => ({
          key: String(item.userId),
          displayName: item.displayName,
          subtitle: item.accountType,
          avatarUrl: item.avatarUrl
        }))
      );
      return;
    }

    setProfiles([
      {
        key: String(user.id),
        displayName: user.fullName || user.username || "Your profile",
        subtitle: roleAccountLabel(user.role),
        avatarUrl: user.avatarUrl
      }
    ]);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return (
    <AccountCenterSubLayout
      variant="sheet"
      onBack={pop}
      title="Search History"
      description={
        <Text style={styles.description}>
          Review and manage your search history across cropvibe products linked to your account.
        </Text>
      }
      contentStyle={styles.content}
    >
      <AccountCenterSectionTitle title="Your Accounts And Profiles" />
      <AccountCenterCard>
        {profiles.map((profile, index) => (
          <AccountCenterChevronRow
            key={`${profile.key}-${index}`}
            title={profile.displayName}
            subtitle={profile.subtitle}
            onPress={() => push("AutoClearSearchHistory")}
            showDivider={index < profiles.length - 1}
            left={<AccountCenterAvatar label={profile.displayName} avatarUrl={profile.avatarUrl} />}
          />
        ))}
      </AccountCenterCard>

      <AccountCenterSectionTitle title="Keep Searches For" />
      <AccountCenterCard>
        <AccountCenterChevronRow
          title={keepLabel}
          onPress={() => push("AutoClearSearchHistory")}
          left={<AccountCenterAvatar label={keepLabel} />}
        />
      </AccountCenterCard>

      <Pressable
        style={styles.clearBtn}
        onPress={() => push("AutoClearSearchHistory")}
        accessibilityRole="button"
      >
        <Text style={styles.clearBtnText}>Clear Searches</Text>
      </Pressable>
    </AccountCenterSubLayout>
  );
}

const styles = StyleSheet.create({
  description: {
    color: "#97a0a8",
    fontSize: 14,
    lineHeight: 21
  },
  content: {
    paddingBottom: 40
  },
  clearBtn: {
    marginTop: 8,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(201, 255, 53, 0.45)",
    alignItems: "center",
    justifyContent: "center"
  },
  clearBtnText: {
    color: APP_LIME,
    fontSize: 15,
    fontWeight: "700"
  }
});
