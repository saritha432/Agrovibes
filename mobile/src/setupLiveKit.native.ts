import { registerGlobals } from "@livekit/react-native";

let registered = false;

/** Call before any LiveKit room — not at app launch (crashes some release APKs). */
export function ensureLiveKitGlobals() {
  if (registered) return;
  registerGlobals();
  registered = true;
}
