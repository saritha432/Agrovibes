import React from "react";
import { StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { AccountCenterBottomSheet } from "../components/accountCenter/AccountCenterBottomSheet";
import type { AccountCenterNavigation } from "../components/accountCenter/AccountCenterContent";

export function AccountCenterScreen() {
  const navigation = useNavigation<AccountCenterNavigation>();

  return (
    <View style={styles.host}>
      <AccountCenterBottomSheet visible onClose={() => navigation.goBack()} />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    backgroundColor: "transparent"
  }
});
