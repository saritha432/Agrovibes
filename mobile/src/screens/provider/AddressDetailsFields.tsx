import React, { useEffect, useState } from "react";
import { FlatList, Modal, Pressable, Text, TextInput, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fetchLocationCities, fetchLocationDistricts, fetchLocationStates } from "../../services/api";
import { APP_LIME } from "../../theme/appColors";
import { PROVIDER_CARD, PROVIDER_MUTED, PROVIDER_TEXT, providerFormStyles as pf } from "./providerFormUi";

type Props = {
  address: string;
  stateName: string;
  district: string;
  city: string;
  pinCode: string;
  onChangeAddress: (value: string) => void;
  onChangeState: (value: string) => void;
  onChangeDistrict: (value: string) => void;
  onChangeCity: (value: string) => void;
  onChangePin: (value: string) => void;
};

export function AddressDetailsFields({
  address,
  stateName,
  district,
  city,
  pinCode,
  onChangeAddress,
  onChangeState,
  onChangeDistrict,
  onChangeCity,
  onChangePin
}: Props) {
  const [states, setStates] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [picker, setPicker] = useState<"state" | "district" | "city" | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    fetchLocationStates()
      .then((result) => {
        if (active) setStates(result.states.map((item) => item.name));
      })
      .catch(() => {
        if (active) setLoadError("Could not load states.");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!stateName) {
      setDistricts([]);
      return;
    }
    let active = true;
    fetchLocationDistricts(stateName)
      .then((result) => {
        if (active) setDistricts(result.districts);
      })
      .catch(() => {
        if (active) setLoadError("Could not load districts.");
      });
    return () => {
      active = false;
    };
  }, [stateName]);

  useEffect(() => {
    if (!stateName || !district) {
      setCities([]);
      return;
    }
    let active = true;
    fetchLocationCities(stateName, district)
      .then((result) => {
        if (active) setCities(result.cities);
      })
      .catch(() => {
        if (active) setLoadError("Could not load cities.");
      });
    return () => {
      active = false;
    };
  }, [stateName, district]);

  const options = picker === "state" ? states : picker === "district" ? districts : cities;
  const choose = (value: string) => {
    if (picker === "state") {
      onChangeState(value);
      onChangeDistrict("");
      onChangeCity("");
    } else if (picker === "district") {
      onChangeDistrict(value);
      onChangeCity("");
    } else if (picker === "city") {
      onChangeCity(value);
    }
    setPicker(null);
  };

  return (
    <View>
      <Text style={[pf.sectionTitle, { marginTop: 14, fontSize: 18 }]}>Address details</Text>
      <Text style={styles.label}>Address</Text>
      <TextInput
        style={pf.input}
        value={address}
        onChangeText={onChangeAddress}
        placeholder="Enter address"
        placeholderTextColor={PROVIDER_MUTED}
      />
      <SelectField label="State" value={stateName} placeholder="Select state" onPress={() => setPicker("state")} />
      <SelectField
        label="District"
        value={district}
        placeholder="Select district"
        disabled={!stateName}
        onPress={() => setPicker("district")}
      />
      <SelectField
        label="City"
        value={city}
        placeholder="Select city"
        disabled={!district}
        onPress={() => setPicker("city")}
      />
      <Text style={styles.label}>PIN code</Text>
      <TextInput
        style={pf.input}
        value={pinCode}
        onChangeText={(value) => onChangePin(value.replace(/\D/g, "").slice(0, 6))}
        placeholder="6-digit PIN code"
        placeholderTextColor={PROVIDER_MUTED}
        keyboardType="number-pad"
        maxLength={6}
      />
      {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
      <Modal visible={picker !== null} animationType="slide" transparent onRequestClose={() => setPicker(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPicker(null)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Text style={styles.sheetTitle}>
              {picker === "state" ? "Select state" : picker === "district" ? "Select district" : "Select city"}
            </Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable style={styles.option} onPress={() => choose(item)}>
                  <Text style={styles.optionText}>{item}</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.empty}>No places found.</Text>}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function SelectField({
  label,
  value,
  placeholder,
  disabled,
  onPress
}: {
  label: string;
  value: string;
  placeholder: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={[styles.select, disabled && styles.selectOff]} onPress={onPress} disabled={disabled}>
        <Text style={value ? styles.value : styles.placeholder}>{value || placeholder}</Text>
        <Ionicons name="chevron-down" size={18} color={PROVIDER_MUTED} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: PROVIDER_TEXT, fontSize: 13, fontWeight: "600", marginBottom: 8 },
  select: {
    backgroundColor: PROVIDER_CARD,
    borderRadius: 8,
    paddingHorizontal: 14,
    minHeight: 48,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  selectOff: { opacity: 0.55 },
  value: { color: PROVIDER_TEXT, fontSize: 14, flex: 1 },
  placeholder: { color: PROVIDER_MUTED, fontSize: 14, flex: 1 },
  error: { color: "#ff8a80", fontSize: 13, marginBottom: 8 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: { maxHeight: "70%", backgroundColor: "#1a1a1a", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 },
  sheetTitle: { color: APP_LIME, fontSize: 16, fontWeight: "800", marginBottom: 8 },
  option: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" },
  optionText: { color: PROVIDER_TEXT, fontSize: 15 },
  empty: { color: PROVIDER_MUTED, paddingVertical: 20 }
});
