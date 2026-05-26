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
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
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
  const mimeType = pickRecorderMimeType();
  if (!mimeType) return null;

  const stream = input.tracks?.length
    ? buildStreamFromTracks(input.tracks)
    : input.room
      ? buildStreamFromRoom(input.room)
      : null;
  if (!stream) return null;

  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(stream, { mimeType });
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
          if (!chunks.length) {
            resolve(null);
            return;
          }
          const blob = new Blob(chunks, { type: mimeType });
          resolve(URL.createObjectURL(blob));
        };
        try {
          recorder.stop();
        } catch {
          resolve(null);
        }
      })
  };
}
