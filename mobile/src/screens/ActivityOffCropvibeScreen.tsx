import React from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AccountCenterSubBottomSheet } from "../components/accountCenter/AccountCenterSubBottomSheet";
import { ActivityOffCropvibeContent } from "../components/accountCenter/ActivityOffCropvibeContent";
import type { RootStackParamList } from "../navigation/rootStackTypes";

export function ActivityOffCropvibeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <AccountCenterSubBottomSheet visible onClose={() => navigation.goBack()}>
      <ActivityOffCropvibeContent />
    </AccountCenterSubBottomSheet>
  );
}
