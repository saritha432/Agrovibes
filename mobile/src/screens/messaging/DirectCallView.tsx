import React from "react";
import { Platform, Text, View } from "react-native";
import type { CallDirection, CallEndResult, DirectCallMode } from "./DirectCallView.native";

type DirectCallViewProps = {
  visible: boolean;
  roomName: string;
  mode: DirectCallMode;
  direction: CallDirection;
  peerName: string;
  peerAvatarUrl?: string | null;
  connectEnabled: boolean;
  statusLabel?: string;
  onAccept?: () => void;
  onDecline?: () => void;
  onCallEnded?: (result: CallEndResult) => void;
  onClose: () => void;
};

export type { CallDirection, CallEndResult, DirectCallMode };

export function DirectCallView(props: DirectCallViewProps) {
  if (Platform.OS === "web") {
    if (!props.visible) return null;
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#121212" }}>
        <Text style={{ color: "#fff" }}>Voice and video calls are available in the mobile app.</Text>
      </View>
    );
  }
  const Native = require("./DirectCallView.native").DirectCallView as React.ComponentType<DirectCallViewProps>;
  return <Native {...props} />;
}
