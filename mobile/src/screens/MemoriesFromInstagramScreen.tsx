import React from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AccountCenterSubBottomSheet } from "../components/accountCenter/AccountCenterSubBottomSheet";
import { MemoriesFromCropvibeContent } from "../components/accountCenter/MemoriesFromCropvibeContent";
import type { RootStackParamList } from "../navigation/rootStackTypes";

export function MemoriesFromInstagramScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <AccountCenterSubBottomSheet visible onClose={() => navigation.goBack()}>
      <MemoriesFromCropvibeContent />
    </AccountCenterSubBottomSheet>
  );
}
