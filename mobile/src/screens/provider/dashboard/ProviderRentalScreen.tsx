import React from "react";
import { StyleSheet, View } from "react-native";
import { ProviderChromeHeader, ProviderEmptyState } from "./ProviderChrome";

const BG = "#303132";

export function ProviderRentalScreen() {
  return (
    <View style={styles.screen}>
      <ProviderChromeHeader />
      <ProviderEmptyState
        title="Rental"
        subtitle="Manage machinery, drivers, land, and warehouse listings."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG }
});
