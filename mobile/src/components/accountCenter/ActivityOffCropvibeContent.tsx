import React, { useCallback, useState } from "react";
import { Alert, StyleSheet, Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  InformationPermissionCard,
  InformationPermissionRow
} from "./InformationPermissionRows";
import { AccountCenterSectionTitle, AccountCenterSubLayout } from "./AccountCenterSubLayout";
import { useAccountCenterSheetNav } from "./accountCenterSheetNav";
import type { RootStackParamList } from "../../navigation/rootStackTypes";
import {
  activeRecentApps,
  DEFAULT_PARTNER_APPS,
  disconnectPartnerApp,
  readActivityOffCropvibeState,
  recentActivitySummary,
  type ActivityOffCropvibeState
} from "../../utils/activityOffCropvibeStorage";

export function ActivityOffCropvibeContent() {
  const { pop, close, navigateStack } = useAccountCenterSheetNav();
  const [state, setState] = useState<ActivityOffCropvibeState | null>(null);

  const reload = useCallback(async () => {
    setState(await readActivityOffCropvibeState());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload])
  );

  const openStack = (screen: keyof RootStackParamList) => {
    close();
    requestAnimationFrame(() => navigateStack(screen));
  };

  const disconnectSpecific = () => {
    const apps = DEFAULT_PARTNER_APPS.filter((app) => !state?.disconnectedAppIds.includes(app.id));
    if (apps.length === 0) {
      Alert.alert("Nothing to disconnect", "All listed activities are already disconnected.");
      return;
    }
    Alert.alert(
      "Disconnect Specific Activity",
      "Choose an app to disconnect.",
      [
        ...apps.map((app) => ({
          text: app.name,
          onPress: async () => {
            const next = await disconnectPartnerApp(app.id);
            setState(next);
          }
        })),
        { text: "Cancel", style: "cancel" as const }
      ]
    );
  };

  const showRecentActivity = () => {
    const apps = state ? activeRecentApps(state) : [];
    Alert.alert("Recent Activity", apps.length > 0 ? apps.join("\n") : "No recent off-cropvibe activity");
  };

  const summary = state ? recentActivitySummary(state) : "Loading...";

  return (
    <AccountCenterSubLayout
      variant="sheet"
      onBack={pop}
      title="Your Activity Off Cropvibe Technologies"
      description={
        <Text style={styles.description}>
          Businesses that you interact with outside cropvibe can send us information about activity such as app or
          website visits.
        </Text>
      }
      contentStyle={styles.content}
    >
      <InformationPermissionCard>
        <InformationPermissionRow
          title="Learn more about activity off cropvibe technologies"
          icon="business-outline"
          onPress={() => openStack("AboutAccountsCentre")}
        />
      </InformationPermissionCard>

      <AccountCenterSectionTitle title="What you can do" />

      <InformationPermissionCard>
        <InformationPermissionRow
          title="Recent Activity"
          icon="time-outline"
          onPress={showRecentActivity}
          showDivider
        />
        {state ? <Text style={styles.recentSummary}>{summary}</Text> : null}
        <InformationPermissionRow
          title="Disconnect Specific Activity"
          icon="ban-outline"
          onPress={disconnectSpecific}
          showDivider
        />
        <InformationPermissionRow
          title="Clear Previous Activity"
          icon="trash-outline"
          onPress={() => openStack("ClearPreviousActivity")}
          showDivider
        />
        <InformationPermissionRow
          title="Manage Future Activity"
          icon="sync-outline"
          onPress={() => openStack("WhatYouShouldKnow")}
        />
      </InformationPermissionCard>
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
  recentSummary: {
    color: "#97a0a8",
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 14,
    paddingBottom: 12,
    marginTop: -4
  }
});
