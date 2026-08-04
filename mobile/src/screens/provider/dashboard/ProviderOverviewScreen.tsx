import React from "react";
import { StyleSheet, View } from "react-native";
import { ProviderChromeHeader, ProviderEmptyState } from "./ProviderChrome";

const BG = "#303132";

export function ProviderOverviewScreen() {
  return (
    <View style={styles.screen}>
      <ProviderChromeHeader />
      <ProviderEmptyState
        title="Overview"
        subtitle="Bookings, earnings, and activity will show here."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG }
});
