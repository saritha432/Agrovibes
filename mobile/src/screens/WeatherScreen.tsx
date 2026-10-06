import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import { useLanguage } from "../localization/LanguageContext";
import { useAndroidNestedStackBack } from "../navigation/useAndroidScreenBack";
import {
  fetchWeatherReport,
  searchWeatherPlaces,
  type WeatherIconName,
  type WeatherPlace,
  type WeatherReport
} from "../services/api";
import { isUsableLatLng } from "../utils/openMeteoWeather";
import { APP_DARK_BG, APP_LIME, APP_SURFACE, APP_TEXT, APP_TEXT_MUTED } from "../theme/appColors";

function weatherIonicon(icon: WeatherIconName): keyof typeof Ionicons.glyphMap {
  if (icon === "sunny") return "sunny-outline";
  if (icon === "rain") return "rainy-outline";
  if (icon === "storm") return "thunderstorm-outline";
  if (icon === "fog") return "cloud-outline";
  if (icon === "snow") return "snow-outline";
  if (icon === "cloudy") return "cloudy-outline";
  return "partly-sunny-outline";
}

export function WeatherScreen() {
  useAndroidNestedStackBack();
  const navigation = useNavigation();
  const { token, user } = useAuth();
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [report, setReport] = useState<WeatherReport | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<WeatherPlace[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadReport = useCallback(
    async (params?: { q?: string; lat?: number; lng?: number }) => {
      setLoading(true);
      setError("");
      try {
        const next = await fetchWeatherReport(token, params);
        setReport(next);
        setSelectedDate(null);
        setQuery("");
        setSuggestions([]);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "";
        setError(msg === "LOCATION_REQUIRED" ? t("weatherNeedLocation") : t("weatherLoadFailed"));
      } finally {
        setLoading(false);
      }
    },
    [t, token]
  );

  useEffect(() => {
    void loadReport(
      isUsableLatLng(user?.locationLat, user?.locationLng)
        ? { lat: Number(user?.locationLat), lng: Number(user?.locationLng) }
        : user?.locationLabel
          ? { q: user.locationLabel }
          : undefined
    );
  }, [loadReport, user?.locationLabel, user?.locationLat, user?.locationLng]);

  const onChangeQuery = (value: string) => {
    setQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    searchTimer.current = setTimeout(() => {
      void searchWeatherPlaces(token, value)
        .then(setSuggestions)
        .catch(() => setSuggestions([]));
    }, 280);
  };

  const useMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      void loadReport();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void loadReport({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        void loadReport();
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  const selectedDay = report?.days.find((day) => day.date === selectedDate) ?? null;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.head}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.headBtn} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={APP_TEXT} />
        </Pressable>
        <Text style={styles.title}>{t("weatherTitle")}</Text>
        <Pressable onPress={useMyLocation} hitSlop={10} style={styles.headBtn} accessibilityLabel={t("weatherUseMyLocation")}>
          <Ionicons name="locate-outline" size={22} color={APP_TEXT} />
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={APP_TEXT_MUTED} />
        <TextInput
          value={query}
          onChangeText={onChangeQuery}
          placeholder={t("weatherSearchPlaceholder")}
          placeholderTextColor={APP_TEXT_MUTED}
          style={styles.searchInput}
          returnKeyType="search"
          onSubmitEditing={() => {
            if (query.trim()) void loadReport({ q: query.trim() });
          }}
        />
      </View>
      {suggestions.length ? (
        <View style={styles.suggestBox}>
          {suggestions.map((place) => (
            <Pressable
              key={`${place.lat},${place.lng},${place.label}`}
              style={styles.suggestRow}
              onPress={() => void loadReport({ lat: place.lat, lng: place.lng })}
            >
              <Text style={styles.suggestText}>{place.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {loading && !report ? (
        <View style={styles.center}>
          <ActivityIndicator color={APP_LIME} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {report ? (
            <>
              <Text style={styles.meta}>
                {report.location.district || report.location.label} · {t("weatherDisclaimer")} {report.source} ·{" "}
                {report.updatedLabel}.
              </Text>

              <View style={styles.nowCard}>
                <Text style={styles.nowLabel}>{t("weatherNow")}</Text>
                <Ionicons name={weatherIonicon(report.current.icon)} size={36} color={APP_LIME} />
                <Text style={styles.nowTemp}>{report.current.tempC}°</Text>
                <Text style={styles.nowCondition}>{report.current.condition}</Text>
                <Text style={styles.rain}>Rain {report.current.rainChance}%</Text>
              </View>

              {report.alert ? (
                <View style={styles.alert}>
                  <Text style={styles.alertTitle}>{report.alert.title}</Text>
                  <Text style={styles.alertBody}>{report.alert.body}</Text>
                </View>
              ) : null}

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.daysRow}>
                {report.days.map((day) => {
                  const selected = selectedDate === day.date;
                  return (
                    <Pressable
                      key={day.date}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => setSelectedDate(day.date)}
                      style={[styles.dayCard, selected ? styles.dayCardSelected : null]}
                    >
                      <Text style={styles.dayName}>
                        {day.weekday} {day.day}
                      </Text>
                      <Ionicons name={weatherIonicon(day.icon)} size={28} color={APP_LIME} />
                      <Text style={styles.temp}>{day.tempC}°</Text>
                      <Text style={styles.rain}>Rain {day.rainChance}%</Text>
                      <Text style={styles.hint}>{day.hint}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {selectedDay ? (
                <View style={styles.detailCard}>
                  <View style={styles.detailHead}>
                    <Ionicons name={weatherIonicon(selectedDay.icon)} size={28} color={APP_LIME} />
                    <View style={styles.detailHeadText}>
                      <Text style={styles.detailTitle}>
                        {selectedDay.weekday} {selectedDay.day}
                      </Text>
                      <Text style={styles.detailCondition}>{selectedDay.condition}</Text>
                    </View>
                  </View>
                  <Text style={styles.detailStats}>
                    High {selectedDay.tempC}° · Low {selectedDay.tempMinC}° · Rain {selectedDay.rainChance}%
                    {selectedDay.windKmh > 0 ? ` · Wind ${selectedDay.windKmh} km/h` : ""}
                  </Text>
                  <Text style={styles.detailBody}>{selectedDay.description}</Text>
                </View>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: APP_DARK_BG },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 8
  },
  headBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700", color: APP_TEXT },
  searchWrap: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: APP_SURFACE,
    borderRadius: 22,
    paddingHorizontal: 14,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  searchInput: { flex: 1, color: APP_TEXT, fontSize: 15, paddingVertical: 10 },
  suggestBox: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: APP_SURFACE,
    borderRadius: 12,
    overflow: "hidden"
  },
  suggestRow: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#3a3a3a" },
  suggestText: { color: APP_TEXT, fontSize: 14 },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { color: APP_LIME, marginBottom: 12 },
  meta: { color: APP_TEXT_MUTED, fontSize: 12, lineHeight: 18, marginBottom: 12 },
  nowCard: {
    backgroundColor: APP_SURFACE,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 6,
    marginBottom: 16
  },
  nowLabel: { fontSize: 12, fontWeight: "700", color: APP_TEXT_MUTED, letterSpacing: 0.6 },
  nowTemp: { fontSize: 36, fontWeight: "800", color: APP_TEXT },
  nowCondition: { fontSize: 16, fontWeight: "700", color: APP_TEXT },
  alert: {
    backgroundColor: "rgba(201, 255, 53, 0.12)",
    borderColor: APP_LIME,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16
  },
  alertTitle: { color: APP_LIME, fontWeight: "700", marginBottom: 4 },
  alertBody: { color: APP_TEXT, fontSize: 13, lineHeight: 18 },
  daysRow: { gap: 10, paddingRight: 8 },
  dayCard: {
    width: 118,
    backgroundColor: APP_SURFACE,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "transparent"
  },
  dayCardSelected: {
    borderColor: APP_LIME
  },
  detailCard: {
    marginTop: 14,
    backgroundColor: APP_SURFACE,
    borderRadius: 16,
    padding: 16,
    gap: 8
  },
  detailHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  detailHeadText: { flex: 1 },
  detailTitle: { color: APP_TEXT, fontSize: 16, fontWeight: "800" },
  detailCondition: { color: APP_LIME, fontSize: 14, fontWeight: "700", marginTop: 2 },
  detailStats: { color: APP_TEXT_MUTED, fontSize: 13, lineHeight: 18 },
  detailBody: { color: APP_TEXT, fontSize: 15, lineHeight: 22 },
  dayName: { fontSize: 11, fontWeight: "700", color: APP_TEXT_MUTED },
  temp: { fontSize: 22, fontWeight: "800", color: APP_TEXT },
  rain: { fontSize: 12, color: APP_TEXT_MUTED },
  hint: { fontSize: 11, color: APP_TEXT_MUTED, textAlign: "center" }
});
