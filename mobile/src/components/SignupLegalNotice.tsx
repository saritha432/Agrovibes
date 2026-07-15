import React from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { useLanguage } from "../localization/LanguageContext";
import { getWebAppOrigin } from "../services/api";

type SignupLegalNoticeProps = {
  /** When true, slightly tighter spacing for compact forms. */
  compact?: boolean;
};

function openLegalUrl(path: string) {
  void Linking.openURL(`${getWebAppOrigin()}${path}`);
}

/**
 * Instagram-style signup legal copy with tappable policy links.
 * Always renders English fallbacks so empty/missing i18n keys cannot hide the notice.
 */
export function SignupLegalNotice({ compact }: SignupLegalNoticeProps) {
  const { t } = useLanguage();

  const contacts =
    t("signupLegalContactsPrefix") ||
    "People who use Cropvibe may have uploaded your contact information to Cropvibe.";
  const learnMore = t("signupLegalLearnMore") || "Learn more";
  const submitPrefix =
    t("signupLegalSubmitPrefix") ||
    "By tapping Submit, you agree to create an account and to Cropvibe's";
  const terms = t("signupLegalTerms") || "Terms";
  const privacy = t("signupLegalPrivacyPolicy") || "Privacy Policy";
  const andWord = t("signupLegalAnd") || "and";
  const guidelines = t("signupLegalCommunityGuidelines") || "Community Guidelines";
  const blurb =
    t("signupLegalPrivacyBlurb") ||
    "The Privacy Policy describes how we can use information collected when you create an account. For example, we use this information to provide, personalize and improve our products.";

  return (
    <View style={[styles.wrap, compact ? styles.wrapCompact : null]} accessibilityRole="text">
      <Text style={styles.paragraph}>
        {contacts}{" "}
        <Text
          style={styles.link}
          onPress={() => openLegalUrl("/privacy-policy")}
          accessibilityRole="link"
        >
          {learnMore}
        </Text>
        .
      </Text>

      <Text style={styles.paragraph}>
        {submitPrefix}{" "}
        <Text style={styles.linkBold} onPress={() => openLegalUrl("/privacy-policy")} accessibilityRole="link">
          {terms}
        </Text>
        ,{" "}
        <Text style={styles.linkBold} onPress={() => openLegalUrl("/privacy-policy")} accessibilityRole="link">
          {privacy}
        </Text>{" "}
        {andWord}{" "}
        <Text style={styles.linkBold} onPress={() => openLegalUrl("/child-safety")} accessibilityRole="link">
          {guidelines}
        </Text>
        .
      </Text>

      <Text style={styles.paragraph}>
        {blurb.includes("Privacy Policy") ? (
          <>
            {blurb.split("Privacy Policy")[0]}
            <Text style={styles.linkBold} onPress={() => openLegalUrl("/privacy-policy")} accessibilityRole="link">
              {privacy}
            </Text>
            {blurb.split("Privacy Policy").slice(1).join("Privacy Policy")}
          </>
        ) : (
          blurb
        )}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 4,
    marginBottom: 4,
    paddingTop: 4
  },
  wrapCompact: {
    marginTop: 2
  },
  paragraph: {
    color: "#a8b0b6",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
    marginBottom: 10
  },
  link: {
    color: "#3897f0",
    fontWeight: "700"
  },
  linkBold: {
    color: "#3897f0",
    fontWeight: "800"
  }
});
