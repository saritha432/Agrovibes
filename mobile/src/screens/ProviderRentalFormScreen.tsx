import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../theme/appColors";

const BG = "#1a1a1a";
const CARD = "#2b2c2e";
const TEXT = APP_TEXT;
const MUTED = APP_TEXT_MUTED;
const DIVIDER = "rgba(255,255,255,0.08)";

const STEPS = [
  { id: 1, label: "Rental", sub: "Choose a category." },
  { id: 2, label: "Personal Details", sub: "Description Text" },
  { id: 3, label: "", sub: "" }
];

const CATEGORIES = ["Machinery", "Drivers", "Workers", "Land", "Warehouse"] as const;
type Category = (typeof CATEGORIES)[number];

const PRICE_UNITS = ["Per Hour", "Per Day", "Per Acre", "Per Trip"] as const;
type PriceUnit = (typeof PRICE_UNITS)[number];

const TYPE_OPTIONS: Record<Category, string[]> = {
  Machinery: ["Tractor", "Harvester", "Thresher", "Rotavator", "Sprayer", "Plough", "Leveller", "Other"],
  Drivers: ["Tractor Driver", "Truck Driver", "Other"],
  Workers: ["Farm Laborer", "Transplanting Team", "Harvesting Team", "Other"],
  Land: ["Agricultural Land", "Storage Land", "Other"],
  Warehouse: ["Cold Storage", "Dry Storage", "Other"]
};

const MAKE_OPTIONS = ["Mahindra", "John Deere", "Sonalika", "TAFE", "New Holland", "Eicher", "Other"];
const YEAR_OPTIONS = Array.from({ length: 30 }, (_, i) => String(new Date().getFullYear() - i));

