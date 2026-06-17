import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { Camera } from "expo-camera";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import {
  AndroidAudioTypePresets,
  AudioSession,
  LiveKitRoom,
  VideoTrack,
  isTrackReference,
  useParticipants,
  useRoomContext,
  useTracks
} from "@livekit/react-native";
import { ConnectionState, Track, type Participant } from "livekit-client";
import React from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../auth/AuthContext";
import { createLiveKitToken, formatLiveStreamError } from "../../services/api";
import { ensureLiveKitGlobals } from "../../setupLiveKit.native";
import { APP_LIME } from "../../theme/appColors";
import { UserAvatar } from "../../components/UserAvatar";

export type DirectCallMode = "voice" | "video";

type DirectCallViewProps = {
  visible: boolean;
  roomName: string;
  mode: DirectCallMode;
  peerName: string;
  peerAvatarUrl?: string | null;
  connectEnabled: boolean;
  statusLabel?: string;
  onAccept?: () => void;
  onDecline?: () => void;
  onClose: () => void;
};

function remoteParticipant(participants: Participant[], localIdentity: string) {
  return participants.find((p) => p.identity !== localIdentity) || null;
}

function CallRoomContent({
  mode,
  peerName,
  peerAvatarUrl,
  statusLabel,
  onClose
}: {
  mode: DirectCallMode;
  peerName: string;
  peerAvatarUrl?: string | null;
  statusLabel?: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const room = useRoomContext();
  const participants = useParticipants();
  const cameraTracks = useTracks([Track.Source.Camera], { onlySubscribed: true });
  const [muted, setMuted] = React.useState(false);
  const [cameraOff, setCameraOff] = React.useState(mode === "voice");
  const [facingFront, setFacingFront] = React.useState(true);
  const [status, setStatus] = React.useState(statusLabel || "Connecting...");
  const localIdentity = room.localParticipant.identity;
  const peer = remoteParticipant(participants, localIdentity);
  const remoteVideo = cameraTracks.find((t) => isTrackReference(t) && t.participant.identity !== localIdentity);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await room.localParticipant.setMicrophoneEnabled(true);
        if (mode === "video") {
          await room.localParticipant.setCameraEnabled(true, { facingMode: "user" });
          if (!cancelled) setCameraOff(false);
        } else {
          await room.localParticipant.setCameraEnabled(false);
          if (!cancelled) setCameraOff(true);
        }
      } catch {
        if (!cancelled) setStatus("Could not start microphone");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, room]);

  React.useEffect(() => {
    if (room.state === ConnectionState.Connected && peer) {
      setStatus(mode === "video" ? "Connected" : "On call");
      return;
    }
    if (room.state === ConnectionState.Connected) {
      setStatus(statusLabel || "Ringing...");
    }
  }, [mode, peer, room.state, statusLabel]);

  const toggleMute = async () => {
    const next = !muted;
    setMuted(next);
    await room.localParticipant.setMicrophoneEnabled(!next);
  };

  const toggleCamera = async () => {
    const next = !cameraOff;
    setCameraOff(next);
    await room.localParticipant.setCameraEnabled(!next, { facingMode: facingFront ? "user" : "environment" });
  };

  const flipCamera = async () => {
    const nextFront = !facingFront;
    setFacingFront(nextFront);
    if (!cameraOff) {
      await room.localParticipant.setCameraEnabled(true, { facingMode: nextFront ? "user" : "environment" });
    }
  };

  const endCall = async () => {
    try {
      await room.localParticipant.setCameraEnabled(false);
      await room.localParticipant.setMicrophoneEnabled(false);
      room.disconnect();
    } catch {
      // no-op
    }
    onClose();
  };

  return (
    <View style={[styles.callScreen, mode === "video" ? styles.videoCallScreen : null]}>
      {mode === "video" && remoteVideo && isTrackReference(remoteVideo) && !cameraOff ? (
        <VideoTrack trackRef={remoteVideo} style={styles.remoteVideo} />
      ) : (
        <View style={styles.videoPreview}>
          <UserAvatar
            uri={peerAvatarUrl}
            name={peerName}
            size={120}
            borderRadius={60}
            fallbackBackgroundColor="#262626"
            initialsColor="#fff"
          />
        </View>
      )}

      <View style={[styles.callTopBar, { paddingTop: Math.max(insets.top, 12) }]}>
        <Pressable style={styles.callTopIcon} onPress={endCall}>
          <Ionicons name="chevron-down" size={28} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.callIdentity}>
        <Text style={styles.callName}>{peerName}</Text>
        <Text style={styles.callStatus}>{status}</Text>
      </View>

      <View style={[styles.callControls, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <Pressable style={styles.callControlBtn} onPress={() => void toggleMute()}>
          <Ionicons name={muted ? "mic-off" : "mic"} size={24} color="#fff" />
        </Pressable>
        {mode === "video" ? (
          <Pressable style={styles.callControlBtn} onPress={() => void toggleCamera()}>
            <Ionicons name={cameraOff ? "videocam-off" : "videocam"} size={24} color="#fff" />
          </Pressable>
        ) : null}
        <Pressable style={[styles.callControlBtn, styles.endCallBtn]} onPress={() => void endCall()}>
          <Ionicons name="call" size={25} color="#fff" />
        </Pressable>
        {mode === "video" ? (
          <Pressable style={styles.callControlBtn} onPress={() => void flipCamera()}>
            <Ionicons name="camera-reverse" size={24} color="#fff" />
          </Pressable>
        ) : (
          <Pressable style={styles.callControlBtn}>
            <Ionicons name="volume-high" size={24} color="#fff" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function DirectCallView({
  visible,
  roomName,
  mode,
  peerName,
  peerAvatarUrl,
  connectEnabled,
  statusLabel,
  onAccept,
  onDecline,
  onClose
}: DirectCallViewProps) {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const [connection, setConnection] = React.useState<{ url: string; token: string } | null>(null);
  const [errorText, setErrorText] = React.useState("");

  React.useEffect(() => {
    if (!visible) return;
    void activateKeepAwakeAsync().catch(() => undefined);
    return () => {
      void deactivateKeepAwake().catch(() => undefined);
    };
  }, [visible]);

  React.useEffect(() => {
    if (!visible || !connectEnabled) {
      setConnection(null);
      setErrorText("");
      return;
    }
    ensureLiveKitGlobals();
    let cancelled = false;
    void (async () => {
      try {
        await AudioSession.configureAudio({
          android: {
            preferredOutputList: ["bluetooth", "headset", "speaker"],
            audioTypeOptions: AndroidAudioTypePresets.communication
          },
          ios: { defaultOutput: "speaker" }
        });
        await AudioSession.startAudioSession();
        const [cameraPerm, micPerm] = await Promise.all([
          mode === "video" ? Camera.requestCameraPermissionsAsync() : Promise.resolve({ granted: true }),
          Audio.requestPermissionsAsync()
        ]);
        if (!micPerm.granted || (mode === "video" && !cameraPerm.granted)) {
          if (!cancelled) setErrorText("Microphone and camera permissions are required for calls.");
          return;
        }
        if (!token) {
          if (!cancelled) setErrorText("Please log in to place calls.");
          return;
        }
        const lk = await createLiveKitToken(token, { roomName, canPublish: true });
        if (!cancelled) {
          setConnection({ url: lk.url, token: lk.token });
          setErrorText("");
        }
      } catch (error) {
        if (!cancelled) setErrorText(formatLiveStreamError(error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connectEnabled, mode, roomName, token, visible]);

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      {!connectEnabled ? (
        <View style={[styles.incomingScreen, { paddingTop: Math.max(insets.top, 24), paddingBottom: Math.max(insets.bottom, 24) }]}>
          <UserAvatar
            uri={peerAvatarUrl}
            name={peerName}
            size={118}
            borderRadius={59}
            fallbackBackgroundColor={APP_LIME}
            initialsColor="#111"
          />
          <Text style={styles.incomingName}>{peerName}</Text>
          <Text style={styles.incomingStatus}>{mode === "video" ? "Incoming video call" : "Incoming voice call"}</Text>
          <View style={styles.incomingActions}>
            <Pressable style={[styles.incomingBtn, styles.declineBtn]} onPress={onDecline || onClose}>
              <Ionicons name="close" size={28} color="#fff" />
            </Pressable>
            <Pressable style={[styles.incomingBtn, styles.acceptBtn]} onPress={onAccept}>
              <Ionicons name="call" size={26} color="#fff" />
            </Pressable>
          </View>
        </View>
      ) : errorText && !connection ? (
        <View style={styles.loadingScreen}>
          <Text style={styles.errorText}>{errorText}</Text>
          <Pressable style={styles.retryBtn} onPress={onClose}>
            <Text style={styles.retryText}>Close</Text>
          </Pressable>
        </View>
      ) : !connection ? (
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" color={APP_LIME} />
          <Text style={styles.loadingText}>{statusLabel || "Connecting call..."}</Text>
        </View>
      ) : (
        <LiveKitRoom
          serverUrl={connection.url}
          token={connection.token}
          connect
          audio
          video={mode === "video"}
          onDisconnected={onClose}
        >
          <CallRoomContent
            mode={mode}
            peerName={peerName}
            peerAvatarUrl={peerAvatarUrl}
            statusLabel={statusLabel}
            onClose={onClose}
          />
        </LiveKitRoom>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  callScreen: {
    flex: 1,
    backgroundColor: "#121212",
    justifyContent: "space-between"
  },
  videoCallScreen: { backgroundColor: "#050505" },
  remoteVideo: { ...StyleSheet.absoluteFillObject },
  videoPreview: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111"
  },
  callTopBar: { zIndex: 2, paddingHorizontal: 18 },
  callTopIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)"
  },
  callIdentity: { zIndex: 2, alignItems: "center", paddingHorizontal: 24 },
  callName: { color: "#fff", fontSize: 24, fontWeight: "800" },
  callStatus: { marginTop: 8, color: "rgba(255,255,255,0.72)", fontSize: 15, fontWeight: "600" },
  callControls: {
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    paddingHorizontal: 20
  },
  callControlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)"
  },
  endCallBtn: { backgroundColor: "#e53935", transform: [{ rotate: "135deg" }] },
  loadingScreen: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#121212", gap: 14 },
  loadingText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  errorText: { color: "#ffb4b4", fontSize: 15, textAlign: "center", paddingHorizontal: 24 },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: APP_LIME
  },
  retryText: { color: "#111", fontWeight: "800" },
  incomingScreen: {
    flex: 1,
    backgroundColor: "#121212",
    alignItems: "center",
    justifyContent: "center",
    gap: 12
  },
  incomingName: { color: "#fff", fontSize: 26, fontWeight: "800", marginTop: 18 },
  incomingStatus: { color: "rgba(255,255,255,0.72)", fontSize: 16, fontWeight: "600" },
  incomingActions: { flexDirection: "row", gap: 42, marginTop: 36 },
  incomingBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center"
  },
  declineBtn: { backgroundColor: "#e53935" },
  acceptBtn: { backgroundColor: "#2e7d32" }
});
