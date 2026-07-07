import React from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AccountCenterSubBottomSheet } from "../components/accountCenter/AccountCenterSubBottomSheet";
import { SharingAcrossProfilesContent } from "../components/accountCenter/SharingAcrossProfilesContent";
import type { RootStackParamList } from "../navigation/rootStackTypes";

export function SharingAcrossProfilesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <AccountCenterSubBottomSheet visible onClose={() => navigation.goBack()}>
      <SharingAcrossProfilesContent />
    </AccountCenterSubBottomSheet>
  );
}
