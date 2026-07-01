import React, { useMemo, useState } from "react";
import { Alert, StyleSheet, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AccountCenterSubLayout } from "../components/accountCenter/AccountCenterSubLayout";
import { ProfileAccountListCard } from "../components/accountCenter/ProfileAccountListCard";
import { useAuth } from "../auth/AuthContext";
import type { RootStackParamList } from "../navigation/rootStackTypes";
import { buildProfileAccounts } from "../utils/contactsUploadStorage";

export function ClearPreviousActivityScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<string>("business");

  const accounts = useMemo(() => (user ? buildProfileAccounts(user) : []), [user]);

  const clearSelected = () => {
    if (!selectedId) {
      Alert.alert("Select a profile", "Choose which profile activity you want to clear.");
      return;
    }
    navigation.navigate("ConfirmItsYou", {
      title: "Confirm It's You",
      description: "For your security, re-enter your password before clearing previous activity for the selected profile.",
      action: "clearOffCropvibeActivity",
      profileId: selectedId
    });
  };

  return (
    <AccountCenterSubLayout
      title="Clear Previous Activity"
      description={
        <Text style={styles.description}>
          Remove your recent activity history from cropvibe. This disconnects previously recorded interactions from your
          account and helps reset your personalized recommendations.
        </Text>
      }
      contentStyle={styles.content}
    >
      <ProfileAccountListCard
        sectionTitle="Clear Previous Activity"
        headerActionLabel="Clear"
        onHeaderAction={clearSelected}
        accounts={accounts}
        selectedId={selectedId}
        selectionMode
        onPressAccount={(account) => setSelectedId(account.id)}
      />
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
  }
});
