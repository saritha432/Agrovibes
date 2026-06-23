import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { Camera, CameraView, useCameraPermissions } from "expo-camera";
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
import {
  ConnectionState,
  LocalVideoTrack,
  RoomEvent,
  Track,
  type Participant,
  type Room
} from "livekit-client";
import React from "react";
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../auth/AuthContext";
import { createLiveKitToken, formatLiveStreamError } from "../../services/api";
import { ensureLiveKitGlobals } from "../../setupLiveKit.native";
import { LIVEKIT_CALL_ROOM_OPTIONS } from "../../utils/liveKitMobileOptions";
import { APP_LIME } from "../../theme/appColors";
import { UserAvatar } from "../../components/UserAvatar";
import type { DmCallStatus } from "./dmMessageFormats";
import { formatCallDuration } from "./dmMessageFormats";
import {
  applyInitialCallAudioRoute,
  callAudioRouteIcon,
  toggleCallAudioRoute,
  type CallAudioRoute
} from "./callAudioRoute";
import { startIncomingRingtone, startOutgoingRingtone, stopCallSounds } from "./callSounds";

export type DirectCallMode = "voice" | "video";
export type CallDirection = "outgoing" | "incoming";

export type CallEndResult = {
  status: DmCallStatus;
  durationSec: number;
};

type DirectCallViewProps = {
  visible: boolean;
  roomName: string;
  mode: DirectCallMode;
  direction: CallDirection;
  peerName: string;
  peerAvatarUrl?: string | null;
  connectEnabled: boolean;
  statusLabel?: string;
  onAccept?: () => void;
  onDecline?: () => void;
  onCallEnded?: (result: CallEndResult) => void;
  onClose: () => void;
};

function remoteParticipant(participants: Participant[], localIdentity: string) {
  return participants.find((p) => p.identity !== localIdentity) || null;
}

async function releaseCallMedia(room: Room) {
  try {
    await room.localParticipant.setCameraEnabled(false);
    await room.localParticipant.setMicrophoneEnabled(false);
  } catch {
    // no-op
  }
  for (const pub of room.localParticipant.trackPublications.values()) {
    const track = pub.track;
    if (!track) continue;
    try {
      track.stop();
    } catch {
      // no-op
    }
    try {
      await room.localParticipant.unpublishTrack(track, false);
    } catch {
      // no-op
    }
  }
  try {
    room.disconnect(true);
  } catch {
    try {
      room.disconnect();
    } catch {
      // no-op
    }
  }
}