function StepBar({ currentStep }: { currentStep: number }) {
  return (
    <View style={styles.stepBar}>
      {STEPS.map((step, index) => {
        const active = step.id === currentStep;
        const done = step.id < currentStep;
        return (
          <React.Fragment key={step.id}>
            <View style={styles.stepItem}>
              <View style={[styles.stepNum, active && styles.stepNumActive, done && styles.stepNumDone]}>
                {done ? (
                  <Ionicons name="checkmark" size={12} color="#000" />
                ) : (
                  <Text style={[styles.stepNumText, active && styles.stepNumTextActive]}>
                    {String(step.id).padStart(2, "0")}
                  </Text>
                )}
              </View>
              {step.label ? (
                <View>
                  <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{step.label}</Text>
                  <Text style={styles.stepSub}>{step.sub}</Text>
                </View>
              ) : null}
            </View>
            {index < STEPS.length - 1 ? (
              <View style={[styles.stepLine, done && styles.stepLineDone]} />
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

function ChipRow<T extends string>({
  items,
  selected,
  onSelect
}: {
  items: readonly T[];
  selected: T;
  onSelect: (val: T) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {items.map((item) => {
        const active = item === selected;
        return (
          <Pressable
            key={item}
            onPress={() => onSelect(item)}
            style={[styles.chip, active && styles.chipActive]}
            accessibilityRole="button"
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{item}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SelectDropdown({
  placeholder,
  value,
  options,
  onSelect
}: {
  placeholder: string;
  value: string;
  options: string[];
  onSelect: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable style={styles.dropdown} onPress={() => setOpen((v) => !v)}>
        <Text style={value ? styles.dropdownVal : styles.dropdownPlaceholder}>
          {value || placeholder}
        </Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={MUTED} />
      </Pressable>
      {open ? (
        <View style={styles.dropdownList}>
          {options.map((opt) => (
            <Pressable
              key={opt}
              style={styles.dropdownItem}
              onPress={() => {
                onSelect(opt);
                setOpen(false);
              }}
            >
              <Text style={styles.dropdownItemText}>{opt}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function ProviderRentalFormScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [category, setCategory] = useState<Category>("Machinery");
  const [selectedType, setSelectedType] = useState("");
  const [selectedMake, setSelectedMake] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [priceUnit, setPriceUnit] = useState<PriceUnit>("Per Day");
  const [amount, setAmount] = useState("300");
  const [radius, setRadius] = useState(20);
  const [serviceArea, setServiceArea] = useState("");
  const [availability, setAvailability] = useState(true);

  const typeOptions = TYPE_OPTIONS[category] ?? [];

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={APP_LIME} />
        </Pressable>
        <Text style={styles.topTitle}>Settings & Privacy</Text>
        <View style={styles.backBtn} />
      </View>

      <StepBar currentStep={1} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.heading}>What Are You Renting Out?</Text>
        <Text style={styles.sub}>Pick everything that applies</Text>

        <ChipRow items={CATEGORIES} selected={category} onSelect={(v) => { setCategory(v); setSelectedType(""); }} />

        <View style={styles.fieldGap} />

        <SelectDropdown
          placeholder="Select Type"
          value={selectedType}
          options={typeOptions}
          onSelect={setSelectedType}
        />

        <View style={styles.fieldGap} />

        <View style={styles.twoCol}>
          <View style={styles.colHalf}>
            <SelectDropdown
              placeholder="Select Mode..."
              value={selectedMake}
              options={MAKE_OPTIONS}
              onSelect={setSelectedMake}
            />
          </View>
          <View style={styles.colHalf}>
            <SelectDropdown
              placeholder="select year..."
              value={selectedYear}
              options={YEAR_OPTIONS}
              onSelect={setSelectedYear}
            />
          </View>
        </View>

        <View style={styles.fieldGap} />

        <Text style={styles.fieldLabel}>Price Unit</Text>
        <ChipRow items={PRICE_UNITS} selected={priceUnit} onSelect={setPriceUnit} />

        <View style={styles.fieldGap} />

        <TextInput
          style={styles.amountInput}
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          placeholder="Enter Amount (₹)*"
          placeholderTextColor={MUTED}
        />

        <View style={styles.fieldGap} />

        <Text style={styles.fieldLabel}>Service Area</Text>
        <View style={styles.sliderWrap}>
          <Text style={styles.sliderLabel}>With in {radius}km</Text>
          <View style={styles.sliderTrack}>
            <View style={[styles.sliderFill, { width: `${(radius / 100) * 100}%` }]} />
            <Pressable
              style={[styles.sliderThumb, { left: `${(radius / 100) * 100}%` as unknown as number }]}
              onStartShouldSetResponder={() => true}
            />
          </View>
          <View style={styles.sliderTicks}>
            {[0, 25, 50, 75, 100].map((v) => (
              <Pressable key={v} onPress={() => setRadius(v)}>
                <Text style={styles.sliderTick}>{v}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <TextInput
          style={styles.areaInput}
          value={serviceArea}
          onChangeText={setServiceArea}
          placeholder="Enter Service Area"
          placeholderTextColor={MUTED}
        />

        <View style={styles.fieldGap} />

        <Pressable
          style={styles.checkRow}
          onPress={() => setAvailability((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: availability }}
        >
          <Ionicons
            name={availability ? "checkbox-outline" : "square-outline"}
            size={20}
            color={availability ? APP_LIME : MUTED}
          />
          <Text style={styles.checkText}>Availability</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.nextBtn} onPress={() => {}} accessibilityRole="button">
          <Text style={styles.nextBtnText}>Continue</Text>
          <Ionicons name="arrow-forward" size={18} color="#000" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 10
  },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  topTitle: { flex: 1, textAlign: "center", color: TEXT, fontSize: 15, fontWeight: "600" },
  stepBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: DIVIDER
  },
  stepItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: MUTED,
    alignItems: "center",
    justifyContent: "center"
  },
  stepNumActive: { borderColor: APP_LIME, backgroundColor: "transparent" },
  stepNumDone: { borderColor: APP_LIME, backgroundColor: APP_LIME },
  stepNumText: { color: MUTED, fontSize: 10, fontWeight: "700" },
  stepNumTextActive: { color: APP_LIME },
  stepLabel: { color: MUTED, fontSize: 11, fontWeight: "600" },
  stepLabelActive: { color: APP_LIME },
  stepSub: { color: "rgba(255,255,255,0.35)", fontSize: 9 },
  stepLine: { flex: 1, height: 1, backgroundColor: MUTED, marginHorizontal: 6 },
  stepLineDone: { backgroundColor: APP_LIME },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 20 },
  heading: { color: TEXT, fontSize: 26, fontWeight: "700", lineHeight: 33, marginBottom: 4 },
  sub: { color: MUTED, fontSize: 13, marginBottom: 16 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "transparent"
  },
  chipActive: { borderColor: APP_LIME, backgroundColor: "rgba(201,255,53,0.1)" },
  chipText: { color: MUTED, fontSize: 13, fontWeight: "500" },
  chipTextActive: { color: APP_LIME, fontWeight: "700" },
  fieldGap: { height: 14 },
  fieldLabel: { color: TEXT, fontSize: 13, fontWeight: "600", marginBottom: 10 },
  dropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: CARD,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)"
  },
  dropdownVal: { color: TEXT, fontSize: 14 },
  dropdownPlaceholder: { color: MUTED, fontSize: 14 },
  dropdownList: {
    backgroundColor: "#333435",
    borderRadius: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    zIndex: 99,
    maxHeight: 200,
    overflow: "hidden"
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)"
  },
  dropdownItemText: { color: TEXT, fontSize: 14 },
  twoCol: { flexDirection: "row", gap: 10 },
  colHalf: { flex: 1 },
  amountInput: {
    backgroundColor: CARD,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: APP_LIME,
    fontSize: 22,
    fontWeight: "700",
    borderWidth: 1,
    borderColor: "rgba(201,255,53,0.25)"
  },
  sliderWrap: { marginBottom: 10 },
  sliderLabel: { color: TEXT, fontSize: 13, fontWeight: "600", textAlign: "center", marginBottom: 10 },
  sliderTrack: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 2,
    position: "relative",
    justifyContent: "center"
  },
  sliderFill: { height: 4, backgroundColor: APP_LIME, borderRadius: 2 },
  sliderThumb: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: APP_LIME,
    top: -8,
    marginLeft: -10
  },
  sliderTicks: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8
  },
  sliderTick: { color: MUTED, fontSize: 10 },
  areaInput: {
    backgroundColor: CARD,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: TEXT,
    fontSize: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)"
  },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkText: { color: TEXT, fontSize: 14, fontWeight: "500" },
  footer: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 10 },
  nextBtn: {
    backgroundColor: APP_LIME,
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  nextBtnText: { color: "#000", fontSize: 15, fontWeight: "800" }
});
