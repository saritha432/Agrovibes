import React from "react";
import { StyleSheet, Text, TextInput } from "react-native";
import { fontFamilyForWeight, FONT_REGULAR } from "./typography";

function withPoppinsFont<T extends { style?: unknown }>(props: T): T {
  const flat = StyleSheet.flatten(props.style as never) ?? {};
  const existing = flat.fontFamily as string | undefined;
  if (existing && !existing.startsWith("Poppins")) {
    return props;
  }
  const fontFamily = existing ?? fontFamilyForWeight(flat.fontWeight as string | number | undefined);
  return {
    ...props,
    style: [{ fontFamily }, props.style]
  };
}

/** Apply Poppins to all Text and TextInput (maps fontWeight → correct font file on Android). */
export function installAppFonts(): void {
  const textRender = (Text as unknown as { render?: (...args: unknown[]) => React.ReactNode }).render;
  if (textRender) {
    (Text as unknown as { render: (...args: unknown[]) => React.ReactNode }).render = function render(
      props: { style?: unknown },
      ref: unknown
    ) {
      return textRender.call(this, withPoppinsFont(props), ref);
    };
  }

  const inputRender = (TextInput as unknown as { render?: (...args: unknown[]) => React.ReactNode }).render;
  if (inputRender) {
    (TextInput as unknown as { render: (...args: unknown[]) => React.ReactNode }).render = function render(
      props: { style?: unknown },
      ref: unknown
    ) {
      return inputRender.call(this, withPoppinsFont(props), ref);
    };
  }

  // Fallback defaults when render patch is unavailable.
  // @ts-expect-error defaultProps exists at runtime
  Text.defaultProps = Text.defaultProps ?? {};
  // @ts-expect-error defaultProps exists at runtime
  Text.defaultProps.style = [{ fontFamily: FONT_REGULAR }, Text.defaultProps.style];
  // @ts-expect-error defaultProps exists at runtime
  TextInput.defaultProps = TextInput.defaultProps ?? {};
  // @ts-expect-error defaultProps exists at runtime
  TextInput.defaultProps.style = [{ fontFamily: FONT_REGULAR }, TextInput.defaultProps.style];
}
