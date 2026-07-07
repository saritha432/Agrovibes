import React from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AccountCenterSubBottomSheet } from "../components/accountCenter/AccountCenterSubBottomSheet";
import { ConnectedExperiencesContent } from "../components/accountCenter/ConnectedExperiencesContent";
import type { RootStackParamList } from "../navigation/rootStackTypes";

export function ConnectedExperiencesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <AccountCenterSubBottomSheet visible onClose={() => navigation.goBack()}>
      <ConnectedExperiencesContent />
    </AccountCenterSubBottomSheet>
  );
}
