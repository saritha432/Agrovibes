import { Ionicons } from "@expo/vector-icons";
import {
  AudioSession,
  LiveKitRoom,
  VideoTrack,
  isTrackReference,
  useParticipants,
  useRoomContext,
  useTracks
} from "@livekit/react-native";
import { RoomEvent, Track } from "livekit-client";
import React from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "../../auth/AuthContext";
import { createLiveKitToken, endHomeLivePost, formatLiveStreamError } from "../../services/api";
import { APP_LIME } from "../../theme/appColors";
import {
  encodeLiveDataMessage,
  liveViewerCount,
  parseLiveDataMessage,
  type LiveComment,
  type LiveViewer
} from "./liveRoomData";

type LiveKitRoomViewProps = {
  visible: boolean;
  roomName: string;
  isHost: boolean;
  title: string;
  postId?: number;
  onClose?: () => void;
  onLiveEnded?: (postId: number) => void;
};

function LiveRoomContent({
  isHost,
  title,
  postId,
  onClose,
  onLiveEnded,
  errorText,
  status
}: {
  isHost: boolean;
  title: string;
  postId?: number;
  onClose?: () => void;
  onLiveEnded?: (postId: number) => void;
  errorText: string;
  status: string;
}) {
  const { token, user } = useAuth();
  const room = useRoomContext();
  const participants = useParticipants();
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: !isHost });
  const commentsRef = React.useRef<ScrollView | null>(null);
  const [comments, setComments] = React.useState<LiveComment[]>([]);
  const [commentDraft, setCommentDraft] = React.useState("");
  const [liveEnded, setLiveEnded] = React.useState(false);
  const [showViewerList, setShowViewerList] = React.useState(false);
  const localName = user?.fullName || "You";

  const viewers = React.useMemo<LiveViewer[]>(() => {
    if (isHost) {
      const rows: LiveViewer[] = [{ id: room.localParticipant.identity, name: localName, role: "Host" }];
      participants
        .filter((p) => p.identity !== room.localParticipant.identity)
        .forEach((p) => rows.push({ id: p.identity, name: p.name || p.identity, role: "Viewer" }));
      return rows;
    }
    const rows: LiveViewer[] = participants
      .filter((p) => p.identity !== room.localParticipant.identity)
      .map((p) => ({ id: p.identity, name: p.name || p.identity, role: "Host" as const }));
    rows.push({ id: room.localParticipant.identity, name: localName, role: "Viewer" });
    return rows;
  }, [isHost, localName, participants, room.localParticipant.identity]);

  const handleLiveEnded = React.useCallback(() => {
    if (liveEnded) return;
    setLiveEnded(true);
    try {
      room.disconnect();
    } catch {
      // no-op
    }
    setTimeout(() => onClose?.(), 1200);
  }, [liveEnded, onClose, room]);

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
    const onTrackUnsubscribed = (track: { kind: Track.Kind }) => {
      if (!isHost && track.kind === Track.Kind.Video) handleLiveEnded();
    };
    const onParticipantDisconnected = () => {
      if (!isHost && participants.filter((p) => p.identity !== room.localParticipant.identity).length === 0) {
        handleLiveEnded();
      }
    };
    room.on(RoomEvent.DataReceived, onData);
    room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
    room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
      room.off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
      room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
    };
  }, [handleLiveEnded, isHost, participants, room]);

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
    if (isHost && postId && token) {
      try {
        await endHomeLivePost(token, postId);
      } catch {
        // Still end the session locally even if the server call fails.
      }
      onLiveEnded?.(postId);
    }
    if (isHost) {
      try {
        await room.localParticipant.publishData(encodeLiveDataMessage({ type: "live_ended" }), {
          reliable: true,
          topic: "live-chat"
        });
      } catch {
        // no-op
      }
      try {
        room.disconnect();
      } catch {
        // no-op
      }
    }
    onClose?.();
  }, [isHost, onClose, onLiveEnded, postId, room, token]);

  const cameraTrack = tracks.find((track) => isTrackReference(track));
  const watchingCount = liveViewerCount(viewers, isHost);

  return (
    <View style={styles.root}>
      {cameraTrack && isTrackReference(cameraTrack) ? (
        <VideoTrack trackRef={cameraTrack} style={styles.videoHost} />
      ) : (
        <View style={[styles.videoHost, styles.videoPlaceholder]}>
          <ActivityIndicator color={APP_LIME} />
          <Text style={styles.videoPlaceholderText}>{isHost ? "Starting camera..." : "Waiting for host..."}</Text>
        </View>
      )}
      {liveEnded ? (
        <View style={styles.endedOverlay}>
          <Text style={styles.endedTitle}>Live ended</Text>
          <Text style={styles.endedSub}>Thanks for watching</Text>
        </View>
      ) : null}
      <View style={styles.topBar}>
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>{liveEnded ? "ENDED" : "LIVE"}</Text>
        </View>
        <Text style={styles.statusText}>{errorText || status}</Text>
        {onClose ? (
          <Pressable style={styles.closeBtn} onPress={() => (isHost ? void handleEndLive() : onClose())}>
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
        ) : null}
      </View>
      <Pressable style={styles.viewerPill} onPress={() => setShowViewerList(true)}>
        <Ionicons name="eye-outline" size={14} color="#fff" />
        <Text style={styles.viewerText}>{watchingCount} watching</Text>
      </Pressable>
      <View style={styles.bottomPanel}>
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
        {isHost && !liveEnded ? (
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

export function LiveKitRoomView({ visible, roomName, isHost, title, postId, onClose, onLiveEnded }: LiveKitRoomViewProps) {
  const { token } = useAuth();
  const [connection, setConnection] = React.useState<{ url: string; token: string } | null>(null);
  const [status, setStatus] = React.useState("Connecting live...");
  const [errorText, setErrorText] = React.useState("");

  React.useEffect(() => {
    if (!visible) return;
    AudioSession.startAudioSession().catch(() => undefined);
    return () => {
      AudioSession.stopAudioSession().catch(() => undefined);
      setConnection(null);
    };
  }, [visible]);

  React.useEffect(() => {
    if (!visible || !roomName) return;
    let cancelled = false;
    setConnection(null);
    setErrorText("");
    setStatus("Connecting live...");

    (async () => {
      if (!token) {
        setErrorText("Please log in to join live.");
        return;
      }
      try {
        const lk = await createLiveKitToken(token, { roomName, canPublish: isHost });
        if (cancelled) return;
        setConnection({ url: lk.url, token: lk.token });
        setStatus(isHost ? "You are live now" : "Joined live");
      } catch (error) {
        if (cancelled) return;
        setErrorText(formatLiveStreamError(error));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isHost, roomName, token, visible]);

  if (!visible) return null;

  if (errorText && !connection) {
    return (
      <View style={styles.root}>
        <View style={[styles.videoHost, styles.videoPlaceholder]}>
          <Ionicons name="alert-circle-outline" size={42} color="#ff6b6b" />
          <Text style={styles.videoPlaceholderText}>{errorText}</Text>
          {onClose ? (
            <Pressable style={styles.retryCloseBtn} onPress={onClose}>
              <Text style={styles.sendText}>Close</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  if (!connection) {
    return (
      <View style={styles.root}>
        <View style={[styles.videoHost, styles.videoPlaceholder]}>
          <ActivityIndicator color={APP_LIME} size="large" />
          <Text style={styles.videoPlaceholderText}>{status}</Text>
        </View>
      </View>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={connection.url}
      token={connection.token}
      connect
      audio
      video={isHost}
      options={{ adaptiveStream: { pixelDensity: "screen" } }}
      onDisconnected={onClose}
      onError={(error) => setErrorText(error.message)}
    >
      <LiveRoomContent
        isHost={isHost}
        title={title}
        postId={postId}
        onClose={onClose}
        onLiveEnded={onLiveEnded}
        errorText={errorText}
        status={status}
      />
    </LiveKitRoom>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  videoHost: { ...StyleSheet.absoluteFillObject, backgroundColor: "#000" },
  videoPlaceholder: { alignItems: "center", justifyContent: "center", padding: 24 },
  videoPlaceholderText: { marginTop: 12, color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: "700", textAlign: "center" },
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
    top: 42,
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
  viewerPill: {
    position: "absolute",
    top: 84,
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
