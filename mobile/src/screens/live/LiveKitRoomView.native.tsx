import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { Camera } from "expo-camera";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { ensureLiveKitGlobals } from "../../setupLiveKit.native";
import { LIVEKIT_LIVE_ROOM_OPTIONS } from "../../utils/liveKitMobileOptions";
import {
  AndroidAudioTypePresets,
  AudioSession,
  LiveKitRoom,
  VideoTrack,
  isTrackReference,
  useParticipants,
  useRoomContext,
  useTracks,
  type TrackReference
} from "@livekit/react-native";
import {
  LocalVideoTrack,
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  VideoPresets,
  createLocalVideoTrack,
  type Participant,
  type RemoteTrackPublication
} from "livekit-client";
import React from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LiveShareSheet } from "../../components/LiveShareSheet";
import { useAuth } from "../../auth/AuthContext";
import {
  API_BASE_URL,
  createLiveKitToken,
  endHomeLivePost,
  fetchLiveSetupCheck,
  formatLiveStreamError,
  startLiveServerRecording,
  type HomePost
} from "../../services/api";
import { APP_LIME } from "../../theme/appColors";
import {
  encodeLiveDataMessage,
  liveViewerCount,
  parseLiveDataMessage,
  type LiveComment,
  type LiveViewer
} from "./liveRoomData";
import { setActiveHostRoomName } from "./liveSessionState";

type LiveCameraFacing = "front" | "back";

type LiveKitRoomViewProps = {
  visible: boolean;
  roomName: string;
  isHost: boolean;
  title: string;
  postId?: number;
  sharePost?: HomePost | null;
  initialCameraFacing?: LiveCameraFacing;
  onClose?: () => void;
  onLiveEnded?: (postId: number, update?: Partial<HomePost>) => void;
};

function participantPublishesCamera(participant: Participant) {
  return Array.from(participant.videoTrackPublications.values()).some(
    (pub) => pub.source === Track.Source.Camera
  );
}

/**
 * Prefer a subscribed remote camera track with attached media (DirectCall-style).
 */
function pickLiveCameraTrack(tracks: TrackReference[], isHost: boolean, localSid: string) {
  if (!tracks.length) return undefined;
  if (isHost) {
    return (
      tracks.find((t) => t.participant.sid === localSid && !!t.publication?.track) ??
      tracks.find((t) => t.participant.sid === localSid)
    );
  }
  const remotes = tracks.filter((t) => t.participant.sid !== localSid);
  const hostFirst = [
    ...remotes.filter((t) => participantPublishesCamera(t.participant) || t.participant.isCameraEnabled),
    ...remotes
  ];
  return (
    hostFirst.find((t) => !!t.publication?.track && t.publication.isSubscribed !== false) ??
    hostFirst.find((t) => !!t.publication?.track)
  );
}

const LIVE_CONNECT_OPTIONS = { autoSubscribe: true };
const LIVE_PUBLISH_OPTIONS = {
  source: Track.Source.Camera,
  videoCodec: "vp8" as const,
  simulcast: false,
  backupCodec: false as const
};

/** Join response often lists H264 first on Android — lock host to VP8 before publishing. */
function lockHostPublishToVp8(room: Room) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    room.localParticipant.setEnabledPublishCodecs([{ mime: "video/VP8", fmtpLine: "" } as any]);
  } catch {
    // no-op
  }
}

async function publishHostCameraAndMic(room: Room, facing: LiveCameraFacing) {
  lockHostPublishToVp8(room);
  await releaseHostCameraAndMic(room);

  // Match DirectCall: setCameraEnabled uses room publishDefaults (VP8) and is stable on Android RN.
  await room.localParticipant.setMicrophoneEnabled(true);
  await room.localParticipant.setCameraEnabled(true, {
    facingMode: facing === "back" ? "environment" : "user",
    resolution: VideoPresets.h360.resolution
  });

  const videoPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
  const mime = String(videoPub?.mimeType || "");
  console.log("[live-host] published camera", {
    mime,
    sid: videoPub?.trackSid,
    vp8: /vp8/i.test(mime) || !mime
  });
  if (mime && /h264/i.test(mime)) {
    console.warn("[live-host] server still selected H264 — remote Android viewers may see black video");
    // Retry once with explicit VP8 publish options.
    try {
      await room.localParticipant.setCameraEnabled(false);
      lockHostPublishToVp8(room);
      const videoTrack = await createLocalVideoTrack({
        facingMode: facing === "back" ? "environment" : "user",
        resolution: VideoPresets.h360.resolution
      });
      const republished = await room.localParticipant.publishTrack(videoTrack, LIVE_PUBLISH_OPTIONS);
      console.log("[live-host] republished camera", {
        mime: String(republished?.mimeType || ""),
        sid: republished?.trackSid,
        vp8: /vp8/i.test(String(republished?.mimeType || ""))
      });
      return republished;
    } catch {
      // keep first publish
    }
  }
  return videoPub;
}

