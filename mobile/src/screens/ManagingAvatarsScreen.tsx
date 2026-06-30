import React from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AccountCenterAddAction } from "../components/accountCenter/AccountCenterAddAction";
import { AccountCenterCard, AccountCenterSectionTitle, AccountCenterSubLayout } from "../components/accountCenter/AccountCenterSubLayout";
import { showAddConnectedAccountAlert } from "../components/accountCenter/showAddConnectedAccountAlert";
import { useConnectedExperiences } from "../hooks/useConnectedExperiences";
import { addManagedAvatar, removeManagedAvatar } from "../utils/connectedExperiencesStorage";
import { APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../theme/appColors";

export function ManagingAvatarsScreen() {
  const { state, user, applyState } = useConnectedExperiences();

  const addAccounts = () => {
    if (!user) return;
    showAddConnectedAccountAlert(user, applyState);
  };

  const createAvatar = () => {
    if (!user) return;
    if (Platform.OS === "ios") {
      Alert.prompt(
        "Create Avatar",
        "Enter a name for your avatar.",
        async (name) => {
          if (!name?.trim()) return;
          const next = await addManagedAvatar(user, name);
          applyState(next);
        },
        "plain-text",
        "",
        "default"
      );
      return;
    }
    void (async () => {
      const next = await addManagedAvatar(user, `Avatar ${(state?.avatars.length || 0) + 1}`);
      applyState(next);
    })();
  };

  const removeAvatar = (avatarId: string, name: string) => {
    if (!user) return;
    Alert.alert("Remove avatar", `Remove "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const next = await removeManagedAvatar(user, avatarId);
          applyState(next);
        }
      }
    ]);
  };

  const avatars = state?.avatars || [];
  const hasLinkedAccounts = (state?.accounts.length || 0) > 0;

  return (
    <AccountCenterSubLayout
      title="Managing Avatars"
      description={
        <Text style={styles.description}>
          Create and manage avatars that represent you across connected profiles and experiences.
        </Text>
      }
    >
      <AccountCenterSectionTitle title="Your Avatars" />
      {avatars.length === 0 ? (
        <AccountCenterCard>
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>
              {hasLinkedAccounts
                ? "Create an avatar to use across your connected profiles."
                : "Link an account first, then create avatars for your profiles."}
            </Text>
          </View>
        </AccountCenterCard>
      ) : (
        <AccountCenterCard>
          {avatars.map((avatar, index) => (
            <View key={avatar.id}>
              <Pressable
                style={styles.avatarRow}
                onPress={() => removeAvatar(avatar.id, avatar.name)}
                accessibilityRole="button"
                accessibilityLabel={`Remove avatar ${avatar.name}`}
              >
                <View style={styles.avatarIcon}>
                  <Ionicons name="happy-outline" size={22} color={APP_LIME} />
                </View>
                <View style={styles.avatarBody}>
                  <Text style={styles.avatarTitle}>{avatar.name}</Text>
                  <Text style={styles.avatarSubtitle}>Tap to remove</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={APP_TEXT_MUTED} />
              </Pressable>
              {index < avatars.length - 1 ? <View style={styles.divider} /> : null}
            </View>
          ))}
        </AccountCenterCard>
      )}

      <AccountCenterAddAction label="+ Create Avatar" onPress={createAvatar} />
      <AccountCenterAddAction label="+ Add Accounts" onPress={addAccounts} />
    </AccountCenterSubLayout>
  );
}

const styles = StyleSheet.create({
  description: {
    color: "#97a0a8",
    fontSize: 14,
    lineHeight: 21
  },
  emptyWrap: {
    paddingHorizontal: 14,
    paddingVertical: 18
  },
  emptyText: {
    color: APP_TEXT_MUTED,
    fontSize: 14,
    lineHeight: 20
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 54,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12
  },
  avatarIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarBody: {
    flex: 1,
    gap: 4
  },
  avatarTitle: {
    color: APP_TEXT,
    fontSize: 15,
    fontWeight: "600"
  },
  avatarSubtitle: {
    color: APP_TEXT_MUTED,
    fontSize: 13
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#3a3a3a",
    marginLeft: 14
  }
});
