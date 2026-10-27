import React from "react";
import { Platform, StyleSheet, Text, TextInput } from "react-native";
import { fontFamilyForWeight, FONT_REGULAR } from "./typography";

const WEB_ALIAS_STYLE_ID = "cropvibe-poppins-weights";

const BASE_TEXT_STYLE = {
  fontFamily: FONT_REGULAR,
  includeFontPadding: false as const
};

function withPoppinsFont<T extends { style?: unknown }>(props: T): T {
  const flat = (StyleSheet.flatten(props.style as never) ?? {}) as Record<string, unknown>;
  const existing = flat.fontFamily as string | undefined;
  if (existing && !existing.startsWith("Poppins")) {
    return props;
  }
  const fontFamily = fontFamilyForWeight(flat.fontWeight as string | number | undefined);
  return {
    ...props,
    style: [{ fontFamily, includeFontPadding: false }, props.style]
  };
}

function patchComponentRender(component: { render?: (...args: unknown[]) => React.ReactNode }): void {
  const original = component.render;
  if (!original) return;
  component.render = function render(...args: unknown[]) {
    const props = (args[0] ?? {}) as { style?: unknown };
    return original.call(this, withPoppinsFont(props), args[1]);
  };
}

function applyDefaultFontProps(): void {
  // @ts-expect-error defaultProps exists at runtime
  Text.defaultProps = Text.defaultProps ?? {};
  // @ts-expect-error defaultProps exists at runtime
  Text.defaultProps.style = [BASE_TEXT_STYLE, Text.defaultProps.style];
  // @ts-expect-error defaultProps exists at runtime
  TextInput.defaultProps = TextInput.defaultProps ?? {};
  // @ts-expect-error defaultProps exists at runtime
  TextInput.defaultProps.style = [BASE_TEXT_STYLE, TextInput.defaultProps.style];
}

type WebFontRule = {
  type?: number;
  style?: { getPropertyValue: (name: string) => string };
};

type WebDoc = {
  styleSheets: ArrayLike<{ cssRules?: ArrayLike<WebFontRule> }>;
  getElementById: (id: string) => { remove: () => void } | null;
  createElement: (tag: string) => { id: string; textContent: string };
  head: { appendChild: (el: { id: string; textContent: string }) => void };
};

const FONT_FACE_RULE = 5;

function webDocument(): WebDoc | null {
  const doc = (globalThis as { document?: WebDoc }).document;
  return doc ?? null;
}

function fontFaceSrc(family: string, doc: WebDoc): string {
  const sheets = Array.from(doc.styleSheets);
  for (const sheet of sheets) {
    let rules: ArrayLike<WebFontRule> | undefined;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    if (!rules) continue;
    for (const rule of Array.from(rules)) {
      if (!rule || rule.type !== FONT_FACE_RULE || !rule.style) continue;
      const name = rule.style.getPropertyValue("font-family").replace(/['"]/g, "").trim();
      const src = rule.style.getPropertyValue("src");
      if (name === family && src) return src;
    }
  }
  return "";
}

/**
 * Expo Google Fonts register each weight as a unique family (Poppins_800ExtraBold).
 * Web defaultProps pin Text to Poppins_400Regular, so fontWeight 800 becomes fake-bold
 * Regular — larger/wider than the APK ExtraBold file. Alias weights onto that family.
 */
export function installWebPoppinsWeightAliases(): void {
  if (Platform.OS !== "web") return;
  const doc = webDocument();
  if (!doc) return;

  const src = (family: string) => fontFaceSrc(family, doc);
  const extraBold = src("Poppins_800ExtraBold") || src("Poppins_700Bold");
  const black = src("Poppins_900Black") || extraBold;
  const faces: Array<[number, string]> = [
    [500, src("Poppins_500Medium")],
    [600, src("Poppins_600SemiBold")],
    [700, src("Poppins_700Bold")],
    [800, extraBold],
    [900, black]
  ];

  const css =
    faces
      .filter(([, url]) => Boolean(url))
      .map(
        ([weight, url]) =>
          `@font-face{font-family:'Poppins_400Regular';font-style:normal;font-weight:${weight};font-display:swap;src:${url}}`
      )
      .join("") + "html,body{-webkit-text-size-adjust:100%;text-size-adjust:100%}";

  const previous = doc.getElementById(WEB_ALIAS_STYLE_ID);
  if (previous) previous.remove();
  const el = doc.createElement("style");
  el.id = WEB_ALIAS_STYLE_ID;
  el.textContent = css;
  doc.head.appendChild(el);
}

/** Apply Poppins to all Text and TextInput (maps fontWeight → correct font file on Android). */
export function installAppFonts(): void {
  applyDefaultFontProps();
  installWebPoppinsWeightAliases();

  patchComponentRender(Text as unknown as { render?: (...args: unknown[]) => React.ReactNode });
  patchComponentRender(TextInput as unknown as { render?: (...args: unknown[]) => React.ReactNode });
}
