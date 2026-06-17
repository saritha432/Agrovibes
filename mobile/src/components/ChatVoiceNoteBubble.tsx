import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatVoiceDuration, type DmVoicePayload } from "../screens/messaging/dmMessageFormats";
import { APP_LIME } from "../theme/appColors";

type ChatVoiceNoteBubbleProps = {
  voice: DmVoicePayload;
  isSelf: boolean;
};

export function ChatVoiceNoteBubble({ voice, isSelf }: ChatVoiceNoteBubbleProps) {
  const soundRef = React.useRef<Audio.Sound | null>(null);
  const [playing, setPlaying] = React.useState(false);

  React.useEffect(() => {
    return () => {
      void soundRef.current?.unloadAsync();
      soundRef.current = null;
    };
  }, []);

  const togglePlay = async () => {
    try {
      if (playing && soundRef.current) {
        await soundRef.current.pauseAsync();
        setPlaying(false);
        return;
      }
      if (soundRef.current) {
        await soundRef.current.replayAsync();
        setPlaying(true);
        return;
      }
      const { sound } = await Audio.Sound.createAsync({ uri: voice.url }, { shouldPlay: true });
      soundRef.current = sound;
      setPlaying(true);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlaying(false);
        }
      });
    } catch {
      setPlaying(false);
    }
  };

  return (
    <Pressable
      style={[styles.row, isSelf ? styles.rowSelf : styles.rowPeer]}
      onPress={() => void togglePlay()}
    >
      <View style={[styles.playBtn, isSelf ? styles.playBtnSelf : styles.playBtnPeer]}>
        <Ionicons name={playing ? "pause" : "play"} size={16} color={isSelf ? "#111" : APP_LIME} />
      </View>
      <View style={styles.waveTrack}>
        {Array.from({ length: 18 }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.waveBar,
              isSelf ? styles.waveBarSelf : styles.waveBarPeer,
              { height: 6 + (i % 5) * 4 }
            ]}
          />
        ))}
      </View>
      <Text style={[styles.duration, isSelf ? styles.durationSelf : styles.durationPeer]}>
        {formatVoiceDuration(voice.durationMs)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 180,
    maxWidth: 240,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 22
  },
  rowSelf: { backgroundColor: APP_LIME },
  rowPeer: { backgroundColor: "#303842" },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  playBtnSelf: { backgroundColor: "rgba(0,0,0,0.12)" },
  playBtnPeer: { backgroundColor: "rgba(0,0,0,0.25)" },
  waveTrack: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    height: 28
  },
  waveBar: { width: 3, borderRadius: 2 },
  waveBarSelf: { backgroundColor: "rgba(0,0,0,0.45)" },
  waveBarPeer: { backgroundColor: "rgba(255,255,255,0.55)" },
  duration: { fontSize: 12, fontWeight: "700", minWidth: 34, textAlign: "right" },
  durationSelf: { color: "rgba(0,0,0,0.7)" },
  durationPeer: { color: "rgba(255,255,255,0.85)" }
});
