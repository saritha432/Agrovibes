import React from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AccountCenterSubBottomSheet } from "../components/accountCenter/AccountCenterSubBottomSheet";
import { SearchHistoryContent } from "../components/accountCenter/SearchHistoryContent";
import type { RootStackParamList } from "../navigation/rootStackTypes";

export function SearchHistoryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <AccountCenterSubBottomSheet visible onClose={() => navigation.goBack()}>
      <SearchHistoryContent />
    </AccountCenterSubBottomSheet>
  );
}
