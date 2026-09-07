import React from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { APP_LIME } from "../../theme/appColors";

/** Ask host to confirm continue every hour of live. */
export const HOST_CONTINUE_INTERVAL_MS = 60 * 60 * 1000;
/** If host does not confirm within this window, auto-end the live. */
export const HOST_CONTINUE_TIMEOUT_MS = 5 * 60 * 1000;

export function formatContinueCountdown(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/**
 * Host-only: every hour show a continue prompt; auto-end after 5 minutes without confirm.
 * Does not touch the LiveKit room — UI overlay only so A/V keeps publishing.
 */
export function useHostContinueLivePrompt(enabled: boolean, onAutoEnd: () => void) {
  const [visible, setVisible] = React.useState(false);
  const [secondsLeft, setSecondsLeft] = React.useState(Math.floor(HOST_CONTINUE_TIMEOUT_MS / 1000));
  const startedAtRef = React.useRef(Date.now());
  const lastPromptHourRef = React.useRef(0);
  const promptDeadlineRef = React.useRef<number | null>(null);
  const visibleRef = React.useRef(false);
  const endingRef = React.useRef(false);
  const onAutoEndRef = React.useRef(onAutoEnd);
  onAutoEndRef.current = onAutoEnd;

  const triggerAutoEnd = React.useCallback(() => {
    if (endingRef.current) return;
    endingRef.current = true;
    promptDeadlineRef.current = null;
    setVisible(false);
    setSecondsLeft(0);
    onAutoEndRef.current();
  }, []);

  const showPrompt = React.useCallback((hourIndex: number) => {
    lastPromptHourRef.current = hourIndex;
    promptDeadlineRef.current = Date.now() + HOST_CONTINUE_TIMEOUT_MS;
    setSecondsLeft(Math.floor(HOST_CONTINUE_TIMEOUT_MS / 1000));
    setVisible(true);
  }, []);

  React.useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  React.useEffect(() => {
    if (!enabled) {
      setVisible(false);
      endingRef.current = false;
      lastPromptHourRef.current = 0;
      promptDeadlineRef.current = null;
      startedAtRef.current = Date.now();
      setSecondsLeft(Math.floor(HOST_CONTINUE_TIMEOUT_MS / 1000));
      return;
    }
    endingRef.current = false;
    startedAtRef.current = Date.now();
    lastPromptHourRef.current = 0;
    promptDeadlineRef.current = null;

    const tick = () => {
      if (endingRef.current) return;

      if (visibleRef.current && promptDeadlineRef.current != null) {
        const remainingMs = promptDeadlineRef.current - Date.now();
        if (remainingMs <= 0) {
          triggerAutoEnd();
          return;
        }
        setSecondsLeft(Math.max(1, Math.ceil(remainingMs / 1000)));
        return;
      }

      if (visibleRef.current) return;
      const elapsed = Date.now() - startedAtRef.current;
      const hourIndex = Math.floor(elapsed / HOST_CONTINUE_INTERVAL_MS);
      if (hourIndex >= 1 && hourIndex > lastPromptHourRef.current) {
        showPrompt(hourIndex);
      }
    };

    const id = setInterval(tick, 1000);
    const appSub = AppState.addEventListener("change", (state) => {
      if (state === "active") tick();
    });
    return () => {
      clearInterval(id);
      appSub.remove();
    };
  }, [enabled, showPrompt, triggerAutoEnd]);

  const onContinue = React.useCallback(() => {
    promptDeadlineRef.current = null;
    setVisible(false);
    setSecondsLeft(Math.floor(HOST_CONTINUE_TIMEOUT_MS / 1000));
  }, []);

  const hidePrompt = React.useCallback(() => {
    promptDeadlineRef.current = null;
    setVisible(false);
  }, []);

  return { visible, secondsLeft, onContinue, hidePrompt };
}

type HostContinueLivePopupProps = {
  visible: boolean;
  secondsLeft: number;
  onContinue: () => void;
  onEndLive: () => void;
};

/**
 * Non-modal overlay so LiveKit camera/mic keep publishing while the host decides.
 */
export function HostContinueLivePopup({
  visible,
  secondsLeft,
  onContinue,
  onEndLive
}: HostContinueLivePopupProps) {
  if (!visible) return null;
  // Full overlay captures taps so host must answer — video/mic keep publishing underneath.
  return (
    <View style={styles.overlay}>
      <View style={styles.card} accessibilityRole="alert">
        <Text style={styles.eyebrow}>Still broadcasting</Text>
        <Text style={styles.title}>Continue this live?</Text>
        <Text style={styles.body}>
          Your stream is still going. Confirm to keep live, or it will end automatically.
        </Text>
        <Text style={styles.countdown}>
          Auto-ends in <Text style={styles.countdownStrong}>{formatContinueCountdown(secondsLeft)}</Text>
        </Text>
        <Pressable style={styles.continueBtn} onPress={onContinue} accessibilityLabel="Continue live">
          <Text style={styles.continueText}>Continue live</Text>
        </Pressable>
        <Pressable style={styles.endBtn} onPress={onEndLive} accessibilityLabel="End live">
          <Text style={styles.endText}>End live</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    backgroundColor: "rgba(0,0,0,0.42)"
  },
  card: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 22,
    backgroundColor: "rgba(22,26,30,0.96)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)"
  },
  eyebrow: {
    color: APP_LIME,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  title: {
    marginTop: 8,
    color: "#fff",
    fontSize: 20,
    fontWeight: "900"
  },
  body: {
    marginTop: 8,
    color: "rgba(255,255,255,0.72)",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20
  },
  countdown: {
    marginTop: 14,
    marginBottom: 18,
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    fontWeight: "700"
  },
  countdownStrong: {
    color: "#FF6B6B",
    fontWeight: "900"
  },
  continueBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: APP_LIME,
    borderRadius: 999,
    paddingVertical: 13
  },
  continueText: {
    color: "#111",
    fontSize: 15,
    fontWeight: "900"
  },
  endBtn: {
    marginTop: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)"
  },
  endText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800"
  }
});
