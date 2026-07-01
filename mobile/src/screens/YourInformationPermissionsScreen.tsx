import React from "react";
import { Linking, StyleSheet, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  InformationPermissionCard,
  InformationPermissionRow
} from "../components/accountCenter/InformationPermissionRows";
import { AccountCenterSubLayout } from "../components/accountCenter/AccountCenterSubLayout";
import type { RootStackParamList } from "../navigation/rootStackTypes";
import { getWebAppOrigin } from "../services/api";

export function YourInformationPermissionsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const openExport = () => {
    void Linking.openURL(`${getWebAppOrigin()}/privacy-policy`);
  };

  return (
    <AccountCenterSubLayout
      title="Your Information & Permissions"
      description={
        <Text style={styles.description}>
          To download or transfer a copy of your information, go to export your information.
        </Text>
      }
      contentStyle={styles.content}
    >
      <InformationPermissionCard>
        <InformationPermissionRow
          title="Export Your Information"
          icon="document-text-outline"
          trailing="external"
          onPress={openExport}
          showDivider
        />
        <InformationPermissionRow
          title="Search History"
          icon="search-outline"
          onPress={() => navigation.navigate("SearchHistory")}
        />
      </InformationPermissionCard>

      <InformationPermissionCard>
        <InformationPermissionRow
          title="Your activity off Cropvibe Technologies"
          onPress={() => navigation.navigate("ActivityOffCropvibe")}
          showDivider
        />
        <InformationPermissionRow
          title="Activity From Other Businesses"
          trailing="diagonal"
          onPress={() => navigation.navigate("ActivityAcrossPartners")}
          showDivider
        />
        <InformationPermissionRow
          title="App Connections"
          onPress={() => navigation.navigate("ConnectedApps")}
          showDivider
        />
        <InformationPermissionRow
          title="Upload Contacts"
          onPress={() => navigation.navigate("UploadContacts")}
          showDivider
        />
        <InformationPermissionRow
          title="Identity Confirmation"
          onPress={() => navigation.navigate("VerificationSelfie")}
        />
      </InformationPermissionCard>

      <Text style={styles.footer}>
        These settings help you understand and control how your information is used across cropvibe products.
      </Text>
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
  },
  footer: {
    color: "#97a0a8",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4
  }
});
