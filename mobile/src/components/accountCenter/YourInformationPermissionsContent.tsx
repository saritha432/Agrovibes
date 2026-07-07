import React from "react";
import { Linking, StyleSheet, Text } from "react-native";
import {
  InformationPermissionCard,
  InformationPermissionRow
} from "./InformationPermissionRows";
import { AccountCenterSubLayout } from "./AccountCenterSubLayout";
import { useAccountCenterSheetNav } from "./accountCenterSheetNav";
import type { RootStackParamList } from "../../navigation/rootStackTypes";
import { getWebAppOrigin } from "../../services/api";

export function YourInformationPermissionsContent() {
  const { push, pop, close, navigateStack } = useAccountCenterSheetNav();

  const openExport = () => {
    void Linking.openURL(`${getWebAppOrigin()}/privacy-policy`);
  };

  const openStack = (screen: keyof RootStackParamList) => {
    close();
    requestAnimationFrame(() => navigateStack(screen));
  };

  return (
    <AccountCenterSubLayout
      variant="sheet"
      onBack={pop}
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
          onPress={() => push("SearchHistory")}
        />
      </InformationPermissionCard>

      <InformationPermissionCard>
        <InformationPermissionRow
          title="Your activity off Cropvibe Technologies"
          onPress={() => push("ActivityOffCropvibe")}
          showDivider
        />
        <InformationPermissionRow
          title="Activity From Other Businesses"
          trailing="diagonal"
          onPress={() => openStack("ActivityAcrossPartners")}
          showDivider
        />
        <InformationPermissionRow
          title="App Connections"
          onPress={() => openStack("ConnectedApps")}
          showDivider
        />
        <InformationPermissionRow
          title="Upload Contacts"
          onPress={() => openStack("UploadContacts")}
          showDivider
        />
        <InformationPermissionRow
          title="Identity Confirmation"
          onPress={() => openStack("VerificationSelfie")}
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
