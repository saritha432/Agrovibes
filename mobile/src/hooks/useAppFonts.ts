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

export function useAppFonts(): { ready: boolean } {
  const [loaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    Poppins_900Black
  });

  if (loaded && !fontsInstalled) {
    installAppFonts();
    fontsInstalled = true;
  }

  return { ready: loaded };
}