async function releaseHostCameraAndMic(room: Room) {
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
}

function buildLiveViewers(
  isHost: boolean,
  localName: string,
  localIdentity: string,
  participants: Participant[]
): LiveViewer[] {
  const remotes = participants.filter((p) => p.identity !== localIdentity);
  if (isHost) {
    return [
      { id: localIdentity, name: localName, role: "Host" },
      ...remotes.map((p) => ({ id: p.identity, name: p.name || p.identity, role: "Viewer" as const }))
    ];
  }
  const hostParticipant =
    remotes.find((p) => participantPublishesCamera(p)) ??
    remotes.find((p) => p.isCameraEnabled) ??
    remotes[0];
  const rows: LiveViewer[] = [];
  if (hostParticipant) {
    rows.push({ id: hostParticipant.identity, name: hostParticipant.name || hostParticipant.identity, role: "Host" });
  }
  remotes
    .filter((p) => p.identity !== hostParticipant?.identity)
    .forEach((p) => rows.push({ id: p.identity, name: p.name || p.identity, role: "Viewer" }));
  rows.push({ id: localIdentity, name: localName, role: "Viewer" });
  return rows;
}

function LiveRoomContent({
  isHost,
  roomName,
  title,
  postId,
  initialCameraFacing = "front",
  onClose,
  onLiveEnded,
  onShare,
  errorText,
  status
}: {
  isHost: boolean;
  roomName: string;
  title: string;
  postId?: number;
  initialCameraFacing?: LiveCameraFacing;
  onClose?: () => void;
  onLiveEnded?: (postId: number, update?: Partial<HomePost>) => void;
  onShare?: () => void;
  errorText: string;
  status: string;
}) {
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();
  const room = useRoomContext();
  const participants = useParticipants();
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: !isHost });
  const commentsRef = React.useRef<ScrollView | null>(null);
  const videoDropTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCloseRef = React.useRef(onClose);
  const onLiveEndedRef = React.useRef(onLiveEnded);
  onCloseRef.current = onClose;
  onLiveEndedRef.current = onLiveEnded;
  const liveEndedRef = React.useRef(false);
  const hostSeenRef = React.useRef(false);
  const [comments, setComments] = React.useState<LiveComment[]>([]);
  const [commentDraft, setCommentDraft] = React.useState("");
  const [liveEnded, setLiveEnded] = React.useState(false);
  const [savingRecording, setSavingRecording] = React.useState(false);
  const [statusText, setStatusText] = React.useState(status);
  const [showViewerList, setShowViewerList] = React.useState(false);
  const [publishError, setPublishError] = React.useState("");
  const [facingFront, setFacingFront] = React.useState(initialCameraFacing !== "back");
  const [mediaTick, setMediaTick] = React.useState(0);
  const localName = user?.fullName || "You";
  const localSid = room.localParticipant.sid;

  const remoteHasHostCamera = React.useMemo(() => {
    if (isHost) return true;
    for (const p of participants) {
      if (p.sid === localSid) continue;
      if (participantPublishesCamera(p) || p.isCameraEnabled) return true;
    }
    return tracks.some((t) => isTrackReference(t) && t.participant.sid !== localSid);
  }, [isHost, localSid, participants, tracks]);

  React.useEffect(() => {
    if (!isHost && remoteHasHostCamera) hostSeenRef.current = true;
  }, [isHost, remoteHasHostCamera]);

  // Force-subscribe host A/V — do not rely on adaptiveStream attach heuristics.
  React.useEffect(() => {
    if (isHost || liveEnded) return;
    const subscribePub = (pub: RemoteTrackPublication) => {
      try {
        if (!pub.isSubscribed) pub.setSubscribed(true);
      } catch {
        // no-op
      }
    };
    const subscribeAllRemote = () => {
      for (const p of room.remoteParticipants.values()) {
        for (const pub of p.trackPublications.values()) {
          if (pub.kind === Track.Kind.Video || pub.kind === Track.Kind.Audio) {
            subscribePub(pub as RemoteTrackPublication);
          }
        }
      }
    };
    subscribeAllRemote();
    const onPublished = (pub: RemoteTrackPublication) => subscribePub(pub);
    const onParticipantConnected = () => subscribeAllRemote();
    const bumpMedia = () => setMediaTick((n) => n + 1);
    room.on(RoomEvent.TrackPublished, onPublished);
    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
    room.on(RoomEvent.Connected, subscribeAllRemote);
    room.on(RoomEvent.Reconnected, subscribeAllRemote);
    room.on(RoomEvent.TrackSubscribed, bumpMedia);
    room.on(RoomEvent.TrackUnsubscribed, bumpMedia);
    room.on(RoomEvent.TrackMuted, bumpMedia);
    room.on(RoomEvent.TrackUnmuted, bumpMedia);
    return () => {
      room.off(RoomEvent.TrackPublished, onPublished);
      room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
      room.off(RoomEvent.Connected, subscribeAllRemote);
      room.off(RoomEvent.Reconnected, subscribeAllRemote);
      room.off(RoomEvent.TrackSubscribed, bumpMedia);
      room.off(RoomEvent.TrackUnsubscribed, bumpMedia);
      room.off(RoomEvent.TrackMuted, bumpMedia);
      room.off(RoomEvent.TrackUnmuted, bumpMedia);
    };
  }, [isHost, liveEnded, room]);

  React.useEffect(() => {
    setStatusText(status);
  }, [status]);

  React.useEffect(() => {
    if (!isHost || liveEnded) return;
    let cancelled = false;
    const publishHostTracks = async () => {
      try {
        setPublishError("");
        await publishHostCameraAndMic(room, initialCameraFacing);
        if (cancelled || liveEndedRef.current) return;
        // RESTORE WHEN SUPABASE PAID — uncomment block below (live replay → Supabase egress).
        // if (token) {
        //   try {
        //     const setup = await fetchLiveSetupCheck(token);
        //     if (!setup.egressRecording) {
        //       setPublishError("API server cannot save live replays — set LIVEKIT_EGRESS_S3 on Render.");
        //     }
        //     const rec = await startLiveServerRecording(token, roomName);
        //     if (!rec.started) {
        //       console.warn("[live] start-recording:", rec.error || "not started");
        //     }
        //   } catch (err) {
        //     console.warn("[live] recording setup failed:", err);
        //   }
        // }
      } catch (error) {
        if (cancelled) return;
        setPublishError(formatLiveStreamError(error));
      }
    };
    const onReady = () => void publishHostTracks();
    room.on(RoomEvent.Connected, onReady);
    room.on(RoomEvent.Reconnected, onReady);
    if (room.state === ConnectionState.Connected) void publishHostTracks();
    return () => {
      cancelled = true;
      room.off(RoomEvent.Connected, onReady);
      room.off(RoomEvent.Reconnected, onReady);
    };
  }, [initialCameraFacing, isHost, liveEnded, room, roomName, token]);

  const viewers = React.useMemo<LiveViewer[]>(
    () =>
      buildLiveViewers(
        isHost,
        localName,
        room.localParticipant.identity,
        [room.localParticipant, ...participants.filter((p) => p.identity !== room.localParticipant.identity)]
      ),
    [isHost, localName, participants, room.localParticipant]
  );

  const handleLiveEnded = React.useCallback(() => {
    if (liveEndedRef.current) return;
    liveEndedRef.current = true;
    setLiveEnded(true);
    if (videoDropTimerRef.current) {
      clearTimeout(videoDropTimerRef.current);
      videoDropTimerRef.current = null;
    }
    void (async () => {
      if (isHost) {
        try {
          await releaseHostCameraAndMic(room);
        } catch {
          // no-op
        }
      }
      try {
        room.disconnect();
      } catch {
        // no-op
      }
    })();
    setStatusText("Live ended");
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      if (!isHost && postId) {
        onLiveEndedRef.current?.(postId, { id: postId, liveStatus: "ended", liveViewerCount: 0 });
      }
      onCloseRef.current?.();
    }, isHost ? 1500 : 1200);
  }, [isHost, postId, room]);

  const flipCamera = React.useCallback(async () => {
    if (!isHost || liveEnded) return;
    try {
      const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
      const track = pub?.track;
      if (!track || track.kind !== Track.Kind.Video) return;
      const nextFront = !facingFront;
      await (track as LocalVideoTrack).restartTrack({ facingMode: nextFront ? "user" : "environment" });
      setFacingFront(nextFront);
    } catch {
      // no-op
    }
  }, [facingFront, isHost, liveEnded, room]);

  React.useEffect(() => {
    const onConnected = () => setStatusText(isHost ? "You are live now" : "Joined live");
    const onReconnecting = () => setStatusText("Reconnecting...");
    const onReconnected = () => setStatusText(isHost ? "You are live now" : "Joined live");
    room.on(RoomEvent.Connected, onConnected);
    room.on(RoomEvent.Reconnecting, onReconnecting);
    room.on(RoomEvent.Reconnected, onReconnected);
    return () => {
      room.off(RoomEvent.Connected, onConnected);
      room.off(RoomEvent.Reconnecting, onReconnecting);
      room.off(RoomEvent.Reconnected, onReconnected);
    };
  }, [isHost, room]);

  React.useEffect(() => {
    const onData = (payload: Uint8Array, participant?: { name?: string; identity?: string }) => {
      const parsed = parseLiveDataMessage(payload);
      if (!parsed) return;
      if (parsed.type === "live_ended") {
        handleLiveEnded();
        return;
      }
      setComments((prev) => [
        ...prev.slice(-60),
        {
          id: `${Date.now()}-${Math.random()}`,
          name: parsed.name || participant?.name || "Viewer",
          text: parsed.text
        }
      ]);
    };
    const clearVideoDropTimer = () => {
      if (videoDropTimerRef.current) {
        clearTimeout(videoDropTimerRef.current);
        videoDropTimerRef.current = null;
      }
    };
    const onTrackSubscribed = (track: { kind: Track.Kind; mediaStreamTrack?: MediaStreamTrack; codec?: string }, publication?: { trackSid?: string; mimeType?: string }) => {
      if (!isHost && track.kind === Track.Kind.Video) {
        hostSeenRef.current = true;
        clearVideoDropTimer();
        setStatusText("Joined live");
        try {
          console.log("[live-viewer] video subscribed", {
            sid: publication?.trackSid,
            mime: publication?.mimeType,
            codec: (track as { codec?: string }).codec,
            readyState: track.mediaStreamTrack?.readyState
          });
        } catch {
          // no-op
        }
      }
    };
    // Dynacast / adaptiveStream often unsubscribes briefly — do NOT end the live for that.
    const onTrackUnsubscribed = (track: { kind: Track.Kind }) => {
      if (isHost || track.kind !== Track.Kind.Video || liveEndedRef.current) return;
      clearVideoDropTimer();
      // Only consider ending if host camera stays gone for a long grace period.
      videoDropTimerRef.current = setTimeout(() => {
        videoDropTimerRef.current = null;
        if (liveEndedRef.current || isHost) return;
        if (room.remoteParticipants.size === 0 && hostSeenRef.current) {
          handleLiveEnded();
        } else {
          setStatusText("Waiting for host...");
        }
      }, 12_000);
    };
    const onParticipantDisconnected = (participant?: Participant) => {
      if (isHost || liveEndedRef.current) return;
      const wasHostCamera =
        !!participant &&
        (participantPublishesCamera(participant) ||
          participant.isCameraEnabled ||
          Array.from(participant.videoTrackPublications.values()).some((p) => p.source === Track.Source.Camera));
      // Ignore other viewers leaving. Only react when a camera publisher leaves.
      if (participant && !wasHostCamera && room.remoteParticipants.size > 0) return;
      clearVideoDropTimer();
      videoDropTimerRef.current = setTimeout(() => {
        videoDropTimerRef.current = null;
        if (liveEndedRef.current) return;
        const stillHasRemoteHost = Array.from(room.remoteParticipants.values()).some(
          (p) => participantPublishesCamera(p) || p.isCameraEnabled
        );
        if (!stillHasRemoteHost && hostSeenRef.current && room.remoteParticipants.size === 0) {
          handleLiveEnded();
        }
      }, 8_000);
    };
    // Brief disconnects / remounts must not close the viewer as "live ended".
    const onDisconnected = () => {
      if (isHost || liveEndedRef.current) return;
      setStatusText("Reconnecting...");
    };
    room.on(RoomEvent.DataReceived, onData);
    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
    room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
    room.on(RoomEvent.Disconnected, onDisconnected);
    return () => {
      clearVideoDropTimer();
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      room.off(RoomEvent.DataReceived, onData);
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
      room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
      room.off(RoomEvent.Disconnected, onDisconnected);
    };
  }, [handleLiveEnded, isHost, room]);

  React.useEffect(() => {
    commentsRef.current?.scrollToEnd?.({ animated: true });
  }, [comments.length]);

  const sendComment = React.useCallback(async () => {
    const text = commentDraft.trim();
    if (!text || liveEnded) return;
    try {
      await room.localParticipant.publishData(
        encodeLiveDataMessage({ type: "comment", name: localName, text }),
        { reliable: true, topic: "live-chat" }
      );
    } catch {
      // Show locally even if broadcast fails.
    }
    setComments((prev) => [...prev.slice(-60), { id: `${Date.now()}-me`, name: localName, text }]);
    setCommentDraft("");
  }, [commentDraft, liveEnded, localName, room]);

  const handleEndLive = React.useCallback(async () => {
    if (liveEndedRef.current || savingRecording) return;
    liveEndedRef.current = true;
    if (isHost) {
      try {
        await room.localParticipant.publishData(encodeLiveDataMessage({ type: "live_ended" }), {
          reliable: true,
          topic: "live-chat"
        });
        await new Promise((resolve) => setTimeout(resolve, 400));
      } catch {
        // Continue ending even if broadcast fails.
      }
    }
    if (isHost && postId && token) {
      setSavingRecording(true);
      setStatusText("Saving recording...");
      await new Promise((resolve) => setTimeout(resolve, 80));
      let savedPost: HomePost | null = null;
      let resultMessage = "Recording was not saved for this live.";
      try {
        const ended = await endHomeLivePost(token, postId);
        if (ended.post?.videoUrl) {
          savedPost = { ...ended.post, liveStatus: "ended", liveViewerCount: 0 };
          resultMessage = "Recording saved.";
        } else if (ended.liveRecording?.message) {
          resultMessage = ended.liveRecording.message;
        } else if (!savedPost) {
          resultMessage = "Recording was not saved for this live.";
        }
      } catch {
        resultMessage = "Live ended — save failed";
      }
      setSavingRecording(false);
      setStatusText(resultMessage);
      setLiveEnded(true);
      try {
        room.disconnect();
      } catch {
        // no-op
      }
      onLiveEnded?.(postId, savedPost ?? { id: postId, liveStatus: "ended", liveViewerCount: 0 });
      await new Promise((resolve) => setTimeout(resolve, 2200));
      onCloseRef.current?.();
      return;
    }
    handleLiveEnded();
  }, [handleLiveEnded, isHost, onLiveEnded, postId, room, savingRecording, token]);

  const cameraRefs = tracks.filter((track): track is TrackReference => isTrackReference(track));
  void mediaTick;
  const cameraTrack = pickLiveCameraTrack(cameraRefs, isHost, localSid);
  const cameraTrackSid = cameraTrack?.publication?.trackSid ?? "";
  const watchingCount = liveViewerCount(viewers, isHost);
  // Match DirectCall: require subscribed track with media attached.
  const showCameraVideo =
    !!cameraTrack &&
    !!cameraTrack.publication?.track &&
    (isHost || cameraTrack.publication.isSubscribed !== false);

  React.useEffect(() => {
    if (isHost || liveEnded || showCameraVideo) return;
    const id = setInterval(() => setMediaTick((n) => n + 1), 400);
    return () => clearInterval(id);
  }, [isHost, liveEnded, showCameraVideo]);

  return (
    <View style={styles.root} collapsable={false}>
      {showCameraVideo && cameraTrack ? (
        <View style={styles.videoHost} collapsable={false} pointerEvents="none">
          <VideoTrack
            key={`live-cam-${cameraTrackSid}`}
            trackRef={cameraTrack}
            style={styles.videoSurface}
            objectFit="cover"
            mirror={isHost && facingFront}
            zOrder={0}
          />
        </View>
      ) : (
        <View style={[styles.videoHost, styles.videoPlaceholder]}>
          <ActivityIndicator color={APP_LIME} />
          <Text style={styles.videoPlaceholderText}>{isHost ? "Starting camera..." : "Waiting for host..."}</Text>
        </View>
      )}
      {savingRecording ? (
        <View style={styles.endedOverlay}>
          <ActivityIndicator color={APP_LIME} size="large" />
          <Text style={[styles.endedTitle, { marginTop: 16 }]}>Saving recording...</Text>
          <Text style={styles.endedSub}>Please wait while your live is saved</Text>
        </View>
      ) : liveEnded ? (
        <View style={styles.endedOverlay}>
          <Ionicons
            name={statusText.includes("saved") && !statusText.includes("not") ? "checkmark-circle" : "alert-circle-outline"}
            size={48}
            color={statusText.includes("saved") && !statusText.includes("not") ? APP_LIME : "#ff6b6b"}
          />
          <Text style={[styles.endedTitle, { marginTop: 12 }]}>Live ended</Text>
          <Text style={styles.endedSub}>{statusText}</Text>
        </View>
      ) : null}
      <View style={[styles.topBar, { top: Math.max(insets.top, 4) }]}>
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>{liveEnded ? "ENDED" : "LIVE"}</Text>
        </View>
        <Text style={styles.statusText}>{publishError || errorText || (savingRecording ? "Saving recording..." : statusText)}</Text>
        {isHost && !liveEnded ? (
          <Pressable style={styles.flipBtn} onPress={() => void flipCamera()} accessibilityLabel="Flip camera">
            <Ionicons name="camera-reverse-outline" size={22} color="#fff" />
          </Pressable>
        ) : null}
        {!liveEnded && onShare ? (
          <Pressable style={styles.flipBtn} onPress={onShare} accessibilityLabel="Share live">
            <Ionicons name="paper-plane-outline" size={20} color="#fff" />
          </Pressable>
        ) : null}
        {onClose ? (
          <Pressable style={styles.closeBtn} onPress={() => (isHost && !liveEnded ? void handleEndLive() : onClose())}>
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
        ) : null}
      </View>
      <Pressable style={[styles.viewerPill, { top: Math.max(insets.top, 4) + 40 }]} onPress={() => setShowViewerList(true)}>
        <Ionicons name="eye-outline" size={14} color="#fff" />
        <Text style={styles.viewerText}>{watchingCount} watching</Text>
      </Pressable>
      <View style={[styles.bottomPanel, { paddingBottom: Math.max(14, insets.bottom + 10) }]}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.names} numberOfLines={1}>
          Joined: {viewers.length ? viewers.map((v) => v.name).join(", ") : "Waiting..."}
        </Text>
        <ScrollView ref={commentsRef} style={styles.comments} contentContainerStyle={styles.commentsInner}>
          {comments.length ? (
            comments.map((c) => (
              <Text key={c.id} style={styles.commentText}>
                <Text style={styles.commentName}>{c.name}: </Text>
                {c.text}
              </Text>
            ))
          ) : (
            <Text style={styles.commentEmpty}>Be the first to comment...</Text>
          )}
        </ScrollView>
        {!liveEnded ? (
          <View style={styles.commentRow}>
            <TextInput
              value={commentDraft}
              onChangeText={setCommentDraft}
              placeholder="Comment on live..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              style={styles.commentInput}
              onSubmitEditing={() => void sendComment()}
              returnKeyType="send"
            />
            <Pressable style={styles.sendBtn} onPress={() => void sendComment()}>
              <Text style={styles.sendText}>Send</Text>
            </Pressable>
          </View>
        ) : null}
        {isHost && !liveEnded && !savingRecording ? (
          <Pressable style={styles.endLiveBtn} onPress={() => void handleEndLive()}>
            <Text style={styles.endLiveText}>End Live</Text>
          </Pressable>
        ) : null}
      </View>

      <Modal visible={showViewerList} transparent animationType="fade" onRequestClose={() => setShowViewerList(false)}>
        <Pressable style={styles.viewerSheetBackdrop} onPress={() => setShowViewerList(false)}>
          <Pressable style={styles.viewerSheetCard} onPress={(e) => e.stopPropagation?.()}>
            <View style={styles.viewerSheetHeader}>
              <Text style={styles.viewerSheetTitle}>Watching now ({viewers.length})</Text>
              <Pressable onPress={() => setShowViewerList(false)}>
                <Ionicons name="close" size={20} color="#fff" />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.viewerSheetList}>
              {viewers.map((viewer) => (
                <View key={viewer.id} style={styles.viewerSheetRow}>
                  <View style={styles.viewerSheetAvatar}>
                    <Text style={styles.viewerSheetAvatarText}>{viewer.name.slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <View style={styles.viewerSheetTextWrap}>
                    <Text style={styles.viewerSheetName}>{viewer.name}</Text>
                    <Text style={styles.viewerSheetRole}>{viewer.role}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export function LiveKitRoomView({
  visible,
  roomName,
  isHost,
  title,
  postId,
  sharePost,
  initialCameraFacing = "front",
  onClose,
  onLiveEnded
}: LiveKitRoomViewProps) {
  const { token, user } = useAuth();
  const authTokenRef = React.useRef(token);
  authTokenRef.current = token;
  const [connection, setConnection] = React.useState<{ url: string; token: string } | null>(null);
  const [status, setStatus] = React.useState("Connecting live...");
  const [errorText, setErrorText] = React.useState("");
  const [debugInfo, setDebugInfo] = React.useState("");
  const [shareOpen, setShareOpen] = React.useState(false);
  const [liveRoom, setLiveRoom] = React.useState<Room | null>(null);
  const handleRoomError = React.useCallback(
    (error: Error) => {
      const msg = error.message || "";
      if (!isHost && /insufficient permissions/i.test(msg)) return;
      setErrorText(formatLiveStreamError(error));
    },
    [isHost]
  );
  const openShare = React.useCallback(() => setShareOpen(true), []);

  const liveSharePost = React.useMemo((): HomePost | null => {
    if (sharePost) return sharePost;
    if (!postId) return null;
    return {
      id: postId,
      userId: user?.id ?? null,
      userName: user?.fullName?.trim() || "Host",
      location: "",
      caption: `[LIVE] ${title}`,
      likesCount: 0,
      commentsCount: 0,
      createdAt: new Date().toISOString(),
      liveStatus: "active",
      liveRoomName: roomName,
      authorAvatarUrl: user?.avatarUrl ?? null
    };
  }, [postId, roomName, sharePost, title, user?.avatarUrl, user?.fullName, user?.id]);

  React.useEffect(() => {
    if (!visible || !isHost) return;
    setActiveHostRoomName(roomName);
    return () => setActiveHostRoomName(null);
  }, [isHost, roomName, visible]);

  // Fresh Room per session so singlePeerConnection:false always applies (required for RN remote video).
  React.useEffect(() => {
    if (!visible) {
      setLiveRoom(null);
      setConnection(null);
      return;
    }
    ensureLiveKitGlobals();
    const room = new Room({
      ...LIVEKIT_LIVE_ROOM_OPTIONS,
      videoCaptureDefaults: {
        ...LIVEKIT_LIVE_ROOM_OPTIONS.videoCaptureDefaults,
        facingMode: (initialCameraFacing === "back" ? "environment" : "user") as "user" | "environment"
      }
    });
    setLiveRoom(room);
    return () => {
      try {
        room.disconnect();
      } catch {
        // no-op
      }
      setLiveRoom((cur) => (cur === room ? null : cur));
    };
  }, [initialCameraFacing, roomName, visible]);

  React.useEffect(() => {
    if (!visible) return;
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
        if (!cancelled) await AudioSession.startAudioSession();
      } catch {
        if (!cancelled) await AudioSession.startAudioSession().catch(() => undefined);
      }
    })();
    void activateKeepAwakeAsync().catch(() => undefined);
    return () => {
      cancelled = true;
      AudioSession.stopAudioSession().catch(() => undefined);
      void deactivateKeepAwake().catch(() => undefined);
    };
  }, [visible]);

  React.useEffect(() => {
    if (!visible || !roomName || !liveRoom) return;
    let cancelled = false;
    setErrorText("");
    setStatus("Connecting live...");

    (async () => {
      const authToken = authTokenRef.current;
      if (!authToken) {
        setErrorText("Please log in to join live.");
        return;
      }
      try {
        if (isHost) {
          setStatus("Checking camera/mic permissions...");
          const [cameraPerm, micPerm] = await Promise.all([
            Camera.requestCameraPermissionsAsync(),
            Audio.requestPermissionsAsync()
          ]);
          const cameraGranted = cameraPerm.granted ? "granted" : "denied";
          const micGranted = micPerm.granted ? "granted" : "denied";
          const apiHost = API_BASE_URL.replace(/^https?:\/\//, "").split("/")[0];
          setDebugInfo(`api=${apiHost} room=${roomName} post=${postId ?? "-"} cam=${cameraGranted} mic=${micGranted}`);
          if (!cameraPerm.granted || !micPerm.granted) {
            setErrorText("Camera and microphone permissions are required to go live.");
            setStatus(`Permission blocked (cam=${cameraGranted}, mic=${micGranted})`);
            return;
          }
        } else {
          setDebugInfo(`room=${roomName} post=${postId ?? "-"} host=no`);
        }
        setStatus("Requesting LiveKit token...");
        const lk = await createLiveKitToken(authToken, { roomName, canPublish: isHost });
        if (cancelled) return;
        setConnection({ url: lk.url, token: lk.token });
        setStatus(isHost ? "You are live now" : "Joined live");
      } catch (error) {
        if (cancelled) return;
        setErrorText(formatLiveStreamError(error));
        setStatus("Live start failed");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isHost, liveRoom, postId, roomName, visible]);

  if (!visible) return null;

  if (errorText && !connection) {
    return (
      <View style={styles.root}>
        <View style={[styles.videoHost, styles.videoPlaceholder]}>
          <Ionicons name="alert-circle-outline" size={42} color="#ff6b6b" />
          <Text style={styles.videoPlaceholderText}>{errorText}</Text>
          {debugInfo ? <Text style={styles.videoDebugText}>{debugInfo}</Text> : null}
          {onClose ? (
            <Pressable style={styles.retryCloseBtn} onPress={onClose}>
              <Text style={styles.sendText}>Close</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  if (!connection || !liveRoom) {
    return (
      <View style={styles.root}>
        <View style={[styles.videoHost, styles.videoPlaceholder]}>
          <ActivityIndicator color={APP_LIME} size="large" />
          <Text style={styles.videoPlaceholderText}>{status}</Text>
          {debugInfo ? <Text style={styles.videoDebugText}>{debugInfo}</Text> : null}
        </View>
      </View>
    );
  }

  return (
    <>
      <LiveKitRoom
        serverUrl={connection.url}
        token={connection.token}
        connect
        audio={false}
        video={false}
        room={liveRoom}
        connectOptions={LIVE_CONNECT_OPTIONS}
        onError={handleRoomError}
      >
        <LiveRoomContent
          isHost={isHost}
          roomName={roomName}
          title={title}
          postId={postId}
          initialCameraFacing={initialCameraFacing}
          onClose={onClose}
          onLiveEnded={onLiveEnded}
          onShare={liveSharePost ? openShare : undefined}
          errorText={errorText}
          status={status}
        />
      </LiveKitRoom>
      <LiveShareSheet visible={shareOpen} post={liveSharePost} title={title} onClose={() => setShareOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  videoHost: { ...StyleSheet.absoluteFillObject, backgroundColor: "transparent" },
  videoSurface: { ...StyleSheet.absoluteFillObject },
  videoPlaceholder: { alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#000" },
  videoPlaceholderText: { marginTop: 12, color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: "700", textAlign: "center" },
  videoDebugText: { marginTop: 8, color: "rgba(201,255,53,0.85)", fontSize: 11, fontWeight: "700", textAlign: "center" },
  endedOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.72)",
    zIndex: 3
  },
  endedTitle: { color: "#fff", fontSize: 24, fontWeight: "900" },
  endedSub: { marginTop: 8, color: "rgba(255,255,255,0.75)", fontSize: 14, fontWeight: "700" },
  topBar: {
    position: "absolute",
    left: 14,
    right: 14,
    zIndex: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FF3040",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 5
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" },
  liveText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  statusText: { flex: 1, color: "#fff", fontSize: 12, fontWeight: "800" },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)"
  },
  flipBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)"
  },
  viewerPill: {
    position: "absolute",
    left: 14,
    zIndex: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999
  },
  viewerText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  bottomPanel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 4,
    padding: 14,
    backgroundColor: "rgba(0,0,0,0.48)"
  },
  title: { color: "#fff", fontSize: 15, fontWeight: "900" },
  names: { marginTop: 4, color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: "700" },
  comments: { maxHeight: 120, marginTop: 8 },
  commentsInner: { gap: 4, paddingBottom: 4 },
  commentEmpty: { color: "rgba(255,255,255,0.45)", fontSize: 12, fontWeight: "700" },
  commentText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  commentName: { color: APP_LIME, fontWeight: "900" },
  commentRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  commentInput: {
    flex: 1,
    minHeight: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.14)",
    color: "#fff",
    paddingHorizontal: 14,
    fontWeight: "700"
  },
  sendBtn: { backgroundColor: APP_LIME, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  sendText: { color: "#111", fontSize: 12, fontWeight: "900" },
  retryCloseBtn: { marginTop: 16, backgroundColor: APP_LIME, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10 },
  endLiveBtn: {
    marginTop: 12,
    alignSelf: "center",
    backgroundColor: "#FF3040",
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 11
  },
  endLiveText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  viewerSheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end"
  },
  viewerSheetCard: {
    backgroundColor: "#1b1f23",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    maxHeight: "55%"
  },
  viewerSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12
  },
  viewerSheetTitle: { color: "#fff", fontSize: 16, fontWeight: "900" },
  viewerSheetList: { gap: 10, paddingBottom: 8 },
  viewerSheetRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  viewerSheetAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: APP_LIME,
    alignItems: "center",
    justifyContent: "center"
  },
  viewerSheetAvatarText: { color: "#111", fontWeight: "900" },
  viewerSheetTextWrap: { flex: 1 },
  viewerSheetName: { color: "#fff", fontSize: 14, fontWeight: "800" },
  viewerSheetRole: { color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "700", marginTop: 2 }
});
