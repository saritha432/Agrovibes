import type { RoomOptions } from "livekit-client";
import { VideoPresets } from "livekit-client";

/**
 * Live streams — VP8 (H.264 often blacks out remote video on Android RN WebRTC),
 * single layer (no simulcast) for reliable viewer decode.
 */
export const LIVEKIT_LIVE_ROOM_OPTIONS: RoomOptions = {
  adaptiveStream: false,
  dynacast: false,
  stopLocalTrackOnUnpublish: true,
  videoCaptureDefaults: {
    resolution: VideoPresets.h720.resolution
  },
  publishDefaults: {
    simulcast: false,
    videoCodec: "vp8",
    videoEncoding: {
      maxBitrate: 600_000,
      maxFramerate: 24
    },
    degradationPreference: "maintain-framerate"
  }
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
    simulcast: true,
    videoCodec: "vp8",
    videoEncoding: {
      maxBitrate: 320_000,
      maxFramerate: 20
    },
    videoSimulcastLayers: [VideoPresets.h180],
    degradationPreference: "maintain-framerate"
  }
};
