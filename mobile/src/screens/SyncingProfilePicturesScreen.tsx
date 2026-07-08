import React from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AccountCenterSubBottomSheet } from "../components/accountCenter/AccountCenterSubBottomSheet";
import { SyncingProfilePicturesContent } from "../components/accountCenter/SyncingProfilePicturesContent";
import type { RootStackParamList } from "../navigation/rootStackTypes";

export function SyncingProfilePicturesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <AccountCenterSubBottomSheet visible onClose={() => navigation.goBack()}>
      <SyncingProfilePicturesContent />
    </AccountCenterSubBottomSheet>
  );
}
