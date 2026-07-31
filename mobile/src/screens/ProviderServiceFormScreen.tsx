import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { APP_LIME } from "../theme/appColors";
import {
  PROVIDER_CARD,
  PROVIDER_MUTED,
  PROVIDER_TEXT,
  ProviderContinueButton,
  ProviderFormHeader,
  ProviderStepBar,
  providerFormStyles as pf
} from "./provider/providerFormUi";

const SERVICES = [
  "Agriculture Expert Consultation",
  "Technician Support",
  "Equipment Repairs & Maintenance",
  "Soil Testing",
  "Irrigation Support",
  "Other"
] as const;
type Service = (typeof SERVICES)[number];

const PRICE_UNITS = ["Per Hour", "Per Day", "Per Acre", "Per Trip", "Per Visit", "Per Consultation", "Per Test"] as const;
type PriceUnit = (typeof PRICE_UNITS)[number];

const EXPERT_TYPES = ["Agronomist", "Horticulturist", "Crop Specialist", "Livestock Advisor", "Other"];
const YEARS_PRACTICE = ["0-1 years", "1-3 years", "3-5 years", "5-10 years", "10+ years"];
const EQUIPMENT_TYPES = ["Tractor", "Harvester", "Pump / Motor", "Sprayer", "Irrigation Kit", "Other"];
const SYSTEM_TYPES = ["Drip", "Sprinkler", "Flood", "Pivot", "Other"];
const LAB_AFFILIATIONS = ["NABL Lab", "State Agri Lab", "Private Lab", "On-field Kit", "Other"];
const TEST_TYPES = ["Soil NPK", "pH / EC", "Micronutrients", "Water Quality", "Full Panel", "Other"];
const TURNAROUND = ["Same day", "24 hours", "2-3 days", "1 week", "Other"];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

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
    <View style={{ marginBottom: 12 }}>
      <Pressable style={styles.dropdown} onPress={() => setOpen((v) => !v)}>
        <Text style={value ? styles.dropdownVal : styles.dropdownPlaceholder}>{value || placeholder}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={PROVIDER_MUTED} />
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

