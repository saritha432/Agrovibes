import { MediaStream } from "@livekit/react-native-webrtc";
import * as FileSystem from "expo-file-system";
import type { LocalTrack, Room } from "livekit-client";
import { Track } from "livekit-client";

export type LiveHostRecorder = {
  stop: () => Promise<string | null>;
};

type StartLiveHostRecorderInput = {
  tracks?: LocalTrack[];
  room?: Room;
};

function pickRecorderMimeType() {
  const MediaRecorderCtor = (globalThis as {
    MediaRecorder?: (typeof MediaRecorder) & { isTypeSupported?: (mimeType: string) => boolean };
  }).MediaRecorder;
  if (!MediaRecorderCtor) return "";
  const candidates = ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  const supportsType = MediaRecorderCtor.isTypeSupported;
  if (typeof supportsType !== "function") {
    // Some Android/Hermes builds expose MediaRecorder but not isTypeSupported — try webm anyway.
    return candidates[0] || "";
  }
  return candidates.find((type) => supportsType(type)) || "";
}

function buildStreamFromTracks(tracks: LocalTrack[]) {
  const stream = new MediaStream();
  for (const track of tracks) {
    const mediaTrack = track.mediaStreamTrack;
    if (mediaTrack) stream.addTrack(mediaTrack);
  }
  return stream.getTracks().length ? stream : null;
}

function buildStreamFromRoom(room: Room) {
  const stream = new MediaStream();
  const video = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track?.mediaStreamTrack;
  const audio = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track?.mediaStreamTrack;
  if (video) stream.addTrack(video);
  if (audio) stream.addTrack(audio);
  return stream.getTracks().length ? stream : null;
}

export function startLiveHostRecorder(input: StartLiveHostRecorderInput): LiveHostRecorder | null {
  const MediaRecorderCtor = (globalThis as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder;
  const mimeType = pickRecorderMimeType();
  if (!MediaRecorderCtor || !mimeType) return null;

  const stream = input.tracks?.length
    ? buildStreamFromTracks(input.tracks)
    : input.room
      ? buildStreamFromRoom(input.room)
      : null;
  if (!stream) return null;

  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorderCtor(stream as unknown as MediaStream, { mimeType });
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  recorder.start(1000);

  return {
    stop: () =>
      new Promise((resolve) => {
        if (recorder.state === "inactive") {
          resolve(null);
          return;
        }
        recorder.onstop = () => {
          void (async () => {
            if (!chunks.length) {
              resolve(null);
              return;
            }
            try {
              const blob = new Blob(chunks, { type: mimeType });
              const ext = mimeType.includes("mp4") ? ".mp4" : ".webm";
              const fileUri = `${FileSystem.cacheDirectory}live-${Date.now()}${ext}`;
              const reader = new FileReader();
              reader.onloadend = async () => {
                try {
                  const dataUrl = String(reader.result || "");
                  const base64 = dataUrl.split(",")[1];
                  if (!base64) {
                    resolve(null);
                    return;
                  }
                  await FileSystem.writeAsStringAsync(fileUri, base64, {
                    encoding: FileSystem.EncodingType.Base64
                  });
                  resolve(fileUri);
                } catch {
                  resolve(null);
                }
              };
              reader.readAsDataURL(blob);
            } catch {
              resolve(null);
            }
          })();
        };
        try {
          recorder.stop();
        } catch {
          resolve(null);
        }
      })
  };
}
