import React from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AccountCenterSubBottomSheet } from "../components/accountCenter/AccountCenterSubBottomSheet";
import { YourInformationPermissionsContent } from "../components/accountCenter/YourInformationPermissionsContent";
import type { RootStackParamList } from "../navigation/rootStackTypes";

export function YourInformationPermissionsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <AccountCenterSubBottomSheet visible onClose={() => navigation.goBack()}>
      <YourInformationPermissionsContent />
    </AccountCenterSubBottomSheet>
  );
}