function PreConnectVideoPreview({
  peerName,
  statusLabel,
  onClose
}: {
  peerName: string;
  statusLabel?: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();

  React.useEffect(() => {
    if (!permission?.granted) void requestPermission();
  }, [permission?.granted, requestPermission]);

  return (
    <View style={[styles.callScreen, styles.videoCallScreen]}>
      {permission?.granted ? (
        <CameraView style={styles.remoteVideo} facing="front" mirror />
      ) : (
        <View style={styles.videoPreview}>
          <ActivityIndicator size="large" color={APP_LIME} />
        </View>
      )}
      <View style={[styles.callTopBar, { paddingTop: Math.max(insets.top, 12) }]}>
        <Pressable style={styles.callTopIcon} onPress={onClose}>
          <Ionicons name="chevron-down" size={28} color="#fff" />
        </Pressable>
      </View>
      <View style={styles.callIdentity}>
        <Text style={styles.callName}>{peerName}</Text>
        <Text style={styles.callStatus}>{statusLabel || "Calling..."}</Text>
      </View>
      <View style={[styles.callControls, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <Pressable style={[styles.callControlBtn, styles.endCallBtn]} onPress={onClose}>
          <Ionicons name="call" size={25} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

function CallRoomContent({
  mode,
  direction,
  peerName,
  peerAvatarUrl,
  statusLabel,
  onCallEnded,
  onCallAnswered,
  onClose,
  endedRef
}: {
  mode: DirectCallMode;
  direction: CallDirection;
  peerName: string;
  peerAvatarUrl?: string | null;
  statusLabel?: string;
  onCallEnded?: (result: CallEndResult) => void;
  onCallAnswered?: () => void;
  onClose: () => void;
  endedRef: React.MutableRefObject<boolean>;
}) {
  const insets = useSafeAreaInsets();
  const room = useRoomContext();
  const participants = useParticipants();
  const remoteCameraTracks = useTracks([Track.Source.Camera], { onlySubscribed: true });
  const localCameraTracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const [muted, setMuted] = React.useState(false);
  const [audioRoute, setAudioRoute] = React.useState<CallAudioRoute>("earpiece");
  const [cameraOff, setCameraOff] = React.useState(mode === "voice");
  const [facingFront, setFacingFront] = React.useState(true);
  const [status, setStatus] = React.useState(statusLabel || "Connecting...");
  const [durationSec, setDurationSec] = React.useState(0);
  const [callActive, setCallActive] = React.useState(false);
  const connectedAtRef = React.useRef<number | null>(null);
  const hadPeerRef = React.useRef(false);
  const [tracksReady, setTracksReady] = React.useState(false);
  const localIdentity = room.localParticipant.identity;
  const peer = remoteParticipant(participants, localIdentity);
  const remoteVideo = remoteCameraTracks.find(
    (track) => isTrackReference(track) && track.participant.identity !== localIdentity
  );
  const localVideo = localCameraTracks.find(
    (track) => isTrackReference(track) && track.participant.identity === localIdentity
  );
  const remoteVideoSid = remoteVideo && isTrackReference(remoteVideo) ? remoteVideo.publication.trackSid : "";
  const localVideoSid = localVideo && isTrackReference(localVideo) ? localVideo.publication.trackSid : "";
  const showRemoteVideo =
    mode === "video" &&
    remoteVideo &&
    isTrackReference(remoteVideo) &&
    room.state === ConnectionState.Connected &&
    !!peer;
  const showLocalPip =
    mode === "video" && !cameraOff && localVideo && isTrackReference(localVideo) && tracksReady;

  const finishCall = React.useCallback(
    async (status: DmCallStatus) => {
      if (endedRef.current) return;
      endedRef.current = true;
      const duration = connectedAtRef.current
        ? Math.max(0, Math.floor((Date.now() - connectedAtRef.current) / 1000))
        : 0;
      await stopCallSounds();
      try {
        await releaseCallMedia(room);
      } catch {
        // no-op
      }
      await AudioSession.stopAudioSession().catch(() => undefined);
      onCallEnded?.({
        status,
        durationSec: status === "completed" ? duration : 0
      });
      onClose();
    },
    [endedRef, onCallEnded, onClose, room]
  );

  React.useEffect(() => {
    void applyInitialCallAudioRoute().then(setAudioRoute).catch(() => undefined);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const publishTracks = async () => {
      if (room.state !== ConnectionState.Connected) return;
      try {
        if (mode === "video") {
          await new Promise((resolve) => setTimeout(resolve, 450));
        }
        if (cancelled || room.state !== ConnectionState.Connected) return;
        await room.localParticipant.setMicrophoneEnabled(true);
        if (mode === "video") {
          await room.localParticipant.setCameraEnabled(true, {
            facingMode: "user",
            resolution: LIVEKIT_CALL_ROOM_OPTIONS.videoCaptureDefaults?.resolution
          });
          if (!cancelled) {
            setCameraOff(false);
            setTracksReady(true);
          }
        } else {
          await room.localParticipant.setCameraEnabled(false);
          if (!cancelled) {
            setCameraOff(true);
            setTracksReady(true);
          }
        }
        if (!cancelled) setMuted(false);
      } catch {
        if (!cancelled) setStatus("Could not start microphone");
      }
    };
    const onConnected = () => void publishTracks();
    room.on(RoomEvent.Connected, onConnected);
    room.on(RoomEvent.Reconnected, onConnected);
    if (room.state === ConnectionState.Connected) void publishTracks();
    return () => {
      cancelled = true;
      room.off(RoomEvent.Connected, onConnected);
      room.off(RoomEvent.Reconnected, onConnected);
    };
  }, [mode, room]);

  React.useEffect(() => {
    const endWhenPeerLeft = () => {
      if (!hadPeerRef.current || endedRef.current) return;
      if (room.remoteParticipants.size === 0) {
        void finishCall("completed");
      }
    };
    const onParticipantDisconnected = () => endWhenPeerLeft();
    const onTrackUnsubscribed = (
      _track: unknown,
      _publication: unknown,
      participant: { identity: string }
    ) => {
      if (participant.identity === localIdentity || !hadPeerRef.current || endedRef.current) return;
      setTimeout(endWhenPeerLeft, 300);
    };
    room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
    room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
    return () => {
      room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
      room.off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
    };
  }, [finishCall, localIdentity, room]);

  React.useEffect(() => {
    if (room.state === ConnectionState.Connected && peer) {
      if (!hadPeerRef.current) {
        hadPeerRef.current = true;
        connectedAtRef.current = Date.now();
        setCallActive(true);
        void stopCallSounds();
        onCallAnswered?.();
      }
      setStatus(mode === "video" ? "Connected" : "On call");
      return;
    }
    if (room.state === ConnectionState.Connected) {
      setStatus(statusLabel || (mode === "video" ? "Calling..." : "Ringing..."));
    }
  }, [mode, onCallAnswered, peer, room.state, statusLabel]);

  React.useEffect(() => {
    if (!callActive || !connectedAtRef.current) return;
    const timer = setInterval(() => {
      if (!connectedAtRef.current) return;
      setDurationSec(Math.max(0, Math.floor((Date.now() - connectedAtRef.current) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [callActive]);

  const toggleMute = async () => {
    const next = !muted;
    setMuted(next);
    try {
      await room.localParticipant.setMicrophoneEnabled(!next);
    } catch {
      setMuted(!next);
    }
  };

  const cycleAudioRoute = async () => {
    try {
      const next = await toggleCallAudioRoute(audioRoute);
      setAudioRoute(next);
    } catch {
      // keep previous route
    }
  };

  const toggleCamera = async () => {
    const next = !cameraOff;
    setCameraOff(next);
    await room.localParticipant.setCameraEnabled(!next, {
      facingMode: facingFront ? "user" : "environment",
      resolution: LIVEKIT_CALL_ROOM_OPTIONS.videoCaptureDefaults?.resolution
    });
  };

  const flipCamera = async () => {
    if (cameraOff) return;
    try {
      const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
      const track = pub?.track;
      if (!track || track.kind !== Track.Kind.Video) return;
      const nextFront = !facingFront;
      await (track as LocalVideoTrack).restartTrack({
        facingMode: nextFront ? "user" : "environment",
        resolution: LIVEKIT_CALL_ROOM_OPTIONS.videoCaptureDefaults?.resolution
      });
      setFacingFront(nextFront);
    } catch {
      // no-op
    }
  };

  const endCall = async () => {
    const status: DmCallStatus = hadPeerRef.current ? "completed" : direction === "outgoing" ? "cancelled" : "missed";
    await finishCall(status);
  };

  const statusLine = hadPeerRef.current
    ? formatCallDuration(durationSec)
    : statusLabel?.trim() || status || (mode === "video" ? "Calling..." : "Ringing...");
  const speakerActive = audioRoute === "speaker";

  return (
    <View style={[styles.callScreen, mode === "video" ? styles.videoCallScreen : null]}>
      {showRemoteVideo ? (
        <VideoTrack
          key={`remote-${remoteVideoSid}`}
          trackRef={remoteVideo}
          style={styles.remoteVideo}
          objectFit="cover"
          zOrder={0}
        />
      ) : mode === "video" && !tracksReady ? (
        <View style={styles.videoPreview}>
          <ActivityIndicator size="large" color={APP_LIME} />
          <Text style={styles.connectingVideoText}>Starting camera...</Text>
        </View>
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

      {showLocalPip ? (
        <View style={styles.localPip}>
          <VideoTrack
            key={`local-${localVideoSid}`}
            trackRef={localVideo}
            style={styles.localPipVideo}
            objectFit="cover"
            mirror={facingFront}
            zOrder={2}
          />
        </View>
      ) : null}

      <View style={[styles.callTopBar, { paddingTop: Math.max(insets.top, 12) }]}>
        <Pressable style={styles.callTopIcon} onPress={() => void endCall()}>
          <Ionicons name="chevron-down" size={28} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.callIdentity}>
        <Text style={styles.callName}>{peerName}</Text>
        {!(mode === "video" && !tracksReady) ? (
          <Text style={styles.callStatus}>{statusLine}</Text>
        ) : null}
      </View>

      <View style={[styles.callControls, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <Pressable
          style={[styles.callControlBtn, muted ? styles.callControlBtnActive : null]}
          onPress={() => void toggleMute()}
        >
          <Ionicons name={muted ? "mic-off" : "mic"} size={24} color="#fff" />
        </Pressable>
        {mode === "video" ? (
          <Pressable
            style={[styles.callControlBtn, cameraOff ? styles.callControlBtnActive : null]}
            onPress={() => void toggleCamera()}
          >
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
        ) : null}
        <Pressable
          style={[
            styles.callControlBtn,
            speakerActive ? styles.callControlBtnSpeakerOn : null
          ]}
          onPress={() => void cycleAudioRoute()}
        >
          <Ionicons
            name={callAudioRouteIcon(audioRoute)}
            size={24}
            color={speakerActive ? "#111" : "#fff"}
          />
        </Pressable>
      </View>
    </View>
  );
}

export function DirectCallView({
  visible,
  roomName,
  mode,
  direction,
  peerName,
  peerAvatarUrl,
  connectEnabled,
  statusLabel,
  onAccept,
  onDecline,
  onCallEnded,
  onClose
}: DirectCallViewProps) {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const [connection, setConnection] = React.useState<{ url: string; token: string } | null>(null);
  const [errorText, setErrorText] = React.useState("");
  const endedRef = React.useRef(false);
  const [ringSilenced, setRingSilenced] = React.useState(false);

  const silenceRingtone = React.useCallback(() => {
    setRingSilenced(true);
    void stopCallSounds();
  }, []);

  const finishWithoutRoom = React.useCallback(
    async (status: DmCallStatus) => {
      if (endedRef.current) return;
      endedRef.current = true;
      setRingSilenced(true);
      await stopCallSounds();
      await AudioSession.stopAudioSession().catch(() => undefined);
      onCallEnded?.({ status, durationSec: 0 });
      onClose();
    },
    [onCallEnded, onClose]
  );

  React.useEffect(() => {
    if (!visible) {
      endedRef.current = false;
      setRingSilenced(false);
      setConnection(null);
      setErrorText("");
      void stopCallSounds();
      void AudioSession.stopAudioSession().catch(() => undefined);
      return;
    }
    void activateKeepAwakeAsync().catch(() => undefined);
    return () => {
      void deactivateKeepAwake().catch(() => undefined);
      void stopCallSounds();
      void AudioSession.stopAudioSession().catch(() => undefined);
    };
  }, [visible]);

  React.useEffect(() => {
    if (!visible || ringSilenced) {
      void stopCallSounds();
      return;
    }
    if (!connectEnabled) {
      void startIncomingRingtone();
      return () => {
        void stopCallSounds();
      };
    }
    if (direction === "outgoing") {
      void startOutgoingRingtone();
      return () => {
        void stopCallSounds();
      };
    }
    void stopCallSounds();
  }, [connectEnabled, direction, ringSilenced, visible]);

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
            preferredOutputList: ["bluetooth", "headset", "earpiece", "speaker"],
            audioTypeOptions: AndroidAudioTypePresets.communication
          },
          ios: { defaultOutput: "earpiece" }
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
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={() => void finishWithoutRoom("cancelled")}>
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
            <Pressable
              style={[styles.incomingBtn, styles.declineBtn]}
              onPress={() => {
                silenceRingtone();
                onDecline?.();
                void finishWithoutRoom("declined");
              }}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </Pressable>
            <Pressable
              style={[styles.incomingBtn, styles.acceptBtn]}
              onPress={() => {
                silenceRingtone();
                onAccept?.();
              }}
            >
              <Ionicons name={mode === "video" ? "videocam" : "call"} size={26} color="#fff" />
            </Pressable>
          </View>
        </View>
      ) : errorText && !connection ? (
        <View style={styles.loadingScreen}>
          <Text style={styles.errorText}>{errorText}</Text>
          <Pressable style={styles.retryBtn} onPress={() => void finishWithoutRoom("cancelled")}>
            <Text style={styles.retryText}>Close</Text>
          </Pressable>
        </View>
      ) : !connection ? (
        mode === "video" ? (
          <PreConnectVideoPreview
            peerName={peerName}
            statusLabel={statusLabel}
            onClose={() => void finishWithoutRoom(direction === "outgoing" ? "cancelled" : "missed")}
          />
        ) : (
          <View style={styles.loadingScreen}>
            <ActivityIndicator size="large" color={APP_LIME} />
            <Text style={styles.loadingText}>{statusLabel || "Connecting call..."}</Text>
            <Pressable style={styles.retryBtn} onPress={() => void finishWithoutRoom(direction === "outgoing" ? "cancelled" : "missed")}>
              <Text style={styles.retryText}>End call</Text>
            </Pressable>
          </View>
        )
      ) : (
        <LiveKitRoom
          serverUrl={connection.url}
          token={connection.token}
          connect
          audio={false}
          video={false}
          options={LIVEKIT_CALL_ROOM_OPTIONS}
          onDisconnected={() => {
            if (!endedRef.current) void finishWithoutRoom("completed");
          }}
        >
          <CallRoomContent
            mode={mode}
            direction={direction}
            peerName={peerName}
            peerAvatarUrl={peerAvatarUrl}
            statusLabel={statusLabel}
            onCallEnded={onCallEnded}
            onCallAnswered={silenceRingtone}
            endedRef={endedRef}
            onClose={() => {
              silenceRingtone();
              onClose();
            }}
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
  localPip: {
    position: "absolute",
    top: 72,
    right: 16,
    width: 108,
    height: 152,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
    zIndex: 3,
    elevation: 6,
    backgroundColor: "#000"
  },
  localPipVideo: { width: "100%", height: "100%" },
  videoPreview: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111"
  },
  connectingVideoText: {
    marginTop: 12,
    color: "rgba(255,255,255,0.72)",
    fontSize: 14,
    fontWeight: "600"
  },
  callTopBar: { zIndex: 4, paddingHorizontal: 18 },
  callTopIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)"
  },
  callIdentity: { zIndex: 4, alignItems: "center", paddingHorizontal: 24 },
  callName: { color: "#fff", fontSize: 24, fontWeight: "800" },
  callStatus: { marginTop: 8, color: "rgba(255,255,255,0.72)", fontSize: 15, fontWeight: "600" },
  callControls: {
    zIndex: 4,
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
  callControlBtnActive: { backgroundColor: "rgba(255,255,255,0.34)" },
  callControlBtnSpeakerOn: { backgroundColor: APP_LIME },
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
