import type { RoomOptions } from "livekit-client";
import { VideoPresets } from "livekit-client";

const mobilePublishDefaults: NonNullable<RoomOptions["publishDefaults"]> = {
  simulcast: true,
  videoCodec: "h264",
  videoEncoding: {
    maxBitrate: 450_000,
    maxFramerate: 24
  },
  videoSimulcastLayers: [VideoPresets.h216, VideoPresets.h360],
  degradationPreference: "maintain-framerate"
};

/** Live streams — 720p capture cap, modest simulcast. */
export const LIVEKIT_LIVE_ROOM_OPTIONS: RoomOptions = {
  adaptiveStream: true,
  dynacast: true,
  stopLocalTrackOnUnpublish: true,
  videoCaptureDefaults: {
    resolution: VideoPresets.h720.resolution
  },
  publishDefaults: mobilePublishDefaults
};

/** 1:1 DM calls — lower capture + bitrate to reduce OOM on mid-range phones. */
export const LIVEKIT_CALL_ROOM_OPTIONS: RoomOptions = {
  adaptiveStream: true,
  dynacast: true,
  stopLocalTrackOnUnpublish: true,
  disconnectOnPageLeave: true,
  videoCaptureDefaults: {
    resolution: VideoPresets.h360.resolution,
    facingMode: "user"
  },
  publishDefaults: {
    ...mobilePublishDefaults,
    videoEncoding: {
      maxBitrate: 320_000,
      maxFramerate: 20
    },
    videoSimulcastLayers: [VideoPresets.h180]
  }
};
