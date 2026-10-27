import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { RentalText as Text } from "./rentalTypography";
import { APP_LIME, APP_SURFACE, APP_TEXT, APP_TEXT_MUTED, APP_TEXT_ON_LIME } from "../../theme/appColors";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatBookingDate(date: Date) {
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function BookingDateField({
  value,
  onChange,
  label = "Date you need it"
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const today = startOfDay(new Date());
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const lead = first.getDay();
    const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const slots: Array<Date | null> = Array.from({ length: lead }, () => null);
    for (let day = 1; day <= days; day += 1) {
      slots.push(new Date(cursor.getFullYear(), cursor.getMonth(), day));
    }
    while (slots.length % 7 !== 0) slots.push(null);
    return slots;
  }, [cursor]);

  const monthLabel = cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.field} onPress={() => setOpen(true)} accessibilityRole="button">
        <Ionicons name="calendar-outline" size={18} color={APP_LIME} />
        <Text style={[styles.fieldText, value ? null : styles.placeholder]}>{value || "Choose a date"}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <View style={styles.monthRow}>
              <Pressable
                hitSlop={8}
                onPress={() => setCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
              >
                <Ionicons name="chevron-back" size={22} color={APP_TEXT} />
              </Pressable>
              <Text style={styles.month}>{monthLabel}</Text>
              <Pressable
                hitSlop={8}
                onPress={() => setCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
              >
                <Ionicons name="chevron-forward" size={22} color={APP_TEXT} />
              </Pressable>
            </View>
            <View style={styles.week}>
              {WEEKDAYS.map((day) => (
                <Text key={day} style={styles.weekday}>
                  {day}
                </Text>
              ))}
            </View>
            <View style={styles.grid}>
              {cells.map((day, index) => {
                if (!day) return <View key={`empty-${index}`} style={styles.day} />;
                const past = startOfDay(day).getTime() < today.getTime();
                const selected = value === formatBookingDate(day);
                return (
                  <Pressable
                    key={day.toISOString()}
                    style={[styles.day, selected ? styles.dayOn : null]}
                    disabled={past}
                    onPress={() => {
                      onChange(formatBookingDate(day));
                      setOpen(false);
                    }}
                  >
                    <Text style={[styles.dayText, past ? styles.dayPast : null, selected ? styles.dayTextOn : null]}>
                      {day.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  label: { color: APP_TEXT, fontSize: 15, fontWeight: "800", marginBottom: 8 },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: APP_SURFACE,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16
  },
  fieldText: { color: APP_TEXT, fontSize: 15, fontWeight: "700" },
  placeholder: { color: APP_TEXT_MUTED, fontWeight: "600" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#1c1c1c",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    paddingBottom: 28
  },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  month: { color: APP_TEXT, fontSize: 16, fontWeight: "800" },
  week: { flexDirection: "row" },
  weekday: { flex: 1, textAlign: "center", color: APP_TEXT_MUTED, fontSize: 12, fontWeight: "700", marginBottom: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  day: { width: "14.28%", height: 40, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  dayOn: { backgroundColor: APP_LIME },
  dayText: { color: APP_TEXT, fontSize: 14, fontWeight: "700" },
  dayTextOn: { color: APP_TEXT_ON_LIME },
  dayPast: { color: "rgba(248,250,252,0.28)" }
});
