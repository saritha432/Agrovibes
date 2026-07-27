import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  Poppins_900Black
} from "@expo-google-fonts/poppins";
import { useFonts } from "expo-font";
import { installAppFonts } from "../theme/setupFonts";

let fontsInstalled = false;

/**
 * Gate the app on core weights only (400–700). ExtraBold/Black load in the background
 * so cold start is not blocked on six font files.
 */
export function useAppFonts(): { ready: boolean } {
  const [coreLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold
  });

  useFonts({
    Poppins_800ExtraBold,
    Poppins_900Black
  });

  if (coreLoaded && !fontsInstalled) {
    installAppFonts();
    fontsInstalled = true;
  }

  return { ready: coreLoaded };
}
