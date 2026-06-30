import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import {
  AccountCenterCard,
  AccountCenterChevronRow,
  AccountCenterSectionTitle,
  AccountCenterSubLayout
} from "../components/accountCenter/AccountCenterSubLayout";
import type { RootStackParamList } from "../navigation/rootStackTypes";
import { APP_LIME } from "../theme/appColors";

type DevicePlatform = "android" | "ios" | "windows";

type LoginDevice = {
  key: string;
  platform: DevicePlatform;
  name: string;
  detail: string;
};

const DEVICES: LoginDevice[] = [
  { key: "oneplus", platform: "android", name: "OnePlus Nord", detail: "Hyderabad, India | Yesterday at 11:29" },
  { key: "moto", platform: "android", name: "Motorola Moto X4", detail: "Chanda Nagar, India | 10 August 2023" },
  { key: "iphone", platform: "ios", name: "iPhone 17 Pro", detail: "Hyderabad, India | 2 days ago" },
  { key: "windows", platform: "windows", name: "Windows PC", detail: "Secunderabad, India | 5 August 2023" }
];

function platformIcon(platform: DevicePlatform): keyof typeof Ionicons.glyphMap {
  if (platform === "ios") return "logo-apple";
  if (platform === "windows") return "logo-windows";
  return "logo-android";
}

function DeviceIcon({ platform }: { platform: DevicePlatform }) {
  return (
    <View style={styles.deviceIconWrap}>
      <Ionicons name={platformIcon(platform)} size={22} color={APP_LIME} />
    </View>
  );
}

export function LoginActivityScreen() {
  const route = useRoute<RouteProp<RootStackParamList, "LoginActivity">>();
  const accountName = route.params?.accountName;

  return (
    <AccountCenterSubLayout
      title="Login Activity"
      description={
        <Text style={{ color: "#97a0a8", fontSize: 14, lineHeight: 21 }}>
          You're Currently Logged In On These Devices.
          {accountName ? ` (${accountName})` : ""}
        </Text>
      }
    >
      <AccountCenterSectionTitle title="Logins On Other Devices" />
      <AccountCenterCard>
        {DEVICES.map((device, index) => (
          <AccountCenterChevronRow
            key={device.key}
            title={device.name}
            subtitle={device.detail}
            onPress={() => {}}
            showDivider={index < DEVICES.length - 1}
            left={<DeviceIcon platform={device.platform} />}
          />
        ))}
      </AccountCenterCard>
    </AccountCenterSubLayout>
  );
}

const styles = StyleSheet.create({
  deviceIconWrap: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center"
  }
});
