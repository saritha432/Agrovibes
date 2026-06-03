import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { createLocalTracks, Room, RoomEvent, Track } from "livekit-client";
import { useAuth } from "../../auth/AuthContext";
import { createLiveKitToken, endHomeLivePost, formatLiveStreamError, type HomePost } from "../../services/api";
import { APP_LIME } from "../../theme/appColors";
import { startLiveHostRecorder, type LiveHostRecorder } from "./liveHostRecording";
import {
  encodeLiveDataMessage,
  liveViewerCount,
  parseLiveDataMessage,
  type LiveComment,
  type LiveViewer
} from "./liveRoomData";
import { saveLiveRecordingToPost } from "./saveLiveRecordingToPost";

type LiveKitRoomViewProps = {
  visible: boolean;
  roomName: string;
  isHost: boolean;
  title: string;
  postId?: number;
  onClose?: () => void;
  onLiveEnded?: (postId: number, update?: Partial<HomePost>) => void;
};

function attachTrack(track: any, host: HTMLDivElement | null) {
  if (!host || !track?.attach) return;
  const element = track.attach();
  element.style.width = "100%";
  element.style.height = "100%";
  element.style.objectFit = "cover";
  element.autoplay = true;
  element.playsInline = true;
  host.innerHTML = "";
  host.appendChild(element);
}

function collectViewers(room: Room, isHost: boolean, localName: string): LiveViewer[] {
  const rows: LiveViewer[] = [];
  if (isHost) {
    rows.push({ id: room.localParticipant.identity, name: localName || "You", role: "Host" });
    room.remoteParticipants.forEach((p) => {
      rows.push({ id: p.identity, name: p.name || p.identity, role: "Viewer" });
    });
    return rows;
  }
  room.remoteParticipants.forEach((p) => {
    rows.push({ id: p.identity, name: p.name || p.identity, role: "Host" });
  });
  rows.push({ id: room.localParticipant.identity, name: localName || "You", role: "Viewer" });
  return rows;
}

