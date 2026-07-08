import React from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AccountCenterSubBottomSheet } from "../components/accountCenter/AccountCenterSubBottomSheet";
import { ShowingProfileLinksContent } from "../components/accountCenter/ShowingProfileLinksContent";
import type { RootStackParamList } from "../navigation/rootStackTypes";

export function ShowingProfileLinksScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <AccountCenterSubBottomSheet visible onClose={() => navigation.goBack()}>
      <ShowingProfileLinksContent />
    </AccountCenterSubBottomSheet>
  );
}
