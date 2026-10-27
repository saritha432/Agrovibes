import React from "react";
import {
  Text as RNText,
  TextInput as RNTextInput,
  type TextInputProps,
  type TextProps,
  type TextStyle
} from "react-native";
import { fontFamilyForWeight } from "../../theme/typography";

/**
 * Same type metrics on Android APK and Expo web: real Poppins file, no system
 * font scaling, no Android extra font padding.
 */
export function rentalType(
  fontSize: number,
  fontWeight: NonNullable<TextStyle["fontWeight"]> = "400",
  extra?: TextStyle
): TextStyle {
  return {
    fontSize,
    fontWeight,
    fontFamily: fontFamilyForWeight(fontWeight),
    includeFontPadding: false,
    ...extra
  };
}

export function RentalText(props: TextProps) {
  return <RNText allowFontScaling={false} maxFontSizeMultiplier={1} {...props} />;
}

export function RentalTextInput(props: TextInputProps) {
  return <RNTextInput allowFontScaling={false} maxFontSizeMultiplier={1} {...props} />;
}
