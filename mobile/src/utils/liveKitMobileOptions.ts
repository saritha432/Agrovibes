import type { RoomOptions } from "livekit-client";
import { VideoPresets } from "livekit-client";

/**
 * Live streams — match working DirectCall capture (h360) + VP8 only.
 * H.264 backup/preferred codecs paint black on Android RN viewers while audio still works
 * (confirmed in logs: mime "video/H264").
 *
 * singlePeerConnection MUST be false on React Native.
 */
export const LIVEKIT_LIVE_ROOM_OPTIONS: RoomOptions = {
  adaptiveStream: false,
  dynacast: false,
  singlePeerConnection: false,
  stopLocalTrackOnUnpublish: true,
  videoCaptureDefaults: {
    resolution: VideoPresets.h360.resolution
  },
  publishDefaults: {
    simulcast: false,
    videoCodec: "vp8",
    backupCodec: false,
    videoEncoding: {
      maxBitrate: 450_000,
      maxFramerate: 24
    },
    degradationPreference: "maintain-framerate"
  }
};

/** 1:1 DM calls — lower capture + bitrate to reduce OOM on mid-range phones. */
export const LIVEKIT_CALL_ROOM_OPTIONS: RoomOptions = {
  adaptiveStream: true,
  dynacast: true,
  singlePeerConnection: false,
  stopLocalTrackOnUnpublish: true,
  disconnectOnPageLeave: true,
  videoCaptureDefaults: {
    resolution: VideoPresets.h360.resolution,
    facingMode: "user"
  },
  publishDefaults: {
    simulcast: true,
    videoCodec: "vp8",
    backupCodec: false,
    videoEncoding: {
      maxBitrate: 320_000,
      maxFramerate: 20
    },
    videoSimulcastLayers: [VideoPresets.h180],
    degradationPreference: "maintain-framerate"
  }
};