function AvailabilityCalendarModal({
  visible,
  selectedDates,
  onChange,
  onClose
}: {
  visible: boolean;
  selectedDates: Set<string>;
  onChange: (next: Set<string>) => void;
  onClose: () => void;
}) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthLabel = cursor.toLocaleString("en-US", { month: "long", year: "numeric" });

  const cells = useMemo(() => {
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const out: Array<{ key: string; day: number | null }> = [];
    for (let i = 0; i < firstDow; i++) out.push({ key: `pad-${i}`, day: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      out.push({ key, day: d });
    }
    return out;
  }, [month, year]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.calOverlay}>
        <View style={styles.calSheet}>
          <View style={styles.calHeader}>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={PROVIDER_TEXT} />
            </Pressable>
            <Text style={styles.calTitle}>Calendar</Text>
            <View style={{ width: 22 }} />
          </View>
          <View style={styles.calNav}>
            <Pressable onPress={() => setCursor(new Date(year, month - 1, 1))} hitSlop={10}>
              <Ionicons name="chevron-back" size={22} color={APP_LIME} />
            </Pressable>
            <Text style={styles.calMonth}>{monthLabel}</Text>
            <Pressable onPress={() => setCursor(new Date(year, month + 1, 1))} hitSlop={10}>
              <Ionicons name="chevron-forward" size={22} color={APP_LIME} />
            </Pressable>
          </View>
          <View style={styles.calWeekRow}>
            {WEEKDAYS.map((d) => (
              <Text key={d} style={styles.calWeekday}>
                {d}
              </Text>
            ))}
          </View>
          <View style={styles.calGrid}>
            {cells.map((cell) => {
              if (cell.day == null) return <View key={cell.key} style={styles.calCell} />;
              const active = selectedDates.has(cell.key);
              return (
                <Pressable
                  key={cell.key}
                  style={[styles.calCell, active && styles.calCellActive]}
                  onPress={() => {
                    const next = new Set(selectedDates);
                    if (next.has(cell.key)) next.delete(cell.key);
                    else next.add(cell.key);
                    onChange(next);
                  }}
                >
                  <Text style={[styles.calDay, active && styles.calDayActive]}>{cell.day}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable style={styles.calApply} onPress={onClose}>
            <Text style={styles.calApplyText}>Apply</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function formatDisplayDate(iso: string) {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "MM/DD/YYYY";
  return `${m}/${d}/${y}`;
}

export function ProviderServiceFormScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<any>();
  const fromBoth = route.params?.fromBoth === true;

  const [selected, setSelected] = useState<Set<Service>>(() => new Set());
  const [expertType, setExpertType] = useState("");
  const [yearsPractice, setYearsPractice] = useState("");
  const [equipmentTypes, setEquipmentTypes] = useState("");
  const [systemTypes, setSystemTypes] = useState("");
  const [labAffiliation, setLabAffiliation] = useState("");
  const [testTypes, setTestTypes] = useState("");
  const [turnaround, setTurnaround] = useState("");
  const [priceUnit, setPriceUnit] = useState<PriceUnit>("Per Day");
  const [amount, setAmount] = useState("300");
  const [radius, setRadius] = useState(20);
  const [serviceArea, setServiceArea] = useState("");
  const [availability, setAvailability] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [availableDates, setAvailableDates] = useState<Set<string>>(() => new Set());

  const sortedDates = useMemo(
    () => [...availableDates].sort(),
    [availableDates]
  );
  const dateFrom = sortedDates[0] ? formatDisplayDate(sortedDates[0]) : "MM/DD/YYYY";
  const dateTo = sortedDates.length > 1 ? formatDisplayDate(sortedDates[sortedDates.length - 1]!) : "MM/DD/YYYY";

  const toggleService = (item: Service) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  };

  const showExpert = selected.has("Agriculture Expert Consultation");
  const showTechnician = selected.has("Technician Support");
  const showIrrigation = selected.has("Irrigation Support");
  const showSoilOrOther =
    selected.has("Soil Testing") ||
    selected.has("Other") ||
    selected.has("Equipment Repairs & Maintenance");

  const onContinue = () => {
    navigation.navigate("ProviderPersonalDetails", { track: fromBoth ? "both" : "service" });
  };

  return (
    <SafeAreaView style={pf.screen} edges={["top", "bottom"]}>
      <ProviderFormHeader onBack={() => navigation.goBack()} />
      <ProviderStepBar currentStep={1} />

      <ScrollView
        style={pf.scroll}
        contentContainerStyle={pf.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.heading}>What Service Do You Offer?</Text>
        <Text style={pf.sectionSub}>Select all that apply</Text>

        <View style={pf.chipRow}>
          {SERVICES.map((item) => {
            const active = selected.has(item);
            return (
              <Pressable
                key={item}
                onPress={() => toggleService(item)}
                style={[pf.chip, active && pf.chipActive]}
              >
                <Text style={[pf.chipText, active && pf.chipTextActive]}>{item}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={pf.fieldGap} />

        {showExpert ? (
          <>
            <SelectDropdown
              placeholder="Select Agriculture Expert"
              value={expertType}
              options={EXPERT_TYPES}
              onSelect={setExpertType}
            />
            <SelectDropdown
              placeholder="Select Years Of Practice"
              value={yearsPractice}
              options={YEARS_PRACTICE}
              onSelect={setYearsPractice}
            />
          </>
        ) : null}

        {showTechnician ? (
          <SelectDropdown
            placeholder="Select Equipment Types Serviced"
            value={equipmentTypes}
            options={EQUIPMENT_TYPES}
            onSelect={setEquipmentTypes}
          />
        ) : null}

        {showIrrigation ? (
          <SelectDropdown
            placeholder="Select System Types"
            value={systemTypes}
            options={SYSTEM_TYPES}
            onSelect={setSystemTypes}
          />
        ) : null}

        {showSoilOrOther ? (
          <>
            <SelectDropdown
              placeholder="Select Lab Affiliation"
              value={labAffiliation}
              options={LAB_AFFILIATIONS}
              onSelect={setLabAffiliation}
            />
            <SelectDropdown
              placeholder="Select Test Types Offered"
              value={testTypes}
              options={TEST_TYPES}
              onSelect={setTestTypes}
            />
            <SelectDropdown
              placeholder="Select Turnaround Time"
              value={turnaround}
              options={TURNAROUND}
              onSelect={setTurnaround}
            />
          </>
        ) : null}

        <Text style={pf.fieldLabel}>Price Unit</Text>
        <View style={pf.chipRow}>
          {PRICE_UNITS.map((unit) => {
            const active = priceUnit === unit;
            return (
              <Pressable
                key={unit}
                onPress={() => setPriceUnit(unit)}
                style={[pf.chip, active && pf.chipActive]}
              >
                <Text style={[pf.chipText, active && pf.chipTextActive]}>{unit}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={pf.fieldGap} />

        <TextInput
          style={styles.amountInput}
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          placeholder="Enter Amount (₹)*"
          placeholderTextColor={PROVIDER_MUTED}
        />

        <View style={pf.fieldGap} />
        <Text style={pf.fieldLabel}>Service Area</Text>
        <View style={styles.sliderWrap}>
          <Text style={styles.sliderLabel}>With In {radius}km</Text>
          <View style={styles.sliderTrack}>
            <View style={[styles.sliderFill, { width: `${radius}%` }]} />
            <View style={[styles.sliderThumb, { left: `${radius}%` }]} />
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
          style={pf.input}
          value={serviceArea}
          onChangeText={setServiceArea}
          placeholder="Enter Service Area"
          placeholderTextColor={PROVIDER_MUTED}
        />

        <Pressable
          style={styles.checkRow}
          onPress={() => {
            const next = !availability;
            setAvailability(next);
            if (next) setCalendarOpen(true);
          }}
        >
          <Ionicons
            name={availability ? "checkbox-outline" : "square-outline"}
            size={20}
            color={availability ? APP_LIME : PROVIDER_MUTED}
          />
          <Text style={styles.checkText}>Availability</Text>
        </Pressable>

        {availability ? (
          <View style={styles.dateRow}>
            <Pressable style={styles.dateField} onPress={() => setCalendarOpen(true)}>
              <Text style={styles.dateText}>{dateFrom}</Text>
              <Ionicons name="calendar-outline" size={16} color={APP_LIME} />
            </Pressable>
            <Pressable style={styles.dateField} onPress={() => setCalendarOpen(true)}>
              <Text style={styles.dateText}>{dateTo}</Text>
              <Ionicons name="calendar-outline" size={16} color={APP_LIME} />
            </Pressable>
          </View>
        ) : null}

        <View style={{ height: 24 }} />
      </ScrollView>

      <ProviderContinueButton
        disabled={selected.size === 0}
        label={fromBoth ? "Continue to Personal Details" : "Continue"}
        onPress={onContinue}
      />

      <AvailabilityCalendarModal
        visible={calendarOpen}
        selectedDates={availableDates}
        onChange={setAvailableDates}
        onClose={() => setCalendarOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  heading: { color: APP_LIME, fontSize: 26, fontWeight: "800", lineHeight: 32, marginBottom: 4 },
  dropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: PROVIDER_CARD,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)"
  },
  dropdownVal: { color: PROVIDER_TEXT, fontSize: 14, flex: 1, paddingRight: 8 },
  dropdownPlaceholder: { color: PROVIDER_MUTED, fontSize: 14, flex: 1 },
  dropdownList: {
    backgroundColor: "#333435",
    borderRadius: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    maxHeight: 200,
    overflow: "hidden"
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)"
  },
  dropdownItemText: { color: PROVIDER_TEXT, fontSize: 14 },
  amountInput: {
    backgroundColor: PROVIDER_CARD,
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
  sliderLabel: {
    color: PROVIDER_TEXT,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 10
  },
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
  sliderTicks: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  sliderTick: { color: PROVIDER_MUTED, fontSize: 10 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  checkText: { color: PROVIDER_TEXT, fontSize: 14, fontWeight: "500" },
  dateRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  dateField: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: PROVIDER_CARD,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)"
  },
  dateText: { color: PROVIDER_MUTED, fontSize: 13 },
  calOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  calSheet: {
    backgroundColor: "#222",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24
  },
  calHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14
  },
  calTitle: { color: PROVIDER_TEXT, fontSize: 16, fontWeight: "700" },
  calNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12
  },
  calMonth: { color: PROVIDER_TEXT, fontSize: 15, fontWeight: "700" },
  calWeekRow: { flexDirection: "row", marginBottom: 6 },
  calWeekday: {
    width: `${100 / 7}%`,
    textAlign: "center",
    color: PROVIDER_MUTED,
    fontSize: 11,
    fontWeight: "600"
  },
  calGrid: { flexDirection: "row", flexWrap: "wrap" },
  calCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8
  },
  calCellActive: { backgroundColor: APP_LIME },
  calDay: { color: PROVIDER_TEXT, fontSize: 14, fontWeight: "600" },
  calDayActive: { color: "#000" },
  calApply: {
    marginTop: 14,
    backgroundColor: APP_LIME,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center"
  },
  calApplyText: { color: "#000", fontSize: 15, fontWeight: "800" }
});
