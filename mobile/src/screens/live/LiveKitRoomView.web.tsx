import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { createLocalTracks, Room, RoomEvent, Track } from "livekit-client";
import { useAuth } from "../../auth/AuthContext";
import { createLiveKitToken, formatLiveStreamError } from "../../services/api";
import { APP_LIME } from "../../theme/appColors";

type LiveComment = {
  id: string;
  name: string;
  text: string;
};

type LiveKitRoomViewProps = {
  visible: boolean;
  roomName: string;
  isHost: boolean;
  title: string;
  onClose?: () => void;
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

export function LiveKitRoomView({ visible, roomName, isHost, title, onClose }: LiveKitRoomViewProps) {
  const { token, user } = useAuth();
  const videoHostRef = React.useRef<HTMLDivElement | null>(null);
  const roomRef = React.useRef<Room | null>(null);
  const localTracksRef = React.useRef<any[]>([]);
  const [status, setStatus] = React.useState("Connecting live...");
  const [errorText, setErrorText] = React.useState("");
  const [viewerNames, setViewerNames] = React.useState<string[]>([]);
  const [comments, setComments] = React.useState<LiveComment[]>([]);
  const [commentDraft, setCommentDraft] = React.useState("");

  const refreshViewers = React.useCallback((room: Room) => {
    const names = [room.localParticipant.name || user?.fullName || "You"];
    room.remoteParticipants.forEach((p) => names.push(p.name || p.identity));
    setViewerNames([...new Set(names)]);
  }, [user?.fullName]);

  React.useEffect(() => {
    if (!visible || !roomName) return;
    let cancelled = false;
    const room = new Room();
    roomRef.current = room;

    const onData = (payload: Uint8Array, participant?: any) => {
      try {
        const parsed = JSON.parse(new TextDecoder().decode(payload));
        if (parsed?.type !== "comment" || !parsed.text) return;
        setComments((prev) => [
          ...prev.slice(-60),
          {
            id: `${Date.now()}-${Math.random()}`,
            name: parsed.name || participant?.name || "Viewer",
            text: String(parsed.text).slice(0, 240)
          }
        ]);
      } catch {
        // Ignore malformed data packets.
      }
    };

    room
      .on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Video) {
          attachTrack(track, videoHostRef.current);
        }
      })
      .on(RoomEvent.ParticipantConnected, () => refreshViewers(room))
      .on(RoomEvent.ParticipantDisconnected, () => refreshViewers(room))
      .on(RoomEvent.DataReceived, onData)
      .on(RoomEvent.Disconnected, (reason) => {
        if (cancelled) return;
        if (reason) setErrorText(formatLiveStreamError(new Error(String(reason))));
      });

    (async () => {
      if (!token) {
        setErrorText("Please log in to join live.");
        return;
      }
      try {
        const lk = await createLiveKitToken(token, { roomName, canPublish: isHost });
        if (cancelled) return;
        await room.connect(lk.url, lk.token);
        if (cancelled) return;
        refreshViewers(room);
        if (isHost) {
          const tracks = await createLocalTracks({ audio: true, video: true });
          localTracksRef.current = tracks;
          for (const track of tracks) {
            await room.localParticipant.publishTrack(track);
            if (track.kind === Track.Kind.Video) {
              attachTrack(track, videoHostRef.current);
            }
          }
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
      room.disconnect();
      roomRef.current = null;
      if (videoHostRef.current) videoHostRef.current.innerHTML = "";
    };
  }, [isHost, refreshViewers, roomName, token, visible]);

  const sendComment = React.useCallback(() => {
    const text = commentDraft.trim();
    if (!text || !roomRef.current) return;
    const payload = new TextEncoder().encode(
      JSON.stringify({ type: "comment", name: user?.fullName || "Viewer", text })
    );
    roomRef.current.localParticipant.publishData(payload, { reliable: true });
    setComments((prev) => [...prev.slice(-60), { id: `${Date.now()}-me`, name: user?.fullName || "You", text }]);
    setCommentDraft("");
  }, [commentDraft, user?.fullName]);

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
      <View style={styles.topBar}>
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
        <Text style={styles.statusText}>{errorText || status}</Text>
        {onClose ? (
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.viewerPill}>
        <Ionicons name="eye-outline" size={14} color="#fff" />
        <Text style={styles.viewerText}>{viewerNames.length} watching</Text>
      </View>
      <View style={styles.bottomPanel}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.names} numberOfLines={1}>
          Joined: {viewerNames.length ? viewerNames.join(", ") : "Waiting..."}
        </Text>
        <ScrollView style={styles.comments} contentContainerStyle={styles.commentsInner}>
          {comments.map((c) => (
            <Text key={c.id} style={styles.commentText}>
              <Text style={styles.commentName}>{c.name}: </Text>
              {c.text}
            </Text>
          ))}
        </ScrollView>
        <View style={styles.commentRow}>
          <TextInput
            value={commentDraft}
            onChangeText={setCommentDraft}
            placeholder="Comment on live..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            style={styles.commentInput}
            onSubmitEditing={sendComment}
          />
          <Pressable style={styles.sendBtn} onPress={sendComment}>
            <Text style={styles.sendText}>Send</Text>
          </Pressable>
        </View>
        {isHost && onClose ? (
          <Pressable style={styles.endLiveBtn} onPress={onClose}>
            <Text style={styles.endLiveText}>End Live</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
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
  livePill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#FF3040", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 5 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" },
  liveText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  statusText: { flex: 1, color: "#fff", fontSize: 12, fontWeight: "800" },
  closeBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.45)" },
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
  bottomPanel: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 4, padding: 14, backgroundColor: "rgba(0,0,0,0.48)" },
  title: { color: "#fff", fontSize: 15, fontWeight: "900" },
  names: { marginTop: 4, color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: "700" },
  comments: { maxHeight: 120, marginTop: 8 },
  commentsInner: { gap: 4 },
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
  endLiveText: { color: "#fff", fontSize: 14, fontWeight: "900" }
});
