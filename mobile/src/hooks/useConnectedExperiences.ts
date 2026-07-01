import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../auth/AuthContext";
import {
  loadConnectedExperiences,
  type ConnectedExperiencesState
} from "../utils/connectedExperiencesStorage";

export function useConnectedExperiences() {
  const { user } = useAuth();
  const [state, setState] = useState<ConnectedExperiencesState | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const next = await loadConnectedExperiences(user);
    setState(next);
    setLoading(false);
    return next;
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload])
  );

  const applyState = useCallback((next: ConnectedExperiencesState) => {
    setState(next);
  }, []);

  return { state, loading, reload, applyState, user };
}
