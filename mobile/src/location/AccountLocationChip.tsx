import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { LocationMapPicker } from "../components/LocationMapPicker";
import { useUserLocation } from "./UserLocationContext";

type Props = {
  variant?: "light" | "dark";
};

export function AccountLocationChip({ variant = "light" }: Props) {
  const { shortLabel, label, lat, lng, hasSaved, saveLocation } = useUserLocation();
  const [open, setOpen] = useState(false);
  const dark = variant === "dark";

  return (
    <>
      <Pressable
        style={dark ? styles.darkChip : styles.lightChip}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Location ${shortLabel}`}
      >
        <Ionicons name="location-outline" size={14} color={dark ? "#C9FF35" : "#1f2c29"} />
        <Text style={dark ? styles.darkText : styles.lightText} numberOfLines={1}>
          {shortLabel}
        </Text>
        <Ionicons name="chevron-down" size={14} color={dark ? "#a8b0b8" : "#1f2c29"} />
      </Pressable>
      <LocationMapPicker
        open={open}
        mode={hasSaved ? "manual" : "manual"}
        label={hasSaved ? label : ""}
        lat={lat}
        lng={lng}
        onClose={() => setOpen(false)}
        onSelect={(value) => {
          void saveLocation({ label: value.label, lat: value.lat, lng: value.lng }).catch(() => undefined);
          setOpen(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  lightChip: { flexDirection: "row", alignItems: "center", gap: 4, maxWidth: 160 },
  lightText: { fontWeight: "700", color: "#1f2c29", fontSize: 13, maxWidth: 120 },
  darkChip: { flexDirection: "row", alignItems: "center", gap: 4, maxWidth: 220 },
  darkText: { fontWeight: "800", color: "#f8fafc", fontSize: 16, maxWidth: 180 }
});
