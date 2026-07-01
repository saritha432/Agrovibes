import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AccountCenterCard,
  AccountCenterSectionTitle,
  AccountCenterSubLayout
} from "../components/accountCenter/AccountCenterSubLayout";
import { LoginActivityDeployBanner } from "../components/accountCenter/LoginActivityDeployBanner";
import type { RootStackParamList } from "../navigation/rootStackTypes";
import { fetchSecurityCheckup, type SecurityCheckupRecommendation } from "../services/api";
import { useAuth } from "../auth/AuthContext";
import { APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../theme/appColors";
import { formatPasswordUpdated, formatReviewedAt } from "../utils/loginActivityFormatters";

type CheckupRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress?: () => void;
  showDivider?: boolean;
};

function CheckupRow({ icon, title, subtitle, onPress, showDivider }: CheckupRowProps) {
  const content = (
    <>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={22} color={APP_LIME} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={18} color={APP_TEXT_MUTED} /> : null}
    </>
  );

  return (
    <>
      {onPress ? (
        <Pressable style={styles.row} onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>
          {content}
        </Pressable>
      ) : (
        <View style={styles.row}>{content}</View>
      )}
      {showDivider ? <View style={styles.divider} /> : null}
    </>
  );
}

function recommendationIcon(key: string): keyof typeof Ionicons.glyphMap {
  if (key === "contact-info") return "information-circle-outline";
  if (key === "unrecognized-logins") return "alert-circle-outline";
  return "alert-circle-outline";
}

export function SecurityCheckupScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recommendationCount, setRecommendationCount] = useState(0);
  const [recommendations, setRecommendations] = useState<SecurityCheckupRecommendation[]>([]);
  const [passwordUpdatedAt, setPasswordUpdatedAt] = useState<string | null>(null);
  const [devicesReviewedAt, setDevicesReviewedAt] = useState<string | null>(null);
  const [legacyFallback, setLegacyFallback] = useState(false);

  const loadCheckup = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const data = await fetchSecurityCheckup(token);
      setRecommendationCount(data.recommendationCount);
      setRecommendations(data.recommendations);
      setPasswordUpdatedAt(data.passwordUpdatedAt || null);
      setDevicesReviewedAt(data.devicesReviewedAt || null);
      setLegacyFallback(Boolean(data.legacyFallback));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load security checkup");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadCheckup();
    }, [loadCheckup])
  );

  const openRecommendation = (item: SecurityCheckupRecommendation) => {
    if (item.route === "ProfilesPersonalDetails") {
      navigation.navigate("ProfilesPersonalDetails");
      return;
    }
    navigation.navigate("WhereLoggedIn");
  };

  const description =
    recommendationCount === 0
      ? "Your account security looks good."
      : `You Have ${recommendationCount} Recommended Action${recommendationCount === 1 ? "" : "s"}`;

  return (
    <AccountCenterSubLayout
      title="Security Checkup"
      description={
        <Text style={{ color: "#97a0a8", fontSize: 14, lineHeight: 21 }}>{description}</Text>
      }
    >
      <LoginActivityDeployBanner visible={legacyFallback} />
      {loading ? (
        <ActivityIndicator color={APP_LIME} style={{ marginTop: 8 }} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <>
          {recommendations.length > 0 ? (
            <AccountCenterCard>
              {recommendations.map((item, index) => (
                <CheckupRow
                  key={item.key}
                  icon={recommendationIcon(item.key)}
                  title={item.title}
                  subtitle={item.subtitle}
                  onPress={() => openRecommendation(item)}
                  showDivider={index < recommendations.length - 1}
                />
              ))}
            </AccountCenterCard>
          ) : null}

          <AccountCenterSectionTitle title="Security Status" />
          <AccountCenterCard>
            <CheckupRow
              icon="checkmark-circle-outline"
              title="Password"
              subtitle={formatPasswordUpdated(passwordUpdatedAt)}
              onPress={() => navigation.navigate("ChangePassword")}
              showDivider
            />
            <CheckupRow
              icon="checkmark-circle-outline"
              title="Where You're Logged In"
              subtitle={formatReviewedAt(devicesReviewedAt)}
              onPress={() => navigation.navigate("WhereLoggedIn")}
            />
          </AccountCenterCard>

          <AccountCenterSectionTitle title="Additional Security Steps" />
          <AccountCenterCard>
            <CheckupRow
              icon="phone-portrait-outline"
              title="Two Factor Authentication"
              subtitle="Set up an extra layer of protection"
              onPress={() => navigation.navigate("TwoFactorAuth")}
            />
          </AccountCenterCard>
        </>
      )}
    </AccountCenterSubLayout>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12
  },
  iconWrap: {
    width: 28,
    paddingTop: 2,
    alignItems: "center"
  },
  rowBody: {
    flex: 1,
    gap: 4
  },
  rowTitle: {
    color: APP_TEXT,
    fontSize: 15,
    fontWeight: "600"
  },
  rowSubtitle: {
    color: APP_TEXT_MUTED,
    fontSize: 13,
    lineHeight: 18
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#3a3a3a",
    marginLeft: 14
  },
  errorText: {
    color: "#f87171",
    fontSize: 14,
    lineHeight: 20
  }
});
