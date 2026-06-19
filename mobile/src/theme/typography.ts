/** Poppins font family names (loaded via @expo-google-fonts/poppins). */
export const FONT_REGULAR = "Poppins_400Regular";
export const FONT_MEDIUM = "Poppins_500Medium";
export const FONT_SEMIBOLD = "Poppins_600SemiBold";
export const FONT_BOLD = "Poppins_700Bold";
export const FONT_EXTRABOLD = "Poppins_800ExtraBold";
export const FONT_BLACK = "Poppins_900Black";

/** Default body font — use in styles when setting fontFamily explicitly. */
export const APP_FONT_FAMILY = FONT_REGULAR;

const NUMERIC_WEIGHT: Record<number, string> = {
  100: FONT_REGULAR,
  200: FONT_REGULAR,
  300: FONT_REGULAR,
  400: FONT_REGULAR,
  500: FONT_MEDIUM,
  600: FONT_SEMIBOLD,
  700: FONT_BOLD,
  800: FONT_EXTRABOLD,
  900: FONT_BLACK
};

/** Maps React Native fontWeight to the matching Poppins file (required on Android). */
export function fontFamilyForWeight(weight?: string | number | null): string {
  if (weight == null) return FONT_REGULAR;
  if (typeof weight === "string") {
    const named: Record<string, string> = {
      normal: FONT_REGULAR,
      bold: FONT_BOLD,
      "100": FONT_REGULAR,
      "200": FONT_REGULAR,
      "300": FONT_REGULAR,
      "400": FONT_REGULAR,
      "500": FONT_MEDIUM,
      "600": FONT_SEMIBOLD,
      "700": FONT_BOLD,
      "800": FONT_EXTRABOLD,
      "900": FONT_BLACK
    };
    if (named[weight]) return named[weight];
    const parsed = parseInt(weight, 10);
    if (!Number.isNaN(parsed)) return NUMERIC_WEIGHT[parsed] ?? FONT_REGULAR;
    return FONT_REGULAR;
  }
  const bucket =
    weight >= 900 ? 900 : weight >= 800 ? 800 : weight >= 700 ? 700 : weight >= 600 ? 600 : weight >= 500 ? 500 : 400;
  return NUMERIC_WEIGHT[bucket] ?? FONT_REGULAR;
}
