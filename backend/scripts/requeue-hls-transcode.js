/**
 * Re-queue AWS MediaConvert HLS jobs for posts missing hls_url / playback_url.
 *
 * Usage (from backend/ with .env containing DATABASE_URL + AWS MediaConvert vars):
 *   node scripts/requeue-hls-transcode.js
 *   node scripts/requeue-hls-transcode.js --dry-run
 *   node scripts/requeue-hls-transcode.js --limit 20
 *   node scripts/requeue-hls-transcode.js --retry-failed
 *
 * Steps:
 * 1. Sync completed job URLs onto home_posts (no new transcode)
 * 2. Enqueue MediaConvert for remaining videos (480p MP4 + adaptive HLS)
 *
 * The running API server polls media_hls_jobs every ~45s and attaches URLs when jobs complete.
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const { query, pool } = require("../src/db");
const {
  isHlsTranscodeConfigured,
  requeueMissingHlsTranscodes
} = require("../src/hlsTranscode");

function readArgValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return null;
  const next = process.argv[idx + 1];
  if (!next || next.startsWith("--")) return null;
  return next;
}

async function ensureTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS media_hls_jobs (
      id SERIAL PRIMARY KEY,
      job_id TEXT NOT NULL UNIQUE,
      source_key TEXT NOT NULL,
      video_url TEXT NOT NULL,
      hls_url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'SUBMITTED',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )
  `);
  await query(`ALTER TABLE media_hls_jobs ADD COLUMN IF NOT EXISTS playback_url TEXT`);
  await query(`ALTER TABLE home_posts ADD COLUMN IF NOT EXISTS hls_url TEXT`);
  await query(`ALTER TABLE home_posts ADD COLUMN IF NOT EXISTS playback_url TEXT`);
  await query(`CREATE INDEX IF NOT EXISTS media_hls_jobs_status_idx ON media_hls_jobs (status)`);
  await query(`CREATE INDEX IF NOT EXISTS media_hls_jobs_video_url_idx ON media_hls_jobs (video_url)`);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const retryFailed = process.argv.includes("--retry-failed");
  const limitRaw = readArgValue("--limit");
  const limit = limitRaw ? Number(limitRaw) : 50;

  if (!String(process.env.DATABASE_URL || "").trim()) {
    console.error("[hls-requeue] DATABASE_URL is required in backend/.env");
    process.exit(1);
  }

  if (!isHlsTranscodeConfigured()) {
    console.error(
      "[hls-requeue] MediaConvert is not configured. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, " +
        "AWS_REGION, AWS_S3_BUCKET, AWS_MEDIA_CONVERT_ROLE_ARN, AWS_MEDIA_CONVERT_ENDPOINT."
    );
    process.exit(1);
  }

  await ensureTables();

  console.log("[hls-requeue] starting", {
    dryRun,
    retryFailed,
    limit: Number.isFinite(limit) ? limit : 50
  });

  const results = await requeueMissingHlsTranscodes(query, {
    dryRun,
    retryFailed,
    limit: Number.isFinite(limit) ? limit : 50
  });

  console.log("[hls-requeue] synced posts from completed jobs:", results.syncedPosts);
  console.log("[hls-requeue] scanned:", results.scanned);
  console.log("[hls-requeue] queued:", results.queued);
  console.log("[hls-requeue] skipped:", results.skipped);

  if (results.items.length) {
    console.log("[hls-requeue] items:");
    for (const item of results.items) {
      console.log(" ", JSON.stringify(item));
    }
  }

  if (results.errors.length) {
    console.warn("[hls-requeue] errors:");
    for (const err of results.errors) {
      console.warn(" ", JSON.stringify(err));
    }
  }

  if (!dryRun && results.queued > 0) {
    console.log(
      "[hls-requeue] Jobs submitted. Keep the API server running (or run poll manually) — " +
        "posts update when MediaConvert status becomes COMPLETE."
    );
  }
}

main()
  .catch((error) => {
    console.error("[hls-requeue] failed:", error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await pool.end();
    } catch {
      // ignore pool shutdown errors
    }
  });
