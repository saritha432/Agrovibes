const {
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  EgressStatus,
  RoomServiceClient,
  S3Upload
} = require("livekit-server-sdk");

/** @type {Map<string, { egressId: string, filepath: string }>} */
const sessionsByRoom = new Map();

function stripEnv(value) {
  return String(value || "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

function liveKitHttpUrl(wssUrl) {
  return String(wssUrl || "").replace(/^wss:\/\//i, "https://");
}

function readEgressS3Config() {
  const accessKey = stripEnv(process.env.LIVEKIT_EGRESS_S3_ACCESS_KEY);
  const secret = stripEnv(process.env.LIVEKIT_EGRESS_S3_SECRET);
  const bucket =
    stripEnv(process.env.LIVEKIT_EGRESS_S3_BUCKET) || stripEnv(process.env.SUPABASE_STORAGE_BUCKET) || "media";
  const region = stripEnv(process.env.LIVEKIT_EGRESS_S3_REGION) || "us-east-1";
  let endpoint = stripEnv(process.env.LIVEKIT_EGRESS_S3_ENDPOINT);
  if (!endpoint) {
    const supabaseUrl = stripEnv(process.env.SUPABASE_URL);
    const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/i);
    if (match) {
      endpoint = `https://${match[1]}.storage.supabase.co/storage/v1/s3`;
    }
  }
  if (!accessKey || !secret || !endpoint) return null;
  return { accessKey, secret, bucket, region, endpoint, forcePathStyle: true };
}

function supabasePublicUrlForPath(filepath) {
  const base = stripEnv(process.env.SUPABASE_URL).replace(/\/+$/, "");
  if (!base) return null;
  const bucket = readEgressS3Config()?.bucket || "media";
  const clean = String(filepath || "").replace(/^\//, "");
  return `${base}/storage/v1/object/public/${bucket}/${clean}`;
}

function getEgressClient(cfg) {
  return new EgressClient(liveKitHttpUrl(cfg.livekitUrl), cfg.apiKey, cfg.apiSecret);
}

function getRoomServiceClient(cfg) {
  return new RoomServiceClient(liveKitHttpUrl(cfg.livekitUrl), cfg.apiKey, cfg.apiSecret);
}

function isEgressConfigured() {
  return readEgressS3Config() != null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function egressItems(list) {
  return Array.isArray(list) ? list : list?.items || [];
}

function isRetryableEgressStartError(error) {
  const msg = String(error?.message || error || "").toLowerCase();
  return (
    msg.includes("not found") ||
    msg.includes("does not exist") ||
    msg.includes("no participants") ||
    msg.includes("room does not") ||
    msg.includes("requested room")
  );
}

async function roomReadyForEgress(cfg, roomName) {
  try {
    const rooms = await getRoomServiceClient(cfg).listRooms([roomName]);
    const room = (Array.isArray(rooms) ? rooms : []).find((r) => (r.name || r.room) === roomName);
    if (!room) return false;
    const count = Number(room.numParticipants ?? room.num_participants ?? 0);
    return count > 0;
  } catch {
    return false;
  }
}

async function findActiveEgressSession(cfg, roomName) {
  const client = getEgressClient(cfg);
  let list;
  try {
    list = await client.listEgress({ roomName });
  } catch {
    return null;
  }
  const activeStatuses = new Set([
    EgressStatus.EGRESS_STARTING,
    EgressStatus.EGRESS_ACTIVE,
    EgressStatus.EGRESS_ENDING
  ]);
  for (const info of egressItems(list)) {
    const status = info.status;
    if (!activeStatuses.has(status)) continue;
    const egressId = info.egressId || info.egress_id;
    if (!egressId) continue;
    const file = info.fileResults?.[0] || info.file_results?.[0];
    const filepath =
      file?.filename ||
      file?.filepath ||
      `live/${roomName}-${egressId}.mp4`;
    return { egressId, filepath };
  }
  return null;
}

async function startLiveRoomRecording(cfg, roomName) {
  const s3cfg = readEgressS3Config();
  if (!s3cfg || !cfg?.ok) return null;
  if (sessionsByRoom.has(roomName)) {
    return sessionsByRoom.get(roomName).egressId;
  }

  const existing = await findActiveEgressSession(cfg, roomName);
  if (existing) {
    sessionsByRoom.set(roomName, existing);
    return existing.egressId;
  }

  const filepath = `live/${roomName}-${Date.now()}.mp4`;
  const output = new EncodedFileOutput({
    fileType: EncodedFileType.MP4,
    filepath,
    s3: new S3Upload({
      accessKey: s3cfg.accessKey,
      secret: s3cfg.secret,
      bucket: s3cfg.bucket,
      region: s3cfg.region,
      endpoint: s3cfg.endpoint,
      forcePathStyle: s3cfg.forcePathStyle
    })
  });

  const client = getEgressClient(cfg);
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    if (sessionsByRoom.has(roomName)) {
      return sessionsByRoom.get(roomName).egressId;
    }
    if (!(await roomReadyForEgress(cfg, roomName))) {
      await sleep(2500);
      continue;
    }
    try {
      const info = await client.startRoomCompositeEgress(roomName, output);
      const egressId = info?.egressId || info?.egress_id;
      if (!egressId) {
        await sleep(2500);
        continue;
      }
      sessionsByRoom.set(roomName, { egressId, filepath });
      console.info("[livekit-egress] started", roomName, egressId);
      return egressId;
    } catch (error) {
      if (!isRetryableEgressStartError(error)) {
        console.warn("[livekit-egress] start failed:", error?.message || error);
        return null;
      }
      await sleep(2500);
    }
  }
  console.warn("[livekit-egress] start gave up (room not ready):", roomName);
  return null;
}

async function stopLiveRoomRecordingAndGetVideoUrl(cfg, roomName) {
  if (!cfg?.ok) return null;
  let session = sessionsByRoom.get(roomName);
  if (!session) {
    session = await findActiveEgressSession(cfg, roomName);
    if (session) sessionsByRoom.set(roomName, session);
  }
  if (!session) return null;
  const client = getEgressClient(cfg);
  try {
    await client.stopEgress(session.egressId);
  } catch (error) {
    console.warn("[livekit-egress] stop:", error?.message || error);
  }

  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    let list;
    try {
      list = await client.listEgress({ egressId: session.egressId });
    } catch {
      break;
    }
    const items = egressItems(list);
    const info = items[0];
    if (!info) break;

    const status = info.status;
    if (status === EgressStatus.EGRESS_COMPLETE) {
      sessionsByRoom.delete(roomName);
      const file = info.fileResults?.[0] || info.file_results?.[0];
      const location = file?.location || file?.filename;
      if (location && /^https?:\/\//i.test(String(location))) {
        return String(location).trim();
      }
      return supabasePublicUrlForPath(session.filepath);
    }
    if (status === EgressStatus.EGRESS_FAILED || status === EgressStatus.EGRESS_ABORTED) {
      sessionsByRoom.delete(roomName);
      return null;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  sessionsByRoom.delete(roomName);
  return supabasePublicUrlForPath(session.filepath);
}

module.exports = {
  isEgressConfigured,
  readEgressS3Config,
  startLiveRoomRecording,
  stopLiveRoomRecordingAndGetVideoUrl
};
