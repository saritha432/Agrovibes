import React from "react";
import { StyleSheet, View } from "react-native";
import { ProviderChromeHeader, ProviderEmptyState } from "./ProviderChrome";

const BG = "#303132";

export function ProviderServicesHubScreen() {
  return (
    <View style={styles.screen}>
      <ProviderChromeHeader />
      <ProviderEmptyState
        title="Services"
        subtitle="Manage expert, technician, and soil-testing services."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG }
});