export function LiveKitRoomView({ visible, roomName, isHost, title, postId, onClose, onLiveEnded }: LiveKitRoomViewProps) {
  const { token, user } = useAuth();
  const videoHostRef = React.useRef<HTMLDivElement | null>(null);
  const roomRef = React.useRef<Room | null>(null);
  const localTracksRef = React.useRef<any[]>([]);
  const recorderRef = React.useRef<LiveHostRecorder | null>(null);
  const commentsRef = React.useRef<ScrollView | null>(null);
  const [savingRecording, setSavingRecording] = React.useState(false);
  const [status, setStatus] = React.useState("Connecting live...");
  const [errorText, setErrorText] = React.useState("");
  const [liveEnded, setLiveEnded] = React.useState(false);
  const [viewers, setViewers] = React.useState<LiveViewer[]>([]);
  const [showViewerList, setShowViewerList] = React.useState(false);
  const [comments, setComments] = React.useState<LiveComment[]>([]);
  const [commentDraft, setCommentDraft] = React.useState("");

  const localName = user?.fullName || "You";

  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;
  const isHostRef = React.useRef(isHost);
  isHostRef.current = isHost;
  const localNameRef = React.useRef(localName);
  localNameRef.current = localName;
  const liveEndedRef = React.useRef(false);

  const refreshViewers = React.useCallback(
    (room: Room) => {
      setViewers(collectViewers(room, isHostRef.current, localNameRef.current));
    },
    []
  );

  const handleLiveEnded = React.useCallback(() => {
    if (liveEndedRef.current) return;
    liveEndedRef.current = true;
    setLiveEnded(true);
    setStatus("Live ended");
    const room = roomRef.current;
    if (room) {
      try {
        room.disconnect();
      } catch {
        // no-op
      }
    }
    window.setTimeout(() => onCloseRef.current?.(), 1200);
  }, []);

  React.useEffect(() => {
    if (!visible || !roomName) return;
    let cancelled = false;
    liveEndedRef.current = false;
    const room = new Room();
    roomRef.current = room;

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

    room
      .on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Video) {
          attachTrack(track, videoHostRef.current);
        }
      })
      .on(RoomEvent.TrackUnsubscribed, (track) => {
        if (!isHostRef.current && track.kind === Track.Kind.Video) {
          handleLiveEnded();
        }
      })
      .on(RoomEvent.ParticipantConnected, () => refreshViewers(room))
      .on(RoomEvent.ParticipantDisconnected, () => {
        refreshViewers(room);
        if (!isHostRef.current && room.remoteParticipants.size === 0) {
          handleLiveEnded();
        }
      })
      .on(RoomEvent.DataReceived, onData)
      .on(RoomEvent.Disconnected, () => {
        if (cancelled || liveEndedRef.current) return;
        if (!isHostRef.current) handleLiveEnded();
      });

    (async () => {
      if (!token) {
        setErrorText("Please log in to join live.");
        return;
      }
      try {
        const lk = await createLiveKitToken(token, { roomName, canPublish: isHostRef.current });
        if (cancelled) return;
        await room.connect(lk.url, lk.token);
        if (cancelled) return;
        refreshViewers(room);
        if (isHostRef.current) {
          const tracks = await createLocalTracks({ audio: true, video: true });
          localTracksRef.current = tracks;
          for (const track of tracks) {
            await room.localParticipant.publishTrack(track);
            if (track.kind === Track.Kind.Video) {
              attachTrack(track, videoHostRef.current);
            }
          }
          recorderRef.current = startLiveHostRecorder({ tracks });
          setStatus("You are live now");
        } else {
          room.remoteParticipants.forEach((participant) => {
            participant.trackPublications.forEach((publication: any) => {
              const track = publication.track;
              if (track?.kind === Track.Kind.Video) {
                attachTrack(track, videoHostRef.current);
              }
            });
          });
          setStatus("Joined live");
        }
      } catch (error) {
        setErrorText(formatLiveStreamError(error));
      }
    })();

    return () => {
      cancelled = true;
      localTracksRef.current.forEach((track) => {
        try {
          track.stop?.();
        } catch {
          // no-op
        }
      });
      localTracksRef.current = [];
      recorderRef.current = null;
      room.disconnect();
      roomRef.current = null;
      if (videoHostRef.current) videoHostRef.current.innerHTML = "";
    };
  }, [roomName, token, visible]);

  React.useEffect(() => {
    commentsRef.current?.scrollToEnd?.({ animated: true });
  }, [comments.length]);

  const sendComment = React.useCallback(async () => {
    const text = commentDraft.trim();
    const room = roomRef.current;
    if (!text || !room || liveEnded) return;
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
  }, [commentDraft, liveEnded, localName]);

  const onLiveEndedRef = React.useRef(onLiveEnded);
  onLiveEndedRef.current = onLiveEnded;

  const handleEndLive = React.useCallback(async () => {
    const room = roomRef.current;
    if (isHostRef.current && postId && token) {
      setSavingRecording(true);
      setStatus("Saving recording...");
      let savedPost: HomePost | null = null;
      try {
        const recordingUri = await recorderRef.current?.stop();
        recorderRef.current = null;
        if (recordingUri) {
          savedPost = await saveLiveRecordingToPost(token, postId, recordingUri);
          if (recordingUri.startsWith("blob:")) URL.revokeObjectURL(recordingUri);
        }
      } catch {
        // Continue ending the live even if upload fails.
      }
      try {
        await endHomeLivePost(token, postId);
      } catch {
        // Still end the session locally even if the server call fails.
      }
      onLiveEndedRef.current?.(postId, savedPost ?? { id: postId, liveStatus: "ended", liveViewerCount: 0 });
      setSavingRecording(false);
    }
    if (isHostRef.current && room) {
      try {
        await room.localParticipant.publishData(encodeLiveDataMessage({ type: "live_ended" }), {
          reliable: true,
          topic: "live-chat"
        });
      } catch {
        // Still disconnect even if broadcast fails.
      }
      localTracksRef.current.forEach((track) => {
        try {
          track.stop?.();
        } catch {
          // no-op
        }
      });
      localTracksRef.current = [];
      recorderRef.current = null;
      try {
        await room.localParticipant.setCameraEnabled(false);
        await room.localParticipant.setMicrophoneEnabled(false);
      } catch {
        // no-op
      }
      if (videoHostRef.current) videoHostRef.current.innerHTML = "";
      try {
        room.disconnect();
      } catch {
        // no-op
      }
    }
    onCloseRef.current?.();
  }, [postId, token]);

  const watchingCount = liveViewerCount(viewers, isHost);

  if (!visible) return null;

  return (
    <View style={styles.root}>
      <div
        ref={videoHostRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: "100%",
          height: "100%",
          backgroundColor: "#000"
        }}
      />
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
        <Text style={styles.statusText}>{errorText || (savingRecording ? "Saving recording..." : status)}</Text>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
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
    fontWeight: "700",
    outlineStyle: "none" as any
  },
  sendBtn: { backgroundColor: APP_LIME, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  sendText: { color: "#111", fontSize: 12, fontWeight: "900" },
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
