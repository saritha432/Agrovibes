const {
  MediaConvertClient,
  CreateJobCommand,
  GetJobCommand
} = require("@aws-sdk/client-mediaconvert");
const {
  readS3StorageConfig,
  buildS3PublicUrl,
  extractS3ObjectKeyFromUrl
} = require("./s3Storage");

function stripEnv(value) {
  return String(value || "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

function readMediaConvertConfig() {
  const s3 = readS3StorageConfig();
  const roleArn = stripEnv(process.env.AWS_MEDIA_CONVERT_ROLE_ARN);
  const endpoint = stripEnv(process.env.AWS_MEDIA_CONVERT_ENDPOINT);
  if (!s3 || !roleArn || !endpoint) return null;
  return {
    s3,
    roleArn,
    endpoint,
    queueArn: stripEnv(process.env.AWS_MEDIA_CONVERT_QUEUE_ARN) || undefined
  };
}

function isHlsTranscodeConfigured() {
  return readMediaConvertConfig() != null;
}

function getMediaConvertClient() {
  const cfg = readMediaConvertConfig();
  if (!cfg) return null;
  return new MediaConvertClient({
    region: cfg.s3.region,
    endpoint: cfg.endpoint,
    credentials: {
      accessKeyId: cfg.s3.accessKeyId,
      secretAccessKey: cfg.s3.secretAccessKey
    }
  });
}

function safeMediaStem(sourceKey) {
  const key = String(sourceKey || "").replace(/^\/+/, "");
  const base = key.replace(/^agrovibes\/videos\//i, "").replace(/\.[^.]+$/, "");
  return base.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 180) || `clip-${Date.now()}`;
}

/** Stable HLS folder for a source object: agrovibes/videos/foo.mp4 → agrovibes/hls/foo */
function hlsOutputPrefixForSourceKey(sourceKey) {
  return `agrovibes/hls/${safeMediaStem(sourceKey)}`;
}

function playbackOutputKeyForSourceKey(sourceKey) {
  return `agrovibes/playback/${safeMediaStem(sourceKey)}`;
}

function hlsMasterUrlForSourceKey(sourceKey) {
  return buildS3PublicUrl(`${hlsOutputPrefixForSourceKey(sourceKey)}/master.m3u8`);
}

function playbackMp4UrlForSourceKey(sourceKey) {
  return buildS3PublicUrl(`${playbackOutputKeyForSourceKey(sourceKey)}.mp4`);
}

function abrLadderOutputs() {
  const rungs = [
    { name: "_240p", height: 240, maxBitrate: 400_000, buf: 800_000 },
    { name: "_480p", height: 480, maxBitrate: 1_200_000, buf: 2_400_000 },
    { name: "_720p", height: 720, maxBitrate: 2_500_000, buf: 5_000_000 },
    { name: "_1080p", height: 1080, maxBitrate: 5_000_000, buf: 10_000_000 }
  ];
  return rungs.map((rung) => ({
    NameModifier: rung.name,
    ContainerSettings: {
      Container: "M3U8",
      M3u8Settings: {
        AudioFramesPerPes: 4,
        PcrControl: "PCR_EVERY_PES_PACKET",
        PmtPid: 480,
        PrivateMetadataPid: 503,
        ProgramNumber: 1,
        PatInterval: 0,
        PmtInterval: 0,
        VideoPid: 481,
        AudioPids: [482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492]
      }
    },
    VideoDescription: {
      Height: rung.height,
      ScalingBehavior: "DEFAULT",
      TimecodeInsertion: "DISABLED",
      AntiAlias: "ENABLED",
      Sharpness: 50,
      CodecSettings: {
        Codec: "H_264",
        H264Settings: {
          InterlaceMode: "PROGRESSIVE",
          NumberReferenceFrames: 3,
          Syntax: "DEFAULT",
          Softness: 0,
          GopClosedCadence: 1,
          GopSize: 48,
          Slices: 1,
          GopBReference: "DISABLED",
          SlowPal: "DISABLED",
          SpatialAdaptiveQuantization: "ENABLED",
          TemporalAdaptiveQuantization: "ENABLED",
          FlickerAdaptiveQuantization: "DISABLED",
          EntropyEncoding: "CABAC",
          Bitrate: rung.maxBitrate,
          FramerateControl: "INITIALIZE_FROM_SOURCE",
          RateControlMode: "CBR",
          CodecProfile: "MAIN",
          Telecine: "NONE",
          MinIInterval: 0,
          AdaptiveQuantization: "HIGH",
          CodecLevel: "AUTO",
          FieldEncoding: "PAFF",
          SceneChangeDetect: "ENABLED",
          QualityTuningLevel: "SINGLE_PASS",
          FramerateConversionAlgorithm: "DUPLICATE_DROP",
          UnregisteredSeiTimecode: "DISABLED",
          GopSizeUnits: "FRAMES",
          ParControl: "INITIALIZE_FROM_SOURCE",
          NumberBFramesBetweenReferenceFrames: 1,
          RepeatPps: "DISABLED"
        }
      }
    },
    AudioDescriptions: [
      {
        AudioTypeControl: "FOLLOW_INPUT",
        AudioSourceName: "Audio Selector 1",
        CodecSettings: {
          Codec: "AAC",
          AacSettings: {
            AudioDescriptionBroadcasterMix: "FOLLOW_INPUT",
            Bitrate: 96_000,
            RateControlMode: "CBR",
            CodecProfile: "LC",
            CodingMode: "CODING_MODE_2_0",
            RawFormat: "NONE",
            SampleRate: 48_000,
            Specification: "MPEG4"
          }
        },
        LanguageCodeControl: "FOLLOW_INPUT"
      }
    ],
    OutputSettings: {
      HlsSettings: {
        AudioGroupId: "program_audio",
        AudioOnlyContainer: "AUTOMATIC",
        IFrameOnlyManifest: "EXCLUDE"
      }
    }
  }));
}

/** Small progressive MP4 so the player can show frame 1 after ~200–400KB. */
function playbackMp4Output() {
  return {
    ContainerSettings: {
      Container: "MP4",
      Mp4Settings: {
        CslgAtom: "INCLUDE",
        FreeSpaceBox: "EXCLUDE",
        MoovPlacement: "PROGRESSIVE_DOWNLOAD"
      }
    },
    VideoDescription: {
      Height: 480,
      ScalingBehavior: "DEFAULT",
      TimecodeInsertion: "DISABLED",
      AntiAlias: "ENABLED",
      Sharpness: 50,
      CodecSettings: {
        Codec: "H_264",
        H264Settings: {
          InterlaceMode: "PROGRESSIVE",
          NumberReferenceFrames: 3,
          Syntax: "DEFAULT",
          GopClosedCadence: 1,
          GopSize: 24,
          EntropyEncoding: "CABAC",
          Bitrate: 1_000_000,
          FramerateControl: "INITIALIZE_FROM_SOURCE",
          RateControlMode: "CBR",
          CodecProfile: "MAIN",
          Telecine: "NONE",
          CodecLevel: "AUTO",
          QualityTuningLevel: "SINGLE_PASS",
          GopSizeUnits: "FRAMES",
          ParControl: "INITIALIZE_FROM_SOURCE",
          NumberBFramesBetweenReferenceFrames: 1
        }
      }
    },
    AudioDescriptions: [
      {
        AudioTypeControl: "FOLLOW_INPUT",
        AudioSourceName: "Audio Selector 1",
        CodecSettings: {
          Codec: "AAC",
          AacSettings: {
            Bitrate: 96_000,
            RateControlMode: "CBR",
            CodecProfile: "LC",
            CodingMode: "CODING_MODE_2_0",
            SampleRate: 48_000,
            Specification: "MPEG4"
          }
        }
      }
    ]
  };
}

/**
 * Start MediaConvert HLS job for an uploaded MP4. No-ops when MediaConvert is not configured.
 * Returns { jobId, hlsUrl, playbackUrl, sourceKey } or null.
 */
async function enqueueHlsTranscodeJob({ sourceKey, videoUrl }) {
  const cfg = readMediaConvertConfig();
  const client = getMediaConvertClient();
  if (!cfg || !client) return null;

  let key = String(sourceKey || "").replace(/^\/+/, "");
  if (!key && videoUrl) {
    key = extractS3ObjectKeyFromUrl(videoUrl) || "";
  }
  if (!key || !/\.(mp4|mov|m4v|webm)$/i.test(key)) return null;

  const outputPrefix = hlsOutputPrefixForSourceKey(key);
  const hlsUrl = buildS3PublicUrl(`${outputPrefix}/master.m3u8`);
  const playbackUrl = playbackMp4UrlForSourceKey(key);
  const playbackDest = `s3://${cfg.s3.bucket}/${playbackOutputKeyForSourceKey(key)}`;
  const destination = `s3://${cfg.s3.bucket}/${outputPrefix}/`;
  const fileInput = `s3://${cfg.s3.bucket}/${key}`;

  const params = {
    Role: cfg.roleArn,
    UserMetadata: {
      sourceKey: key,
      videoUrl: String(videoUrl || ""),
      hlsUrl,
      playbackUrl
    },
    Settings: {
      TimecodeConfig: { Source: "ZEROBASED" },
      Inputs: [
        {
          FileInput: fileInput,
          AudioSelectors: {
            "Audio Selector 1": {
              DefaultSelection: "DEFAULT"
            }
          },
          VideoSelector: {},
          TimecodeSource: "ZEROBASED"
        }
      ],
      OutputGroups: [
        {
          Name: "Apple HLS",
          OutputGroupSettings: {
            Type: "HLS_GROUP_SETTINGS",
            HlsGroupSettings: {
              Destination: destination,
              SegmentLength: 2,
              MinSegmentLength: 1,
              DirectoryStructure: "SINGLE_DIRECTORY",
              ManifestDurationFormat: "INTEGER",
              OutputSelection: "MANIFESTS_AND_SEGMENTS",
              StreamInfResolution: "INCLUDE",
              ClientCache: "ENABLED",
              CaptionLanguageSetting: "OMIT",
              ManifestCompression: "NONE",
              CodecSpecification: "RFC_4281",
              ManifestName: "master"
            }
          },
          Outputs: abrLadderOutputs()
        },
        {
          Name: "Fast-start MP4",
          OutputGroupSettings: {
            Type: "FILE_GROUP_SETTINGS",
            FileGroupSettings: {
              Destination: playbackDest
            }
          },
          Outputs: [playbackMp4Output()]
        }
      ]
    },
    StatusUpdateInterval: "SECONDS_60"
  };
  if (cfg.queueArn) params.Queue = cfg.queueArn;

  const result = await client.send(new CreateJobCommand(params));
  const jobId = result?.Job?.Id;
  if (!jobId) {
    throw new Error("MediaConvert CreateJob returned no job id");
  }
  return { jobId, hlsUrl, playbackUrl, sourceKey: key, status: result?.Job?.Status || "SUBMITTED" };
}

async function getHlsJobStatus(jobId) {
  const client = getMediaConvertClient();
  if (!client || !jobId) return null;
  const result = await client.send(new GetJobCommand({ Id: jobId }));
  return result?.Job || null;
}

/**
 * Persist job row, enqueue MediaConvert, and return public hls URL (ready after COMPLETE).
 * Safe to call without MediaConvert — returns null.
 */
async function startHlsJobForUploadedVideo(query, { sourceKey, videoUrl }) {
  if (!isHlsTranscodeConfigured()) return null;
  try {
    const started = await enqueueHlsTranscodeJob({ sourceKey, videoUrl });
    if (!started) return null;
    await query(
      `
      INSERT INTO media_hls_jobs (job_id, source_key, video_url, hls_url, playback_url, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (job_id) DO UPDATE SET
        status = EXCLUDED.status,
        playback_url = COALESCE(EXCLUDED.playback_url, media_hls_jobs.playback_url),
        updated_at = NOW()
      `,
      [
        started.jobId,
        started.sourceKey,
        String(videoUrl || ""),
        started.hlsUrl,
        started.playbackUrl || "",
        started.status || "SUBMITTED"
      ]
    );
    return started;
  } catch (error) {
    console.warn("[hls] enqueue failed:", error?.message || error);
    return null;
  }
}

async function resolveCompletedHlsUrlForVideo(query, videoUrl) {
  const url = String(videoUrl || "").trim();
  if (!url) return null;
  const res = await query(
    `
    SELECT hls_url AS "hlsUrl"
    FROM media_hls_jobs
    WHERE video_url = $1 AND status = 'COMPLETE'
    ORDER BY completed_at DESC NULLS LAST, id DESC
    LIMIT 1
    `,
    [url]
  );
  return res.rows[0]?.hlsUrl || null;
}

async function attachHlsUrlToMatchingPosts(query, { videoUrl, hlsUrl, playbackUrl }) {
  const url = String(videoUrl || "").trim();
  const hls = String(hlsUrl || "").trim();
  const playback = String(playbackUrl || "").trim();
  if (!url || (!hls && !playback)) return 0;
  const updated = await query(
    `
    UPDATE home_posts
    SET
      hls_url = CASE
        WHEN $1 <> '' AND (hls_url IS NULL OR BTRIM(hls_url) = '') THEN $1
        ELSE hls_url
      END,
      playback_url = CASE
        WHEN $3 <> '' AND (playback_url IS NULL OR BTRIM(playback_url) = '') THEN $3
        ELSE playback_url
      END
    WHERE video_url = $2
    `,
    [hls, url, playback]
  );
  return Number(updated.rowCount || 0);
}

async function pollPendingHlsJobs(query) {
  if (!isHlsTranscodeConfigured()) return { checked: 0, completed: 0 };
  const pending = await query(
    `
    SELECT job_id AS "jobId", video_url AS "videoUrl", hls_url AS "hlsUrl", playback_url AS "playbackUrl"
    FROM media_hls_jobs
    WHERE status IN ('SUBMITTED', 'PROGRESSING', 'INPUT_INFORMATION')
    ORDER BY id ASC
    LIMIT 20
    `
  );
  let completed = 0;
  for (const row of pending.rows) {
    try {
      const job = await getHlsJobStatus(row.jobId);
      const status = String(job?.Status || "").toUpperCase();
      if (!status) continue;
      if (status === "COMPLETE") {
        await query(
          `
          UPDATE media_hls_jobs
          SET status = 'COMPLETE', updated_at = NOW(), completed_at = NOW()
          WHERE job_id = $1
          `,
          [row.jobId]
        );
        await attachHlsUrlToMatchingPosts(query, {
          videoUrl: row.videoUrl,
          hlsUrl: row.hlsUrl,
          playbackUrl: row.playbackUrl
        });
        completed += 1;
      } else if (status === "ERROR" || status === "CANCELED") {
        await query(
          `
          UPDATE media_hls_jobs
          SET status = $2, updated_at = NOW()
          WHERE job_id = $1
          `,
          [row.jobId, status]
        );
      } else if (status !== String(row.status || "").toUpperCase()) {
        await query(
          `
          UPDATE media_hls_jobs
          SET status = $2, updated_at = NOW()
          WHERE job_id = $1
          `,
          [row.jobId, status]
        );
      }
    } catch (error) {
      console.warn("[hls] poll job failed:", row.jobId, error?.message || error);
    }
  }
  return { checked: pending.rows.length, completed };
}

let hlsPollTimer = null;

function startHlsJobPolling(query, intervalMs = 45_000) {
  if (!isHlsTranscodeConfigured()) return;
  if (hlsPollTimer) return;
  const tick = () => {
    void pollPendingHlsJobs(query).catch((error) => {
      console.warn("[hls] poll cycle failed:", error?.message || error);
    });
  };
  // First tick after short delay so boot isn't blocked.
  setTimeout(tick, 8_000);
  hlsPollTimer = setInterval(tick, intervalMs);
  if (typeof hlsPollTimer.unref === "function") hlsPollTimer.unref();
  console.log("[hls] MediaConvert job polling enabled");
}

module.exports = {
  isHlsTranscodeConfigured,
  hlsMasterUrlForSourceKey,
  enqueueHlsTranscodeJob,
  startHlsJobForUploadedVideo,
  resolveCompletedHlsUrlForVideo,
  attachHlsUrlToMatchingPosts,
  pollPendingHlsJobs,
  startHlsJobPolling
};
