import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
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

function rainIsComing(report: WeatherReport) {
  const today = report.days.find((day) => day.dayLabel === "Today") ?? report.days[0];
  const icons = [report.current?.icon, today?.icon];
  if (icons.some((icon) => icon === "rain" || icon === "storm")) return true;
  if ((today?.precipMm ?? 0) >= 0.2) return true;
  return Math.max(report.current?.rainChance ?? 0, today?.rainChance ?? 0) >= 50;
}

function weatherIonicon(icon: WeatherIconName, night = false): keyof typeof Ionicons.glyphMap {
  if (night && icon === "sunny") return "moon";
  if (night && (icon === "partly-cloudy" || icon === "cloudy")) return "cloudy-night";
  if (icon === "sunny") return "sunny";
  if (icon === "rain") return "rainy";
  if (icon === "storm") return "thunderstorm";
  if (icon === "fog") return "cloud";
  if (icon === "snow") return "snow";
  if (icon === "cloudy") return "cloudy";
  return "partly-sunny";
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
  const [feelsLike, setFeelsLike] = useState(false);
  const [suggestions, setSuggestions] = useState<WeatherPlace[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alarmRef = useRef<Audio.Sound | null>(null);
  const silencedKey = useRef("");
  const [alarmOn, setAlarmOn] = useState(false);
  const rainComing = report ? rainIsComing(report) : false;
  const alarmKey = rainComing
    ? `${report?.location.lat},${report?.location.lng}:${report?.days[0]?.date ?? ""}`
    : "";

  const loadReport = useCallback(
    async (params?: { q?: string; lat?: number; lng?: number }) => {
      setLoading(true);
      setError("");
      try {
        const next = await fetchWeatherReport(token, params);
        setReport(next);
        const today = next.days.find((day) => day.dayLabel === "Today") ?? next.days[0];
        setSelectedDate(today?.date ?? null);
        setFeelsLike(false);
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

  const releaseAlarm = useCallback(async () => {
    const sound = alarmRef.current;
    alarmRef.current = null;
    setAlarmOn(false);
    if (sound) await sound.unloadAsync().catch(() => undefined);
  }, []);

  const playAlarm = useCallback(async () => {
    await releaseAlarm();
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true
    });
    const created = await Audio.Sound.createAsync(require("../../assets/sounds/rain-alarm.wav"), {
      shouldPlay: true,
      isLooping: true,
      volume: 1
    });
    alarmRef.current = created.sound;
    setAlarmOn(true);
  }, [releaseAlarm]);

  useEffect(() => {
    if (!alarmKey) {
      silencedKey.current = "";
      void releaseAlarm();
      return;
    }
    if (silencedKey.current === alarmKey) return;
    let cancelled = false;
    void playAlarm()
      .then(() => {
        if (cancelled) void releaseAlarm();
      })
      .catch(() => {
        if (!cancelled) setAlarmOn(false);
      });
    return () => {
      cancelled = true;
    };
  }, [alarmKey, playAlarm, releaseAlarm]);

  useEffect(() => {
    return () => {
      void alarmRef.current?.unloadAsync().catch(() => undefined);
    };
  }, []);

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

              {rainComing ? (
                <Pressable
                  style={styles.alarm}
                  onPress={() => {
                    if (alarmOn) {
                      silencedKey.current = alarmKey;
                      void releaseAlarm();
                      return;
                    }
                    silencedKey.current = "";
                    void playAlarm();
                  }}
                  accessibilityRole="button"
                >
                  <Ionicons name={alarmOn ? "volume-high" : "volume-mute"} size={18} color="#111" />
                  <Text style={styles.alarmText}>
                    {alarmOn ? "Rain alarm is on. Tap to stop." : "Rain is coming. Tap to play the alarm."}
                  </Text>
                </Pressable>
              ) : null}

              {report.alert ? (
                <View style={styles.alert}>
                  <Text style={styles.alertTitle}>{report.alert.title}</Text>
                  <Text style={styles.alertBody}>{report.alert.body}</Text>
                </View>
              ) : null}

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.daysRow}>
                {report.days.map((day) => {
                  const selected = selectedDay?.date === day.date;
                  const showNight = day.nightIcon !== day.icon;
                  return (
                    <Pressable
                      key={day.date}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => setSelectedDate(day.date)}
                      style={[styles.dayCard, selected ? styles.dayCardSelected : null]}
                    >
                      <View style={styles.dayTop}>
                        <Text style={styles.dayNum}>{day.day}</Text>
                        <Text style={styles.dayName}>{day.dayLabel}</Text>
                      </View>
                      <View style={styles.dayBody}>
                        <View style={styles.dayIcons}>
                          <Ionicons name={weatherIonicon(day.icon)} size={26} color="#f5a524" />
                          {showNight ? (
                            <Ionicons name={weatherIonicon(day.nightIcon, true)} size={26} color="#3d4db8" />
                          ) : null}
                        </View>
                        <View style={styles.dayTemps}>
                          <Text style={styles.tempHigh}>{day.tempC}°</Text>
                          <Text style={styles.tempLow}>{day.tempMinC}°</Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {selectedDay ? (
                <View style={styles.overview}>
                  <View style={styles.overviewHead}>
                    <Text style={styles.overviewTitle}>Overview</Text>
                    <View style={styles.feelsRow}>
                      <Switch
                        value={feelsLike}
                        onValueChange={setFeelsLike}
                        trackColor={{ false: "#d5dbe3", true: "#8ab4f8" }}
                        thumbColor="#ffffff"
                      />
                      <Text style={styles.feelsLabel}>Feels like</Text>
                    </View>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hoursRow}>
                    {selectedDay.hours.map((hour) => (
                      <View key={hour.time} style={styles.hourCol}>
                        <Text style={styles.hourLabel}>{hour.label}</Text>
                        <Ionicons
                          name={weatherIonicon(hour.icon, !hour.isDay)}
                          size={22}
                          color={hour.isDay ? "#f5a524" : "#3d4db8"}
                        />
                        <Text style={styles.hourTemp}>{feelsLike ? hour.feelsC : hour.tempC}°</Text>
                      </View>
                    ))}
                  </ScrollView>
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
  alarm: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#c9ff35",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16
  },
  alarmText: { color: "#111", fontWeight: "700", flex: 1 },
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
  daysRow: { gap: 10, paddingRight: 8, paddingVertical: 4 },
  dayCard: {
    width: 132,
    backgroundColor: "#f7f9fc",
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: "#e6ebf2"
  },
  dayCardSelected: { borderColor: "#8ab4f8" },
  dayTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dayNum: { fontSize: 18, fontWeight: "700", color: "#1f2430" },
  dayName: { fontSize: 13, fontWeight: "600", color: "#5c6570", marginLeft: 6, flexShrink: 1 },
  dayBody: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  dayIcons: { flexDirection: "row", alignItems: "center", gap: 2 },
  dayTemps: { alignItems: "flex-end" },
  tempHigh: { fontSize: 20, fontWeight: "700", color: "#1f2430" },
  tempLow: { marginTop: 2, fontSize: 15, fontWeight: "500", color: "#5c6570" },
  overview: {
    marginTop: 14,
    backgroundColor: "#f4f7fb",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 12
  },
  overviewHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  overviewTitle: { fontSize: 18, fontWeight: "700", color: "#1f2430" },
  feelsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  feelsLabel: { fontSize: 14, fontWeight: "600", color: "#1f2430" },
  hoursRow: { gap: 18, paddingRight: 8, paddingBottom: 4 },
  hourCol: { width: 64, alignItems: "center", gap: 8 },
  hourLabel: { fontSize: 12, fontWeight: "600", color: "#5c6570", textAlign: "center", minHeight: 32 },
  hourTemp: { fontSize: 16, fontWeight: "700", color: "#1f2430" },
  detailBody: { marginTop: 12, color: "#3c4450", fontSize: 14, lineHeight: 20 },
  rain: { fontSize: 12, color: APP_TEXT_MUTED }
});
