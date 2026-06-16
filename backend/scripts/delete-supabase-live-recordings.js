/**
 * Deletes LiveKit live replay files from Supabase Storage (live/* prefix).
 * Optionally removes video files linked to [LIVE] posts in the database.
 *
 * Does NOT delete agrovibes/videos/* reel uploads.
 *
 * Usage (from backend/ with .env containing SUPABASE_* and optional DATABASE_URL):
 *   node scripts/delete-supabase-live-recordings.js
 *   node scripts/delete-supabase-live-recordings.js --include-live-post-videos
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const { Pool } = require("pg");
const {
  isSupabaseStorageConfigured,
  listStorageFilesUnderPrefix,
  deleteStorageObjectPaths,
  publicUrlToObjectPath,
  readSupabaseStorageConfig
} = require("../src/supabaseStorage");

const includeLivePostVideos = process.argv.includes("--include-live-post-videos");

async function loadLivePostVideoPaths(bucket) {
  const dbUrl = String(process.env.DATABASE_URL || "").trim();
  if (!dbUrl) {
    console.warn("[cleanup] DATABASE_URL not set — skipping DB live post video paths");
    return [];
  }
  const pool = new Pool({ connectionString: dbUrl });
  try {
    const { rows } = await pool.query(
      `
      SELECT id, video_url AS "videoUrl"
      FROM home_posts
      WHERE video_url IS NOT NULL
        AND TRIM(video_url) <> ''
        AND caption ~* '^\\[LIVE\\]'
      `
    );
    const paths = [];
    for (const row of rows) {
      const objectPath = publicUrlToObjectPath(row.videoUrl, bucket);
      if (objectPath) paths.push(objectPath);
    }
    return paths;
  } finally {
    await pool.end();
  }
}

async function main() {
  if (!isSupabaseStorageConfigured()) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env");
    process.exit(1);
  }

  const cfg = readSupabaseStorageConfig();
  console.log("[cleanup] bucket:", cfg.bucket);

  const toDelete = new Set();

  console.log("[cleanup] listing live/* ...");
  const liveFiles = await listStorageFilesUnderPrefix("live");
  liveFiles.forEach((p) => toDelete.add(p));
  console.log("[cleanup] live/* files:", liveFiles.length);

  if (includeLivePostVideos) {
    const dbPaths = await loadLivePostVideoPaths(cfg.bucket);
    dbPaths.forEach((p) => toDelete.add(p));
    console.log("[cleanup] [LIVE] post video paths from DB:", dbPaths.length);
  }

  const paths = Array.from(toDelete);
  if (paths.length === 0) {
    console.log("[cleanup] nothing to delete");
    return;
  }

  console.log("[cleanup] deleting", paths.length, "object(s) ...");
  const result = await deleteStorageObjectPaths(paths);
  console.log("[cleanup] deleted:", result.deleted);
  if (result.errors.length) {
    console.warn("[cleanup] errors:", result.errors);
  }

  const dbUrl = String(process.env.DATABASE_URL || "").trim();
  if (dbUrl && includeLivePostVideos) {
    const pool = new Pool({ connectionString: dbUrl });
    try {
      const updated = await pool.query(
        `
        UPDATE home_posts
        SET video_url = NULL
        WHERE caption ~* '^\\[LIVE\\]'
          AND video_url IS NOT NULL
        `
      );
      console.log("[cleanup] cleared video_url on live posts:", updated.rowCount);
    } finally {
      await pool.end();
    }
  }

  console.log(
    "\nNote: Deleting files frees storage but does NOT reset Cached Egress quota.\n" +
      "Home reels still need Supabase billing/quota fixed (402) to play again.\n" +
      "Live egress save is already commented in the API — see RESTORE WHEN SUPABASE PAID."
  );
}

main().catch((err) => {
  console.error("[cleanup] failed:", err.message || err);
  process.exit(1);
});
