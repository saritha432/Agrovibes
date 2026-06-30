import React from "react";
import { StyleSheet, Text } from "react-native";
import { AccountCenterSubLayout } from "../components/accountCenter/AccountCenterSubLayout";

export function ManagingAvatarsScreen() {
  return (
    <AccountCenterSubLayout
      title="Managing Avatars"
      description={
        <Text style={styles.description}>
          Create and manage avatars that represent you across connected profiles and experiences.
        </Text>
      }
    >
      <Text style={styles.placeholder}>
        Avatar management will be available once your connected accounts are linked.
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
