import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AccountCenterAddAction } from "./AccountCenterAddAction";
import { AccountCenterCard, AccountCenterChevronRow, AccountCenterSubLayout } from "./AccountCenterSubLayout";
import { showAddConnectedAccountAlert } from "./showAddConnectedAccountAlert";
import { useAccountCenterSheetNav } from "./accountCenterSheetNav";
import type { AccountCenterSheetRoute } from "./accountCenterSheetNav";
import { useConnectedExperiences } from "../../hooks/useConnectedExperiences";
import { APP_LIME } from "../../theme/appColors";

type MenuItem = {
  key: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: AccountCenterSheetRoute;
};

const MENU_ITEMS: MenuItem[] = [
  { key: "sharing", title: "Sharing Across Profiles", icon: "git-compare-outline", route: "SharingAcrossProfiles" },
  { key: "memories", title: "Memories From Cropvibe", icon: "albums-outline", route: "MemoriesFromInstagram" },
  { key: "links", title: "Showing Links For Your Profiles", icon: "link-outline", route: "ShowingProfileLinks" },
  { key: "sync", title: "Syncing Profile Pictures", icon: "images-outline", route: "SyncingProfilePictures" }
];

export function ConnectedExperiencesContent() {
  const { push, pop, close, navigateStack } = useAccountCenterSheetNav();
  const { user, applyState } = useConnectedExperiences();

  const addAccounts = () => {
    if (!user) return;
    showAddConnectedAccountAlert(user, applyState);
  };

  return (
    <AccountCenterSubLayout
      variant="sheet"
      onBack={pop}
      title="Connected Experiences"
      description={
        <Text style={styles.description}>
          Manage how your profiles and connected accounts work together across cropvibe.
        </Text>
      }
    >
      <AccountCenterAddAction label="+ Add Accounts" onPress={addAccounts} />

      <AccountCenterCard>
        {MENU_ITEMS.map((item, index) => (
          <AccountCenterChevronRow
            key={item.key}
            title={item.title}
            onPress={() => push(item.route)}
            showDivider={index < MENU_ITEMS.length - 1}
            left={<Ionicons name={item.icon} size={22} color={APP_LIME} style={styles.icon} />}
          />
        ))}
      </AccountCenterCard>

      <View style={styles.secondaryCard}>
        <AccountCenterCard>
        <AccountCenterChevronRow
          title="Managing Avatars"
          onPress={() => {
            close();
            requestAnimationFrame(() => navigateStack("ManagingAvatars"));
          }}
          left={<Ionicons name="person-outline" size={22} color={APP_LIME} style={styles.icon} />}
        />
        </AccountCenterCard>
      </View>
    </AccountCenterSubLayout>
  );
}

const styles = StyleSheet.create({
  description: {
    color: "#97a0a8",
    fontSize: 14,
    lineHeight: 21
  },
  icon: {
    width: 28,
    textAlign: "center"
  },
  secondaryCard: {
    marginTop: 14
  }
});
