import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AccountCenterAddAction } from "../components/accountCenter/AccountCenterAddAction";
import { AccountCenterSubLayout } from "../components/accountCenter/AccountCenterSubLayout";
import { showAddConnectedAccountAlert } from "../components/accountCenter/showAddConnectedAccountAlert";
import { useConnectedExperiences } from "../hooks/useConnectedExperiences";
import type { RootStackParamList } from "../navigation/rootStackTypes";
import { APP_LIME, APP_SURFACE, APP_TEXT, APP_TEXT_MUTED } from "../theme/appColors";

type ConnectedRoute =
  | "SharingAcrossProfiles"
  | "MemoriesFromInstagram"
  | "ShowingProfileLinks"
  | "SyncingProfilePictures"
  | "ManagingAvatars";

type MenuItem = {
  key: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: ConnectedRoute;
};

const MENU_ITEMS: MenuItem[] = [
  { key: "sharing", title: "Sharing Across Profiles", icon: "person-add-outline", route: "SharingAcrossProfiles" },
  { key: "memories", title: "Memories From Cropvibe", icon: "albums-outline", route: "MemoriesFromInstagram" },
  { key: "links", title: "Showing Links For Your Profiles", icon: "link-outline", route: "ShowingProfileLinks" },
  { key: "sync", title: "Syncing Profile Pictures", icon: "image-outline", route: "SyncingProfilePictures" },
  { key: "avatars", title: "Managing Avatars", icon: "person-outline", route: "ManagingAvatars" }
];

function ExperienceRow({
  title,
  icon,
  onPress,
  showDivider
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  showDivider?: boolean;
}) {
  return (
    <>
      <Pressable style={styles.row} onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={22} color={APP_LIME} />
        </View>
        <Text style={styles.rowTitle}>{title}</Text>
        <Ionicons name="chevron-forward" size={18} color={APP_TEXT_MUTED} />
      </Pressable>
      {showDivider ? <View style={styles.divider} /> : null}
    </>
  );
}

export function ConnectedExperiencesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, applyState } = useConnectedExperiences();

  const addAccounts = () => {
    if (!user) return;
    showAddConnectedAccountAlert(user, applyState);
  };

  return (
    <AccountCenterSubLayout title="Connected Experiences">
      <AccountCenterAddAction label="+ Add Accounts" onPress={addAccounts} />

      <View style={styles.card}>
        {MENU_ITEMS.map((item, index) => (
          <ExperienceRow
            key={item.key}
            title={item.title}
            icon={item.icon}
            onPress={() => navigation.navigate(item.route)}
            showDivider={index < MENU_ITEMS.length - 1}
          />
        ))}
      </View>
    </AccountCenterSubLayout>
  );
}

const styles = StyleSheet.create({
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
    gap: 14
  },
  iconWrap: {
    width: 28,
    alignItems: "center"
  },
  rowTitle: {
    flex: 1,
    color: APP_TEXT,
    fontSize: 15,
    fontWeight: "600"
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#3a3a3a",
    marginLeft: 14 + 28 + 14
  }
});
