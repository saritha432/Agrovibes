import React from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { useLanguage } from "../localization/LanguageContext";
import { getWebAppOrigin } from "../services/api";

type SignupLegalNoticeProps = {
  compact?: boolean;
};

function openLegalUrl(path: string) {
  void Linking.openURL(`${getWebAppOrigin()}${path}`);
}

export function SignupLegalNotice({ compact }: SignupLegalNoticeProps) {
  const { t } = useLanguage();

  return (
    <View style={[styles.wrap, compact ? styles.wrapCompact : null]}>
      <Text style={styles.paragraph}>
        {t("signupLegalContactsPrefix")}{" "}
        <Text style={styles.link} onPress={() => openLegalUrl("/privacy-policy")}>
          {t("signupLegalLearnMore")}
        </Text>
        .
      </Text>
      <Text style={styles.paragraph}>
        {t("signupLegalSubmitPrefix")}{" "}
        <Text style={styles.link} onPress={() => openLegalUrl("/privacy-policy")}>
          {t("signupLegalTerms")}
        </Text>
        ,{" "}
        <Text style={styles.link} onPress={() => openLegalUrl("/privacy-policy")}>
          {t("signupLegalPrivacyPolicy")}
        </Text>{" "}
        {t("signupLegalAnd")}{" "}
        <Text style={styles.link} onPress={() => openLegalUrl("/child-safety")}>
          {t("signupLegalCommunityGuidelines")}
        </Text>
        .
      </Text>
      <Text style={styles.paragraph}>{t("signupLegalPrivacyBlurb")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 14, gap: 10 },
  wrapCompact: { marginTop: 10 },
  paragraph: {
    color: "#8b98a1",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600"
  },
  link: {
    color: "#8bc76f",
    fontWeight: "800"
  }
});
