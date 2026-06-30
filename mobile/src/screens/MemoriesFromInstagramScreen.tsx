import React from "react";
import { StyleSheet, Text } from "react-native";
import { AccountCenterSubLayout } from "../components/accountCenter/AccountCenterSubLayout";

export function MemoriesFromInstagramScreen() {
  return (
    <AccountCenterSubLayout
      title="Memories From Instagram"
      description={
        <Text style={styles.description}>
          Control whether memories from Instagram can appear in your cropvibe experience across connected profiles.
        </Text>
      }
    >
      <Text style={styles.placeholder}>
        Connect an Instagram account to manage memories sharing across your profiles.
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
  placeholder: {
    color: "#97a0a8",
    fontSize: 14,
    lineHeight: 21
  }
});
