import React, { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AccountCenterAvatar } from "../components/accountCenter/AccountCenterAvatar";
import {
  AccountCenterCard,
  AccountCenterChevronRow,
  AccountCenterSectionTitle,
  AccountCenterSubLayout
} from "../components/accountCenter/AccountCenterSubLayout";
import { useAuth } from "../auth/AuthContext";
import type { RootStackParamList } from "../navigation/rootStackTypes";
import {
  autoClearPeriodLabel,
  clearStoredSearches,
  readSearchHistorySettings
} from "../utils/searchHistorySettings";
import { readSavedLogins } from "../utils/savedLogins";
import { roleAccountLabel } from "../utils/loginActivityFormatters";
import { APP_LIME } from "../theme/appColors";

type ProfileRow = {
  key: string;
  displayName: string;
  subtitle: string;
  avatarUrl?: string | null;
};

export function SearchHistoryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [keepLabel, setKeepLabel] = useState("Default");
  const [clearing, setClearing] = useState(false);

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

  const clearSearches = () => {
    Alert.alert("Clear Searches", "Remove all recent searches from this device?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          setClearing(true);
          try {
            await clearStoredSearches();
            Alert.alert("Cleared", "Your recent searches have been removed.");
          } finally {
            setClearing(false);
          }
        }
      }
    ]);
  };

  return (
    <AccountCenterSubLayout
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
            onPress={() => navigation.navigate("AutoClearSearchHistory")}
            showDivider={index < profiles.length - 1}
            left={<AccountCenterAvatar label={profile.displayName} avatarUrl={profile.avatarUrl} />}
          />
        ))}
      </AccountCenterCard>

      <AccountCenterSectionTitle title="Keep Searches For" />
      <AccountCenterCard>
        <AccountCenterChevronRow
          title={keepLabel}
          onPress={() => navigation.navigate("AutoClearSearchHistory")}
          left={<AccountCenterAvatar label={keepLabel} />}
        />
      </AccountCenterCard>

      <Pressable
        style={[styles.clearBtn, clearing && styles.clearBtnDisabled]}
        onPress={clearSearches}
        disabled={clearing}
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
  clearBtnDisabled: {
    opacity: 0.6
  },
  clearBtnText: {
    color: APP_LIME,
    fontSize: 15,
    fontWeight: "700"
  }
});
