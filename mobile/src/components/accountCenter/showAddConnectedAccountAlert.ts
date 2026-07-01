import { Alert } from "react-native";
import type { AuthUser } from "../../auth/AuthContext";
import { addLinkedAccount, loadConnectedExperiences, type ConnectedExperiencesState } from "../../utils/connectedExperiencesStorage";

export function showAddConnectedAccountAlert(
  user: AuthUser,
  onUpdated: (state: ConnectedExperiencesState) => void
) {
  void (async () => {
    const state = await loadConnectedExperiences(user);
    const canAddInstagram = !state.accounts.some((a) => a.platform === "instagram");
    const canAddWhatsapp = !state.accounts.some((a) => a.platform === "whatsapp");

    if (!canAddInstagram && !canAddWhatsapp) {
      Alert.alert("All set", "Instagram and WhatsApp are already linked to your profile.");
      return;
    }

    const options = [
      ...(canAddInstagram
        ? [
            {
              text: "Instagram",
              onPress: async () => {
                const next = await addLinkedAccount(user, "instagram");
                onUpdated(next);
              }
            }
          ]
        : []),
      ...(canAddWhatsapp
        ? [
            {
              text: "WhatsApp",
              onPress: async () => {
                const next = await addLinkedAccount(user, "whatsapp");
                onUpdated(next);
              }
            }
          ]
        : []),
      { text: "Cancel", style: "cancel" as const }
    ];

    Alert.alert("Add Account", "Choose a platform to link.", options);
  })();
}
